require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');
const admin = require('firebase-admin');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files for testing
app.get('/', (req, res) => {
  res.send('SecureGov Backend Server is running!');
});

// Test endpoint
app.get('/test', (req, res) => {
  res.json({ message: 'Server is working!' });
});

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
let mongoClient;

async function connectMongoDB() {
  try {
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    console.log('✅ MongoDB connected');
  } catch (err) {
    console.error('❌ MongoDB connection error:', err);
  }
}

connectMongoDB();

// Firebase Admin initialization
const SERVICE_ACCOUNT_PATH = process.env.FIREBASE_ADMIN_KEY_PATH || path.join(__dirname, 'serviceAccountKey.json');
if (fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  try {
    const serviceAccount = require(SERVICE_ACCOUNT_PATH);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('✅ Firebase Admin initialized');
  } catch (err) {
    console.error('❌ Firebase Admin initialization error:', err);
  }
} else {
  console.warn('⚠️ Firebase service account key not found at:', SERVICE_ACCOUNT_PATH);
}

// Authentication middleware
async function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('❌ Token verification error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// User sync endpoint
app.post('/api/users/sync', verifyToken, async (req, res) => {
  try {
    console.log('👤 Syncing user:', req.user.uid);
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');
    
    const userData = {
      firebaseUID: req.user.uid,
      email: req.user.email,
      name: req.user.name || req.user.email?.split('@')[0] || 'User',
      lastLogin: new Date(),
      updatedAt: new Date()
    };
    
    await db.collection('users').updateOne(
      { firebaseUID: req.user.uid },
      { $set: userData },
      { upsert: true }
    );
    
    await client.close();
    
    res.json({ success: true, message: 'User synced successfully' });
  } catch (error) {
    console.error('❌ User sync error:', error);
    res.status(500).json({ error: 'Failed to sync user' });
  }
});

// Get documents
app.get('/api/documents', verifyToken, async (req, res) => {
  try {
    console.log('📄 Fetching documents for user:', req.user.uid);
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');
    
    const documents = await db.collection('documents')
      .find({ userId: req.user.uid })
      .sort({ uploadDate: -1 })
      .toArray();
    
    console.log('📄 Found documents:', documents.length);
    
    await client.close();
    
    res.json({
      success: true,
      documents: documents
    });
  } catch (error) {
    console.error('❌ Documents fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// Download document
app.get('/api/documents/:id/download', verifyToken, async (req, res) => {
  try {
    console.log('⬇️ Download request for document:', req.params.id);
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');
    
    const document = await db.collection('documents').findOne({
      _id: new ObjectId(req.params.id),
      userId: req.user.uid
    });
    
    await client.close();
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    const filePath = path.join(__dirname, 'uploads', document.filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on server' });
    }
    
    res.setHeader('Content-Disposition', `attachment; filename="${document.originalName}"`);
    res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('❌ Download error:', error);
    res.status(500).json({ error: 'Failed to download document' });
  }
});

// Delete document
app.delete('/api/documents/:id', verifyToken, async (req, res) => {
  try {
    console.log('🗑️ Delete request for document:', req.params.id);
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');
    
    const document = await db.collection('documents').findOne({
      _id: new ObjectId(req.params.id),
      userId: req.user.uid
    });
    
    if (!document) {
      await client.close();
      return res.status(404).json({ 
        success: false, 
        message: 'Document not found' 
      });
    }
    
    // Delete from database
    await db.collection('documents').deleteOne({
      _id: new ObjectId(req.params.id),
      userId: req.user.uid
    });
    
    await client.close();
    
    // Delete file from filesystem
    const filePath = path.join(__dirname, 'uploads', document.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    
    console.log('✅ Document deleted:', req.params.id);
    
    res.json({
      success: true,
      message: 'Document deleted successfully'
    });
    
  } catch (error) {
    console.error('❌ Delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete document'
    });
  }
});

// Get dashboard stats
app.get('/api/dashboard/stats', verifyToken, async (req, res) => {
  try {
    console.log('📊 Fetching stats for user:', req.user.uid);
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');
    
    const totalDocuments = await db.collection('documents')
      .countDocuments({ userId: req.user.uid });
    
    const recentUploads = await db.collection('documents')
      .countDocuments({ 
        userId: req.user.uid,
        uploadDate: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      });
    
    const documents = await db.collection('documents')
      .find({ userId: req.user.uid })
      .toArray();
    
    const storageUsed = documents.reduce((total, doc) => total + (doc.fileSize || 0), 0);
    
    await client.close();
    
    console.log('📊 Stats calculated:', { totalDocuments, recentUploads, storageUsed });
    
    res.json({
      success: true,
      stats: {
        totalDocuments,
        recentUploads,
        sharedDocuments: 0, // TODO: Implement sharing
        storageUsed,
        familyMembers: 0 // Family features disabled
      }
    });
  } catch (error) {
    console.error('❌ Stats error:', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

app.post('/api/documents/upload', verifyToken, upload.single('document'), async (req, res) => {
  try {
    console.log('📤 Upload request from user:', req.user.uid);
    console.log('📤 File info:', req.file ? req.file.originalname : 'No file');
    console.log('📤 Body:', req.body);

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');

    const documentData = {
      userId: req.user.uid,
      title: req.body.title || req.file.originalname,
      originalName: req.file.originalname,
      filename: req.file.filename,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      classification: req.body.classification || 'general',
      description: req.body.description || '',
      uploadDate: new Date(),
      filePath: req.file.path
    };

    const result = await db.collection('documents').insertOne(documentData);
    
    await client.close();

    console.log('✅ Document uploaded:', result.insertedId);

    res.json({
      success: true,
      message: 'Document uploaded successfully',
      documentId: result.insertedId,
      document: {
        _id: result.insertedId,
        ...documentData
      }
    });

  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Upload failed'
    });
  }
});

// Family Management Endpoints

// Get family members and pending invitations
app.get('/api/family/members', verifyToken, async (req, res) => {
  try {
    console.log('👨‍👩‍👧‍👦 Fetching family members for user:', req.user.uid);
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');
    
    // Get accepted family members
    const members = await db.collection('family_members')
      .find({ 
        $or: [
          { userId: req.user.uid, status: 'active' },
          { invitedEmail: req.user.email, status: 'active' }
        ]
      })
      .toArray();
    
    // Get pending invitations sent by this user AND invitations received by this user
    const pendingInvitations = await db.collection('family_invitations')
      .find({ 
        $or: [
          { inviterId: req.user.uid, status: 'pending' },
          { email: req.user.email, status: 'pending' }
        ]
      })
      .toArray();
    
    await client.close();
    
    res.json({
      success: true,
      members: members,
      pendingInvitations: pendingInvitations
    });
  } catch (error) {
    console.error('❌ Family members fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch family members' });
  }
});

// Get family members count for dashboard
app.get('/api/family/count', verifyToken, async (req, res) => {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');
    
    const count = await db.collection('family_members')
      .countDocuments({ 
        $or: [
          { userId: req.user.uid, status: 'active' },
          { invitedEmail: req.user.email, status: 'active' }
        ]
      });
    
    await client.close();
    
    res.json({
      success: true,
      count: count
    });
  } catch (error) {
    console.error('❌ Family count fetch error:', error);
    res.status(500).json({ success: false, count: 0 });
  }
});

// Send family invitation
app.post('/api/family/invite', verifyToken, async (req, res) => {
  try {
    console.log('📧 Family invite request:', req.body);
    
    const { email, relationship } = req.body;
    
    if (!email || !relationship) {
      return res.status(400).json({
        success: false,
        message: 'Email and relationship are required'
      });
    }
    
    // Don't allow inviting yourself
    if (email === req.user.email) {
      return res.status(400).json({
        success: false,
        message: 'You cannot invite yourself'
      });
    }
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');
    
    // Check if already exists
    const existingMember = await db.collection('family_members').findOne({
      $or: [
        { userId: req.user.uid, invitedEmail: email },
        { inviterId: req.user.uid, invitedEmail: email }
      ]
    });
    
    const existingInvitation = await db.collection('family_invitations').findOne({
      inviterId: req.user.uid,
      email: email,
      status: 'pending'
    });
    
    if (existingMember || existingInvitation) {
      await client.close();
      return res.status(400).json({
        success: false,
        message: 'This person is already invited or is a family member'
      });
    }
    
    // Generate secure invitation token
    const inviteToken = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    
    // Create invitation record
    const invitation = {
      inviterId: req.user.uid,
      inviterName: req.user.name || req.user.email,
      inviterEmail: req.user.email,
      email: email,
      relationship: relationship,
      status: 'pending',
      inviteToken: inviteToken,
      invitedAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
    };
    
    const result = await db.collection('family_invitations').insertOne(invitation);
    
    await client.close();
    
    console.log('✅ Family invitation created:', result.insertedId);
    
    // TODO: Send email invitation here
    console.log('📧 Email invitation would be sent to:', email);
    console.log('🔗 Invitation link: http://localhost:5500/pages/accept-invitation.html?token=' + inviteToken);
    
    res.json({
      success: true,
      message: 'Family invitation sent successfully',
      invitationId: result.insertedId
    });
    
  } catch (error) {
    console.error('❌ Family invite error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send family invitation' 
    });
  }
});

// Remove family member
app.delete('/api/family/members/:memberId', verifyToken, async (req, res) => {
  try {
    console.log('🗑️ Remove family member:', req.params.memberId);
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');
    
    const result = await db.collection('family_members').deleteOne({
      _id: new ObjectId(req.params.memberId),
      userId: req.user.uid
    });
    
    await client.close();
    
    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Family member not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Family member removed successfully'
    });
    
  } catch (error) {
    console.error('❌ Remove family member error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove family member'
    });
  }
});

// Cancel invitation
app.delete('/api/family/invitations/:invitationId', verifyToken, async (req, res) => {
  try {
    console.log('❌ Cancel invitation:', req.params.invitationId);
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');
    
    const result = await db.collection('family_invitations').deleteOne({
      _id: new ObjectId(req.params.invitationId),
      inviterId: req.user.uid
    });
    
    await client.close();
    
    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invitation not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Invitation cancelled successfully'
    });
    
  } catch (error) {
    console.error('❌ Cancel invitation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel invitation'
    });
  }
});

// Resend invitation
app.post('/api/family/invitations/:invitationId/resend', verifyToken, async (req, res) => {
  try {
    console.log('📧 Resend invitation:', req.params.invitationId);
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');
    
    // Update invitation with new expiry
    const result = await db.collection('family_invitations').updateOne(
      {
        _id: new ObjectId(req.params.invitationId),
        inviterId: req.user.uid
      },
      {
        $set: {
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          resentAt: new Date()
        }
      }
    );
    
    await client.close();
    
    if (result.modifiedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Invitation not found'
      });
    }
    
    // TODO: Resend email invitation here
    console.log('📧 Email invitation would be resent');
    
    res.json({
      success: true,
      message: 'Invitation resent successfully'
    });
    
  } catch (error) {
    console.error('❌ Resend invitation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resend invitation'
    });
  }
});

// Accept invitation (for when invited user clicks email link)
app.post('/api/family/accept/:token', verifyToken, async (req, res) => {
  try {
    console.log('✅ Accept invitation with token:', req.params.token);
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');
    
    // Find the invitation
    const invitation = await db.collection('family_invitations').findOne({
      inviteToken: req.params.token,
      status: 'pending',
      expiresAt: { $gt: new Date() }
    });
    
    if (!invitation) {
      await client.close();
      return res.status(404).json({
        success: false,
        message: 'Invitation not found or expired'
      });
    }
    
    // Create family member relationship
    const familyMember = {
      userId: invitation.inviterId,
      invitedUserId: req.user.uid,
      invitedEmail: req.user.email,
      name: req.user.name || req.user.email,
      email: req.user.email,
      relationship: invitation.relationship,
      status: 'active',
      acceptedAt: new Date()
    };
    
    await db.collection('family_members').insertOne(familyMember);
    
    // Mark invitation as accepted
    await db.collection('family_invitations').updateOne(
      { _id: invitation._id },
      { 
        $set: { 
          status: 'accepted',
          acceptedAt: new Date(),
          acceptedBy: req.user.uid
        }
      }
    );
    
    await client.close();
    
    res.json({
      success: true,
      message: 'Family invitation accepted successfully'
    });
    
  } catch (error) {
    console.error('❌ Accept invitation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept invitation'
    });
  }
});

// Reject invitation (for when invited user declines)
app.post('/api/family/reject-invitation/:token', verifyToken, async (req, res) => {
  try {
    console.log('❌ Reject invitation with token:', req.params.token);
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');
    
    // Find the invitation
    const invitation = await db.collection('family_invitations').findOne({
      inviteToken: req.params.token,
      status: 'pending'
    });
    
    if (!invitation) {
      await client.close();
      return res.status(404).json({
        success: false,
        message: 'Invitation not found'
      });
    }
    
    // Mark invitation as rejected
    await db.collection('family_invitations').updateOne(
      { _id: invitation._id },
      { 
        $set: { 
          status: 'rejected',
          rejectedAt: new Date(),
          rejectedBy: req.user.uid
        }
      }
    );
    
    await client.close();
    
    res.json({
      success: true,
      message: 'Family invitation rejected successfully'
    });
    
  } catch (error) {
    console.error('❌ Reject invitation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject invitation'
    });
  }
});

// Profile endpoints
app.get('/api/users/profile', verifyToken, async (req, res) => {
  try {
    console.log('👤 Fetching user profile for:', req.user.uid);
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');
    
    // Get user data from database
    const userData = await db.collection('users').findOne({
      firebaseUID: req.user.uid
    });
    
    await client.close();
    
    const profile = {
      firebaseUID: req.user.uid,
      email: req.user.email,
      name: userData?.name || req.user.name || req.user.email?.split('@')[0] || 'User',
      personalInfo: {
        firstName: (userData?.name || req.user.name || '').split(' ')[0] || 'User',
        lastName: (userData?.name || req.user.name || '').split(' ')[1] || '',
        email: req.user.email,
        phoneNumber: userData?.phoneNumber || '',
        dateOfBirth: userData?.dateOfBirth || '',
        address: userData?.address || ''
      },
      governmentIds: {
        aadhaar: userData?.governmentIds?.aadhaar || '',
        pan: userData?.governmentIds?.pan || '',
        passport: userData?.governmentIds?.passport || '',
        drivingLicense: userData?.governmentIds?.drivingLicense || ''
      },
      securitySettings: {
        twoFactorEnabled: userData?.securitySettings?.twoFactorEnabled || false,
        loginNotifications: userData?.securitySettings?.loginNotifications || true,
        dataSharing: userData?.securitySettings?.dataSharing || false
      },
      profileStatus: {
        completionPercentage: userData?.profileStatus?.completionPercentage || 25,
        level: userData?.profileStatus?.level || 'basic'
      },
      lastLogin: userData?.lastLogin || new Date(),
      profilePicture: userData?.profilePicture || null
    };
    
    res.json({
      success: true,
      profile: profile
    });
    
  } catch (error) {
    console.error('❌ Profile fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Update user profile
app.put('/api/users/profile', verifyToken, async (req, res) => {
  try {
    console.log('👤 Updating user profile for:', req.user.uid);
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');
    
    const updateData = {
      ...req.body,
      firebaseUID: req.user.uid,
      email: req.user.email,
      updatedAt: new Date()
    };
    
    await db.collection('users').updateOne(
      { firebaseUID: req.user.uid },
      { $set: updateData },
      { upsert: true }
    );
    
    await client.close();
    
    res.json({
      success: true,
      message: 'Profile updated successfully'
    });
    
  } catch (error) {
    console.error('❌ Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 SecureGov server running on port ${PORT}`);
});

module.exports = app;
