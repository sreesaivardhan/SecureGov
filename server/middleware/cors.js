'use strict';

/**
 * CORS middleware with an explicit origin whitelist.
 *
 * Origins are read from the CORS_ORIGIN env var (comma-separated).
 * Localhost is always allowed in non-production to avoid friction during dev.
 *
 * Example .env:
 *   CORS_ORIGIN=https://securegov.netlify.app,https://www.securegov.app
 */

const cors = require('cors');

function buildAllowedOrigins() {
  const origins = [];

  // Pull production origins from env
  if (process.env.CORS_ORIGIN) {
    process.env.CORS_ORIGIN
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean)
      .forEach((o) => origins.push(o));
  }

  // Always allow localhost in development (live-server default ports)
  if (process.env.NODE_ENV !== 'production') {
    const devOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:5173', // Vite (in case we ever add it)
      'http://localhost:8080',
    ];
    devOrigins.forEach((o) => {
      if (!origins.includes(o)) origins.push(o);
    });
  }

  return origins;
}

const allowedOrigins = buildAllowedOrigins();

module.exports = cors({
  origin(origin, callback) {
    // No origin = curl, Postman, mobile, server-to-server — always allow
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) return callback(null, true);

    // Reject with a plain error; our global error handler will catch it
    return callback(
      Object.assign(new Error(`CORS: origin "${origin}" is not allowed`), { status: 403 })
    );
  },
  credentials: true,                                      // allow cookies / auth headers
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200,                              // IE11 fix
});
