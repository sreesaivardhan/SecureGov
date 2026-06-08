'use strict';

const express    = require('express');
const router     = express.Router();
const { verifyToken } = require('../middleware/auth');
const User       = require('../models/User');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Return only the fields we want to expose to the client.
 * Never leak internal Mongoose fields or future sensitive additions.
 */
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

// ─── POST /api/auth/sync ──────────────────────────────────────────────────────
/**
 * Called by the frontend immediately after Firebase login.
 * Creates the user in MongoDB if this is their first login,
 * or updates email / name if they have changed in Firebase.
 *
 * Body (optional): { name, phone }
 */
router.post('/sync', verifyToken, async (req, res) => {
  const { uid, email } = req.user;
  const { name, phone } = req.body;

  // Build the $set payload — only include fields that were sent
  const fields = { email }; // always keep email in sync with Firebase
  if (name  && typeof name  === 'string') fields.name  = name.trim();
  if (phone && typeof phone === 'string') fields.phone = phone.trim();

  const user = await User.findOneAndUpdate(
    { firebaseUID: uid },
    {
      $set:         fields,
      $setOnInsert: { firebaseUID: uid }, // only written on first-time insert
    },
    { upsert: true, new: true, runValidators: true }
  );

  return res.status(200).json({ success: true, user: toPublic(user) });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
/**
 * Returns the current user's MongoDB record.
 * Used on page load to hydrate the UI.
 * Returns 404 if the user has never synced (edge case — client should sync first).
 */
router.get('/me', verifyToken, async (req, res) => {
  const user = await User.findOne({ firebaseUID: req.user.uid });

  if (!user) {
    return res.status(404).json({
      success: false,
      message: 'User record not found. Call POST /api/auth/sync first.',
    });
  }

  return res.json({ success: true, user: toPublic(user) });
});

module.exports = router;