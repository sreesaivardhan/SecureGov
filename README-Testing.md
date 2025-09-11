# SecureGov Testing & Logging Documentation

## Overview

This document provides comprehensive information about the testing framework, logging system, and error handling implemented in SecureGov.

## 🧪 Testing Framework

### Test Structure

```
tests/
├── unit/                    # Unit tests
│   ├── auth.test.js        # Authentication tests
│   ├── documents.test.js   # Document management tests
│   └── family.test.js      # Family management tests
├── integration/            # Integration tests
│   └── user-acceptance.test.js  # End-to-end user tests
├── test-config.js         # Test configuration
└── run-tests.js          # Test runner script
```

### Running Tests

#### Unit Tests
```bash
npm test                    # Run all unit tests
npm run test:watch         # Run tests in watch mode
npm run test:coverage      # Run tests with coverage report
```

#### Integration Tests
```bash
npm run test:integration   # Run end-to-end tests
```

#### All Tests
```bash
node tests/run-tests.js    # Run complete test suite
```

### Test Configuration

- **Framework**: Mocha + Chai + Sinon
- **Coverage**: NYC (Istanbul)
- **E2E Testing**: Puppeteer
- **Timeout**: 10 seconds (configurable)
- **Environment**: Separate test database

### Test Coverage Goals

- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 85%
- **Lines**: > 80%

## 📝 Logging System

### Logger Features

- **Multiple Log Levels**: ERROR, WARN, INFO, DEBUG
- **File Rotation**: Daily log files with 30-day retention
- **Structured Logging**: JSON format with metadata
- **Console Output**: Colored output for development
- **Performance Tracking**: Request duration logging
- **Security Events**: Dedicated security log

### Log Files Location

```
server/logs/
├── 2024-01-15.log         # Daily logs
├── error.log              # Error-only logs
├── security.log           # Security events
├── user-activity.log      # User actions
└── info.log               # Info-level logs
```

### Usage Examples

```javascript
const logger = require('./utils/logger');

// Basic logging
logger.info('User logged in', { userId: 'abc123' });
logger.error('Database connection failed', { error: error.message });

// User actions
logger.logUserAction('user123', 'document_upload', { 
    filename: 'important.pdf',
    size: 1024 
});

// Security events
logger.logSecurityEvent('failed_login_attempt', {
    ip: '192.168.1.1',
    email: 'attacker@evil.com'
});

// Performance monitoring
logger.logPerformance('database_query', 1500, {
    collection: 'documents',
    operation: 'find'
});
```

### Log Levels

- **ERROR**: System errors, exceptions, failures
- **WARN**: Warnings, deprecated features, performance issues
- **INFO**: General information, user actions, system events
- **DEBUG**: Detailed debugging information (development only)

## 🚨 Error Handling

### Error Handler Features

- **Standardized Error Codes**: Consistent error identification
- **Automatic Logging**: All errors logged with context
- **Security Monitoring**: Auth failures trigger security logs
- **Client-Safe Responses**: Sensitive data filtered in production
- **Stack Trace Capture**: Full error context preservation

### Error Categories

#### Authentication Errors
- `AUTH_TOKEN_MISSING`: No authorization header
- `AUTH_TOKEN_INVALID`: Invalid or malformed token
- `AUTH_TOKEN_EXPIRED`: Expired authentication token
- `AUTH_INSUFFICIENT_PERMISSIONS`: User lacks required permissions

#### Validation Errors
- `VALIDATION_REQUIRED_FIELD`: Missing required field
- `VALIDATION_INVALID_FORMAT`: Invalid data format
- `VALIDATION_FILE_TOO_LARGE`: File exceeds size limit
- `VALIDATION_INVALID_FILE_TYPE`: Unsupported file type

#### Database Errors
- `DB_CONNECTION_FAILED`: Database connection issues
- `DB_OPERATION_FAILED`: Database operation failure
- `DB_RECORD_NOT_FOUND`: Record not found
- `DB_DUPLICATE_ENTRY`: Duplicate key violation

#### Document Errors
- `DOCUMENT_NOT_FOUND`: Document not found
- `DOCUMENT_ACCESS_DENIED`: Access denied to document
- `DOCUMENT_UPLOAD_FAILED`: Document upload failure
- `DOCUMENT_ENCRYPTION_FAILED`: Encryption operation failed

#### Family Errors
- `FAMILY_INVITATION_NOT_FOUND`: Invitation not found
- `FAMILY_INVITATION_EXPIRED`: Invitation has expired
- `FAMILY_MEMBER_NOT_FOUND`: Family member not found
- `FAMILY_DUPLICATE_INVITATION`: Duplicate invitation attempt

### Usage Examples

```javascript
const errorHandler = require('./utils/errorHandler');

// Create standardized errors
const error = errorHandler.createError('DOCUMENT_NOT_FOUND', {
    documentId: 'doc123',
    userId: 'user456'
});

// Handle errors in routes
try {
    const result = await someOperation();
} catch (error) {
    errorHandler.handleError(error, req, res);
}

// Validation helpers
errorHandler.validateRequired(data, ['email', 'password']);
errorHandler.validateEmail('user@example.com');
errorHandler.validateFileSize(fileSize, maxSize);
```

## 🎯 Frontend Error Handling

### Features

- **Global Error Capture**: Unhandled errors and promise rejections
- **Network Error Handling**: Fetch request monitoring
- **User Notifications**: Error messages via notification system
- **Error Reporting**: Automatic error reporting to backend
- **Validation Helpers**: Form and file validation utilities

### Usage Examples

```javascript
// Validation
errorHandler.validateForm(formData, {
    email: { required: true, email: true },
    password: { required: true, minLength: 8 }
});

// File validation
errorHandler.validateFile(file, {
    maxSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['.pdf', '.doc', '.docx']
});

// API error handling
const response = await fetch('/api/documents');
await errorHandler.handleApiResponse(response);

// Retry mechanism
const result = await errorHandler.retry(async () => {
    return await riskyOperation();
}, 3, 1000); // 3 attempts, 1 second delay
```

## 📊 Monitoring & Analytics

### Performance Metrics

- **Request Duration**: Average response times
- **Error Rates**: Error frequency by endpoint
- **User Activity**: Action tracking and patterns
- **System Health**: Database and service status

### Log Analysis

```bash
# View recent errors
tail -f server/logs/error.log

# Search for specific user activity
grep "user123" server/logs/user-activity.log

# Monitor security events
tail -f server/logs/security.log

# Check performance issues
grep "WARN.*Performance" server/logs/*.log
```

### Alerts & Notifications

- **High Error Rates**: > 5% error rate triggers alert
- **Security Events**: Failed login attempts, token issues
- **Performance Issues**: Slow database queries, high memory usage
- **System Failures**: Database disconnections, service outages

## 🔧 Configuration

### Environment Variables

```bash
# Logging
LOG_LEVEL=INFO                    # DEBUG, INFO, WARN, ERROR
LOG_RETENTION_DAYS=30            # Days to keep log files

# Testing
NODE_ENV=test                    # Test environment
MONGODB_TEST_URI=mongodb://...   # Test database URI

# Error Handling
ENABLE_ERROR_REPORTING=true      # Send errors to external service
ERROR_WEBHOOK_URL=https://...    # Webhook for critical errors
```

### Production Considerations

1. **Log Rotation**: Implement logrotate for production
2. **Monitoring**: Use external monitoring services
3. **Alerting**: Set up real-time alerts for critical errors
4. **Performance**: Monitor and optimize slow queries
5. **Security**: Regular security log analysis

## 🚀 Best Practices

### Testing
- Write tests before implementing features (TDD)
- Maintain high test coverage (>80%)
- Use descriptive test names and assertions
- Mock external dependencies
- Test error conditions and edge cases

### Logging
- Log at appropriate levels
- Include relevant context in log messages
- Avoid logging sensitive information
- Use structured logging for better analysis
- Monitor log file sizes and rotation

### Error Handling
- Use specific error codes for different scenarios
- Provide helpful error messages to users
- Log all errors with sufficient context
- Handle errors gracefully without crashing
- Implement proper retry mechanisms for transient failures

## 📈 Metrics & KPIs

### Testing Metrics
- **Test Coverage**: Current coverage percentage
- **Test Execution Time**: Time to run full test suite
- **Test Reliability**: Flaky test identification
- **Bug Detection Rate**: Tests catching bugs before production

### System Health Metrics
- **Error Rate**: Percentage of requests resulting in errors
- **Response Time**: Average API response times
- **Uptime**: System availability percentage
- **Security Events**: Number of security-related incidents

### User Experience Metrics
- **Page Load Time**: Frontend performance
- **User Actions**: Feature usage statistics
- **Error Recovery**: User ability to recover from errors
- **Support Tickets**: Error-related support requests

This comprehensive testing and logging system ensures SecureGov maintains high quality, reliability, and security standards while providing excellent observability into system behavior and user interactions.
