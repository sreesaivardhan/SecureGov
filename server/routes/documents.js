const express = require('express');
const { ObjectId } = require('mongodb');
const multer = require('multer');
const GridFSStorage = require('multer-gridfs-storage').GridFSStorage;
const { getDB, getGridFSBucket, collections } = require('../config/database');
const { authenticateUser, checkDocumentPermission } = require('../middleware/auth');

const router = express.Router();

// Configure multer for GridFS storage
const storage = new GridFSStorage({
  url: process.env.MONGODB_URI,
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      const filename = `${Date.now()}-${file.originalname}`;
      const fileInfo = {
        filename: filename,
        bucketName: 'documents',
        metadata: {
          originalName: file.originalname,
          uploadDate: new Date(),
          userId: req.user?.uid,
          fileType: file.mimetype,
          fileSize: file.size
        }
      };
      resolve(fileInfo);
    });
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, JPG, and PNG files are allowed'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Upload document
router.post('/upload', authenticateUser, upload.single('document'), async (req, res) => {
  try {
    const { file } = req;
    
    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const documentMetadata = {
      title: req.body.title || file.originalname,
      description: req.body.description || '',
      type: req.body.type || 'other',
      department: req.body.department || 'citizen',
      classification: req.body.classification || 'personal',
      uploadDate: new Date(),
      lastModified: new Date(),
      uploadedBy: req.user.uid,
      fileId: file.id,
      fileName: file.filename,
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
      version: 1
    };

    const db = await getDB();
    const result = await collections.documents().insertOne(documentMetadata);

    res.status(201).json({
      success: true,
      message: 'Document uploaded successfully',
      documentId: result.insertedId,
      fileId: file.id
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Upload failed'
    });
  }
});

// Get user documents
router.get('/', authenticateUser, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const filter = {
      status: 'active',
      uploadedBy: req.user.uid
    };

    // Add search filters
    if (req.query.type) {
      filter.type = req.query.type;
    }

    if (req.query.search) {
      filter.$or = [
        { title: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } }
      ];
    }

    const db = await getDB();
    const documents = await collections.documents()
      .find(filter)
      .sort({ uploadDate: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await collections.documents().countDocuments(filter);

    res.json({
      success: true,
      documents: documents,
      pagination: {
        page: page,
        limit: limit,
        total: total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Fetch documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch documents'
    });
  }
});

// Get document statistics
router.get('/stats', authenticateUser, async (req, res) => {
  try {
    const db = await getDB();
    
    const totalDocs = await collections.documents().countDocuments({
      uploadedBy: req.user.uid,
      status: 'active'
    });

    const sharedDocs = await collections.documents().countDocuments({
      uploadedBy: req.user.uid,
      status: 'active',
      'permissions.read': { $exists: true, $not: { $size: 1 } }
    });

    res.json({
      success: true,
      total: totalDocs,
      shared: sharedDocs
    });

  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics'
    });
  }
});

// Download document
router.get('/:id/download', authenticateUser, checkDocumentPermission('read'), async (req, res) => {
  try {
    const document = req.document;
    const gridfsBucket = getGridFSBucket();

    // Update download count
    await collections.documents().updateOne(
      { _id: new ObjectId(req.params.id) },
      { $inc: { downloadCount: 1 } }
    );

    // Set headers for file download
    res.set({
      'Content-Type': document.mimeType,
      'Content-Disposition': `attachment; filename="${document.originalName}"`
    });

    // Stream file from GridFS
    const downloadStream = gridfsBucket.openDownloadStream(new ObjectId(document.fileId));
    
    downloadStream.on('error', (error) => {
      console.error('Download stream error:', error);
      if (!res.headersSent) {
        res.status(404).json({ success: false, message: 'File not found' });
      }
    });

    downloadStream.pipe(res);

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({
      success: false,
      message: 'Download failed'
    });
  }
});

// Share document
router.post('/:id/share', authenticateUser, checkDocumentPermission('admin'), async (req, res) => {
  try {
    const { email, permission } = req.body;
    
    if (!email || !permission) {
      return res.status(400).json({
        success: false,
        message: 'Email and permission are required'
      });
    }

    // Find user by email (you might need to implement user lookup)
    const db = await getDB();
    const sharedWithUser = await collections.users().findOne({ email: email });
    
    if (!sharedWithUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found with this email'
      });
    }

    // Update document permissions
    const updateResult = await collections.documents().updateOne(
      { _id: new ObjectId(req.params.id) },
      { 
        $addToSet: { [`permissions.${permission}`]: sharedWithUser.firebaseUID },
        $set: { lastModified: new Date() }
      }
    );

    if (updateResult.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    res.json({
      success: true,
      message: 'Document shared successfully'
    });

  } catch (error) {
    console.error('Share error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to share document'
    });
  }
});

// Get shared documents
router.get('/shared', authenticateUser, async (req, res) => {
  try {
    const db = await getDB();
    
    // Find documents where user has read permission but is not the owner
    const sharedDocs = await collections.documents()
      .find({
        status: 'active',
        uploadedBy: { $ne: req.user.uid },
        'permissions.read': req.user.uid
      })
      .sort({ lastModified: -1 })
      .toArray();

    res.json({
      success: true,
      documents: sharedDocs
    });

  } catch (error) {
    console.error('Shared documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch shared documents'
    });
  }
});

// Delete document
router.delete('/:id', authenticateUser, checkDocumentPermission('admin'), async (req, res) => {
  try {
    const document = req.document;
    const db = await getDB();
    const gridfsBucket = getGridFSBucket();

    // Delete file from GridFS
    await gridfsBucket.delete(new ObjectId(document.fileId));

    // Delete document metadata
    await collections.documents().deleteOne({
      _id: new ObjectId(req.params.id)
    });

    res.json({
      success: true,
      message: 'Document deleted successfully'
    });

  } catch (error) {
    console.error('Delete error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete document'
    });
  }
});

module.exports = router;