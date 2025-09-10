const express = require('express');
const { getDB, collections } = require('../config/database');
const { authenticateUser, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Sync user with MongoDB (called from frontend after Firebase auth)
router.post('/sync', authenticateUser, async (req, res) => {
  try {
    const userData = {
      firebaseUID: req.user.uid,
      email: req.user.email || req.body.email,
      name: req.user.name || req.body.name,
      emailVerified: req.user.emailVerified || req.body.emailVerified || false,
      role: 'user', // Default role
      department: 'citizen', // Default department
      permissions: ['read', 'write'], // Default permissions
      isActive: true,
      lastLogin: new Date(),
      createdDate: new Date()
    };

    const db = await getDB();
    
    // Use upsert to create or update user
    const result = await collections.users().replaceOne(
      { firebaseUID: req.user.uid },
      userData,
      { upsert: true }
    );

    res.json({
      success: true,
      message: result.upsertedCount > 0 ? 'User created' : 'User updated',
      user: userData
    });

  } catch (error) {
    console.error('User sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync user'
    });
  }
});

// Update user profile
router.put('/profile', authenticateUser, async (req, res) => {
  try {
    const updateData = {
      name: req.body.name,
      phone: req.body.phone,
      lastModified: new Date()
    };

    // Remove undefined fields
    Object.keys(updateData).forEach(key => 
      updateData[key] === undefined && delete updateData[key]
    );

    if (Object.keys(updateData).length === 1) { // Only lastModified
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    const db = await getDB();
    const result = await collections.users().updateOne(
      { firebaseUID: req.user.uid },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'Profile updated successfully'
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
});

// Get user by email (for sharing functionality)
router.get('/by-email/:email', authenticateUser, async (req, res) => {
  try {
    const email = req.params.email;
    const db = await getDB();
    
    const user = await collections.users().findOne(
      { email: email },
      { projection: { firebaseUID: 1, email: 1, name: 1 } }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user: user
    });

  } catch (error) {
    console.error('User lookup error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to find user'
    });
  }
});

// Admin: List all users
router.get('/', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const db = await getDB();
    const users = await collections.users()
      .find({}, { projection: { firebaseUID: 1, email: 1, name: 1, role: 1, department: 1, isActive: 1, createdDate: 1, lastLogin: 1 } })
      .sort({ createdDate: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await collections.users().countDocuments();

    res.json({
      success: true,
      users: users,
      pagination: {
        page: page,
        limit: limit,
        total: total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users'
    });
  }
});

// Admin: Update user role/permissions
router.put('/:userId/role', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const { role, department, permissions } = req.body;
    const userId = req.params.userId;

    const updateData = {
      lastModified: new Date()
    };

    if (role) updateData.role = role;
    if (department) updateData.department = department;
    if (permissions) updateData.permissions = permissions;

    const db = await getDB();
    const result = await collections.users().updateOne(
      { firebaseUID: userId },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User role updated successfully'
    });

  } catch (error) {
    console.error('Role update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user role'
    });
  }
});

// Admin: Deactivate/activate user
router.put('/:userId/status', authenticateUser, requireAdmin, async (req, res) => {
  try {
    const { isActive } = req.body;
    const userId = req.params.userId;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isActive must be a boolean value'
      });
    }

    const db = await getDB();
    const result = await collections.users().updateOne(
      { firebaseUID: userId },
      { 
        $set: { 
          isActive: isActive,
          lastModified: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: `User ${isActive ? 'activated' : 'deactivated'} successfully`
    });

  } catch (error) {
    console.error('User status update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user status'
    });
  }
});

module.exports = router;