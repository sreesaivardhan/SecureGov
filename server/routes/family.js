'use strict';

const express  = require('express');
const crypto   = require('crypto');
const mongoose = require('mongoose');
const router   = express.Router();

const { verifyToken }                  = require('../middleware/auth');
const FamilyGroup                      = require('../models/FamilyGroup');
const { sendFamilyInvitationEmail }    = require('../services/emailService');

// ─── Helpers ──────────────────────────────────────────────────────────────────

const INVITATION_TTL_MS  = 7 * 24 * 60 * 60 * 1000; // 7 days
const VALID_INVITE_ROLES = new Set(['member', 'viewer']);

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function toPublicGroup(group, uid) {
  return {
    id:          group._id,
    name:        group.name,
    createdBy:   group.createdBy,
    status:      group.status,
    memberCount: group.members.filter((m) => m.uid !== uid).length,
    myRole:      (group.members.find((m) => m.uid === uid) || {}).role || null,
    members:     group.members.map((m) => ({
      uid:         m.uid,
      email:       m.email,
      displayName: m.displayName,
      role:        m.role,
      joinedAt:    m.joinedAt,
    })),
    createdAt:   group.createdAt,
    updatedAt:   group.updatedAt,
  };
}

/** Return all groups where this uid is an active member */
async function getMyGroups(uid) {
  return FamilyGroup.find({ 'members.uid': uid, status: 'active' });
}

// ─── POST /api/family/groups ──────────────────────────────────────────────────

router.post('/groups', verifyToken, async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Group name is required.' });
  }

  const { uid, email, name: userName } = req.user;

  const group = await FamilyGroup.create({
    name:      name.trim(),
    createdBy: uid,
    members: [{
      uid,
      email,
      displayName: userName || email.split('@')[0],
      role:        'admin',
    }],
  });

  return res.status(201).json({ success: true, group: toPublicGroup(group, uid) });
});

// ─── GET /api/family/groups ───────────────────────────────────────────────────

router.get('/groups', verifyToken, async (req, res) => {
  const { uid } = req.user;
  const groups  = await getMyGroups(uid);
  return res.json({
    success: true,
    total:   groups.length,
    groups:  groups.map((g) => toPublicGroup(g, uid)),
  });
});

// ─── GET /api/family/members ──────────────────────────────────────────────────
// Flattened, deduplicated list of all family members across the user's groups.

router.get('/members', verifyToken, async (req, res) => {
  const { uid } = req.user;
  const groups  = await getMyGroups(uid);

  const memberMap = new Map(); // uid → member object
  groups.forEach((group) => {
    group.members.forEach((m) => {
      if (m.uid !== uid && !memberMap.has(m.uid)) {
        memberMap.set(m.uid, {
          uid:         m.uid,
          email:       m.email,
          displayName: m.displayName,
          role:        m.role,
          joinedAt:    m.joinedAt,
        });
      }
    });
  });

  const members = [...memberMap.values()];
  return res.json({ success: true, total: members.length, members });
});

// ─── GET /api/family/count ────────────────────────────────────────────────────

router.get('/count', verifyToken, async (req, res) => {
  const { uid } = req.user;
  const groups  = await getMyGroups(uid);

  const uids = new Set();
  groups.forEach((g) => g.members.forEach((m) => { if (m.uid !== uid) uids.add(m.uid); }));

  return res.json({ success: true, count: uids.size });
});

// ─── POST /api/family/invite ──────────────────────────────────────────────────

router.post('/invite', verifyToken, async (req, res) => {
  const { email, groupId, role = 'member' } = req.body;

  // ── Validate inputs ───────────────────────────────────────────────────────
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ success: false, message: 'Valid email is required.' });
  }
  if (!groupId || !mongoose.Types.ObjectId.isValid(groupId)) {
    return res.status(400).json({ success: false, message: 'Valid groupId is required.' });
  }
  if (!VALID_INVITE_ROLES.has(role)) {
    return res.status(400).json({ success: false, message: 'role must be "member" or "viewer".' });
  }

  const { uid, email: inviterEmail, name: inviterName } = req.user;
  const normalizedEmail = email.toLowerCase().trim();

  // ── Load group ────────────────────────────────────────────────────────────
  const group = await FamilyGroup.findOne({ _id: groupId, status: 'active' });
  if (!group) {
    return res.status(404).json({ success: false, message: 'Family group not found.' });
  }

  // ── Caller must be admin ──────────────────────────────────────────────────
  const caller = group.members.find((m) => m.uid === uid);
  if (!caller || caller.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Only group admins can invite.' });
  }

  // ── Cannot invite yourself ────────────────────────────────────────────────
  if (normalizedEmail === inviterEmail.toLowerCase()) {
    return res.status(400).json({ success: false, message: 'You cannot invite yourself.' });
  }

  // ── Already a member? ─────────────────────────────────────────────────────
  const alreadyMember = group.members.some((m) => m.email === normalizedEmail);
  if (alreadyMember) {
    return res.status(409).json({ success: false, message: 'This person is already a member.' });
  }

  // ── Already has a pending invitation? ─────────────────────────────────────
  const existingPending = group.invitations.find(
    (inv) => inv.email === normalizedEmail && inv.status === 'pending'
  );
  if (existingPending) {
    return res.status(409).json({ success: false, message: 'A pending invitation already exists for this email.' });
  }

  // ── Create invitation ─────────────────────────────────────────────────────
  const token     = generateToken();
  const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);
  const displayName = inviterName || inviterEmail.split('@')[0];

  group.invitations.push({
    email:         normalizedEmail,
    token,
    role,
    invitedBy:     uid,
    invitedByName: displayName,
    expiresAt,
  });
  await group.save();

  // ── Send email ────────────────────────────────────────────────────────────
  const base       = process.env.FRONTEND_URL || 'http://localhost:3000';
  const acceptUrl  = `${base}/pages/accept-invitation.html?token=${token}&action=accept`;
  const rejectUrl  = `${base}/pages/accept-invitation.html?token=${token}&action=reject`;

  const emailResult = await sendFamilyInvitationEmail({
    to:          normalizedEmail,
    inviterName: displayName,
    groupName:   group.name,
    acceptUrl,
    rejectUrl,
  });

  return res.status(201).json({
    success: true,
    message: emailResult.sent
      ? `Invitation email sent to ${normalizedEmail}.`
      : `Invitation created. Email not configured — use the console URLs above to test.`,
    invitation: {
      email,
      role,
      groupId:   group._id,
      groupName: group.name,
      token,      // include token in response for easier testing without email
      expiresAt,
      emailSent:  emailResult.sent,
    },
  });
});

// ─── GET /api/family/invitations ──────────────────────────────────────────────

router.get('/invitations', verifyToken, async (req, res) => {
  const { uid, email } = req.user;
  const normalizedEmail = email.toLowerCase();

  // Find groups with invitations related to current user
  const groups = await FamilyGroup.find({
    status: 'active',
    $or: [
      { 'invitations.invitedBy': uid },           // invitations SENT by me
      { 'invitations.email': normalizedEmail },   // invitations RECEIVED by me
    ],
  });

  const invitations = [];
  groups.forEach((group) => {
    group.invitations.forEach((inv) => {
      const isSent     = inv.invitedBy === uid;
      const isReceived = inv.email === normalizedEmail;
      if (!isSent && !isReceived) return;

      invitations.push({
        token:         inv.token,
        email:         inv.email,
        role:          inv.role,
        status:        inv.status,
        groupId:       group._id,
        groupName:     group.name,
        invitedBy:     inv.invitedBy,
        invitedByName: inv.invitedByName,
        expiresAt:     inv.expiresAt,
        respondedAt:   inv.respondedAt,
        createdAt:     inv.createdAt,
        direction:     isSent ? 'sent' : 'received',
      });
    });
  });

  // Sort newest first
  invitations.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return res.json({ success: true, total: invitations.length, invitations });
});

// ─── POST /api/family/accept/:token ──────────────────────────────────────────

router.post('/accept/:token', verifyToken, async (req, res) => {
  const { token } = req.params;
  const { uid, email, name } = req.user;

  const group = await FamilyGroup.findOne({ 'invitations.token': token, status: 'active' });
  if (!group) {
    return res.status(404).json({ success: false, message: 'Invitation not found or group inactive.' });
  }

  const invitation = group.invitations.find((inv) => inv.token === token);

  // ── Validate ──────────────────────────────────────────────────────────────
  if (invitation.status !== 'pending') {
    return res.status(409).json({ success: false, message: `Invitation already ${invitation.status}.` });
  }
  if (new Date() > invitation.expiresAt) {
    invitation.status = 'expired';
    await group.save();
    return res.status(410).json({ success: false, message: 'Invitation has expired.' });
  }
  if (invitation.email !== email.toLowerCase()) {
    return res.status(403).json({ success: false, message: 'This invitation is not for your email address.' });
  }

  // ── Already a member? ─────────────────────────────────────────────────────
  const alreadyMember = group.members.some((m) => m.uid === uid);
  if (alreadyMember) {
    invitation.status      = 'accepted';
    invitation.respondedAt = new Date();
    await group.save();
    return res.json({ success: true, message: 'Already a member of this group.' });
  }

  // ── Add member + mark accepted ────────────────────────────────────────────
  group.members.push({
    uid,
    email:       email.toLowerCase(),
    displayName: name || email.split('@')[0],
    role:        invitation.role,
  });
  invitation.status      = 'accepted';
  invitation.respondedAt = new Date();
  await group.save();

  return res.json({
    success: true,
    message: `You have joined "${group.name}" as ${invitation.role}.`,
    group:   toPublicGroup(group, uid),
  });
});

// ─── POST /api/family/reject/:token ──────────────────────────────────────────

router.post('/reject/:token', verifyToken, async (req, res) => {
  const { token } = req.params;
  const { email } = req.user;

  const group = await FamilyGroup.findOne({ 'invitations.token': token, status: 'active' });
  if (!group) {
    return res.status(404).json({ success: false, message: 'Invitation not found or group inactive.' });
  }

  const invitation = group.invitations.find((inv) => inv.token === token);

  if (invitation.status !== 'pending') {
    return res.status(409).json({ success: false, message: `Invitation already ${invitation.status}.` });
  }
  if (invitation.email !== email.toLowerCase()) {
    return res.status(403).json({ success: false, message: 'This invitation is not for your email address.' });
  }

  invitation.status      = 'rejected';
  invitation.respondedAt = new Date();
  await group.save();

  return res.json({ success: true, message: 'Invitation declined.' });
});

// ─── DELETE /api/family/groups/:groupId/members/:memberUid ───────────────────

router.delete('/groups/:groupId/members/:memberUid', verifyToken, async (req, res) => {
  const { groupId, memberUid } = req.params;
  const { uid }                = req.user;

  if (!mongoose.Types.ObjectId.isValid(groupId)) {
    return res.status(400).json({ success: false, message: 'Invalid group ID.' });
  }

  const group = await FamilyGroup.findOne({ _id: groupId, status: 'active' });
  if (!group) {
    return res.status(404).json({ success: false, message: 'Group not found.' });
  }

  // Only admins can remove members
  const caller = group.members.find((m) => m.uid === uid);
  if (!caller || caller.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Only admins can remove members.' });
  }

  const target = group.members.find((m) => m.uid === memberUid);
  if (!target) {
    return res.status(404).json({ success: false, message: 'Member not found in this group.' });
  }

  // Sole admin cannot remove themselves
  if (memberUid === uid) {
    const adminCount = group.members.filter((m) => m.role === 'admin').length;
    if (adminCount <= 1) {
      return res.status(400).json({
        success: false,
        message: 'You are the only admin. Promote another member before leaving.',
      });
    }
  }

  group.members = group.members.filter((m) => m.uid !== memberUid);
  await group.save();

  return res.json({ success: true, message: 'Member removed from group.' });
});

// ─── DELETE /api/family/groups/:groupId ──────────────────────────────────────
// Soft-deletes a group. Only the group creator/sole-admin can do this.
// Blocked if the group has other members (to avoid orphaning shared docs).

router.delete('/groups/:groupId', verifyToken, async (req, res) => {
  const { groupId } = req.params;
  const { uid }     = req.user;

  if (!mongoose.Types.ObjectId.isValid(groupId)) {
    return res.status(400).json({ success: false, message: 'Invalid group ID.' });
  }

  const group = await FamilyGroup.findOne({ _id: groupId, status: 'active' });
  if (!group) {
    return res.status(404).json({ success: false, message: 'Group not found.' });
  }

  // Only admins can delete
  const caller = group.members.find((m) => m.uid === uid);
  if (!caller || caller.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Only group admins can delete this group.' });
  }

  // Block if other members are still in the group
  const otherMembers = group.members.filter((m) => m.uid !== uid);
  if (otherMembers.length > 0) {
    return res.status(409).json({
      success: false,
      message: `Remove all ${otherMembers.length} member${otherMembers.length !== 1 ? 's' : ''} before deleting this group.`,
    });
  }

  group.status = 'archived';
  await group.save();

  return res.json({ success: true, message: `Group "${group.name}" has been deleted.` });
});

module.exports = router;
