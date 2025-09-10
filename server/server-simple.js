require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/secureGovDocs';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Firebase Admin initialization
const SERVICE_ACCOUNT_PATH = process.env.FIREBASE_ADMIN_KEY_PATH || path.join(__dirname, 'serviceAccountKey.json');
if (fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  try {
    const serviceAccount = require(SERVICE_ACCOUNT_PATH);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Firebase Admin initialized');
  } catch (err) {
    console.warn('⚠️ Firebase Admin init failed:', err.message);
  }
} else {
  console.warn('⚠️ Firebase serviceAccountKey.json not found');
}

// Basic auth middleware
const verifyToken = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Basic routes
app.get('/api/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// User sync endpoint
app.post('/api/users/sync', verifyToken, async (req, res) => {
  try {
    res.json({
      success: true,
      user: {
        uid: req.user.uid,
        email: req.user.email,
        emailVerified: req.user.email_verified
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'User sync failed' });
  }
});

// Documents endpoints
app.get('/api/documents', verifyToken, async (req, res) => {
  try {
    const { limit = 50, page = 1 } = req.query;
    res.json({
      success: true,
      documents: [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

app.get('/api/documents/stats', verifyToken, async (req, res) => {
  try {
    res.json({
      success: true,
      stats: {
        totalDocuments: 0,
        recentUploads: 0,
        sharedDocuments: 0,
        storageUsed: 0
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

app.post('/api/documents/upload', verifyToken, (req, res) => {
  res.status(501).json({ error: 'Upload endpoint not implemented yet' });
});

// Family endpoints
app.get('/api/family', verifyToken, async (req, res) => {
  try {
    res.json({
      success: true,
      familyGroups: []
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch family groups' });
  }
});

// Profile endpoints
app.get('/api/profile', verifyToken, async (req, res) => {
  try {
    res.json({
      success: true,
      profile: {
        firebaseUID: req.user.uid,
        email: req.user.email,
        personalInfo: {
          firstName: req.user.name?.split(' ')[0] || 'User',
          lastName: req.user.name?.split(' ')[1] || ''
        },
        profileStatus: {
          completionPercentage: 25,
          level: 'basic'
        }
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 SecureGov backend listening on http://localhost:${PORT}`);
});
