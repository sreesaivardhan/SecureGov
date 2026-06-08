'use strict';

const mongoose = require('mongoose');

// ─── Sub-schemas ──────────────────────────────────────────────────────────────

/**
 * One entry per user this document is shared with.
 * permission: 'read' = view/download only, 'write' = can also delete
 */
const sharedWithSchema = new mongoose.Schema(
  {
    uid:        { type: String, required: true },
    email:      { type: String, required: true, lowercase: true, trim: true },
    permission: { type: String, enum: ['read', 'write'], default: 'read' },
  },
  { _id: false }
);

// ─── Main Schema ──────────────────────────────────────────────────────────────

/**
 * Document
 *
 * Files are stored in Firebase Storage.
 * This collection holds metadata only — no base64 blobs.
 *
 * firebaseStoragePath  = the path inside the bucket (used for deletion)
 * firebaseUrl          = public / signed URL returned to the client
 * uploadedBy           = Firebase UID of the owner
 */
const documentSchema = new mongoose.Schema(
  {
    title: {
      type:     String,
      required: true,
      trim:     true,
    },
    category: {
      type:    String,
      enum:    [
        'aadhaar', 'pan', 'passport', 'driving_license',
        'marksheet', 'certificate', 'medical', 'financial', 'other',
      ],
      default: 'other',
    },
    description: {
      type:    String,
      trim:    true,
      default: '',
    },

    // ── Firebase Storage ──────────────────────────────────────────────────────
    firebaseStoragePath: { type: String, required: true },  // for deletion
    firebaseUrl:         { type: String, required: true },  // signed URL cached at upload time

    // ── File metadata ─────────────────────────────────────────────────────────
    mimeType: { type: String, required: true },
    fileSize: { type: Number, required: true }, // bytes

    // ── Ownership & sharing ───────────────────────────────────────────────────
    uploadedBy: { type: String, required: true, index: true }, // Firebase UID
    sharedWith: { type: [sharedWithSchema], default: [] },

    // ── Lifecycle ─────────────────────────────────────────────────────────────
    status:       { type: String, enum: ['active', 'deleted'], default: 'active', index: true },
    uploadDate:   { type: Date, default: Date.now },
    lastModified: { type: Date, default: Date.now },
  },
  { timestamps: false } // we manage uploadDate / lastModified manually
);

// Compound index for the most common list query: "my active docs"
documentSchema.index({ uploadedBy: 1, status: 1, uploadDate: -1 });
// For shared-with queries
documentSchema.index({ 'sharedWith.uid': 1, status: 1 });

module.exports = mongoose.model('Document', documentSchema);