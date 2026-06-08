'use strict';

const express    = require('express');
const router     = express.Router();
const { verifyToken } = require('../middleware/auth');
const User       = require('../models/User');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toPublic(user) {
  return {
    id:         user._id,
    firebaseUID: user.firebaseUID,
    email:      user.email,
    name:       user.name,
    phone:      user.phone,
    address:    user.address,
    createdAt:  user.createdAt,
    updatedAt:  user.updatedAt,
  };
}

// ─── GET /api/profile ─────────────────────────────────────────────────────────
/**
 * Fetch the current user's profile.
 * If the user hasn't synced yet, we return a 404 with a clear message.
 */
router.get('/', verifyToken, async (req, res) => {
  const user = await User.findOne({ firebaseUID: req.user.uid });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'Profile not found. Please complete account setup.',
    });
  }

  return res.json({ success: true, profile: toPublic(user) });
});

// ─── PUT /api/profile ─────────────────────────────────────────────────────────
/**
 * Update mutable profile fields: name, phone, address.
 * email is read-only (managed by Firebase Auth).
 * Ignores unknown fields — only the three allowed fields are patched.
 */
router.put('/', verifyToken, async (req, res) => {
  const { name, phone, address } = req.body;

  const patch = {};
  if (name    !== undefined) patch.name    = String(name).trim();
  if (phone   !== undefined) patch.phone   = String(phone).trim();
  if (address !== undefined) patch.address = String(address).trim();

  if (Object.keys(patch).length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Nothing to update. Send at least one of: name, phone, address.',
    });
  }

  const user = await User.findOneAndUpdate(
    { firebaseUID: req.user.uid },
    { $set: patch },
    { new: true, runValidators: true }
  );

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User not found. Call POST /api/auth/sync to create your account.',
    });
  }

  return res.json({
    success: true,
    message: 'Profile updated successfully',
    profile: toPublic(user),
  });
});

module.exports = router;
