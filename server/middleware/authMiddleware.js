const admin = require('firebase-admin');
const logger = require('../utils/logger');
const errorHandler = require('../utils/errorHandler');

// Middleware to verify Firebase token
async function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw errorHandler.createError('AUTH_TOKEN_MISSING', {
        url: req.url,
        method: req.method
      });
    }

    const token = authHeader.substring(7);
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    
    logger.debug('Token verified successfully', {
      userId: decodedToken.uid,
      email: decodedToken.email
    });
    
    next();
  } catch (error) {
    if (error.code && error.statusCode) {
      // Already a handled error
      errorHandler.handleError(error, req, res);
    } else {
      // Firebase auth error
      const handledError = errorHandler.createError('AUTH_TOKEN_INVALID', {
        url: req.url,
        method: req.method
      }, error);
      errorHandler.handleError(handledError, req, res);
    }
  }
}

module.exports = { verifyToken };
