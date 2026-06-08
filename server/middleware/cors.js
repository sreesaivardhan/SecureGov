'use strict';

const cors = require('cors');

function buildAllowedOrigins() {
  const origins = [];

  if (process.env.CORS_ORIGIN) {
    process.env.CORS_ORIGIN
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean)
      .forEach((o) => origins.push(o));
  }

  if (process.env.NODE_ENV !== 'production') {
    [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:5173',
      'http://localhost:8080',
    ].forEach((o) => {
      if (!origins.includes(o)) origins.push(o);
    });
  }

  return origins;
}

const allowedOrigins = buildAllowedOrigins();

const corsOptions = {
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(Object.assign(
      new Error(`CORS: origin "${origin}" is not allowed`),
      { status: 403 }
    ));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200,
};

module.exports = {
  corsMiddleware: cors(corsOptions),
  corsOptions,
};