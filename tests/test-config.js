// Test configuration and setup
const path = require('path');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/secureGovDocs_test';

// Global test timeout
const originalTimeout = 5000;

// Mock Firebase Admin for tests
const mockFirebaseAdmin = {
    auth: () => ({
        verifyIdToken: async (token) => {
            if (token === 'valid-token') {
                return {
                    uid: 'test-user-id',
                    email: 'test@example.com'
                };
            }
            if (token === 'expired-token') {
                const error = new Error('Token expired');
                error.code = 'auth/id-token-expired';
                throw error;
            }
            throw new Error('Invalid token');
        }
    }),
    initializeApp: () => {},
    credential: {
        cert: () => ({})
    }
};

// Setup global mocks before tests run
before(() => {
    // Mock Firebase Admin
    const admin = require('firebase-admin');
    Object.assign(admin, mockFirebaseAdmin);
});

// Cleanup after tests
after(() => {
    // Clean up any test data
    console.log('Test cleanup completed');
});

module.exports = {
    testTimeout: originalTimeout,
    mockFirebaseAdmin
};
