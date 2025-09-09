const express = require('express');
const { verifyIdToken } = require('../config/firebase');
const { getDB, collections } = require('../config/database');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();

// Test authentication endpoint
router.get('/verify', authenticateUser, async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Authentication verified',
      user: {
        uid: req.user.uid,
        email: req.user.email,
        name: req.user.name,
        role: req.user.role || 'user',
        department: req.user.department || 'citizen'
      }
    });
  } catch (error) {
    console.error('Auth verify error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication verification failed'
    });
  }
});

// Get current user info
router.get('/me', authenticateUser, async (req, res) => {
  try {
    const db = await getDB();
    const userDoc = await collections.users().findOne({ 
      firebaseUID: req.user.uid 
    });

    res.json({
      success: true,
      user: {
        uid: req.user.uid,
        email: req.user.email,
        name: req.user.name,
        emailVerified: req.user.emailVerified,
        ...userDoc // Include additional data from MongoDB
      }
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user information'
    });
  }
});

module.exports = router;