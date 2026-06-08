'use strict';

const express   = require('express');
const multer    = require('multer');
const mongoose  = require('mongoose');
const router    = express.Router();

const { verifyToken }                         = require('../middleware/auth');
const Document                                = require('../models/Document');
const FamilyGroup                             = require('../models/FamilyGroup');
const { uploadFile, getSignedUrl, deleteFile } = require('../services/firebaseStorage');

// ─── Multer setup ─────────────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
]);

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: MAX_SIZE_BYTES },
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true);
    } else {
      // Passing an error here causes multer to call next(err)
      cb(Object.assign(
        new Error('Only PDF, JPG, and PNG files are allowed.'),
        { status: 400 }
      ));
    }
  },
});

// ─── Valid categories (must match Document model enum) ────────────────────────

const VALID_CATEGORIES = new Set([
  'aadhaar', 'pan', 'passport', 'driving_license',
  'marksheet', 'certificate', 'medical', 'financial', 'other',
]);

// ─── Helper ───────────────────────────────────────────────────────────────────

/**
 * Strip internal fields before sending a document to the client.
 * firebaseStoragePath stays server-side — clients use /download to get a URL.
 */
function toPublic(doc) {
  return {
    id:           doc._id,
    title:        doc.title,
    category:     doc.category,
    description:  doc.description,
    mimeType:     doc.mimeType,
    fileSize:     doc.fileSize,
    uploadedBy:   doc.uploadedBy,
    sharedWith:   doc.sharedWith,
    status:       doc.status,
    uploadDate:   doc.uploadDate,
    lastModified: doc.lastModified,
  };
}

/** Sanitize a filename for safe use in a storage path */
function sanitizeName(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

// ─── POST /api/documents/upload ───────────────────────────────────────────────

router.post(
  '/upload',
  verifyToken,
  upload.single('file'),           // multer processes multipart BEFORE the handler
  async (req, res) => {
    const { title, category, description } = req.body;

    // Field validation
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'File is required.' });
    }
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'title is required.' });
    }
    if (!category || !VALID_CATEGORIES.has(category)) {
      return res.status(400).json({
        success: false,
        message: `category must be one of: ${[...VALID_CATEGORIES].join(', ')}`,
      });
    }

    const { uid }        = req.user;
    const timestamp      = Date.now();
    const safeName       = sanitizeName(req.file.originalname);
    const destination    = `documents/${uid}/${timestamp}-${safeName}`;

    // Upload to Firebase Storage
    const { path: storagePath, url } = await uploadFile(
      req.file.buffer,
      destination,
      req.file.mimetype
    );

    // Persist metadata in MongoDB
    const doc = await Document.create({
      title:               title.trim(),
      category,
      description:         description ? description.trim() : '',
      firebaseStoragePath: storagePath,
      firebaseUrl:         url,
      mimeType:            req.file.mimetype,
      fileSize:            req.file.size,
      uploadedBy:          uid,
    });

    return res.status(201).json({ success: true, document: toPublic(doc) });
  }
);

// ─── GET /api/documents ───────────────────────────────────────────────────────

router.get('/', verifyToken, async (req, res) => {
  const { uid }             = req.user;
  const { category, search } = req.query;

  const filter = { uploadedBy: uid, status: 'active' };

  if (category) {
    if (!VALID_CATEGORIES.has(category)) {
      return res.status(400).json({ success: false, message: 'Invalid category filter.' });
    }
    filter.category = category;
  }

  if (search && search.trim()) {
    // Case-insensitive title search
    filter.title = { $regex: search.trim(), $options: 'i' };
  }

  const docs = await Document.find(filter).sort({ uploadDate: -1 });

  return res.json({
    success:   true,
    total:     docs.length,
    documents: docs.map(toPublic),
  });
});

// ─── GET /api/documents/stats ─────────────────────────────────────────────────
// ⚠️  Must be registered BEFORE /:id routes so "stats" is not treated as an id.

router.get('/stats', verifyToken, async (req, res) => {
  const { uid } = req.user;

  // Lean projection — only pull the fields we need
  const docs = await Document
    .find({ uploadedBy: uid, status: 'active' })
    .select('fileSize category')
    .lean();

  const totalSizeBytes = docs.reduce((sum, d) => sum + d.fileSize, 0);

  // Build category breakdown
  const categoryMap = {};
  docs.forEach((d) => {
    categoryMap[d.category] = (categoryMap[d.category] || 0) + 1;
  });
  const categories = Object.entries(categoryMap)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return res.json({
    success: true,
    stats: {
      totalDocs:      docs.length,
      totalSizeBytes,
      totalSizeMB:    parseFloat((totalSizeBytes / (1024 * 1024)).toFixed(2)),
      categories,
    },
  });
});

// ─── GET /api/documents/:id/download ─────────────────────────────────────────

router.get('/:id/download', verifyToken, async (req, res) => {
  const { uid } = req.user;
  const { id }  = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid document ID.' });
  }

  const doc = await Document.findOne({ _id: id, status: 'active' });
  if (!doc) {
    return res.status(404).json({ success: false, message: 'Document not found.' });
  }

  // Access control: owner OR shared with this user
  const isOwner  = doc.uploadedBy === uid;
  const isShared = doc.sharedWith.some((s) => s.uid === uid);

  if (!isOwner && !isShared) {
    return res.status(403).json({ success: false, message: 'Access denied.' });
  }

  // Always generate a fresh signed URL — the stored one may have expired
  const url      = await getSignedUrl(doc.firebaseStoragePath);
  const filename = sanitizeName(doc.title);

  return res.json({
    success:  true,
    url,
    filename,
    mimeType: doc.mimeType,
    fileSize: doc.fileSize,
  });
});

// ─── DELETE /api/documents/:id ────────────────────────────────────────────────

router.delete('/:id', verifyToken, async (req, res) => {
  const { uid } = req.user;
  const { id }  = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid document ID.' });
  }

  const doc = await Document.findOne({ _id: id, status: 'active' });
  if (!doc) {
    return res.status(404).json({ success: false, message: 'Document not found.' });
  }

  // Only the owner can delete
  if (doc.uploadedBy !== uid) {
    return res.status(403).json({ success: false, message: 'Only the document owner can delete it.' });
  }

  // Delete from Firebase Storage first (idempotent — won't crash if already gone)
  await deleteFile(doc.firebaseStoragePath);

  // Soft delete in MongoDB
  doc.status       = 'deleted';
  doc.lastModified = new Date();
  await doc.save();

  return res.json({ success: true, message: 'Document deleted successfully.' });
});

// ─── GET /api/documents/shared-with-me ─────────────────────────────────────────────
// NOTE: registered BEFORE /:id/* routes so this path is not captured as an :id

router.get('/shared-with-me', verifyToken, async (req, res) => {
  const { uid } = req.user;

  const docs = await Document
    .find({ 'sharedWith.uid': uid, status: 'active' })
    .sort({ uploadDate: -1 });

  return res.json({
    success:   true,
    total:     docs.length,
    documents: docs.map(toPublic),
  });
});

// ─── POST /api/documents/:id/share ──────────────────────────────────────────────────

router.post('/:id/share', verifyToken, async (req, res) => {
  const { uid } = req.user;
  const { id }  = req.params;
  const { targetUid } = req.body;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid document ID.' });
  }
  if (!targetUid || typeof targetUid !== 'string') {
    return res.status(400).json({ success: false, message: 'targetUid is required.' });
  }
  if (targetUid === uid) {
    return res.status(400).json({ success: false, message: 'You cannot share a document with yourself.' });
  }

  // Load the document
  const doc = await Document.findOne({ _id: id, status: 'active' });
  if (!doc) {
    return res.status(404).json({ success: false, message: 'Document not found.' });
  }
  if (doc.uploadedBy !== uid) {
    return res.status(403).json({ success: false, message: 'Only the document owner can share it.' });
  }

  // Verify targetUid is a member of at least one of the owner's family groups
  const ownerGroups = await FamilyGroup.find({ 'members.uid': uid, status: 'active' });

  let targetEmail = null;
  for (const group of ownerGroups) {
    const member = group.members.find((m) => m.uid === targetUid);
    if (member) { targetEmail = member.email; break; }
  }

  if (!targetEmail) {
    return res.status(403).json({
      success: false,
      message: 'targetUid is not a member of any of your family groups.',
    });
  }

  // Prevent duplicate share
  const alreadyShared = doc.sharedWith.some((s) => s.uid === targetUid);
  if (alreadyShared) {
    return res.status(409).json({ success: false, message: 'Document is already shared with this user.' });
  }

  // Sharing is read-only for MVP
  doc.sharedWith.push({ uid: targetUid, email: targetEmail, permission: 'read' });
  doc.lastModified = new Date();
  await doc.save();

  return res.json({
    success:  true,
    message:  `Document shared with ${targetEmail}.`,
    document: toPublic(doc),
  });
});

// ─── DELETE /api/documents/:id/share/:uid ────────────────────────────────────
// Revoke sharing access from a specific user.

router.delete('/:id/share/:uid', verifyToken, async (req, res) => {
  const { uid: requesterUid } = req.user;
  const { id, uid: targetUid } = req.params;

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(400).json({ success: false, message: 'Invalid document ID.' });
  }

  const doc = await Document.findOne({ _id: id, status: 'active' });
  if (!doc) {
    return res.status(404).json({ success: false, message: 'Document not found.' });
  }

  // Only the owner can revoke access
  if (doc.uploadedBy !== requesterUid) {
    return res.status(403).json({ success: false, message: 'Only the document owner can revoke sharing.' });
  }

  const before = doc.sharedWith.length;
  doc.sharedWith    = doc.sharedWith.filter((s) => s.uid !== targetUid);
  doc.lastModified  = new Date();

  if (doc.sharedWith.length === before) {
    return res.status(404).json({ success: false, message: 'User does not have access to this document.' });
  }

  await doc.save();

  return res.json({ success: true, message: 'Access revoked.', document: toPublic(doc) });
});

module.exports = router;