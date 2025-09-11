const logger = require('./logger');

class ErrorHandler {
    constructor() {
        this.errorCodes = {
            // Authentication errors
            AUTH_TOKEN_MISSING: { code: 401, message: 'Authentication token missing' },
            AUTH_TOKEN_INVALID: { code: 401, message: 'Invalid authentication token' },
            AUTH_TOKEN_EXPIRED: { code: 401, message: 'Authentication token expired' },
            AUTH_INSUFFICIENT_PERMISSIONS: { code: 403, message: 'Insufficient permissions' },
            
            // Validation errors
            VALIDATION_REQUIRED_FIELD: { code: 400, message: 'Required field missing' },
            VALIDATION_INVALID_FORMAT: { code: 400, message: 'Invalid data format' },
            VALIDATION_FILE_TOO_LARGE: { code: 413, message: 'File size exceeds limit' },
            VALIDATION_INVALID_FILE_TYPE: { code: 400, message: 'Invalid file type' },
            
            // Database errors
            DB_CONNECTION_FAILED: { code: 500, message: 'Database connection failed' },
            DB_OPERATION_FAILED: { code: 500, message: 'Database operation failed' },
            DB_RECORD_NOT_FOUND: { code: 404, message: 'Record not found' },
            DB_DUPLICATE_ENTRY: { code: 409, message: 'Duplicate entry' },
            
            // Document errors
            DOCUMENT_NOT_FOUND: { code: 404, message: 'Document not found' },
            DOCUMENT_ACCESS_DENIED: { code: 403, message: 'Access denied to document' },
            DOCUMENT_UPLOAD_FAILED: { code: 500, message: 'Document upload failed' },
            DOCUMENT_ENCRYPTION_FAILED: { code: 500, message: 'Document encryption failed' },
            
            // Family errors
            FAMILY_INVITATION_NOT_FOUND: { code: 404, message: 'Family invitation not found' },
            FAMILY_INVITATION_EXPIRED: { code: 410, message: 'Family invitation expired' },
            FAMILY_MEMBER_NOT_FOUND: { code: 404, message: 'Family member not found' },
            FAMILY_DUPLICATE_INVITATION: { code: 409, message: 'Invitation already sent' },
            
            // Generic errors
            INTERNAL_SERVER_ERROR: { code: 500, message: 'Internal server error' },
            SERVICE_UNAVAILABLE: { code: 503, message: 'Service temporarily unavailable' },
            RATE_LIMIT_EXCEEDED: { code: 429, message: 'Rate limit exceeded' }
        };
    }

    // Create standardized error
    createError(errorCode, details = {}, originalError = null) {
        const errorInfo = this.errorCodes[errorCode] || this.errorCodes.INTERNAL_SERVER_ERROR;
        
        const error = new Error(errorInfo.message);
        error.code = errorCode;
        error.statusCode = errorInfo.code;
        error.details = details;
        error.timestamp = new Date().toISOString();
        
        if (originalError) {
            error.originalError = originalError.message;
            error.stack = originalError.stack;
        }
        
        return error;
    }

    // Handle different types of errors
    handleError(error, req = null, res = null) {
        const errorId = Math.random().toString(36).substr(2, 9);
        
        // Log error with context
        logger.error('Error occurred', {
            errorId,
            code: error.code || 'UNKNOWN',
            message: error.message,
            statusCode: error.statusCode || 500,
            details: error.details || {},
            stack: error.stack,
            url: req?.url,
            method: req?.method,
            userId: req?.user?.uid,
            requestId: req?.requestId
        });

        // Security event logging for auth errors
        if (error.statusCode === 401 || error.statusCode === 403) {
            logger.logSecurityEvent('Authentication/Authorization Error', {
                errorId,
                code: error.code,
                url: req?.url,
                method: req?.method,
                userId: req?.user?.uid,
                ip: req?.ip
            });
        }

        // Send response if res object provided
        if (res && !res.headersSent) {
            const statusCode = error.statusCode || 500;
            const response = {
                success: false,
                error: {
                    id: errorId,
                    code: error.code || 'INTERNAL_SERVER_ERROR',
                    message: error.message,
                    timestamp: error.timestamp || new Date().toISOString()
                }
            };

            // Add details in development mode
            if (process.env.NODE_ENV === 'development') {
                response.error.details = error.details;
                response.error.stack = error.stack;
            }

            res.status(statusCode).json(response);
        }

        return errorId;
    }

    // Express error handling middleware
    middleware() {
        return (error, req, res, next) => {
            this.handleError(error, req, res);
        };
    }

    // Async wrapper for route handlers
    asyncHandler(fn) {
        return (req, res, next) => {
            Promise.resolve(fn(req, res, next)).catch(next);
        };
    }

    // Validation helpers
    validateRequired(data, fields) {
        const missing = [];
        fields.forEach(field => {
            if (!data[field] || (typeof data[field] === 'string' && data[field].trim() === '')) {
                missing.push(field);
            }
        });
        
        if (missing.length > 0) {
            throw this.createError('VALIDATION_REQUIRED_FIELD', { missing });
        }
    }

    validateEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            throw this.createError('VALIDATION_INVALID_FORMAT', { field: 'email' });
        }
    }

    validateFileSize(size, maxSize = 10 * 1024 * 1024) { // 10MB default
        if (size > maxSize) {
            throw this.createError('VALIDATION_FILE_TOO_LARGE', { 
                size, 
                maxSize,
                sizeHuman: this.formatFileSize(size),
                maxSizeHuman: this.formatFileSize(maxSize)
            });
        }
    }

    validateFileType(filename, allowedTypes = ['.pdf', '.doc', '.docx', '.jpg', '.png']) {
        const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
        if (!allowedTypes.includes(ext)) {
            throw this.createError('VALIDATION_INVALID_FILE_TYPE', { 
                filename, 
                extension: ext, 
                allowedTypes 
            });
        }
    }

    // Database error handling
    handleDatabaseError(error, operation = 'unknown') {
        logger.logDatabaseOperation(operation, 'unknown', { error: error.message });
        
        if (error.code === 11000) { // MongoDB duplicate key error
            throw this.createError('DB_DUPLICATE_ENTRY', { operation }, error);
        }
        
        if (error.name === 'CastError') {
            throw this.createError('DB_RECORD_NOT_FOUND', { operation }, error);
        }
        
        throw this.createError('DB_OPERATION_FAILED', { operation }, error);
    }

    // Authentication error handling
    handleAuthError(error, context = {}) {
        if (error.code === 'auth/id-token-expired') {
            throw this.createError('AUTH_TOKEN_EXPIRED', context, error);
        }
        
        if (error.code === 'auth/argument-error') {
            throw this.createError('AUTH_TOKEN_INVALID', context, error);
        }
        
        throw this.createError('AUTH_TOKEN_INVALID', context, error);
    }

    // File operation error handling
    handleFileError(error, operation = 'unknown', filename = '') {
        logger.error('File operation error', {
            operation,
            filename,
            error: error.message
        });
        
        if (error.code === 'ENOENT') {
            throw this.createError('DOCUMENT_NOT_FOUND', { filename, operation }, error);
        }
        
        if (error.code === 'EACCES') {
            throw this.createError('DOCUMENT_ACCESS_DENIED', { filename, operation }, error);
        }
        
        throw this.createError('DOCUMENT_UPLOAD_FAILED', { filename, operation }, error);
    }

    // Utility methods
    formatFileSize(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    // Rate limiting error
    handleRateLimit(req, res) {
        const error = this.createError('RATE_LIMIT_EXCEEDED', {
            ip: req.ip,
            url: req.url,
            method: req.method
        });
        
        this.handleError(error, req, res);
    }

    // Process uncaught exceptions
    setupGlobalHandlers() {
        process.on('uncaughtException', (error) => {
            logger.error('Uncaught Exception', {
                error: error.message,
                stack: error.stack
            });
            
            // Graceful shutdown
            process.exit(1);
        });

        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled Rejection', {
                reason: reason?.message || reason,
                stack: reason?.stack
            });
        });
    }
}

// Create singleton instance
const errorHandler = new ErrorHandler();

// Setup global error handlers
errorHandler.setupGlobalHandlers();

module.exports = errorHandler;
