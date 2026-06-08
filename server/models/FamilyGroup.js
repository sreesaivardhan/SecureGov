'use strict';

const mongoose = require('mongoose');

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

const memberSchema = new mongoose.Schema(
  {
    uid:         { type: String, required: true },
    email:       { type: String, required: true, lowercase: true, trim: true },
    displayName: { type: String, trim: true, default: '' },
    role: {
      type:    String,
      enum:    ['admin', 'member', 'viewer'],
      default: 'member',
    },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const invitationSchema = new mongoose.Schema(
  {
    email:  { type: String, required: true, lowercase: true, trim: true },
    token:  { type: String, required: true },    // crypto.randomBytes(32).toString('hex')
    role: {
      type:    String,
      enum:    ['member', 'viewer'],             // admin cannot be invited — only promoted
      default: 'member',
    },
    status: {
      type:    String,
      enum:    ['pending', 'accepted', 'rejected', 'expired'],
      default: 'pending',
    },
    invitedBy:     { type: String, required: true },  // Firebase UID of the inviter
    invitedByName: { type: String, default: '' },     // Display name for emails
    expiresAt:     { type: Date, required: true },    // createdAt + 7 days
    respondedAt:   { type: Date, default: null },     // set on accept/reject
    createdAt:     { type: Date, default: Date.now },
  },
  { _id: false }
);

// ─── Main Schema ──────────────────────────────────────────────────────────────

const familyGroupSchema = new mongoose.Schema(
  {
    name:        { type: String, required: true, trim: true },
    createdBy:   { type: String, required: true },           // Firebase UID
    members:     { type: [memberSchema],     default: [] },
    invitations: { type: [invitationSchema], default: [] },
    status:      { type: String, enum: ['active', 'archived'], default: 'active' },
  },
  { timestamps: true }
);

familyGroupSchema.index({ createdBy: 1, status: 1 });
familyGroupSchema.index({ 'members.uid': 1 });
familyGroupSchema.index({ 'invitations.token': 1 }); // critical: fast token lookup on accept/reject

module.exports = mongoose.model('FamilyGroup', familyGroupSchema);
