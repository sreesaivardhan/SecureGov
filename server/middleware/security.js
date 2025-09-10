const { UserProfile } = require('../models/UserProfile');
const admin = require('firebase-admin');
const crypto = require('crypto');

// Security validation middleware
class SecurityMiddleware {
  
  // Rate limiting store
  static rateLimitStore = new Map();
  
  // Failed login attempts store
  static failedAttempts = new Map();
  
  // Suspicious activity patterns
  static suspiciousPatterns = new Map();

  /**
   * Verify Firebase token and extract user information
   */
  static async verifyFirebaseToken(req, res, next) {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
          error: 'Authorization header missing or invalid format',
          code: 'AUTH_HEADER_MISSING'
        });
      }

      const token = authHeader.split(' ')[1];
      if (!token) {
        return res.status(401).json({ 
          error: 'Token not provided',
          code: 'TOKEN_MISSING'
        });
      }

      // Verify the Firebase ID token
      const decodedToken = await admin.auth().verifyIdToken(token, true);
      
      // Check if token is not expired
      const now = Math.floor(Date.now() / 1000);
      if (decodedToken.exp < now) {
        return res.status(401).json({ 
          error: 'Token has expired',
          code: 'TOKEN_EXPIRED'
        });
      }

      // Attach user info to request
      req.user = {
        uid: decodedToken.uid,
        email: decodedToken.email,
        emailVerified: decodedToken.email_verified,
        phoneNumber: decodedToken.phone_number,
        authTime: decodedToken.auth_time,
        iat: decodedToken.iat,
        exp: decodedToken.exp
      };

      next();
    } catch (error) {
      console.error('Token verification error:', error);
      
      let errorCode = 'TOKEN_INVALID';
      let errorMessage = 'Invalid or expired token';
      
      if (error.code === 'auth/id-token-expired') {
        errorCode = 'TOKEN_EXPIRED';
        errorMessage = 'Token has expired';
      } else if (error.code === 'auth/id-token-revoked') {
        errorCode = 'TOKEN_REVOKED';
        errorMessage = 'Token has been revoked';
      } else if (error.code === 'auth/user-not-found') {
        errorCode = 'USER_NOT_FOUND';
        errorMessage = 'User not found';
      }

      res.status(401).json({ 
        error: errorMessage,
        code: errorCode
      });
    }
  }

  /**
   * Load user profile and perform security checks
   */
  static async loadUserProfile(req, res, next) {
    try {
      if (!req.user) {
        return res.status(401).json({ 
          error: 'User not authenticated',
          code: 'USER_NOT_AUTHENTICATED'
        });
      }

      const profile = await UserProfile.findOne({ firebaseUID: req.user.uid });
      
      if (!profile) {
        // For profile creation endpoints, this is acceptable
        if (req.method === 'POST' && req.path === '/') {
          return next();
        }
        
        return res.status(404).json({ 
          error: 'User profile not found',
          code: 'PROFILE_NOT_FOUND'
        });
      }

      // Check if account is locked
      if (profile.security.accountLockout.isLocked) {
        const lockoutUntil = profile.security.accountLockout.lockoutUntil;
        if (lockoutUntil && lockoutUntil > new Date()) {
          return res.status(423).json({ 
            error: 'Account is temporarily locked',
            code: 'ACCOUNT_LOCKED',
            lockoutUntil: lockoutUntil.toISOString(),
            message: `Account locked until ${lockoutUntil.toLocaleString()}`
          });
        } else {
          // Unlock account if lockout period has passed
          profile.security.accountLockout.isLocked = false;
          profile.security.accountLockout.lockoutUntil = null;
          profile.security.accountLockout.failedAttempts = 0;
          await profile.save();
        }
      }

      // Check if account is active
      if (!profile.profileStatus.isActive) {
        return res.status(403).json({ 
          error: 'Account is deactivated',
          code: 'ACCOUNT_DEACTIVATED'
        });
      }

      // Update last active timestamp
      profile.lastActiveAt = new Date();
      
      // Log activity
      profile.addActivityLog(`${req.method} ${req.path}`, {
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        timestamp: new Date()
      });

      await profile.save();
      req.profile = profile;
      next();
    } catch (error) {
      console.error('Load user profile error:', error);
      res.status(500).json({ 
        error: 'Failed to load user profile',
        code: 'PROFILE_LOAD_ERROR'
      });
    }
  }

  /**
   * Rate limiting middleware
   */
  static rateLimit(options = {}) {
    const {
      maxAttempts = 10,
      windowMs = 15 * 60 * 1000, // 15 minutes
      skipSuccessfulRequests = false,
      keyGenerator = (req) => req.user?.uid || req.ip
    } = options;

    return (req, res, next) => {
      const key = keyGenerator(req);
      const now = Date.now();
      
      if (!SecurityMiddleware.rateLimitStore.has(key)) {
        SecurityMiddleware.rateLimitStore.set(key, {
          attempts: 1,
          resetTime: now + windowMs,
          firstAttempt: now
        });
        return next();
      }
      
      const limit = SecurityMiddleware.rateLimitStore.get(key);
      
      // Reset if window has passed
      if (now > limit.resetTime) {
        limit.attempts = 1;
        limit.resetTime = now + windowMs;
        limit.firstAttempt = now;
        return next();
      }
      
      // Check if limit exceeded
      if (limit.attempts >= maxAttempts) {
        const retryAfter = Math.ceil((limit.resetTime - now) / 1000);
        
        res.set({
          'Retry-After': retryAfter,
          'X-RateLimit-Limit': maxAttempts,
          'X-RateLimit-Remaining': 0,
          'X-RateLimit-Reset': new Date(limit.resetTime).toISOString()
        });
        
        return res.status(429).json({ 
          error: 'Too many requests',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter,
          message: `Rate limit exceeded. Try again in ${retryAfter} seconds.`
        });
      }
      
      // Increment attempts
      limit.attempts++;
      
      // Set rate limit headers
      res.set({
        'X-RateLimit-Limit': maxAttempts,
        'X-RateLimit-Remaining': Math.max(0, maxAttempts - limit.attempts),
        'X-RateLimit-Reset': new Date(limit.resetTime).toISOString()
      });
      
      next();
    };
  }

  /**
   * Validate request data integrity
   */
  static validateDataIntegrity(req, res, next) {
    try {
      // Check for common injection patterns
      const suspiciousPatterns = [
        /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
        /javascript:/gi,
        /on\w+\s*=/gi,
        /\$\(.*\)/gi,
        /eval\s*\(/gi,
        /expression\s*\(/gi
      ];

      const checkValue = (value) => {
        if (typeof value === 'string') {
          return suspiciousPatterns.some(pattern => pattern.test(value));
        }
        if (typeof value === 'object' && value !== null) {
          return Object.values(value).some(checkValue);
        }
        return false;
      };

      // Check request body
      if (req.body && checkValue(req.body)) {
        return res.status(400).json({ 
          error: 'Invalid data detected',
          code: 'INVALID_DATA'
        });
      }

      // Check query parameters
      if (req.query && checkValue(req.query)) {
        return res.status(400).json({ 
          error: 'Invalid query parameters',
          code: 'INVALID_QUERY'
        });
      }

      next();
    } catch (error) {
      console.error('Data integrity validation error:', error);
      res.status(500).json({ 
        error: 'Data validation failed',
        code: 'VALIDATION_ERROR'
      });
    }
  }

  /**
   * Detect suspicious activity patterns
   */
  static detectSuspiciousActivity(req, res, next) {
    try {
      const userKey = req.user?.uid || req.ip;
      const now = Date.now();
      const windowMs = 60 * 1000; // 1 minute window
      
      if (!SecurityMiddleware.suspiciousPatterns.has(userKey)) {
        SecurityMiddleware.suspiciousPatterns.set(userKey, {
          requests: [],
          failedLogins: 0,
          lastFailedLogin: null
        });
      }
      
      const pattern = SecurityMiddleware.suspiciousPatterns.get(userKey);
      
      // Clean old requests
      pattern.requests = pattern.requests.filter(time => now - time < windowMs);
      
      // Add current request
      pattern.requests.push(now);
      
      // Check for rapid requests (more than 30 per minute)
      if (pattern.requests.length > 30) {
        return res.status(429).json({ 
          error: 'Suspicious activity detected',
          code: 'SUSPICIOUS_ACTIVITY'
        });
      }
      
      // Check for failed login patterns
      if (pattern.failedLogins > 5 && pattern.lastFailedLogin && 
          now - pattern.lastFailedLogin < 5 * 60 * 1000) { // 5 minutes
        return res.status(429).json({ 
          error: 'Multiple failed login attempts detected',
          code: 'MULTIPLE_FAILED_LOGINS'
        });
      }
      
      next();
    } catch (error) {
      console.error('Suspicious activity detection error:', error);
      next(); // Don't block request on detection error
    }
  }

  /**
   * Validate Aadhaar number format and checksum
   */
  static validateAadhaarNumber(aadhaarNumber) {
    if (!aadhaarNumber || typeof aadhaarNumber !== 'string') {
      return { valid: false, error: 'Aadhaar number is required' };
    }

    // Remove spaces and hyphens
    const cleanAadhaar = aadhaarNumber.replace(/[\s-]/g, '');
    
    // Check length
    if (cleanAadhaar.length !== 12) {
      return { valid: false, error: 'Aadhaar number must be 12 digits' };
    }

    // Check if all digits
    if (!/^\d{12}$/.test(cleanAadhaar)) {
      return { valid: false, error: 'Aadhaar number must contain only digits' };
    }

    // Check if first digit is not 0 or 1
    if (cleanAadhaar[0] === '0' || cleanAadhaar[0] === '1') {
      return { valid: false, error: 'Invalid Aadhaar number format' };
    }

    // Verhoeff algorithm for checksum validation
    const verhoeffTable = [
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
      [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
      [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
      [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
      [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
      [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
      [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
      [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
      [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
    ];

    const permutationTable = [
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
      [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
      [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
      [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
      [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
      [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
      [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
      [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
    ];

    let checksum = 0;
    const digits = cleanAadhaar.split('').map(Number).reverse();

    for (let i = 0; i < digits.length; i++) {
      checksum = verhoeffTable[checksum][permutationTable[i % 8][digits[i]]];
    }

    if (checksum !== 0) {
      return { valid: false, error: 'Invalid Aadhaar number checksum' };
    }

    return { valid: true, cleanAadhaar };
  }

  /**
   * Validate PAN number format
   */
  static validatePANNumber(panNumber) {
    if (!panNumber || typeof panNumber !== 'string') {
      return { valid: false, error: 'PAN number is required' };
    }

    const cleanPAN = panNumber.toUpperCase().trim();
    
    // PAN format: ABCDE1234F
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    
    if (!panRegex.test(cleanPAN)) {
      return { valid: false, error: 'Invalid PAN number format' };
    }

    // Additional validation: 4th character should be 'P' for individual
    const fourthChar = cleanPAN[3];
    const validFourthChars = ['P', 'C', 'H', 'F', 'A', 'T', 'B', 'L', 'J', 'G'];
    
    if (!validFourthChars.includes(fourthChar)) {
      return { valid: false, error: 'Invalid PAN number category' };
    }

    return { valid: true, cleanPAN };
  }

  /**
   * Validate Indian mobile number
   */
  static validateMobileNumber(mobileNumber) {
    if (!mobileNumber || typeof mobileNumber !== 'string') {
      return { valid: false, error: 'Mobile number is required' };
    }

    const cleanMobile = mobileNumber.replace(/[\s-+()]/g, '');
    
    // Indian mobile number format: starts with 6-9, followed by 9 digits
    const mobileRegex = /^[6-9]\d{9}$/;
    
    if (!mobileRegex.test(cleanMobile)) {
      return { valid: false, error: 'Invalid Indian mobile number format' };
    }

    return { valid: true, cleanMobile };
  }

  /**
   * Validate Indian PIN code
   */
  static validatePincode(pincode) {
    if (!pincode || typeof pincode !== 'string') {
      return { valid: false, error: 'PIN code is required' };
    }

    const cleanPincode = pincode.trim();
    
    // Indian PIN code format: 6 digits, first digit cannot be 0
    const pincodeRegex = /^[1-9][0-9]{5}$/;
    
    if (!pincodeRegex.test(cleanPincode)) {
      return { valid: false, error: 'Invalid PIN code format' };
    }

    return { valid: true, cleanPincode };
  }

  /**
   * Clean up expired rate limit entries
   */
  static cleanupRateLimits() {
    const now = Date.now();
    
    for (const [key, limit] of SecurityMiddleware.rateLimitStore.entries()) {
      if (now > limit.resetTime) {
        SecurityMiddleware.rateLimitStore.delete(key);
      }
    }
    
    for (const [key, pattern] of SecurityMiddleware.suspiciousPatterns.entries()) {
      pattern.requests = pattern.requests.filter(time => now - time < 60 * 1000);
      if (pattern.requests.length === 0 && 
          (!pattern.lastFailedLogin || now - pattern.lastFailedLogin > 60 * 60 * 1000)) {
        SecurityMiddleware.suspiciousPatterns.delete(key);
      }
    }
  }

  /**
   * Record failed login attempt
   */
  static recordFailedLogin(identifier) {
    if (!SecurityMiddleware.suspiciousPatterns.has(identifier)) {
      SecurityMiddleware.suspiciousPatterns.set(identifier, {
        requests: [],
        failedLogins: 0,
        lastFailedLogin: null
      });
    }
    
    const pattern = SecurityMiddleware.suspiciousPatterns.get(identifier);
    pattern.failedLogins++;
    pattern.lastFailedLogin = Date.now();
  }
}

// Cleanup expired entries every 5 minutes
setInterval(() => {
  SecurityMiddleware.cleanupRateLimits();
}, 5 * 60 * 1000);

module.exports = SecurityMiddleware;
