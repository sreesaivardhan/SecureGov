class FrontendErrorHandler {
    constructor() {
        this.setupGlobalHandlers();
        this.errorQueue = [];
        this.maxQueueSize = 100;
    }

    // Setup global error handlers
    setupGlobalHandlers() {
        // Handle uncaught JavaScript errors
        window.addEventListener('error', (event) => {
            this.logError('JavaScript Error', {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error?.stack
            });
        });

        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.logError('Unhandled Promise Rejection', {
                reason: event.reason?.message || event.reason,
                stack: event.reason?.stack
            });
        });

        // Handle network errors
        this.setupNetworkErrorHandling();
    }

    // Setup network error handling for fetch requests
    setupNetworkErrorHandling() {
        const originalFetch = window.fetch;
        window.fetch = async (...args) => {
            try {
                const response = await originalFetch(...args);
                
                // Log failed HTTP requests
                if (!response.ok) {
                    this.logError('HTTP Error', {
                        url: args[0],
                        status: response.status,
                        statusText: response.statusText,
                        method: args[1]?.method || 'GET'
                    });
                }
                
                return response;
            } catch (error) {
                this.logError('Network Error', {
                    url: args[0],
                    method: args[1]?.method || 'GET',
                    error: error.message
                });
                throw error;
            }
        };
    }

    // Log errors to console and queue
    logError(type, details) {
        const errorEntry = {
            id: Math.random().toString(36).substr(2, 9),
            type,
            details,
            timestamp: new Date().toISOString(),
            url: window.location.href,
            userAgent: navigator.userAgent
        };

        // Add to queue
        this.errorQueue.push(errorEntry);
        if (this.errorQueue.length > this.maxQueueSize) {
            this.errorQueue.shift();
        }

        // Log to console
        console.error(`[${type}]`, details);

        // Send to server if available
        this.sendErrorToServer(errorEntry);

        // Show user notification for critical errors
        if (this.isCriticalError(type)) {
            this.showErrorNotification(type, details);
        }
    }

    // Send error to server
    async sendErrorToServer(errorEntry) {
        try {
            const user = firebase.auth().currentUser;
            if (!user) return;

            const token = await user.getIdToken();
            
            await fetch('/api/errors/client', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(errorEntry)
            });
        } catch (error) {
            // Silently fail - don't create error loops
            console.warn('Failed to send error to server:', error);
        }
    }

    // Check if error is critical
    isCriticalError(type) {
        const criticalTypes = [
            'Network Error',
            'Authentication Error',
            'Data Loss Error'
        ];
        return criticalTypes.includes(type);
    }

    // Show error notification to user
    showErrorNotification(type, details) {
        if (window.advancedFeatures && window.advancedFeatures.showNotification) {
            let message = 'An error occurred. Please try again.';
            
            if (type === 'Network Error') {
                message = 'Network connection error. Please check your internet connection.';
            } else if (type === 'Authentication Error') {
                message = 'Authentication error. Please sign in again.';
            }
            
            window.advancedFeatures.showNotification(message, 'error');
        }
    }

    // API error handling helper
    async handleApiResponse(response, context = {}) {
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            
            const error = {
                status: response.status,
                statusText: response.statusText,
                message: errorData.error?.message || 'API request failed',
                code: errorData.error?.code,
                context
            };

            this.logError('API Error', error);
            
            // Handle specific error types
            if (response.status === 401) {
                this.handleAuthenticationError();
            } else if (response.status === 403) {
                this.handleAuthorizationError();
            } else if (response.status >= 500) {
                this.handleServerError(error);
            }
            
            throw new Error(error.message);
        }
        
        return response;
    }

    // Handle authentication errors
    handleAuthenticationError() {
        this.logError('Authentication Error', {
            message: 'User authentication failed'
        });
        
        // Sign out user and redirect to login
        if (firebase.auth().currentUser) {
            firebase.auth().signOut().then(() => {
                window.location.reload();
            });
        }
    }

    // Handle authorization errors
    handleAuthorizationError() {
        this.logError('Authorization Error', {
            message: 'User lacks required permissions'
        });
        
        if (window.advancedFeatures) {
            window.advancedFeatures.showNotification(
                'You do not have permission to perform this action.',
                'error'
            );
        }
    }

    // Handle server errors
    handleServerError(error) {
        this.logError('Server Error', error);
        
        if (window.advancedFeatures) {
            window.advancedFeatures.showNotification(
                'Server error occurred. Please try again later.',
                'error'
            );
        }
    }

    // Validation helpers
    validateForm(formData, rules) {
        const errors = [];
        
        Object.keys(rules).forEach(field => {
            const rule = rules[field];
            const value = formData[field];
            
            if (rule.required && (!value || value.trim() === '')) {
                errors.push(`${field} is required`);
            }
            
            if (rule.email && value && !this.isValidEmail(value)) {
                errors.push(`${field} must be a valid email address`);
            }
            
            if (rule.minLength && value && value.length < rule.minLength) {
                errors.push(`${field} must be at least ${rule.minLength} characters`);
            }
            
            if (rule.maxLength && value && value.length > rule.maxLength) {
                errors.push(`${field} must be no more than ${rule.maxLength} characters`);
            }
        });
        
        if (errors.length > 0) {
            this.logError('Validation Error', { errors, formData: Object.keys(formData) });
            throw new Error(errors.join(', '));
        }
        
        return true;
    }

    // Email validation
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    // File validation
    validateFile(file, options = {}) {
        const errors = [];
        const {
            maxSize = 10 * 1024 * 1024, // 10MB
            allowedTypes = ['.pdf', '.doc', '.docx', '.jpg', '.png', '.gif'],
            required = false
        } = options;
        
        if (required && !file) {
            errors.push('File is required');
        }
        
        if (file) {
            if (file.size > maxSize) {
                errors.push(`File size must be less than ${this.formatFileSize(maxSize)}`);
            }
            
            const extension = '.' + file.name.split('.').pop().toLowerCase();
            if (!allowedTypes.includes(extension)) {
                errors.push(`File type ${extension} is not allowed. Allowed types: ${allowedTypes.join(', ')}`);
            }
        }
        
        if (errors.length > 0) {
            this.logError('File Validation Error', { errors, fileName: file?.name });
            throw new Error(errors.join(', '));
        }
        
        return true;
    }

    // Format file size
    formatFileSize(bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        if (bytes === 0) return '0 Bytes';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }

    // Retry mechanism for failed operations
    async retry(operation, maxAttempts = 3, delay = 1000) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await operation();
            } catch (error) {
                lastError = error;
                
                this.logError('Retry Attempt Failed', {
                    attempt,
                    maxAttempts,
                    error: error.message
                });
                
                if (attempt < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, delay * attempt));
                }
            }
        }
        
        this.logError('All Retry Attempts Failed', {
            maxAttempts,
            finalError: lastError.message
        });
        
        throw lastError;
    }

    // Get error statistics
    getErrorStats() {
        const stats = {
            total: this.errorQueue.length,
            byType: {},
            recent: this.errorQueue.slice(-10)
        };
        
        this.errorQueue.forEach(error => {
            stats.byType[error.type] = (stats.byType[error.type] || 0) + 1;
        });
        
        return stats;
    }

    // Clear error queue
    clearErrors() {
        this.errorQueue = [];
    }

    // Export errors for debugging
    exportErrors() {
        const data = {
            errors: this.errorQueue,
            timestamp: new Date().toISOString(),
            url: window.location.href,
            userAgent: navigator.userAgent
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `securegov-errors-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(url);
    }
}

// Create global instance
window.errorHandler = new FrontendErrorHandler();

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FrontendErrorHandler;
}
