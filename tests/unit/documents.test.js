const { expect } = require('chai');
const sinon = require('sinon');
const request = require('supertest');
const { MongoClient, ObjectId } = require('mongodb');
const errorHandler = require('../../server/utils/errorHandler');

describe('Document Management Tests', () => {
    let app, mockDb, mockCollection;

    beforeEach(() => {
        // Mock MongoDB
        mockCollection = {
            find: sinon.stub(),
            findOne: sinon.stub(),
            insertOne: sinon.stub(),
            updateOne: sinon.stub(),
            deleteOne: sinon.stub()
        };

        mockDb = {
            collection: sinon.stub().returns(mockCollection)
        };

        // Mock MongoDB client
        sinon.stub(MongoClient.prototype, 'connect').resolves();
        sinon.stub(MongoClient.prototype, 'db').returns(mockDb);
        sinon.stub(MongoClient.prototype, 'close').resolves();

        // Load app after mocking
        app = require('../../server/server-clean');
    });

    afterEach(() => {
        sinon.restore();
    });

    describe('Document Upload', () => {
        it('should upload document successfully', async () => {
            const mockUser = { uid: 'test-user', email: 'test@example.com' };
            const mockDocument = {
                _id: new ObjectId(),
                filename: 'test.pdf',
                size: 1024,
                userId: 'test-user'
            };

            mockCollection.insertOne.resolves({ insertedId: mockDocument._id });

            // Mock authentication middleware
            const authStub = sinon.stub().callsFake((req, res, next) => {
                req.user = mockUser;
                next();
            });

            const response = await request(app)
                .post('/api/documents/upload')
                .attach('document', Buffer.from('test content'), 'test.pdf')
                .expect(200);

            expect(response.body.success).to.be.true;
            expect(mockCollection.insertOne.called).to.be.true;
        });

        it('should reject files that are too large', async () => {
            const error = errorHandler.createError('VALIDATION_FILE_TOO_LARGE', {
                size: 20 * 1024 * 1024,
                maxSize: 10 * 1024 * 1024
            });

            expect(error.code).to.equal('VALIDATION_FILE_TOO_LARGE');
            expect(error.statusCode).to.equal(413);
        });

        it('should reject invalid file types', async () => {
            errorHandler.validateFileType('test.exe', ['.pdf', '.doc', '.docx']);
            // Should throw error for .exe files
        });
    });

    describe('Document Retrieval', () => {
        it('should fetch user documents', async () => {
            const mockDocuments = [
                { _id: new ObjectId(), filename: 'doc1.pdf', userId: 'test-user' },
                { _id: new ObjectId(), filename: 'doc2.pdf', userId: 'test-user' }
            ];

            mockCollection.find.returns({
                sort: sinon.stub().returns({
                    toArray: sinon.stub().resolves(mockDocuments)
                })
            });

            const response = await request(app)
                .get('/api/documents')
                .set('Authorization', 'Bearer valid-token')
                .expect(200);

            expect(response.body.success).to.be.true;
            expect(response.body.documents).to.have.length(2);
        });

        it('should handle database errors gracefully', async () => {
            const dbError = new Error('Database connection failed');
            mockCollection.find.throws(dbError);

            const response = await request(app)
                .get('/api/documents')
                .set('Authorization', 'Bearer valid-token')
                .expect(500);

            expect(response.body.success).to.be.false;
            expect(response.body.error.code).to.equal('DB_OPERATION_FAILED');
        });
    });

    describe('Document Search', () => {
        it('should search documents by filename', async () => {
            const mockDocuments = [
                { _id: new ObjectId(), filename: 'important.pdf', userId: 'test-user' }
            ];

            mockCollection.find.returns({
                sort: sinon.stub().returns({
                    toArray: sinon.stub().resolves(mockDocuments)
                })
            });

            const response = await request(app)
                .get('/api/documents/search?q=important')
                .set('Authorization', 'Bearer valid-token')
                .expect(200);

            expect(response.body.success).to.be.true;
            expect(response.body.documents).to.have.length(1);
            expect(mockCollection.find.calledWith(sinon.match({
                $or: sinon.match.array
            }))).to.be.true;
        });

        it('should filter by category', async () => {
            const response = await request(app)
                .get('/api/documents/search?category=government')
                .set('Authorization', 'Bearer valid-token')
                .expect(200);

            expect(mockCollection.find.calledWith(sinon.match({
                category: 'government'
            }))).to.be.true;
        });

        it('should filter by date range', async () => {
            const response = await request(app)
                .get('/api/documents/search?dateFilter=week')
                .set('Authorization', 'Bearer valid-token')
                .expect(200);

            expect(mockCollection.find.calledWith(sinon.match({
                uploadedAt: sinon.match.object
            }))).to.be.true;
        });
    });

    describe('Document Encryption', () => {
        it('should toggle document encryption', async () => {
            const documentId = new ObjectId();
            mockCollection.updateOne.resolves({ modifiedCount: 1 });

            const response = await request(app)
                .patch(`/api/documents/${documentId}/encryption`)
                .set('Authorization', 'Bearer valid-token')
                .send({ encrypted: true, encryptionKey: 'test-key' })
                .expect(200);

            expect(response.body.success).to.be.true;
            expect(mockCollection.updateOne.calledWith(
                sinon.match({ _id: documentId }),
                sinon.match({
                    $set: sinon.match({
                        encrypted: true,
                        encryptionKey: 'test-key'
                    })
                })
            )).to.be.true;
        });

        it('should handle document not found', async () => {
            const documentId = new ObjectId();
            mockCollection.updateOne.resolves({ modifiedCount: 0 });

            const response = await request(app)
                .patch(`/api/documents/${documentId}/encryption`)
                .set('Authorization', 'Bearer valid-token')
                .send({ encrypted: true })
                .expect(404);

            expect(response.body.success).to.be.false;
            expect(response.body.error.message).to.equal('Document not found');
        });
    });

    describe('Document Validation', () => {
        it('should validate required fields', () => {
            const data = { filename: '' };
            
            expect(() => {
                errorHandler.validateRequired(data, ['filename', 'size']);
            }).to.throw();
        });

        it('should validate file size', () => {
            expect(() => {
                errorHandler.validateFileSize(15 * 1024 * 1024, 10 * 1024 * 1024);
            }).to.throw();
        });

        it('should validate file type', () => {
            expect(() => {
                errorHandler.validateFileType('malware.exe');
            }).to.throw();
        });
    });

    describe('Error Handling', () => {
        it('should handle MongoDB duplicate key errors', () => {
            const mongoError = new Error('Duplicate key');
            mongoError.code = 11000;

            expect(() => {
                errorHandler.handleDatabaseError(mongoError, 'insert');
            }).to.throw().with.property('code', 'DB_DUPLICATE_ENTRY');
        });

        it('should handle MongoDB cast errors', () => {
            const mongoError = new Error('Cast error');
            mongoError.name = 'CastError';

            expect(() => {
                errorHandler.handleDatabaseError(mongoError, 'find');
            }).to.throw().with.property('code', 'DB_RECORD_NOT_FOUND');
        });
    });
});
