const express = require('express');
const router = express.Router();
const { authenticateUser } = require('../middleware/auth');

// Get user profile endpoint
router.get('/profile', authenticateUser, async (req, res) => {
  try {
    res.json({
      success: true,
      profile: {
        uid: req.user.uid,
        email: req.user.email,
        displayName: req.user.name || req.user.displayName || req.user.email,
        phone: req.user.phone_number || '',
        address: '',
        photoURL: req.user.picture || ''
      }
    });
  } catch (error) {
    console.error('User profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user profile'
    });
  }
});

// Sync user data endpoint
router.post('/sync', authenticateUser, async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'User synced successfully',
      user: {
        uid: req.user.uid,
        email: req.user.email,
        displayName: req.user.name || req.user.email
      }
    });
  } catch (error) {
    console.error('User sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync user'
    });
  }
});

module.exports = router;