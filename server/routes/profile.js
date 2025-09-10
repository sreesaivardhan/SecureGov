const express = require('express');
const router = express.Router();
const { UserProfile, AADHAAR_STATUS, PROFILE_LEVELS } = require('../models/UserProfile');
const admin = require('firebase-admin');
const multer = require('multer');
const { uploadToFirebase, deleteFromFirebase } = require('../config/firebase-storage');
const Joi = require('joi');
const crypto = require('crypto');

// Configure multer for profile picture uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

// Validation schemas
const personalInfoSchema = Joi.object({
  firstName: Joi.string().trim().max(50).required(),
  lastName: Joi.string().trim().max(50).required(),
  middleName: Joi.string().trim().max(50).optional(),
  displayName: Joi.string().trim().max(100).optional(),
  dateOfBirth: Joi.date().max('now').optional(),
  gender: Joi.string().valid('male', 'female', 'other', 'prefer_not_to_say').optional(),
  nationality: Joi.string().max(50).optional(),
  occupation: Joi.string().max(100).optional()
});

const addressSchema = Joi.object({
  type: Joi.string().valid('permanent', 'current', 'office').required(),
  addressLine1: Joi.string().max(200).required(),
  addressLine2: Joi.string().max(200).optional(),
  city: Joi.string().max(100).required(),
  state: Joi.string().max(100).required(),
  pincode: Joi.string().pattern(/^[1-9][0-9]{5}$/).required(),
  country: Joi.string().max(100).default('India')
});

const aadhaarSchema = Joi.object({
  aadhaarNumber: Joi.string().pattern(/^[2-9]{1}[0-9]{3}[0-9]{4}[0-9]{4}$/).required()
});

const panSchema = Joi.object({
  number: Joi.string().pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).required()
});

const securityQuestionSchema = Joi.object({
  question: Joi.string().required(),
  answer: Joi.string().min(3).required()
});

const securitySettingsSchema = Joi.object({
  twoFactorEnabled: Joi.boolean().optional(),
  loginNotifications: Joi.boolean().optional(),
  documentAccessNotifications: Joi.boolean().optional(),
  familyActivityNotifications: Joi.boolean().optional(),
  sessionTimeout: Joi.number().min(5).max(120).optional()
});

// Middleware to verify Firebase token and get user
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
    console.error('Token verification error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Security validation middleware
const validateSecurityContext = async (req, res, next) => {
  try {
    const profile = await UserProfile.findOne({ firebaseUID: req.user.uid });
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Check account lockout
    if (profile.security.accountLockout.isLocked && 
        profile.security.accountLockout.lockoutUntil > new Date()) {
      return res.status(423).json({ 
        error: 'Account temporarily locked',
        lockoutUntil: profile.security.accountLockout.lockoutUntil
      });
    }

    // Log activity
    profile.addActivityLog(`${req.method} ${req.path}`, {
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    });

    req.profile = profile;
    next();
  } catch (error) {
    console.error('Security validation error:', error);
    res.status(500).json({ error: 'Security validation failed' });
  }
};

// Rate limiting for sensitive operations
const rateLimitMap = new Map();
const rateLimit = (maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
  return (req, res, next) => {
    const key = `${req.user.uid}:${req.path}`;
    const now = Date.now();
    
    if (!rateLimitMap.has(key)) {
      rateLimitMap.set(key, { attempts: 1, resetTime: now + windowMs });
      return next();
    }
    
    const limit = rateLimitMap.get(key);
    if (now > limit.resetTime) {
      limit.attempts = 1;
      limit.resetTime = now + windowMs;
      return next();
    }
    
    if (limit.attempts >= maxAttempts) {
      return res.status(429).json({ 
        error: 'Too many attempts. Please try again later.',
        retryAfter: Math.ceil((limit.resetTime - now) / 1000)
      });
    }
    
    limit.attempts++;
    next();
  };
};

// GET /api/profile - Get user profile
router.get('/', verifyToken, validateSecurityContext, async (req, res) => {
  try {
    const profile = req.profile;
    
    // Remove sensitive information
    const safeProfile = profile.toObject();
    delete safeProfile.governmentIds.aadhaar.aadhaarNumber;
    delete safeProfile.security.securityQuestions;
    delete safeProfile.security.accountLockout;
    
    // Update last login
    profile.lastLoginAt = new Date();
    await profile.save();

    res.json({
      success: true,
      profile: safeProfile
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// POST /api/profile - Create or update user profile
router.post('/', verifyToken, async (req, res) => {
  try {
    const { error, value } = personalInfoSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    let profile = await UserProfile.findOne({ firebaseUID: req.user.uid });
    
    if (!profile) {
      // Create new profile
      profile = new UserProfile({
        firebaseUID: req.user.uid,
        email: req.user.email,
        emailVerified: req.user.email_verified || false,
        personalInfo: value
      });
    } else {
      // Update existing profile
      Object.assign(profile.personalInfo, value);
    }

    await profile.save();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      completionPercentage: profile.profileStatus.completionPercentage,
      level: profile.profileStatus.level
    });
  } catch (error) {
    console.error('Update profile error:', error);
    if (error.code === 11000) {
      res.status(400).json({ error: 'Profile already exists' });
    } else {
      res.status(500).json({ error: 'Failed to update profile' });
    }
  }
});

// POST /api/profile/picture - Upload profile picture
router.post('/picture', verifyToken, validateSecurityContext, upload.single('profilePicture'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const profile = req.profile;
    
    // Delete old profile picture if exists
    if (profile.personalInfo.profilePicture?.firebasePath) {
      try {
        await deleteFromFirebase(profile.personalInfo.profilePicture.firebasePath);
      } catch (deleteError) {
        console.warn('Failed to delete old profile picture:', deleteError);
      }
    }

    // Upload new picture
    const fileName = `profile-pictures/${req.user.uid}/${Date.now()}-${req.file.originalname}`;
    const uploadResult = await uploadToFirebase(req.file.buffer, fileName, req.file.mimetype);

    profile.personalInfo.profilePicture = {
      url: uploadResult.downloadURL,
      firebasePath: fileName
    };

    await profile.save();

    res.json({
      success: true,
      message: 'Profile picture updated successfully',
      profilePicture: profile.personalInfo.profilePicture
    });
  } catch (error) {
    console.error('Upload profile picture error:', error);
    res.status(500).json({ error: 'Failed to upload profile picture' });
  }
});

// POST /api/profile/address - Add or update address
router.post('/address', verifyToken, validateSecurityContext, async (req, res) => {
  try {
    const { error, value } = addressSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const profile = req.profile;
    
    // Check if address type already exists
    const existingIndex = profile.addresses.findIndex(addr => addr.type === value.type);
    
    if (existingIndex >= 0) {
      // Update existing address
      profile.addresses[existingIndex] = { ...profile.addresses[existingIndex].toObject(), ...value };
    } else {
      // Add new address
      profile.addresses.push(value);
    }

    await profile.save();

    res.json({
      success: true,
      message: 'Address updated successfully',
      addresses: profile.addresses
    });
  } catch (error) {
    console.error('Update address error:', error);
    res.status(500).json({ error: 'Failed to update address' });
  }
});

// POST /api/profile/aadhaar/link - Link Aadhaar number
router.post('/aadhaar/link', verifyToken, validateSecurityContext, rateLimit(3, 60 * 60 * 1000), async (req, res) => {
  try {
    const { error, value } = aadhaarSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const profile = req.profile;
    
    // Check if can link Aadhaar
    const canLink = profile.canLinkAadhaar();
    if (!canLink.canLink) {
      return res.status(400).json({ error: canLink.reason });
    }

    // Check if Aadhaar is already linked to another user
    const existingProfile = await UserProfile.findOne({
      'governmentIds.aadhaar.aadhaarNumber': value.aadhaarNumber,
      firebaseUID: { $ne: req.user.uid }
    });

    if (existingProfile) {
      return res.status(400).json({ error: 'Aadhaar number is already linked to another account' });
    }

    // Update Aadhaar details
    profile.governmentIds.aadhaar.aadhaarNumber = value.aadhaarNumber;
    profile.governmentIds.aadhaar.status = AADHAAR_STATUS.PENDING;
    profile.governmentIds.aadhaar.lastVerificationAttempt = new Date();
    profile.governmentIds.aadhaar.verificationAttempts += 1;

    // Generate verification ID for OTP process
    profile.governmentIds.aadhaar.verificationId = crypto.randomBytes(16).toString('hex');

    await profile.save();

    res.json({
      success: true,
      message: 'Aadhaar linked successfully. Verification pending.',
      verificationId: profile.governmentIds.aadhaar.verificationId,
      maskedAadhaar: profile.maskedAadhaarNumber
    });
  } catch (error) {
    console.error('Link Aadhaar error:', error);
    res.status(500).json({ error: 'Failed to link Aadhaar' });
  }
});

// POST /api/profile/aadhaar/verify - Verify Aadhaar with OTP
router.post('/aadhaar/verify', verifyToken, validateSecurityContext, rateLimit(5, 30 * 60 * 1000), async (req, res) => {
  try {
    const { verificationId, otp } = req.body;
    
    if (!verificationId || !otp) {
      return res.status(400).json({ error: 'Verification ID and OTP are required' });
    }

    const profile = req.profile;
    
    if (profile.governmentIds.aadhaar.verificationId !== verificationId) {
      return res.status(400).json({ error: 'Invalid verification ID' });
    }

    if (profile.governmentIds.aadhaar.status !== AADHAAR_STATUS.PENDING) {
      return res.status(400).json({ error: 'No pending Aadhaar verification' });
    }

    // In a real implementation, you would verify the OTP with UIDAI
    // For demo purposes, we'll accept any 6-digit OTP
    if (!/^\d{6}$/.test(otp)) {
      return res.status(400).json({ error: 'Invalid OTP format' });
    }

    // Simulate OTP verification (in production, integrate with UIDAI API)
    const isValidOTP = otp === '123456' || Math.random() > 0.3; // Demo logic
    
    if (isValidOTP) {
      profile.governmentIds.aadhaar.status = AADHAAR_STATUS.VERIFIED;
      profile.governmentIds.aadhaar.verificationDate = new Date();
      profile.governmentIds.aadhaar.verificationMethod = 'otp';
      profile.governmentIds.aadhaar.verificationId = null;
      
      // Add verification badge
      profile.profileStatus.verificationBadges.push({
        type: 'aadhaar',
        verifiedAt: new Date(),
        expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) // 1 year
      });
      
      await profile.save();
      
      res.json({
        success: true,
        message: 'Aadhaar verified successfully',
        status: AADHAAR_STATUS.VERIFIED
      });
    } else {
      profile.governmentIds.aadhaar.verificationAttempts += 1;
      
      if (profile.governmentIds.aadhaar.verificationAttempts >= 5) {
        profile.governmentIds.aadhaar.status = AADHAAR_STATUS.REJECTED;
      }
      
      await profile.save();
      
      res.status(400).json({
        error: 'Invalid OTP',
        attemptsRemaining: Math.max(0, 5 - profile.governmentIds.aadhaar.verificationAttempts)
      });
    }
  } catch (error) {
    console.error('Verify Aadhaar error:', error);
    res.status(500).json({ error: 'Failed to verify Aadhaar' });
  }
});

// POST /api/profile/pan - Add/update PAN details
router.post('/pan', verifyToken, validateSecurityContext, async (req, res) => {
  try {
    const { error, value } = panSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const profile = req.profile;
    
    // Check if PAN is already linked to another user
    const existingProfile = await UserProfile.findOne({
      'governmentIds.pan.number': value.number,
      firebaseUID: { $ne: req.user.uid }
    });

    if (existingProfile) {
      return res.status(400).json({ error: 'PAN number is already linked to another account' });
    }

    profile.governmentIds.pan.number = value.number;
    profile.governmentIds.pan.isVerified = false; // Will be verified through document upload
    
    await profile.save();

    res.json({
      success: true,
      message: 'PAN details updated successfully',
      pan: {
        number: profile.governmentIds.pan.number,
        isVerified: profile.governmentIds.pan.isVerified
      }
    });
  } catch (error) {
    console.error('Update PAN error:', error);
    res.status(500).json({ error: 'Failed to update PAN details' });
  }
});

// POST /api/profile/security/questions - Set security questions
router.post('/security/questions', verifyToken, validateSecurityContext, async (req, res) => {
  try {
    const { questions } = req.body;
    
    if (!Array.isArray(questions) || questions.length < 2 || questions.length > 5) {
      return res.status(400).json({ error: 'Please provide 2-5 security questions' });
    }

    // Validate each question
    for (const q of questions) {
      const { error } = securityQuestionSchema.validate(q);
      if (error) {
        return res.status(400).json({ error: error.details[0].message });
      }
    }

    const profile = req.profile;
    
    // Hash answers and store questions
    profile.security.securityQuestions = questions.map(q => ({
      question: q.question,
      answerHash: profile.hashSecurityAnswer(q.answer),
      createdAt: new Date()
    }));

    await profile.save();

    res.json({
      success: true,
      message: 'Security questions set successfully',
      questionsCount: profile.security.securityQuestions.length
    });
  } catch (error) {
    console.error('Set security questions error:', error);
    res.status(500).json({ error: 'Failed to set security questions' });
  }
});

// POST /api/profile/security/settings - Update security settings
router.post('/security/settings', verifyToken, validateSecurityContext, async (req, res) => {
  try {
    const { error, value } = securitySettingsSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const profile = req.profile;
    
    // Update security settings
    Object.assign(profile.security, value);
    
    await profile.save();

    res.json({
      success: true,
      message: 'Security settings updated successfully',
      settings: {
        twoFactorEnabled: profile.security.twoFactorEnabled,
        loginNotifications: profile.security.loginNotifications,
        documentAccessNotifications: profile.security.documentAccessNotifications,
        familyActivityNotifications: profile.security.familyActivityNotifications,
        sessionTimeout: profile.security.sessionTimeout
      }
    });
  } catch (error) {
    console.error('Update security settings error:', error);
    res.status(500).json({ error: 'Failed to update security settings' });
  }
});

// GET /api/profile/activity - Get activity log
router.get('/activity', verifyToken, validateSecurityContext, async (req, res) => {
  try {
    const profile = req.profile;
    const { page = 1, limit = 20 } = req.query;
    
    const startIndex = (page - 1) * limit;
    const activities = profile.activityLog
      .slice(-100) // Get last 100 activities
      .reverse() // Most recent first
      .slice(startIndex, startIndex + parseInt(limit));

    res.json({
      success: true,
      activities,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: Math.min(profile.activityLog.length, 100)
      }
    });
  } catch (error) {
    console.error('Get activity log error:', error);
    res.status(500).json({ error: 'Failed to fetch activity log' });
  }
});

// DELETE /api/profile/address/:type - Delete address
router.delete('/address/:type', verifyToken, validateSecurityContext, async (req, res) => {
  try {
    const { type } = req.params;
    const profile = req.profile;
    
    profile.addresses = profile.addresses.filter(addr => addr.type !== type);
    await profile.save();

    res.json({
      success: true,
      message: 'Address deleted successfully'
    });
  } catch (error) {
    console.error('Delete address error:', error);
    res.status(500).json({ error: 'Failed to delete address' });
  }
});

// GET /api/profile/completion - Get profile completion status
router.get('/completion', verifyToken, validateSecurityContext, async (req, res) => {
  try {
    const profile = req.profile;
    
    const completion = {
      percentage: profile.profileStatus.completionPercentage,
      level: profile.profileStatus.level,
      badges: profile.profileStatus.verificationBadges,
      suggestions: []
    };

    // Add completion suggestions
    if (!profile.personalInfo.dateOfBirth) {
      completion.suggestions.push('Add your date of birth');
    }
    if (!profile.phoneVerified) {
      completion.suggestions.push('Verify your phone number');
    }
    if (profile.addresses.length === 0) {
      completion.suggestions.push('Add your address');
    }
    if (profile.governmentIds.aadhaar.status !== AADHAAR_STATUS.VERIFIED) {
      completion.suggestions.push('Link and verify your Aadhaar');
    }
    if (!profile.governmentIds.pan.number) {
      completion.suggestions.push('Add your PAN details');
    }
    if (!profile.security.twoFactorEnabled) {
      completion.suggestions.push('Enable two-factor authentication');
    }

    res.json({
      success: true,
      completion
    });
  } catch (error) {
    console.error('Get completion status error:', error);
    res.status(500).json({ error: 'Failed to fetch completion status' });
  }
});

module.exports = router;
