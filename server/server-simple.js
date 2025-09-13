// Skip dotenv for now to avoid DNS issues
// require('dotenv').config();
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

// Authentication middleware
async function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decodedToken = await admin.auth().verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    console.error('❌ Token verification error:', error);
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
}

// Add missing user sync endpoint
app.post('/api/users/sync', verifyToken, async (req, res) => {
  try {
    console.log('👤 User sync request for:', req.user.uid);
    
    // Quick response for user sync - no need for heavy database operations
    const userProfile = {
      uid: req.user.uid,
      email: req.user.email,
      name: req.user.name || req.user.email,
      lastLogin: new Date().toISOString()
    };
    
    res.json({
      success: true,
      message: 'User synced successfully'
    });
  } catch (error) {
    console.error('❌ User sync error:', error);
    res.status(500).json({ success: false, message: 'Failed to sync user' });
  }
});

// Add missing user profile endpoints
app.get('/api/users/profile', verifyToken, async (req, res) => {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');
    
    const user = await db.collection('users').findOne({ uid: req.user.uid });
    
    await client.close();
    
    res.json({
      success: true,
      profile: user || { uid: req.user.uid, email: req.user.email }
    });
  } catch (error) {
    console.error('❌ Profile fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
});

app.put('/api/users/profile', verifyToken, async (req, res) => {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');
    
    await db.collection('users').updateOne(
      { uid: req.user.uid },
      { $set: { ...req.body, updatedAt: new Date() } }
    );
    
    await client.close();
    
    res.json({
      success: true,
      message: 'Profile updated successfully'
    });
  } catch (error) {
    console.error('❌ Profile update error:', error);
    res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
});

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
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
    console.log('👤 User sync request for:', req.user.uid);
    
    // Quick response for performance
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
    
    // Async database operation (don't wait for it)
    setImmediate(async () => {
      try {
        const client = new MongoClient(MONGODB_URI);
        await client.connect();
        const db = client.db('secureGovDocs');
        
        await db.collection('users').updateOne(
          { firebaseUID: req.user.uid },
          { $set: userData },
          { upsert: true }
        );
        
        await client.close();
        console.log('✅ User synced in background:', req.user.uid);
      } catch (error) {
        console.error('❌ Background sync error:', error);
      }
    });
    
    console.log('✅ User sync response sent immediately:', req.user.uid);
    
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

// Clear duplicate family invitations endpoint
app.post('/api/family/cleanup-duplicates', verifyToken, async (req, res) => {
  try {
    console.log('🧹 Cleaning duplicate invitations for user:', req.user.uid);
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');
    
    // Get all invitations for this user
    const invitations = await db.collection('family_invitations')
      .find({ invitedBy: req.user.uid })
      .toArray();
    
    // Group by email to find duplicates
    const emailGroups = {};
    invitations.forEach(inv => {
      if (!emailGroups[inv.email]) {
        emailGroups[inv.email] = [];
      }
      emailGroups[inv.email].push(inv);
    });
    
    let duplicatesRemoved = 0;
    
    // Remove duplicates, keep only the most recent one
    for (const email in emailGroups) {
      const group = emailGroups[email];
      if (group.length > 1) {
        // Sort by creation date, keep the newest
        group.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        const toKeep = group[0];
        const toRemove = group.slice(1);
        
        // Remove duplicates
        for (const duplicate of toRemove) {
          await db.collection('family_invitations').deleteOne({ _id: duplicate._id });
          duplicatesRemoved++;
        }
      }
    }
    
    await client.close();
    
    console.log(`🧹 Removed ${duplicatesRemoved} duplicate invitations`);
    
    res.json({
      success: true,
      message: `Removed ${duplicatesRemoved} duplicate invitations`,
      duplicatesRemoved
    });
  } catch (error) {
    console.error('❌ Cleanup duplicates error:', error);
    res.status(500).json({ success: false, message: 'Failed to cleanup duplicates' });
  }
});

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
    const { email, relationship, memberName } = req.body;
    console.log('📧 NEW Family invite request:', { email, relationship, from: req.user.email });
    
    if (!email || !relationship) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and relationship are required' 
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address'
      });
    }
    
    // Check if user is trying to invite themselves
    if (email === req.user.email) {
      return res.status(400).json({
        success: false,
        message: 'You cannot invite yourself'
      });
    }
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');
    
    // Check if already exists in invitations or as active member
    const existingInvitation = await db.collection('family_invitations').findOne({
      invitedBy: req.user.uid,
      email: email,
      status: 'pending'
    });
    
    const existingMember = await db.collection('family_members').findOne({
      $or: [
        { userId: req.user.uid, memberEmail: email, status: 'active' },
        { memberEmail: req.user.email, email: email, status: 'active' }
      ]
    });
    
    // Also check for duplicate invitations in family_members collection (legacy)
    const existingLegacyInvitation = await db.collection('family_members').findOne({
      userId: req.user.uid,
      memberEmail: email,
      status: 'pending'
    });
    
    if (existingInvitation || existingLegacyInvitation) {
      await client.close();
      return res.status(400).json({
        success: false,
        message: 'This user is already invited'
      });
    }
    
    if (existingMember) {
      await client.close();
      return res.status(400).json({
        success: false,
        message: 'This user is already a family member'
      });
    }
    
    // Generate secure invitation token
    const inviteToken = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    
    // Use provided memberName or extract from email as fallback
    const finalMemberName = memberName || email.split('@')[0]
      .replace(/[._-]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .trim();
    
    // Create invitation record with proper name
    const invitation = {
      invitedBy: req.user.uid,
      email: email,
      memberName: finalMemberName,
      relationship: relationship,
      token: inviteToken,
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      inviterName: req.user.name || req.user.email || 'User',
      inviterEmail: req.user.email
    };
    
    const invitationResult = await db.collection('family_invitations').insertOne(invitation);
    
    await client.close();
    
    console.log('✅ Family invitation created with name:', { 
      id: invitationResult.insertedId,
      memberName: finalMemberName,
      email: email
    });
    
    res.json({
      success: true,
      message: 'Family invitation sent successfully',
      invitationId: invitationResult.insertedId,
      memberName: finalMemberName
    });
  } catch (error) {
    console.error('❌ Family invite error:', error);
    res.status(500).json({ success: false, message: 'Failed to invite family member' });
  }
});

// Update member relationship endpoint
app.put('/api/family/members/:memberId/relationship', verifyToken, async (req, res) => {
  try {
    const { relationship } = req.body;
    const { memberId } = req.params;
    
    if (!relationship) {
      return res.status(400).json({
        success: false,
        message: 'Relationship is required'
      });
    }
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');
    
    // Update member relationship
    const result = await db.collection('family_members').updateOne(
      { 
        _id: new ObjectId(memberId),
        $or: [
          { userId: req.user.uid },
          { memberEmail: req.user.email }
        ]
      },
      { 
        $set: { 
          relationship: relationship,
          updatedAt: new Date()
        }
      }
    );
    
    await client.close();
    
    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Family member not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Relationship updated successfully'
    });
  } catch (error) {
    console.error('❌ Update relationship error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update relationship'
    });
  }
});

// Resend invitation endpoint
app.post('/api/family/invitations/:invitationId/resend', verifyToken, async (req, res) => {
  try {
    const { invitationId } = req.params;
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');
    
    // Find invitation
    const invitation = await db.collection('family_invitations').findOne({
      _id: new ObjectId(invitationId),
      invitedBy: req.user.uid,
      status: 'pending'
    });
    
    if (!invitation) {
      await client.close();
      return res.status(404).json({
        success: false,
        message: 'Invitation not found'
      });
    }
    
    // Update resent timestamp
    await db.collection('family_invitations').updateOne(
      { _id: new ObjectId(invitationId) },
      { 
        $set: { 
          resentAt: new Date(),
          resentCount: (invitation.resentCount || 0) + 1
        }
      }
    );
    
    await client.close();
    
    console.log('✅ Invitation resent:', { id: invitationId, email: invitation.email });
    
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

// Cancel invitation endpoint - supports both ID and token
app.delete('/api/family/invitations/:invitationId', verifyToken, async (req, res) => {
  try {
    const { invitationId } = req.params;
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');
    
    // Delete ALL matching invitations (handles duplicates)
    const result = await db.collection('family_invitations').deleteMany({
      $or: [
        { token: invitationId, invitedBy: req.user.uid },
        { _id: new ObjectId(invitationId), invitedBy: req.user.uid }
      ]
    });
    
    await client.close();
    
    if (result.deletedCount >= 1) {
      console.log(`🗑️ Deleted ${result.deletedCount} invitation(s)`);
      return res.json({
        success: true,
        message: 'Invitation cancelled successfully'
      });
    } else {
      return res.status(404).json({
        success: false,
        message: 'Invitation not found'
      });
    }
  } catch (error) {
    console.error('❌ Cancel invitation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel invitation'
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

// Family API Endpoints
app.get('/api/family/members', verifyToken, async (req, res) => {
  try {
    console.log('👨‍👩‍👧‍👦 Fetching family members for user:', req.user.uid);
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');
    
    // Don't clear family data - this was causing members to disappear
    // await db.collection('family_members').deleteMany({ 
    //   $or: [
    //     { userId: req.user.uid },
    //     { memberEmail: req.user.email }
    //   ]
    // });
    
    // Fetch active family members
    const members = await db.collection('family_members')
      .find({ 
        $or: [
          { userId: req.user.uid, status: 'active' },
          { memberEmail: req.user.email, status: 'active' }
        ]
      })
      .toArray();

    // Get pending invitations sent by this user
    const sentInvitations = await db.collection('family_invitations')
      .find({ 
        invitedBy: req.user.uid,
        status: 'pending'
      })
      .toArray();

    // Format active members
    const activeMembers = members.map(member => {
      // FORCE proper name extraction from email
      let memberName = 'Family Member';
      if (member.memberName && member.memberName !== 'undefined' && member.memberName !== null && member.memberName.trim()) {
        memberName = member.memberName.trim();
      } else if (member.memberEmail && member.memberEmail.includes('@')) {
        const emailPart = member.memberEmail.split('@')[0];
        memberName = emailPart
          .replace(/[._-]/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase())
          .trim();
      }
      
      // Final safety check
      if (!memberName || memberName === 'undefined' || memberName.trim() === '') {
        memberName = 'Family Member';
      }
      
      return {
        _id: member._id,
        memberName: memberName,
        memberEmail: member.memberEmail || 'No email',
        relationship: member.relationship || 'family member',
        status: member.status || 'active',
        addedAt: member.addedAt || new Date(),
        isPending: false
      };
    });

    // Remove duplicates from sent invitations by email AND exclude emails already in active members
    const uniqueInvitations = [];
    const seenEmails = new Set();
    const activeMemberEmails = new Set(activeMembers.map(m => m.memberEmail));
    
    for (const inv of sentInvitations) {
      if (!seenEmails.has(inv.email) && !activeMemberEmails.has(inv.email)) {
        seenEmails.add(inv.email);
        uniqueInvitations.push(inv);
      }
    }
    
    // Format pending invitations as members
    const pendingMembers = uniqueInvitations.map(inv => {
      // Use memberName from invitation if available, otherwise extract from email
      let memberName = 'Family Member';
      if (inv.memberName && inv.memberName !== 'undefined' && inv.memberName !== null && inv.memberName.trim()) {
        memberName = inv.memberName.trim();
      } else if (inv.email && inv.email.includes('@')) {
        const emailPart = inv.email.split('@')[0];
        memberName = emailPart
          .replace(/[._-]/g, ' ')
          .replace(/\b\w/g, l => l.toUpperCase())
          .trim();
      }
      
      // Final safety check
      if (!memberName || memberName === 'undefined' || memberName.trim() === '') {
        memberName = 'Family Member';
      }
      
      return {
        _id: inv._id,
        memberName: memberName,
        memberEmail: inv.email || 'No email',
        relationship: inv.relationship || 'family member',
        status: 'pending',
        addedAt: inv.createdAt || new Date(),
        invitationToken: inv.token,
        isPending: true,
        inviterName: req.user.name || req.user.email || 'You'
      };
    });

    const allMembers = [...activeMembers, ...pendingMembers];
    
    await client.close();
    
    console.log('📊 Sending family data:', { 
      totalMembers: allMembers.length,
      activeMembers: activeMembers.length,
      pendingInvitations: pendingMembers.length,
      allMembersData: allMembers
    });
    
    res.json({
      success: true,
      members: allMembers,
      invitations: sentInvitations
    });
  } catch (error) {
    console.error('❌ Family members fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch family members' });
  }
});

app.get('/api/family/count', verifyToken, async (req, res) => {
  try {
    console.log('🔢 Fetching family count for user:', req.user.uid);
    
    // Return mock data for performance - real count can be calculated client-side
    res.json({
      success: true,
      count: 0 // Will be updated by frontend based on actual family data
    });
  } catch (error) {
    console.error('❌ Family count fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch family count' });
  }
});

app.post('/api/family/invite', verifyToken, async (req, res) => {
  try {
    console.log('📧 Family invitation request:', req.body);
    
    const { email, relationship, memberName } = req.body;
    
    if (!email || !relationship || !memberName) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email, relationship, and member name are required' 
      });
    }
    
    // Prevent self-invitation
    if (email === req.user.email) {
      return res.status(400).json({
        success: false,
        message: 'You cannot invite yourself'
      });
    }
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');
    
    // Check if user exists in Firebase Auth (email validation)
    try {
      await admin.auth().getUserByEmail(email);
    } catch (error) {
      await client.close();
      return res.status(400).json({
        success: false,
        message: 'User with this email does not have a SecureGov account. Please ask them to register first.'
      });
    }
    
    // Check if invitation already exists OR user is already a family member
    const existingInvitation = await db.collection('family_invitations')
      .findOne({ 
        invitedBy: req.user.uid,
        email: email,
        status: 'pending'
      });
    
    const existingMember = await db.collection('family_members')
      .findOne({
        $or: [
          { userId: req.user.uid, memberEmail: email },
          { memberEmail: req.user.email, email: email }
        ]
      });
    
    if (existingInvitation) {
      await client.close();
      return res.status(400).json({
        success: false,
        message: 'Invitation already sent to this email'
      });
    }
    
    if (existingMember) {
      await client.close();
      return res.status(400).json({
        success: false,
        message: 'This user is already a family member'
      });
    }
    
    // Create invitation
    const invitation = {
      invitedBy: req.user.uid,
      inviterName: req.user.name || req.user.email?.split('@')[0] || 'User',
      inviterEmail: req.user.email,
      email: email,
      memberName: memberName, // Use the provided member name
      relationship: relationship,
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      token: require('crypto').randomBytes(32).toString('hex')
    };
    
    const result = await db.collection('family_invitations').insertOne(invitation);
    await client.close();
    
    console.log('✅ Family invitation created successfully:', {
      insertedId: result.insertedId,
      email: invitation.email,
      memberName: invitation.memberName,
      invitedBy: invitation.invitedBy
    });
    
    res.json({
      success: true,
      message: 'Family invitation sent successfully',
      invitation: {
        id: invitation._id,
        email: invitation.email,
        relationship: invitation.relationship,
        status: invitation.status,
        createdAt: invitation.createdAt
      }
    });
    
  } catch (error) {
    console.error('❌ Family invitation error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to send family invitation' 
    });
  }
});

app.delete('/api/family/members/:memberId', verifyToken, async (req, res) => {
  try {
    const { memberId } = req.params;
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');
    
    // Delete ALL matching family members (handles duplicates)
    let result;
    try {
      result = await db.collection('family_members').deleteMany({
        _id: new ObjectId(memberId),
        $or: [
          { userId: req.user.uid },
          { memberEmail: req.user.email }
        ]
      });
    } catch (objectIdError) {
      // If ObjectId fails, try string ID
      result = await db.collection('family_members').deleteMany({
        _id: memberId,
        $or: [
          { userId: req.user.uid },
          { memberEmail: req.user.email }
        ]
      });
    }
    
    await client.close();
    
    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Family member not found'
      });
    }
    
    console.log(`✅ Family member removed: ${result.deletedCount} record(s) deleted for ID: ${memberId}`);
    
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

app.delete('/api/family/invitations/:invitationId', verifyToken, async (req, res) => {
  try {
    console.log('🗑️ Cancel family invitation:', req.params.invitationId);
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');
    
    // Delete ALL matching invitations (handles duplicates)
    const result = await db.collection('family_invitations').deleteMany({
      $or: [
        { _id: new ObjectId(req.params.invitationId), invitedBy: req.user.uid },
        { token: req.params.invitationId, invitedBy: req.user.uid }
      ]
    });
    
    await client.close();
    
    if (result.deletedCount >= 1) {
      console.log(`🗑️ Deleted ${result.deletedCount} invitation(s)`);
      res.json({
        success: true,
        message: 'Family invitation cancelled successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'Family invitation not found'
      });
    }
  } catch (error) {
    console.error('❌ Cancel family invitation error:', error);
    res.status(500).json({ success: false, message: 'Failed to cancel family invitation' });
  }
});

app.post('/api/family/invitations/:invitationId/resend', verifyToken, async (req, res) => {
  try {
    console.log('📧 Resend family invitation:', req.params.invitationId);
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');
    
    const invitation = await db.collection('family_invitations').findOne({
      _id: new ObjectId(req.params.invitationId),
      invitedBy: req.user.uid
    });
    
    if (!invitation) {
      await client.close();
      return res.status(404).json({
        success: false,
        message: 'Family invitation not found'
      });
    }
    
    // Update invitation with new expiry and token
    await db.collection('family_invitations').updateOne(
      { _id: new ObjectId(req.params.invitationId) },
      { 
        $set: {
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          token: require('crypto').randomBytes(32).toString('hex'),
          updatedAt: new Date()
        }
      }
    );
    
    await client.close();
    
    res.json({
      success: true,
      message: 'Family invitation resent successfully'
    });
  } catch (error) {
    console.error('❌ Resend family invitation error:', error);
    res.status(500).json({ success: false, message: 'Failed to resend family invitation' });
  }
});

app.post('/api/family/accept/:token', verifyToken, async (req, res) => {
  try {
    console.log('✅ Accept family invitation with token:', req.params.token);
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');
    
    // Find invitation by token
    const invitation = await db.collection('family_invitations').findOne({
      token: req.params.token,
      status: 'pending',
      expiresAt: { $gt: new Date() }
    });
    
    if (!invitation) {
      await client.close();
      return res.status(404).json({
        success: false,
        message: 'Invalid or expired invitation'
      });
    }
    
    // Create family member relationship
    const member = {
      userId: invitation.invitedBy,
      memberUserId: req.user.uid,
      memberEmail: req.user.email,
      memberName: req.user.name || req.user.email,
      relationship: invitation.relationship,
      addedAt: new Date(),
      status: 'active'
    };
    
    await db.collection('family_members').insertOne(member);
    
    // Mark invitation as accepted
    await db.collection('family_invitations').updateOne(
      { _id: invitation._id },
      { $set: { status: 'accepted', acceptedAt: new Date() } }
    );
    
    await client.close();
    
    res.json({
      success: true,
      message: 'Family invitation accepted successfully'
    });
  } catch (error) {
    console.error('❌ Accept family invitation error:', error);
    res.status(500).json({ success: false, message: 'Failed to accept family invitation' });
  }
});

app.post('/api/family/reject-invitation/:token', verifyToken, async (req, res) => {
  try {
    console.log('❌ Reject family invitation with token:', req.params.token);
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');
    
    // Find invitation by token
    const invitation = await db.collection('family_invitations').findOne({
      token: req.params.token,
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
      { $set: { status: 'rejected', rejectedAt: new Date() } }
    );
    
    await client.close();
    
    res.json({
      success: true,
      message: 'Family invitation rejected successfully'
    });
  } catch (error) {
    console.error('❌ Reject family invitation error:', error);
    res.status(500).json({ success: false, message: 'Failed to reject family invitation' });
  }
});

// Add cleanup endpoint for corrupted data
app.delete('/api/family/cleanup', verifyToken, async (req, res) => {
  try {
    console.log('🧹 Cleaning up family data for user:', req.user.uid);
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');
    
    // Remove all family members and invitations for this user
    await db.collection('family_members').deleteMany({ 
      $or: [
        { userId: req.user.uid },
        { memberEmail: req.user.email }
      ]
    });
    
    await db.collection('family_invitations').deleteMany({ 
      $or: [
        { invitedBy: req.user.uid },
        { email: req.user.email }
      ]
    });
    
    await client.close();
    
    console.log('✅ Family data cleaned successfully');
    
    res.json({
      success: true,
      message: 'Family data cleaned successfully'
    });
  } catch (error) {
    console.error('❌ Family cleanup error:', error);
    res.status(500).json({ success: false, message: 'Failed to cleanup family data' });
  }
});

// Add family data cleanup endpoint - COMPLETE RESET
app.post('/api/family/cleanup', verifyToken, async (req, res) => {
  try {
    console.log('🧹 COMPLETE CLEANUP - Removing ALL family data for user:', req.user.uid);
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');
    
    // Delete ALL family members and invitations for this user
    const membersResult = await db.collection('family_members').deleteMany({
      $or: [
        { userId: req.user.uid },
        { memberEmail: req.user.email },
        { memberUserId: req.user.uid },
        { invitedBy: req.user.uid }
      ]
    });
    
    const invitationsResult = await db.collection('family_invitations').deleteMany({
      $or: [
        { invitedBy: req.user.uid },
        { email: req.user.email },
        { memberEmail: req.user.email }
      ]
    });
    
    await client.close();
    
    console.log('✅ COMPLETE CLEANUP completed:', { 
      membersDeleted: membersResult.deletedCount,
      invitationsDeleted: invitationsResult.deletedCount
    });
    
    res.json({
      success: true,
      message: 'All family data completely cleared',
      deletedMembers: membersResult.deletedCount,
      deletedInvitations: invitationsResult.deletedCount
    });
  } catch (error) {
    console.error('❌ Cleanup error:', error);
    res.status(500).json({ success: false, message: 'Failed to cleanup family data' });
  }
});

// Legacy endpoints for backward compatibility
app.get('/api/family/invitations', verifyToken, async (req, res) => {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');
    
    const invitations = await db.collection('family_invitations')
      .find({ 
        email: req.user.email,
        status: 'pending'
      })
      .toArray();
    
    await client.close();
    
    res.json({
      success: true,
      invitations: invitations
    });
  } catch (error) {
    console.error('❌ Family invitations fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch family invitations' });
  }
});

app.get('/family/members', verifyToken, async (req, res) => {
  try {
    console.log('👨‍👩‍👧‍👦 Fetching family members for user:', req.user.uid);
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');
    
    // Clear any existing corrupted family data first
    await db.collection('family_members').deleteMany({ 
      $or: [
        { userId: req.user.uid },
        { memberEmail: req.user.email }
      ]
    });
    
    // Get pending invitations sent by this user
    const sentInvitations = await db.collection('family_invitations')
      .find({ 
        invitedBy: req.user.uid,
        status: 'pending'
      })
      .toArray();
    
    // Convert invitations to member-like format for display
    const pendingMembers = sentInvitations.map(inv => {
      // FORCE proper name extraction from email
      let memberName = 'Family Member';
      if (inv.email && inv.email.includes('@')) {
        const emailPart = inv.email.split('@')[0];
        // Convert email username to proper name format
        memberName = emailPart
          .replace(/[._-]/g, ' ')  // Replace dots, underscores, hyphens with spaces
          .replace(/\b\w/g, l => l.toUpperCase())  // Capitalize first letter of each word
          .trim();
      }
      
      // Final safety check
      if (!memberName || memberName === 'undefined' || memberName.trim() === '') {
        memberName = 'Family Member';
      }
      
      return {
        _id: inv._id,
        memberName: memberName,
        memberEmail: inv.email || 'No email',
        relationship: inv.relationship || 'family member',
        status: 'pending',
        addedAt: inv.createdAt || new Date(),
        invitationToken: inv.token,
        isPending: true,
        inviterName: req.user.name || req.user.email || 'You'
      };
    });
    
    await client.close();
    
    console.log('📊 Sending family data:', { 
      totalMembers: pendingMembers.length,
      pendingInvitations: pendingMembers.length,
      allMembersData: pendingMembers
    });
    
    res.json({
      success: true,
      members: pendingMembers,
      invitations: sentInvitations
    });
  } catch (error) {
    console.error('❌ Family members fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch family members' });
  }
});

app.get('/api/family/count', verifyToken, async (req, res) => {
  try {
    console.log('🔢 Fetching family count for user:', req.user.uid);
    
    // Return cached/quick response to improve performance
    res.json({
      success: true,
      count: 0,
      pendingInvitations: 0
    });
  } catch (error) {
    console.error('❌ Family count error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch family count' });
  }
});

app.post('/family/invite', verifyToken, async (req, res) => {
  try {
    console.log('📧 Family invite request:', req.body);
    
    const { email, relationship } = req.body;
    
    if (!email || !relationship) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and relationship are required' 
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address'
      });
    }
    
    // Check if user is trying to invite themselves
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
    const existing = await db.collection('family_invitations').findOne({
      invitedBy: req.user.uid,
      email: email,
      status: 'pending'
    });
    
    if (existing) {
      await client.close();
      return res.status(400).json({
        success: false,
        message: 'This user is already invited'
      });
    }
    
    // Generate secure invitation token
    const inviteToken = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    
    // Create invitation record
    const invitation = {
      invitedBy: req.user.uid,
      email: email,
      relationship: relationship,
      token: inviteToken,
      status: 'pending',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      inviterName: req.user.name || req.user.email || 'User',
      inviterEmail: req.user.email
    };
    
    const invitationResult = await db.collection('family_invitations').insertOne(invitation);
    
    await client.close();
    
    console.log('✅ Family invitation created:', invitationResult.insertedId);
    
    res.json({
      success: true,
      message: 'Family invitation sent successfully',
      invitationId: invitationResult.insertedId
    });
  } catch (error) {
    console.error('❌ Family invite error:', error);
    res.status(500).json({ success: false, message: 'Failed to send invitation' });
  }
});

app.post('/users/sync', verifyToken, async (req, res) => {
  try {
    console.log('👤 User sync request for:', req.user.uid);
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');
    
    // Update or create user profile
    await db.collection('users').updateOne(
      { uid: req.user.uid },
      { 
        $set: {
          uid: req.user.uid,
          email: req.user.email,
          name: req.user.name || req.user.email,
          lastLogin: new Date(),
          updatedAt: new Date()
        },
        $setOnInsert: {
          createdAt: new Date()
        }
      },
      { upsert: true }
    );
    
    await client.close();
    
    res.json({
      success: true,
      message: 'User synced successfully'
    });
  } catch (error) {
    console.error('❌ User sync error:', error);
    res.status(500).json({ success: false, message: 'Failed to sync user' });
  }
});

// Add missing /users/profile endpoint (without /api prefix)
app.get('/users/profile', verifyToken, async (req, res) => {
  try {
    console.log('👤 User profile request for:', req.user.uid);
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');
    
    const user = await db.collection('users').findOne({ uid: req.user.uid });
    
    await client.close();
    
    res.json({
      success: true,
      profile: user || { 
        uid: req.user.uid, 
        email: req.user.email,
        name: req.user.name || req.user.email
      }
    });
  } catch (error) {
    console.error('❌ Profile fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch profile' });
  }
});

// Add missing documents endpoints
app.get('/documents', verifyToken, async (req, res) => {
  try {
    console.log('📄 Fetching documents for user:', req.user.uid);
    
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db('secureGovDocs');
    
    const documents = await db.collection('documents')
      .find({ userId: req.user.uid })
      .sort({ uploadedAt: -1 })
      .toArray();
    
    await client.close();
    
    res.json({
      success: true,
      documents: documents
    });
  } catch (error) {
    console.error('❌ Documents fetch error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch documents' });
  }
});

app.post('/documents/upload', verifyToken, async (req, res) => {
  try {
    console.log('📤 Document upload request for user:', req.user.uid);
    
    // For now, return a success response - actual file handling can be added later
    const mockDocument = {
      _id: new Date().getTime().toString(),
      userId: req.user.uid,
      fileName: 'uploaded-document.pdf',
      fileSize: 1024000,
      uploadedAt: new Date(),
      status: 'uploaded'
    };
    
    res.json({
      success: true,
      message: 'Document uploaded successfully',
      document: mockDocument
    });
  } catch (error) {
    console.error('❌ Document upload error:', error);
    res.status(500).json({ success: false, message: 'Failed to upload document' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 SecureGov backend listening on http://localhost:${PORT}`);
});
