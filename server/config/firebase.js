'use strict';

/**
 * Firebase Admin — lazy singleton.
 *
 * Supports TWO credential strategies, checked in order:
 *
 * 1. ENV VARS (preferred for Render / production):
 *    Set these in the Render dashboard:
 *      FIREBASE_PROJECT_ID
 *      FIREBASE_CLIENT_EMAIL
 *      FIREBASE_PRIVATE_KEY   (the full PEM string — Render handles newlines correctly)
 *
 * 2. KEY FILE (local dev fallback):
 *    Set FIREBASE_ADMIN_KEY_PATH=./serviceAccountKey.json in server/.env
 *    The file must exist at that path relative to server/.
 *
 * USAGE:
 *   const { getAdmin, getStorageBucket } = require('../config/firebase');
 *   const admin  = getAdmin();           // admin.auth(), etc.
 *   const bucket = getStorageBucket();   // Firebase Storage bucket
 */

const path = require('path');
const fs   = require('fs');

let _initialized = false;

function initFirebase() {
  if (_initialized) return;

  const admin = require('firebase-admin');

  let credential;

  // ── Strategy 1: individual env vars (Render / cloud) ────────────────────────
  if (process.env.FIREBASE_PROJECT_ID &&
      process.env.FIREBASE_CLIENT_EMAIL &&
      process.env.FIREBASE_PRIVATE_KEY) {

    const serviceAccount = {
      type:                        'service_account',
      project_id:                  process.env.FIREBASE_PROJECT_ID,
      client_email:                process.env.FIREBASE_CLIENT_EMAIL,
      // Render stores the literal string; replace escaped newlines if present
      private_key:                 process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    };

    credential = admin.credential.cert(serviceAccount);
    console.log('[Firebase] Using env-var credentials (production mode)');

  // ── Strategy 2: service account key file (local dev) ────────────────────────
  } else if (process.env.FIREBASE_ADMIN_KEY_PATH) {

    const resolved = path.resolve(process.env.FIREBASE_ADMIN_KEY_PATH);

    if (!fs.existsSync(resolved)) {
      throw new Error(
        `Firebase service account key not found at: ${resolved}\n` +
        'Set FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY ' +
        'or FIREBASE_ADMIN_KEY_PATH in server/.env'
      );
    }

    // eslint-disable-next-line import/no-dynamic-require
    const serviceAccount = require(resolved);
    credential = admin.credential.cert(serviceAccount);
    console.log('[Firebase] Using key-file credentials (local dev mode)');

  } else {
    throw new Error(
      'Firebase Admin credentials not configured.\n' +
      'Production: set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY.\n' +
      'Local dev:  set FIREBASE_ADMIN_KEY_PATH=./serviceAccountKey.json in server/.env'
    );
  }

  admin.initializeApp({
    credential,
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
  });

  _initialized = true;
  console.log('✅  Firebase Admin initialized');
}

/**
 * Returns the firebase-admin namespace.
 * Initializes on first call.
 */
function getAdmin() {
  initFirebase();
  return require('firebase-admin');
}

/**
 * Returns the default Firebase Storage bucket.
 * Requires FIREBASE_STORAGE_BUCKET env var.
 */
function getStorageBucket() {
  const admin = getAdmin();
  if (!process.env.FIREBASE_STORAGE_BUCKET) {
    throw new Error('FIREBASE_STORAGE_BUCKET is not set.');
  }
  return admin.storage().bucket();
}

module.exports = { getAdmin, getStorageBucket };
