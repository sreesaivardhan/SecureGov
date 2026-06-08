'use strict';

const mongoose = require('mongoose');

/**
 * User
 *
 * Minimal schema — we intentionally keep this flat and small.
 * Government ID fields (Aadhaar, PAN) are out of scope for v2 MVP.
 *
 * firebaseUID is the single source of truth for identity.
 * email is mirrored from Firebase for display / family matching.
 */
const userSchema = new mongoose.Schema(
  {
    firebaseUID: {
      type:     String,
      required: true,
      unique:   true,
      index:    true,
      trim:     true,
    },
    email: {
      type:      String,
      required:  true,
      lowercase: true,
      trim:      true,
    },
    name: {
      type:    String,
      trim:    true,
      default: '',
    },
    phone: {
      type:    String,
      trim:    true,
      default: '',
    },
    address: {
      type:    String,
      trim:    true,
      default: '',
    },
  },
  {
    timestamps: true, // adds createdAt, updatedAt automatically
  }
);

module.exports = mongoose.model('User', userSchema);
