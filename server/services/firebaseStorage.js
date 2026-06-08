'use strict';

/**
 * firebaseStorage.js
 *
 * Thin wrapper around Firebase Admin Storage.
 * All functions throw on failure — callers decide how to handle errors.
 *
 * ── IAM note ─────────────────────────────────────────────────────────────────
 * getSignedUrl() requires the service account to have the
 * "Service Account Token Creator" IAM role in Google Cloud Console.
 * If you get a "SigningError / IAM API has not been used" error:
 *   1. Go to Google Cloud Console → IAM & Admin → IAM
 *   2. Find your service account email
 *   3. Grant it the "Service Account Token Creator" role
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { getStorageBucket } = require('../config/firebase');

const SIGNED_URL_TTL_MS = 72 * 60 * 60 * 1000; // 72 hours

/**
 * Upload a file buffer to Firebase Storage.
 *
 * @param {Buffer}  fileBuffer   Raw file content
 * @param {string}  destination  Storage path, e.g. "documents/uid/123-file.pdf"
 * @param {string}  mimeType     e.g. "application/pdf"
 * @returns {{ path: string, url: string }}
 */
async function uploadFile(fileBuffer, destination, mimeType) {
  try {
    const bucket = getStorageBucket();
    const file   = bucket.file(destination);

    await file.save(fileBuffer, {
      metadata:   { contentType: mimeType },
      resumable:  false, // direct upload is faster for files < 5 MB
    });

    const [url] = await file.getSignedUrl({
      action:  'read',
      expires: Date.now() + SIGNED_URL_TTL_MS,
    });

    return { path: destination, url };
  } catch (err) {
    throw new Error(`Storage upload failed: ${err.message}`);
  }
}

/**
 * Generate a fresh signed URL for an existing file.
 * Call this every time a user requests a download — the cached URL in MongoDB
 * may have expired.
 *
 * @param {string} storagePath  e.g. "documents/uid/123-file.pdf"
 * @returns {string}  Time-limited signed URL
 */
async function getSignedUrl(storagePath) {
  try {
    const bucket = getStorageBucket();
    const [url]  = await bucket.file(storagePath).getSignedUrl({
      action:  'read',
      expires: Date.now() + SIGNED_URL_TTL_MS,
    });
    return url;
  } catch (err) {
    throw new Error(`Failed to generate download URL: ${err.message}`);
  }
}

/**
 * Permanently delete a file from Firebase Storage.
 * Treats 404 (already gone) as success — idempotent.
 *
 * @param {string} storagePath
 */
async function deleteFile(storagePath) {
  try {
    const bucket = getStorageBucket();
    await bucket.file(storagePath).delete();
  } catch (err) {
    // File already deleted — treat as success
    if (err.code === 404) return;
    throw new Error(`Storage delete failed: ${err.message}`);
  }
}

module.exports = { uploadFile, getSignedUrl, deleteFile };
