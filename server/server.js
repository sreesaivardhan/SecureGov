'use strict';

// Load environment variables FIRST — before any other require
require('dotenv').config();

const express = require('express');
const { connectDB } = require('./db/mongoose');
const { corsMiddleware, corsOptions } = require('./middleware/cors');

// ─── Route modules ────────────────────────────────────────────────────────────
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const documentsRouter = require('./routes/documents'); // Day 2
const familyRouter = require('./routes/family');    // Day 3
// Day 4+: no more server-level changes needed

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Core Middleware ──────────────────────────────────────────────────────────
app.use(corsMiddleware);
app.options('*', require('cors')(corsOptions));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/documents', documentsRouter);
app.use('/api/family', familyRouter);

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
// Express 5 automatically forwards async errors here — no try/catch needed
// in route handlers for thrown errors.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  // Multer-specific errors (file too large, wrong type, etc.)
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ success: false, message: 'File too large. Maximum size is 10 MB.' });
  }
  if (err.name === 'MulterError') {
    return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
  }

  console.error('[ERROR]', err.stack || err.message || err);
  res.status(err.status || 500).json({
    success: false,
    message:
      process.env.NODE_ENV === 'production'
        ? 'Internal server error'
        : (err.message || 'Internal server error'),
  });
});

// ─── Boot Sequence ────────────────────────────────────────────────────────────
async function start() {
  await connectDB();          // fail fast if DB is unreachable
  app.listen(PORT, () => {
    console.log(`\n🚀  SecureGov backend  →  http://localhost:${PORT}`);
    console.log(`    Environment: ${process.env.NODE_ENV || 'development'}\n`);
  });
}

start().catch((err) => {
  console.error('❌  Failed to start server:', err.message);
  process.exit(1);
});
