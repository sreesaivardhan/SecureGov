const { expect } = require('chai');
const sinon = require('sinon');
const admin = require('firebase-admin');
const errorHandler = require('../../server/utils/errorHandler');

// Mock Firebase Admin
const mockAuth = {
    verifyIdToken: sinon.stub()
};

describe('Authentication Tests', () => {
    let req, res, next;

    beforeEach(() => {
        req = {
            headers: {},
            url: '/test',
            method: 'GET',
            user: null
        };
        res = {
            status: sinon.stub().returnsThis(),
            json: sinon.stub(),
            headersSent: false
        };
        next = sinon.stub();
        
        // Reset stubs
        mockAuth.verifyIdToken.reset();
        res.status.reset();
        res.json.reset();
        next.reset();
    });

    describe('Token Verification', () => {
        it('should reject requests without authorization header', async () => {
            const verifyToken = require('../../server/middleware/auth');
            
            await verifyToken(req, res, next);
            
            expect(res.status.calledWith(401)).to.be.true;
            expect(res.json.calledWith(sinon.match({
                success: false,
                error: sinon.match({
                    code: 'AUTH_TOKEN_MISSING'
                })
            }))).to.be.true;
            expect(next.called).to.be.false;
        });

        it('should reject requests with invalid token format', async () => {
            req.headers.authorization = 'InvalidFormat token123';
            const verifyToken = require('../../server/middleware/auth');
            
            await verifyToken(req, res, next);
            
            expect(res.status.calledWith(401)).to.be.true;
            expect(next.called).to.be.false;
        });

        it('should accept valid tokens', async () => {
            const mockDecodedToken = {
                uid: 'test-user-id',
                email: 'test@example.com'
            };
            
            req.headers.authorization = 'Bearer valid-token';
            mockAuth.verifyIdToken.resolves(mockDecodedToken);
            
            // Mock admin.auth()
            sinon.stub(admin, 'auth').returns(mockAuth);
            
            const verifyToken = require('../../server/middleware/auth');
            await verifyToken(req, res, next);
            
            expect(req.user).to.deep.equal(mockDecodedToken);
            expect(next.called).to.be.true;
            expect(res.status.called).to.be.false;
            
            admin.auth.restore();
        });

        it('should handle expired tokens', async () => {
            req.headers.authorization = 'Bearer expired-token';
            const expiredError = new Error('Token expired');
            expiredError.code = 'auth/id-token-expired';
            
            mockAuth.verifyIdToken.rejects(expiredError);
            sinon.stub(admin, 'auth').returns(mockAuth);
            
            const verifyToken = require('../../server/middleware/auth');
            await verifyToken(req, res, next);
            
            expect(res.status.calledWith(401)).to.be.true;
            expect(res.json.calledWith(sinon.match({
                success: false,
                error: sinon.match({
                    code: 'AUTH_TOKEN_EXPIRED'
                })
            }))).to.be.true;
            
            admin.auth.restore();
        });
    });

    describe('Error Handler Integration', () => {
        it('should create proper error objects', () => {
            const error = errorHandler.createError('AUTH_TOKEN_MISSING', {
                url: '/test',
                method: 'GET'
            });
            
            expect(error).to.be.an('error');
            expect(error.code).to.equal('AUTH_TOKEN_MISSING');
            expect(error.statusCode).to.equal(401);
            expect(error.details.url).to.equal('/test');
        });

        it('should handle authentication errors properly', () => {
            const originalError = new Error('Firebase auth failed');
            const handledError = errorHandler.createError('AUTH_TOKEN_INVALID', {}, originalError);
            
            expect(handledError.originalError).to.equal('Firebase auth failed');
            expect(handledError.code).to.equal('AUTH_TOKEN_INVALID');
        });
    });

    describe('Security Event Logging', () => {
        it('should log security events for auth failures', () => {
            const logSpy = sinon.spy(console, 'error');
            
            const error = errorHandler.createError('AUTH_TOKEN_INVALID', {
                url: '/api/documents',
                method: 'GET'
            });
            
            errorHandler.handleError(error, req, res);
            
            expect(logSpy.called).to.be.true;
            logSpy.restore();
        });
    });
});
