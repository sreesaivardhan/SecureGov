/**
 * js/firebase-init.js — SecureGov Firebase bootstrap
 *
 * Rules:
 *  - Initialize the Firebase app only once (guard against double-load).
 *  - Expose window.auth — always set; required by every page.
 *  - Expose window.db  — set ONLY if the Firestore SDK is loaded.
 *  - Expose window.storage — set ONLY if the Storage SDK is loaded.
 *  - Never throw; log a warning and continue if an optional SDK is absent.
 *
 * Firestore is NOT required for the current SecureGov flow.
 * All app data goes through the Node/Express backend, not Firestore directly.
 */

const firebaseConfig = {
  apiKey:            "AIzaSyDZI7PgIRGfR-8nFDCiHHKJ9HV-SjVJqBE",
  authDomain:        "secure-gov-docs.firebaseapp.com",
  projectId:         "gov-docs-43fa8",
  storageBucket:     "secure-gov-docs.appspot.com",
  messagingSenderId: "115099928789",
  appId:             "1:115099928789:web:563396382e87d98eafba5c",
};

// ── Initialize app exactly once ────────────────────────────────
try {
  if (!firebase.apps || firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
    console.log('[Firebase] App initialized');
  } else {
    console.log('[Firebase] Reusing existing app');
  }
} catch (err) {
  console.error('[Firebase] initializeApp failed:', err);
}

// ── Auth — always required ─────────────────────────────────────
try {
  window.auth = firebase.auth();
} catch (err) {
  console.error('[Firebase] firebase.auth() failed:', err);
}

// ── Firestore — only if SDK is present ────────────────────────
if (typeof firebase.firestore === 'function') {
  try {
    window.db = firebase.firestore();
  } catch (err) {
    console.warn('[Firebase] firestore() failed:', err);
  }
} else {
  console.warn('[Firebase] Firestore SDK not loaded — window.db will not be set. This is expected if Firestore is not used.');
}

// ── Storage — only if SDK is present ──────────────────────────
if (typeof firebase.storage === 'function') {
  try {
    window.storage = firebase.storage();
  } catch (err) {
    console.warn('[Firebase] storage() failed:', err);
  }
} else {
  console.warn('[Firebase] Storage SDK not loaded — window.storage will not be set.');
}

// ── Auth state listener (passive — does not redirect) ─────────
firebase.auth().onAuthStateChanged((user) => {
  window.currentUser = user || null;
});
