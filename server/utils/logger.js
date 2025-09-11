const fs = require('fs');
const path = require('path');

class Logger {
    constructor() {
        this.logDir = path.join(__dirname, '../logs');
        this.ensureLogDirectory();
        this.logLevels = {
            ERROR: 0,
            WARN: 1,
            INFO: 2,
            DEBUG: 3
        };
        this.currentLevel = this.logLevels.INFO;
    }

    ensureLogDirectory() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    formatMessage(level, message, metadata = {}) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            ...metadata
        };
        return JSON.stringify(logEntry);
    }

    writeToFile(filename, message) {
        const filePath = path.join(this.logDir, filename);
        const logMessage = message + '\n';
        
        try {
            fs.appendFileSync(filePath, logMessage);
        } catch (error) {
            console.error('Failed to write to log file:', error);
        }
    }

    log(level, message, metadata = {}) {
        if (this.logLevels[level] > this.currentLevel) {
            return;
        }

        const formattedMessage = this.formatMessage(level, message, metadata);
        const today = new Date().toISOString().split('T')[0];
        
        // Write to console with colors
        this.logToConsole(level, message, metadata);
        
        // Write to files
        this.writeToFile(`${today}.log`, formattedMessage);
        this.writeToFile(`${level.toLowerCase()}.log`, formattedMessage);
        
        // Write errors to separate error log
        if (level === 'ERROR') {
            this.writeToFile('errors.log', formattedMessage);
        }
    }

    logToConsole(level, message, metadata) {
        const colors = {
            ERROR: '\x1b[31m',   // Red
            WARN: '\x1b[33m',    // Yellow
            INFO: '\x1b[36m',    // Cyan
            DEBUG: '\x1b[37m',   // White
            RESET: '\x1b[0m'     // Reset
        };

        const timestamp = new Date().toISOString();
        const color = colors[level] || colors.RESET;
        const metaStr = Object.keys(metadata).length > 0 ? ` ${JSON.stringify(metadata)}` : '';
        
        console.log(`${color}[${timestamp}] ${level}: ${message}${metaStr}${colors.RESET}`);
    }

    error(message, metadata = {}) {
        this.log('ERROR', message, metadata);
    }

    warn(message, metadata = {}) {
        this.log('WARN', message, metadata);
    }

    info(message, metadata = {}) {
        this.log('INFO', message, metadata);
    }

    debug(message, metadata = {}) {
        this.log('DEBUG', message, metadata);
    }

    // Request logging middleware
    requestLogger() {
        return (req, res, next) => {
            const start = Date.now();
            const requestId = Math.random().toString(36).substr(2, 9);
            
            req.requestId = requestId;
            
            this.info('Request started', {
                requestId,
                method: req.method,
                url: req.url,
                userAgent: req.get('User-Agent'),
                ip: req.ip,
                userId: req.user?.uid || 'anonymous'
            });

            // Log response
            const originalSend = res.send;
            res.send = function(data) {
                const duration = Date.now() - start;
                
                logger.info('Request completed', {
                    requestId,
                    method: req.method,
                    url: req.url,
                    statusCode: res.statusCode,
                    duration: `${duration}ms`,
                    userId: req.user?.uid || 'anonymous'
                });

                return originalSend.call(this, data);
            };

            next();
        };
    }

    // Security event logging
    logSecurityEvent(event, details = {}) {
        this.error('Security Event', {
            event,
            timestamp: new Date().toISOString(),
            ...details
        });
        
        // Write to dedicated security log
        const securityLog = this.formatMessage('SECURITY', event, details);
        this.writeToFile('security.log', securityLog);
    }

    // Database operation logging
    logDatabaseOperation(operation, collection, details = {}) {
        this.debug('Database Operation', {
            operation,
            collection,
            ...details
        });
    }

    // User action logging
    logUserAction(userId, action, details = {}) {
        this.info('User Action', {
            userId,
            action,
            timestamp: new Date().toISOString(),
            ...details
        });
        
        // Write to user activity log
        const userLog = this.formatMessage('USER_ACTION', action, { userId, ...details });
        this.writeToFile('user-activity.log', userLog);
    }

    // Performance logging
    logPerformance(operation, duration, details = {}) {
        const level = duration > 5000 ? 'WARN' : 'INFO';
        this.log(level, `Performance: ${operation}`, {
            duration: `${duration}ms`,
            ...details
        });
    }

    // Clean old logs (keep last 30 days)
    cleanOldLogs() {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        try {
            const files = fs.readdirSync(this.logDir);
            files.forEach(file => {
                if (file.match(/^\d{4}-\d{2}-\d{2}\.log$/)) {
                    const fileDate = new Date(file.replace('.log', ''));
                    if (fileDate < thirtyDaysAgo) {
                        fs.unlinkSync(path.join(this.logDir, file));
                        this.info(`Cleaned old log file: ${file}`);
                    }
                }
            });
        } catch (error) {
            this.error('Failed to clean old logs', { error: error.message });
        }
    }

    // Set log level
    setLevel(level) {
        if (this.logLevels[level] !== undefined) {
            this.currentLevel = this.logLevels[level];
            this.info(`Log level set to ${level}`);
        }
    }

    // Get log statistics
    getLogStats() {
        try {
            const files = fs.readdirSync(this.logDir);
            const stats = {};
            
            files.forEach(file => {
                const filePath = path.join(this.logDir, file);
                const stat = fs.statSync(filePath);
                stats[file] = {
                    size: stat.size,
                    modified: stat.mtime,
                    lines: fs.readFileSync(filePath, 'utf8').split('\n').length - 1
                };
            });
            
            return stats;
        } catch (error) {
            this.error('Failed to get log stats', { error: error.message });
            return {};
        }
    }
}

// Create singleton instance
const logger = new Logger();

// Clean old logs on startup
logger.cleanOldLogs();

// Schedule daily cleanup
setInterval(() => {
    logger.cleanOldLogs();
}, 24 * 60 * 60 * 1000); // 24 hours

module.exports = logger;
