const mongoose = require('mongoose');
const crypto = require('crypto');

// Aadhaar validation status
const AADHAAR_STATUS = {
  NOT_LINKED: 'not_linked',
  PENDING: 'pending',
  VERIFIED: 'verified',
  REJECTED: 'rejected',
  EXPIRED: 'expired'
};

// Profile completion levels
const PROFILE_LEVELS = {
  BASIC: 'basic',
  INTERMEDIATE: 'intermediate',
  COMPLETE: 'complete',
  VERIFIED: 'verified'
};

// Security question schema
const securityQuestionSchema = new mongoose.Schema({
  question: {
    type: String,
    required: true
  },
  answerHash: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Address schema
const addressSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['permanent', 'current', 'office'],
    required: true
  },
  addressLine1: {
    type: String,
    required: true,
    maxlength: 200
  },
  addressLine2: {
    type: String,
    maxlength: 200
  },
  city: {
    type: String,
    required: true,
    maxlength: 100
  },
  state: {
    type: String,
    required: true,
    maxlength: 100
  },
  pincode: {
    type: String,
    required: true,
    match: /^[1-9][0-9]{5}$/
  },
  country: {
    type: String,
    default: 'India',
    maxlength: 100
  },
  isVerified: {
    type: Boolean,
    default: false
  }
});

// Aadhaar details schema
const aadhaarDetailsSchema = new mongoose.Schema({
  aadhaarNumber: {
    type: String,
    match: /^[2-9]{1}[0-9]{3}[0-9]{4}[0-9]{4}$/,
    unique: true,
    sparse: true
  },
  maskedAadhaar: {
    type: String
  },
  status: {
    type: String,
    enum: Object.values(AADHAAR_STATUS),
    default: AADHAAR_STATUS.NOT_LINKED
  },
  verificationDate: Date,
  verificationMethod: {
    type: String,
    enum: ['otp', 'biometric', 'offline']
  },
  verificationId: String,
  lastVerificationAttempt: Date,
  verificationAttempts: {
    type: Number,
    default: 0,
    max: 5
  },
  linkedDocuments: [{
    documentId: mongoose.Schema.Types.ObjectId,
    documentType: String,
    linkedAt: Date
  }]
});

// Security settings schema
const securitySettingsSchema = new mongoose.Schema({
  twoFactorEnabled: {
    type: Boolean,
    default: false
  },
  loginNotifications: {
    type: Boolean,
    default: true
  },
  documentAccessNotifications: {
    type: Boolean,
    default: true
  },
  familyActivityNotifications: {
    type: Boolean,
    default: true
  },
  sessionTimeout: {
    type: Number,
    default: 30, // minutes
    min: 5,
    max: 120
  },
  allowedDevices: [{
    deviceId: String,
    deviceName: String,
    lastUsed: Date,
    isActive: Boolean
  }],
  securityQuestions: [securityQuestionSchema],
  passwordLastChanged: Date,
  accountLockout: {
    isLocked: {
      type: Boolean,
      default: false
    },
    lockoutUntil: Date,
    failedAttempts: {
      type: Number,
      default: 0
    }
  }
});

// Main user profile schema
const userProfileSchema = new mongoose.Schema({
  firebaseUID: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    index: true
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  phoneNumber: {
    type: String,
    match: /^[6-9]\d{9}$/
  },
  phoneVerified: {
    type: Boolean,
    default: false
  },
  
  // Personal Information
  personalInfo: {
    firstName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 50
    },
    middleName: {
      type: String,
      trim: true,
      maxlength: 50
    },
    displayName: {
      type: String,
      trim: true,
      maxlength: 100
    },
    dateOfBirth: Date,
    gender: {
      type: String,
      enum: ['male', 'female', 'other', 'prefer_not_to_say']
    },
    nationality: {
      type: String,
      default: 'Indian',
      maxlength: 50
    },
    occupation: {
      type: String,
      maxlength: 100
    },
    profilePicture: {
      url: String,
      firebasePath: String
    }
  },

  // Contact Information
  addresses: [addressSchema],
  
  // Government ID Information
  governmentIds: {
    aadhaar: aadhaarDetailsSchema,
    pan: {
      number: {
        type: String,
        match: /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/,
        uppercase: true
      },
      isVerified: {
        type: Boolean,
        default: false
      },
      verificationDate: Date
    },
    passport: {
      number: {
        type: String,
        match: /^[A-Z]{1}[0-9]{7}$/,
        uppercase: true
      },
      issuedDate: Date,
      expiryDate: Date,
      isVerified: {
        type: Boolean,
        default: false
      }
    },
    drivingLicense: {
      number: String,
      state: String,
      issuedDate: Date,
      expiryDate: Date,
      isVerified: {
        type: Boolean,
        default: false
      }
    },
    voterId: {
      number: String,
      isVerified: {
        type: Boolean,
        default: false
      }
    }
  },

  // Profile Status
  profileStatus: {
    level: {
      type: String,
      enum: Object.values(PROFILE_LEVELS),
      default: PROFILE_LEVELS.BASIC
    },
    completionPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    isActive: {
      type: Boolean,
      default: true
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    verificationBadges: [{
      type: {
        type: String,
        enum: ['email', 'phone', 'aadhaar', 'pan', 'address', 'biometric']
      },
      verifiedAt: Date,
      expiresAt: Date
    }]
  },

  // Security Settings
  security: securitySettingsSchema,

  // Activity Tracking
  activityLog: [{
    action: String,
    timestamp: {
      type: Date,
      default: Date.now
    },
    ipAddress: String,
    userAgent: String,
    location: {
      city: String,
      state: String,
      country: String
    }
  }],

  // Preferences
  preferences: {
    language: {
      type: String,
      default: 'en',
      enum: ['en', 'hi', 'ta', 'te', 'bn', 'mr', 'gu', 'kn', 'ml', 'or', 'pa', 'as']
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata'
    },
    dateFormat: {
      type: String,
      default: 'DD/MM/YYYY',
      enum: ['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD']
    },
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      sms: {
        type: Boolean,
        default: false
      },
      push: {
        type: Boolean,
        default: true
      }
    }
  },

  // Metadata
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  lastLoginAt: Date,
  lastActiveAt: Date
}, {
  timestamps: true
});

// Indexes for better performance
userProfileSchema.index({ firebaseUID: 1 });
userProfileSchema.index({ email: 1 });
userProfileSchema.index({ 'governmentIds.aadhaar.aadhaarNumber': 1 });
userProfileSchema.index({ 'governmentIds.pan.number': 1 });
userProfileSchema.index({ 'personalInfo.firstName': 1, 'personalInfo.lastName': 1 });
userProfileSchema.index({ 'profileStatus.level': 1 });

// Virtual for full name
userProfileSchema.virtual('fullName').get(function() {
  const { firstName, middleName, lastName } = this.personalInfo;
  return [firstName, middleName, lastName].filter(Boolean).join(' ');
});

// Virtual for masked Aadhaar
userProfileSchema.virtual('maskedAadhaarNumber').get(function() {
  if (this.governmentIds.aadhaar.aadhaarNumber) {
    const aadhaar = this.governmentIds.aadhaar.aadhaarNumber;
    return `XXXX-XXXX-${aadhaar.slice(-4)}`;
  }
  return null;
});

// Method to calculate profile completion percentage
userProfileSchema.methods.calculateCompletionPercentage = function() {
  let score = 0;
  const maxScore = 100;

  // Basic info (30 points)
  if (this.personalInfo.firstName && this.personalInfo.lastName) score += 10;
  if (this.personalInfo.dateOfBirth) score += 5;
  if (this.personalInfo.gender) score += 5;
  if (this.phoneNumber) score += 5;
  if (this.personalInfo.profilePicture?.url) score += 5;

  // Contact info (20 points)
  if (this.addresses.length > 0) score += 10;
  if (this.phoneVerified) score += 5;
  if (this.emailVerified) score += 5;

  // Government IDs (30 points)
  if (this.governmentIds.aadhaar.status === AADHAAR_STATUS.VERIFIED) score += 15;
  if (this.governmentIds.pan.isVerified) score += 10;
  if (this.governmentIds.passport.number) score += 5;

  // Security (20 points)
  if (this.security.twoFactorEnabled) score += 10;
  if (this.security.securityQuestions.length >= 2) score += 5;
  if (this.security.passwordLastChanged) score += 5;

  this.profileStatus.completionPercentage = Math.min(score, maxScore);
  return this.profileStatus.completionPercentage;
};

// Method to update profile level based on completion
userProfileSchema.methods.updateProfileLevel = function() {
  const completion = this.calculateCompletionPercentage();
  
  if (completion >= 90 && this.profileStatus.isVerified) {
    this.profileStatus.level = PROFILE_LEVELS.VERIFIED;
  } else if (completion >= 70) {
    this.profileStatus.level = PROFILE_LEVELS.COMPLETE;
  } else if (completion >= 40) {
    this.profileStatus.level = PROFILE_LEVELS.INTERMEDIATE;
  } else {
    this.profileStatus.level = PROFILE_LEVELS.BASIC;
  }
  
  return this.profileStatus.level;
};

// Method to add activity log entry
userProfileSchema.methods.addActivityLog = function(action, metadata = {}) {
  this.activityLog.push({
    action,
    timestamp: new Date(),
    ...metadata
  });
  
  // Keep only last 100 entries
  if (this.activityLog.length > 100) {
    this.activityLog = this.activityLog.slice(-100);
  }
  
  this.lastActiveAt = new Date();
};

// Method to hash security question answer
userProfileSchema.methods.hashSecurityAnswer = function(answer) {
  return crypto.createHash('sha256').update(answer.toLowerCase().trim()).digest('hex');
};

// Method to verify security question answer
userProfileSchema.methods.verifySecurityAnswer = function(questionIndex, answer) {
  if (!this.security.securityQuestions[questionIndex]) {
    return false;
  }
  
  const hashedAnswer = this.hashSecurityAnswer(answer);
  return this.security.securityQuestions[questionIndex].answerHash === hashedAnswer;
};

// Method to check if Aadhaar can be linked
userProfileSchema.methods.canLinkAadhaar = function() {
  const aadhaar = this.governmentIds.aadhaar;
  
  // Check if already verified
  if (aadhaar.status === AADHAAR_STATUS.VERIFIED) {
    return { canLink: false, reason: 'Aadhaar already verified' };
  }
  
  // Check verification attempts
  if (aadhaar.verificationAttempts >= 5) {
    return { canLink: false, reason: 'Maximum verification attempts exceeded' };
  }
  
  // Check cooldown period (24 hours between attempts)
  if (aadhaar.lastVerificationAttempt) {
    const hoursSinceLastAttempt = (Date.now() - aadhaar.lastVerificationAttempt) / (1000 * 60 * 60);
    if (hoursSinceLastAttempt < 24) {
      return { canLink: false, reason: 'Please wait 24 hours between verification attempts' };
    }
  }
  
  return { canLink: true };
};

// Pre-save middleware
userProfileSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  
  // Update completion percentage and level
  this.calculateCompletionPercentage();
  this.updateProfileLevel();
  
  // Generate display name if not set
  if (!this.personalInfo.displayName && this.personalInfo.firstName) {
    this.personalInfo.displayName = this.fullName;
  }
  
  // Mask Aadhaar number
  if (this.governmentIds.aadhaar.aadhaarNumber && !this.governmentIds.aadhaar.maskedAadhaar) {
    this.governmentIds.aadhaar.maskedAadhaar = this.maskedAadhaarNumber;
  }
  
  next();
});

const UserProfile = mongoose.model('UserProfile', userProfileSchema);

module.exports = {
  UserProfile,
  AADHAAR_STATUS,
  PROFILE_LEVELS
};
