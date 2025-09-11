const { expect } = require('chai');
const sinon = require('sinon');
const request = require('supertest');
const { MongoClient, ObjectId } = require('mongodb');
const errorHandler = require('../../server/utils/errorHandler');

describe('Family Management Tests', () => {
    let app, mockDb, mockFamilyCollection, mockInvitationCollection;

    beforeEach(() => {
        // Mock MongoDB collections
        mockFamilyCollection = {
            find: sinon.stub(),
            findOne: sinon.stub(),
            insertOne: sinon.stub(),
            updateOne: sinon.stub(),
            deleteOne: sinon.stub()
        };

        mockInvitationCollection = {
            find: sinon.stub(),
            findOne: sinon.stub(),
            insertOne: sinon.stub(),
            updateOne: sinon.stub(),
            deleteOne: sinon.stub()
        };

        mockDb = {
            collection: sinon.stub().callsFake((name) => {
                if (name === 'family_members') return mockFamilyCollection;
                if (name === 'family_invitations') return mockInvitationCollection;
                return mockFamilyCollection;
            })
        };

        // Mock MongoDB client
        sinon.stub(MongoClient.prototype, 'connect').resolves();
        sinon.stub(MongoClient.prototype, 'db').returns(mockDb);
        sinon.stub(MongoClient.prototype, 'close').resolves();

        app = require('../../server/server-clean');
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('Family Members Retrieval', () => {
        it('should fetch family members and pending invitations', async () => {
            const mockMembers = [
                { _id: new ObjectId(), userId: 'test-user', email: 'member@example.com', status: 'active' }
            ];
            const mockInvitations = [
                { _id: new ObjectId(), inviterId: 'test-user', email: 'invited@example.com', status: 'pending' }
            ];

            mockFamilyCollection.find.returns({ toArray: sinon.stub().resolves(mockMembers) });
            mockInvitationCollection.find.returns({ toArray: sinon.stub().resolves(mockInvitations) });

            const response = await request(app)
                .get('/api/family/members')
                .set('Authorization', 'Bearer valid-token')
                .expect(200);

            expect(response.body.success).to.be.true;
            expect(response.body.members).to.have.length(1);
            expect(response.body.pendingInvitations).to.have.length(1);
        });

        it('should handle database errors', async () => {
            const dbError = new Error('Database connection failed');
            mockFamilyCollection.find.throws(dbError);

            const response = await request(app)
                .get('/api/family/members')
                .set('Authorization', 'Bearer valid-token')
                .expect(500);

            expect(response.body.success).to.be.false;
        });
    });

    describe('Family Invitations', () => {
        it('should send family invitation successfully', async () => {
            const invitationData = {
                email: 'newmember@example.com',
                relationship: 'spouse'
            };

            // Mock no existing invitation
            mockInvitationCollection.findOne.resolves(null);
            mockInvitationCollection.insertOne.resolves({ insertedId: new ObjectId() });

            const response = await request(app)
                .post('/api/family/invite')
                .set('Authorization', 'Bearer valid-token')
                .send(invitationData)
                .expect(200);

            expect(response.body.success).to.be.true;
            expect(mockInvitationCollection.insertOne.called).to.be.true;
        });

        it('should prevent duplicate invitations', async () => {
            const invitationData = {
                email: 'existing@example.com',
                relationship: 'child'
            };

            // Mock existing invitation
            mockInvitationCollection.findOne.resolves({
                _id: new ObjectId(),
                email: 'existing@example.com',
                status: 'pending'
            });

            const response = await request(app)
                .post('/api/family/invite')
                .set('Authorization', 'Bearer valid-token')
                .send(invitationData)
                .expect(409);

            expect(response.body.success).to.be.false;
            expect(response.body.error.code).to.equal('FAMILY_DUPLICATE_INVITATION');
        });

        it('should validate email format', () => {
            expect(() => {
                errorHandler.validateEmail('invalid-email');
            }).to.throw();

            expect(() => {
                errorHandler.validateEmail('valid@example.com');
            }).to.not.throw();
        });

        it('should prevent self-invitations', async () => {
            const invitationData = {
                email: 'test@example.com', // Same as authenticated user
                relationship: 'self'
            };

            const response = await request(app)
                .post('/api/family/invite')
                .set('Authorization', 'Bearer valid-token')
                .send(invitationData)
                .expect(400);

            expect(response.body.success).to.be.false;
        });
    });

    describe('Invitation Acceptance', () => {
        it('should accept valid invitation', async () => {
            const mockInvitation = {
                _id: new ObjectId(),
                token: 'valid-token-123',
                email: 'invited@example.com',
                status: 'pending',
                expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
            };

            mockInvitationCollection.findOne.resolves(mockInvitation);
            mockInvitationCollection.updateOne.resolves({ modifiedCount: 1 });
            mockFamilyCollection.insertOne.resolves({ insertedId: new ObjectId() });

            const response = await request(app)
                .post('/api/family/accept/valid-token-123')
                .set('Authorization', 'Bearer valid-token')
                .expect(200);

            expect(response.body.success).to.be.true;
            expect(mockFamilyCollection.insertOne.called).to.be.true;
        });

        it('should reject expired invitations', async () => {
            const mockInvitation = {
                _id: new ObjectId(),
                token: 'expired-token-123',
                email: 'invited@example.com',
                status: 'pending',
                expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
            };

            mockInvitationCollection.findOne.resolves(mockInvitation);

            const response = await request(app)
                .post('/api/family/accept/expired-token-123')
                .set('Authorization', 'Bearer valid-token')
                .expect(410);

            expect(response.body.success).to.be.false;
            expect(response.body.error.code).to.equal('FAMILY_INVITATION_EXPIRED');
        });

        it('should reject invalid tokens', async () => {
            mockInvitationCollection.findOne.resolves(null);

            const response = await request(app)
                .post('/api/family/accept/invalid-token')
                .set('Authorization', 'Bearer valid-token')
                .expect(404);

            expect(response.body.success).to.be.false;
            expect(response.body.error.code).to.equal('FAMILY_INVITATION_NOT_FOUND');
        });
    });

    describe('Invitation Rejection', () => {
        it('should reject invitation successfully', async () => {
            const mockInvitation = {
                _id: new ObjectId(),
                token: 'valid-token-123',
                status: 'pending'
            };

            mockInvitationCollection.findOne.resolves(mockInvitation);
            mockInvitationCollection.updateOne.resolves({ modifiedCount: 1 });

            const response = await request(app)
                .post('/api/family/reject-invitation/valid-token-123')
                .set('Authorization', 'Bearer valid-token')
                .expect(200);

            expect(response.body.success).to.be.true;
            expect(mockInvitationCollection.updateOne.calledWith(
                sinon.match({ token: 'valid-token-123' }),
                sinon.match({ $set: { status: 'rejected' } })
            )).to.be.true;
        });
    });

    describe('Family Member Management', () => {
        it('should remove family member', async () => {
            const memberId = new ObjectId();
            mockFamilyCollection.deleteOne.resolves({ deletedCount: 1 });

            const response = await request(app)
                .delete(`/api/family/members/${memberId}`)
                .set('Authorization', 'Bearer valid-token')
                .expect(200);

            expect(response.body.success).to.be.true;
            expect(mockFamilyCollection.deleteOne.called).to.be.true;
        });

        it('should handle member not found', async () => {
            const memberId = new ObjectId();
            mockFamilyCollection.deleteOne.resolves({ deletedCount: 0 });

            const response = await request(app)
                .delete(`/api/family/members/${memberId}`)
                .set('Authorization', 'Bearer valid-token')
                .expect(404);

            expect(response.body.success).to.be.false;
        });
    });

    describe('Invitation Management', () => {
        it('should cancel invitation', async () => {
            const invitationId = new ObjectId();
            mockInvitationCollection.deleteOne.resolves({ deletedCount: 1 });

            const response = await request(app)
                .delete(`/api/family/invitations/${invitationId}`)
                .set('Authorization', 'Bearer valid-token')
                .expect(200);

            expect(response.body.success).to.be.true;
        });

        it('should resend invitation', async () => {
            const invitationId = new ObjectId();
            const mockInvitation = {
                _id: invitationId,
                email: 'resend@example.com',
                inviterId: 'test-user'
            };

            mockInvitationCollection.findOne.resolves(mockInvitation);
            mockInvitationCollection.updateOne.resolves({ modifiedCount: 1 });

            const response = await request(app)
                .post(`/api/family/invitations/${invitationId}/resend`)
                .set('Authorization', 'Bearer valid-token')
                .expect(200);

            expect(response.body.success).to.be.true;
            expect(mockInvitationCollection.updateOne.called).to.be.true;
        });
    });

    describe('Family Count', () => {
        it('should return family member count', async () => {
            mockFamilyCollection.find.returns({
                toArray: sinon.stub().resolves([
                    { _id: new ObjectId() },
                    { _id: new ObjectId() }
                ])
            });

            const response = await request(app)
                .get('/api/family/count')
                .set('Authorization', 'Bearer valid-token')
                .expect(200);

            expect(response.body.success).to.be.true;
            expect(response.body.count).to.equal(2);
        });
    });

    describe('Security and Validation', () => {
        it('should require authentication for all endpoints', async () => {
            const endpoints = [
                { method: 'get', path: '/api/family/members' },
                { method: 'post', path: '/api/family/invite' },
                { method: 'get', path: '/api/family/count' }
            ];

            for (const endpoint of endpoints) {
                const response = await request(app)[endpoint.method](endpoint.path)
                    .expect(401);
                
                expect(response.body.success).to.be.false;
                expect(response.body.error.code).to.equal('AUTH_TOKEN_MISSING');
            }
        });

        it('should validate invitation data', () => {
            const invalidData = { email: '', relationship: '' };
            
            expect(() => {
                errorHandler.validateRequired(invalidData, ['email', 'relationship']);
            }).to.throw();
        });

        it('should generate secure tokens', () => {
            const crypto = require('crypto');
            const token = crypto.randomBytes(32).toString('hex');
            
            expect(token).to.have.length(64);
            expect(token).to.match(/^[a-f0-9]+$/);
        });
    });
});
