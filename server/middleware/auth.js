'use strict';

const { getAdmin } = require('../config/firebase');

/**
 * verifyToken — Express middleware.
 *
 * Reads the Bearer token from the Authorization header, verifies it with
 * Firebase Admin, and attaches a clean req.user object.
 *
 * req.user shape:
 *   { uid, email, emailVerified, name }
 *
 * Returns 401 for missing, malformed, expired, or revoked tokens.
 */
async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Authorization header missing or invalid. Expected: Bearer <token>',
    });
  }

  const token = authHeader.slice(7); // strip "Bearer "

  try {
    const admin        = getAdmin();
    const decoded      = await admin.auth().verifyIdToken(token);

    req.user = {
      uid:           decoded.uid,
      email:         decoded.email        || '',
      emailVerified: decoded.email_verified || false,
      name:          decoded.name          || '',
    };

    return next();
  } catch (err) {
    // Log only in dev — don't leak token details to the client
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[auth] Token verification failed:', err.code || err.message);
    }
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token. Please sign in again.',
    });
  }
}

module.exports = { verifyToken };
