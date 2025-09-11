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
    console.warn('⚠️ Firebase Admin init failed:', err.message);
  }
} else {
  console.warn('⚠️ Firebase serviceAccountKey.json not found');
}

// Basic auth middleware
async function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    console.log('🔐 Auth header:', authHeader);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ No valid auth header');
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    console.log('🎫 Token received:', token.substring(0, 20) + '...');
    
    const decodedToken = await admin.auth().verifyIdToken(token);
    console.log('✅ Token verified for user:', decodedToken.uid);
    
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('❌ Token verification failed:', error.message);
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Basic routes
app.get('/api/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// User sync endpoint
app.post('/api/users/sync', verifyToken, async (req, res) => {
  try {
    console.log('👤 User sync request:', req.body);
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');
    
    const userData = {
      firebaseUID: req.user.uid,
      email: req.user.email || req.body.email,
      name: req.body.name || req.user.name || req.user.email?.split('@')[0] || 'User',
      emailVerified: req.user.email_verified || req.body.emailVerified || false,
      lastLogin: new Date(),
      profilePicture: req.body.profilePicture || null,
      phoneNumber: req.body.phoneNumber || null,
      updatedAt: new Date()
    };
    
    // Upsert user data
    await db.collection('users').updateOne(
      { firebaseUID: req.user.uid },
      { $set: userData },
      { upsert: true }
    );
    
    await client.close();
    
    console.log('✅ User synced successfully:', req.user.uid);
    
    res.json({
      success: true,
      message: 'User synced successfully',
      user: userData
    });
  } catch (error) {
    console.error('❌ User sync error:', error);
    res.status(500).json({ error: 'Failed to sync user' });
  }
});

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  }
});

// Documents endpoints
app.get('/api/documents', verifyToken, async (req, res) => {
  try {
    console.log('📋 Fetching documents for user:', req.user.uid);
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');
    
    const documents = await db.collection('documents')
      .find({ 
        uploadedBy: req.user.uid,
        status: 'active'
      })
      .sort({ uploadDate: -1 })
      .toArray();
    
    console.log('📄 Found documents:', documents.length);
    console.log('Documents:', documents.map(d => ({ title: d.title, id: d._id, uploadDate: d.uploadDate })));
    
    await client.close();
    
    res.json({
      success: true,
      documents: documents,
      pagination: {
        page: 1,
        limit: 50,
        total: documents.length
      }
    });
  } catch (error) {
    console.error('❌ Fetch documents error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch documents' });
  }
});

app.get('/api/documents/:id/download', verifyToken, async (req, res) => {
  try {
    console.log('📥 Download request for document:', req.params.id);
    console.log('👤 User:', req.user.uid);
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');
    
    const document = await db.collection('documents').findOne({
      _id: new ObjectId(req.params.id),
      uploadedBy: req.user.uid
    });
    
    if (!document) {
      console.log('❌ Document not found');
      await client.close();
      return res.status(404).json({ error: 'Document not found' });
    }
    
    console.log('✅ Document found:', document.title);
    
    // Convert base64 back to buffer
    const fileBuffer = Buffer.from(document.fileData, 'base64');
    
    res.set({
      'Content-Type': document.mimeType,
      'Content-Disposition': `inline; filename="${document.fileName}"`,
      'Content-Length': fileBuffer.length
    });
    
    res.send(fileBuffer);
    await client.close();
  } catch (error) {
    console.error('❌ Download error:', error);
    res.status(500).json({ error: 'Download failed' });
  }
});

app.delete('/api/documents/:id', verifyToken, async (req, res) => {
  try {
    console.log('🗑️ Delete request for document:', req.params.id);
    console.log('👤 User:', req.user.uid);
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');
    
    const result = await db.collection('documents').deleteOne({
      _id: new ObjectId(req.params.id),
      uploadedBy: req.user.uid
    });
    
    await client.close();
    
    if (result.deletedCount === 1) {
      console.log('✅ Document deleted successfully');
      res.json({
        success: true,
        message: 'Document deleted successfully'
      });
    } else {
      console.log('❌ Document not found or not authorized');
      res.status(404).json({
        success: false,
        message: 'Document not found or not authorized'
      });
    }
  } catch (error) {
    console.error('❌ Delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete document'
    });
  }
});

app.get('/api/documents/stats', verifyToken, async (req, res) => {
  try {
    console.log('📊 Fetching stats for user:', req.user.uid);
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');
    
    // Get total documents count
    const totalDocuments = await db.collection('documents').countDocuments({
      uploadedBy: req.user.uid,
      status: 'active'
    });
    
    // Get recent uploads (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentUploads = await db.collection('documents').countDocuments({
      uploadedBy: req.user.uid,
      status: 'active',
      uploadDate: { $gte: sevenDaysAgo }
    });
    
    // Calculate total storage used
    const documents = await db.collection('documents').find({
      uploadedBy: req.user.uid,
      status: 'active'
    }).toArray();
    
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
    console.log('📁 Upload request received');
    console.log('User:', req.user.uid);
    console.log('Body:', req.body);
    
    const { file } = req;
    
    if (!file) {
      console.log('❌ No file in request');
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    console.log('📄 File details:', {
      name: file.originalname,
      size: file.size,
      type: file.mimetype
    });

    const documentMetadata = {
      title: req.body.title || file.originalname,
      description: req.body.description || '',
      category: req.body.category || 'other',
      uploadDate: new Date(),
      lastModified: new Date(),
      uploadedBy: req.user.uid,
      fileName: file.originalname,
      originalName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      downloadCount: 0,
      tags: req.body.tags ? req.body.tags.split(',').map(tag => tag.trim()) : [],
      permissions: {
        read: [req.user.uid],
        write: [req.user.uid],
        admin: [req.user.uid]
      },
      status: 'active',
      verificationStatus: 'pending',
      // Store file data as base64
      fileData: file.buffer.toString('base64')
    };

    console.log('💾 Saving to MongoDB...');
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');
    const result = await db.collection('documents').insertOne(documentMetadata);
    await client.close();

    console.log('✅ Document saved with ID:', result.insertedId);

    res.status(201).json({
      success: true,
      message: 'Document uploaded successfully',
      documentId: result.insertedId,
      category: req.body.category || 'other'
    });

  } catch (error) {
    console.error('❌ Upload error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Upload failed'
    });
  }
});

// Family functionality removed - will be reimplemented later

// Family endpoints
app.get('/api/family/my-groups', verifyToken, async (req, res) => {
  try {
    console.log('👨‍👩‍👧‍👦 Fetching family groups for user:', req.user.uid);
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');
    
    const familyMembers = await db.collection('family_members')
      .find({ userId: req.user.uid })
      .toArray();
    
    console.log('👨‍👩‍👧‍👦 Found family members:', familyMembers.length);
    
    await client.close();
    
    res.json({
      success: true,
      familyGroups: familyMembers
    });
  } catch (error) {
    console.error('❌ Family fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch family groups' });
  }
});

app.get('/api/family/invitations/pending', verifyToken, async (req, res) => {
  try {
    console.log('📨 Getting invitations for:', req.user.email);
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');
    
    const invitations = await db.collection('family_members')
      .find({ 
        memberEmail: req.user.email,
        status: 'pending'
      })
      .toArray();
    
    await client.close();
    
    res.json({
      success: true,
      invitations: invitations
    });
    
  } catch (error) {
    console.error('❌ Get invitations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get invitations'
    });
  }
});
  
  // Add missing endpoints that app.js is calling
  app.get('/api/family', verifyToken, async (req, res) => {
    try {
      console.log('👨‍👩‍👧‍👦 Fetching family for user:', req.user.uid);
      
      const client = new MongoClient(MONGODB_URI);
      await client.connect();
      const db = client.db('secureGovDocs');
      
      const familyMembers = await db.collection('family_members')
        .find({ userId: req.user.uid })
        .toArray();
      
      await client.close();
      
      res.json({
        success: true,
        familyMembers: familyMembers
      });
    } catch (error) {
      console.error('❌ Family fetch error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch family' });
    }
  });
  
  app.get('/api/family/my-groups', verifyToken, async (req, res) => {
    try {
      console.log('👨‍👩‍👧‍👦 Fetching my groups for user:', req.user.uid);
      
      const client = new MongoClient(MONGODB_URI);
      await client.connect();
      const db = client.db('secureGovDocs');
      
      const familyGroups = await db.collection('family_members')
        .find({ userId: req.user.uid })
        .toArray();
      
      await client.close();
      
      res.json({
        success: true,
        familyGroups: familyGroups
      });
    } catch (error) {
      console.error('❌ Family groups fetch error:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch family groups' });
    }
  });
  
  app.get('/api/family/invitations', verifyToken, async (req, res) => {
    try {
      console.log('📨 Getting invitations for:', req.user.email);
      
      const client = new MongoClient(MONGODB_URI);
      await client.connect();
      const db = client.db('secureGovDocs');
      
      const invitations = await db.collection('family_members')
        .find({ 
          memberEmail: req.user.email,
          status: 'pending'
        })
        .toArray();
      
      await client.close();
      
      res.json({
        success: true,
        invitations: invitations
      });
      
    } catch (error) {
      console.error('❌ Get invitations error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get invitations'
      });
    }
  });
  
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
      
      const client = new MongoClient(MONGODB_URI);
      await client.connect();
      const db = client.db('secureGovDocs');
      
      // Check if already exists
      const existing = await db.collection('family_members').findOne({
        userId: req.user.uid,
        memberEmail: email,
        status: { $in: ['active', 'pending'] }
      });
      
      if (existing) {
        await client.close();
        return res.status(400).json({
          success: false,
          message: 'This user is already invited or is a family member'
        });
      }
      
      // Get inviter's email from Firebase user data
      const inviterEmail = req.user.email || req.user.uid;
      
      // Generate secure invitation token
      const inviteToken = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      
      // Add family member invitation
      const familyMember = {
        userId: req.user.uid,
        memberEmail: email,
        relationship: relationship,
        invitedAt: new Date(),
        status: 'pending',
        invitedBy: inviterEmail,
        inviteToken: inviteToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days from now
      };
      
      console.log('👤 Creating invitation from:', inviterEmail, 'to:', email);
      
      const result = await db.collection('family_members').insertOne(familyMember);
      
      // Try to send email invitation (don't fail if email fails)
      try {
        const EmailService = require('./services/emailService');
        const emailService = new EmailService();
        
        await emailService.sendFamilyInvitation({
          recipientEmail: email,
          recipientName: email.split('@')[0],
          familyGroupName: `${inviterEmail}'s Family`,
          familyGroupDescription: `Family group managed by ${inviterEmail}`,
          inviterName: inviterEmail,
          inviterEmail: inviterEmail,
          role: relationship,
          invitationToken: inviteToken,
          expiresAt: familyMember.expiresAt
        });
        
        console.log('✉️ Email invitation sent to:', email);
      } catch (emailError) {
        console.warn('⚠️ Email sending failed (invitation still created):', emailError.message);
      }
      
      await client.close();
      
      console.log('✅ Family member invited:', result.insertedId);
      
      res.json({
        success: true,
        message: 'Family member invited successfully',
        memberId: result.insertedId
      });
      
    } catch (error) {
      console.error('❌ Family invite error:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to invite family member' 
      });
    }
  });

// Legacy family endpoints for backward compatibility
app.get('/api/family-legacy', verifyToken, async (req, res) => {
  try {
    console.log('👨‍👩‍👧‍👦 Fetching family members for user:', req.user.uid);
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');
    
    const familyMembers = await db.collection('family_members')
      .find({ userId: req.user.uid, status: 'active' })
      .toArray();
    
    console.log('👨‍👩‍👧‍👦 Found family members:', familyMembers.length);
    
    await client.close();
    
    res.json({
      success: true,
      familyGroups: familyMembers
    });
  } catch (error) {
    console.error('❌ Family fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch family' });
  }
});

app.post('/api/family-legacy/invite', verifyToken, async (req, res) => {
  try {
    console.log('📧 Family invite request:', req.body);
    
    const { email, relationship } = req.body;
    
    if (!email || !relationship) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and relationship are required' 
      });
    }
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');
    
    // Check if already exists
    const existing = await db.collection('family_members').findOne({
      userId: req.user.uid,
      memberEmail: email,
      status: { $in: ['active', 'pending'] }
    });
    
    if (existing) {
      await client.close();
      return res.status(400).json({
        success: false,
        message: 'This user is already invited or is a family member'
      });
    }
    
    // Add family member invitation
    const familyMember = {
      userId: req.user.uid,
      memberEmail: email,
      relationship: relationship,
      invitedAt: new Date(),
      status: 'pending',
      invitedBy: req.user.email || req.user.uid,
      inviteToken: Math.random().toString(36).substring(2, 15)
    };
    
    const result = await db.collection('family_members').insertOne(familyMember);
    await client.close();
    
    console.log('✅ Family member invited:', result.insertedId);
    
    res.json({
      success: true,
      message: 'Family member invited successfully',
      memberId: result.insertedId
    });
    
  } catch (error) {
    console.error('❌ Family invite error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to invite family member' 
    });
  }
});

// Accept family invitation (legacy)
app.post('/api/family-legacy/accept/:inviteId', verifyToken, async (req, res) => {
  try {
    console.log('✅ Family invite acceptance:', req.params.inviteId);
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');
    
    // Find the invitation
    const invitation = await db.collection('family_members').findOne({
      _id: new ObjectId(req.params.inviteId),
      memberEmail: req.user.email,
      status: 'pending'
    });
    
    if (!invitation) {
      await client.close();
      return res.status(404).json({
        success: false,
        message: 'Invitation not found or already processed'
      });
    }
    
    // Update invitation status to active
    await db.collection('family_members').updateOne(
      { _id: new ObjectId(req.params.inviteId) },
      { 
        $set: { 
          status: 'active',
          acceptedAt: new Date(),
          memberUID: req.user.uid
        }
      }
    );
    
    await client.close();
    
    console.log('✅ Family invitation accepted');
    
    res.json({
      success: true,
      message: 'Family invitation accepted successfully'
    });
    
  } catch (error) {
    console.error('❌ Family accept error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to accept invitation'
    });
  }
});

// Decline family invitation (legacy)
app.post('/api/family-legacy/decline/:inviteId', verifyToken, async (req, res) => {
  try {
    console.log('❌ Family invite declined:', req.params.inviteId);
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');
    
    // Find the invitation
    const invitation = await db.collection('family_members').findOne({
      _id: new ObjectId(req.params.inviteId),
      memberEmail: req.user.email,
      status: 'pending'
    });
    
    if (!invitation) {
      await client.close();
      return res.status(404).json({
        success: false,
        message: 'Invitation not found or already processed'
      });
    }
    
    // Update invitation status to declined
    await db.collection('family_members').updateOne(
      { _id: new ObjectId(req.params.inviteId) },
      { 
        $set: { 
          status: 'declined',
          declinedAt: new Date(),
          memberUID: req.user.uid
        }
      }
    );
    
    await client.close();
    
    console.log('❌ Family invitation declined');
    
    res.json({
      success: true,
      message: 'Family invitation declined successfully'
    });
    
  } catch (error) {
    console.error('❌ Family decline error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to decline invitation'
    });
  }
});

// Get pending invitations for current user (legacy)
app.get('/api/family-legacy/invitations', verifyToken, async (req, res) => {
  try {
    console.log('📨 Getting invitations for:', req.user.email);
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');
    
    const invitations = await db.collection('family_members')
      .find({ 
        memberEmail: req.user.email,
        status: 'pending'
      })
      .toArray();
    
    await client.close();
    
    res.json({
      success: true,
      invitations: invitations
    });
    
  } catch (error) {
    console.error('❌ Get invitations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get invitations'
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
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch profile' 
    });
  }
});

app.get('/api/profile', verifyToken, async (req, res) => {
  try {
    res.json({
      success: true,
      profile: {
        firebaseUID: req.user.uid,
        email: req.user.email,
        personalInfo: {
          firstName: req.user.name?.split(' ')[0] || 'User',
          lastName: req.user.name?.split(' ')[1] || ''
        },
        profileStatus: {
          completionPercentage: 25,
          level: 'basic'
        }
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Share document endpoint
app.post('/api/share/:id', verifyToken, async (req, res) => {
  try {
    console.log('📤 Share document request:', req.params.id, req.body);
    
    const { email, permission } = req.body;
    
    if (!email || !permission) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and permission are required' 
      });
    }
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');
    
    // Find the document
    const document = await db.collection('documents').findOne({
      _id: new ObjectId(req.params.id),
      uploadedBy: req.user.uid
    });
    
    if (!document) {
      await client.close();
      return res.status(404).json({
        success: false,
        message: 'Document not found or you do not have permission to share it'
      });
    }
    
    // For now, just simulate sharing (you can implement actual email sending later)
    console.log(`✉️ Document "${document.title}" shared with ${email} (${permission} permission)`);
    
    await client.close();
    
    res.json({
      success: true,
      message: `Document shared with ${email} successfully`
    });
    
  } catch (error) {
    console.error('❌ Share error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to share document' 
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 SecureGov backend listening on http://localhost:${PORT}`);
});
