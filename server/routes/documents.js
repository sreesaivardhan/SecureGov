const express = require('express');
const { ObjectId } = require('mongodb');
const multer = require('multer');
const { Document, DOCUMENT_CATEGORIES } = require('../models/Document');
const { uploadToFirebase, deleteFromFirebase, getSignedUrl } = require('../config/firebase-storage');
const { FamilyGroup, FAMILY_ROLES } = require('../models/FamilyGroup');
const SecurityMiddleware = require('../middleware/security');

const router = express.Router();

// Configure multer for memory storage (Firebase upload)
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Upload document with Firebase Storage
router.post('/upload', SecurityMiddleware.verifyFirebaseToken, SecurityMiddleware.loadUserProfile, upload.single('document'), async (req, res) => {
  try {
    const { file } = req;
    
    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    // Validate category
    const category = req.body.category || DOCUMENT_CATEGORIES.OTHER.GENERAL;
    const validCategories = Object.values(DOCUMENT_CATEGORIES).flatMap(cat => Object.values(cat));
    if (!validCategories.includes(category)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid document category'
      });
    }

    // Upload to Firebase Storage
    // For now, skip Firebase upload and store directly in MongoDB
    // const firebaseResult = await uploadToFirebase(file, req.user.uid, category);

    const documentMetadata = {
      title: req.body.title || file.originalname,
      description: req.body.description || '',
      category: category,
      subcategory: req.body.subcategory || '',
      department: req.body.department || 'citizen',
      classification: req.body.classification || 'private',
      uploadDate: new Date(),
      lastModified: new Date(),
      uploadedBy: req.user.uid,
      fileId: new ObjectId(),
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
      version: 1,
      expiryDate: req.body.expiryDate ? new Date(req.body.expiryDate) : null,
      issueDate: req.body.issueDate ? new Date(req.body.issueDate) : null,
      documentNumber: req.body.documentNumber || '',
      issuingAuthority: req.body.issuingAuthority || '',
      verificationStatus: 'pending',
      metadata: {
        firebaseUrl: '',
        extractedText: '',
        ocrProcessed: false,
        thumbnailPath: '',
        checksum: ''
      },
      // Store file data directly in MongoDB for now
      fileData: file.buffer.toString('base64')
    };

    // Connect to MongoDB and insert document
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');
    await client.connect();
    const db = client.db('secureGovDocs');
    const result = await db.collection('documents').insertOne(documentMetadata);
    await client.close();

    res.status(201).json({
      success: true,
      message: 'Document uploaded successfully',
      documentId: result.insertedId,
      fileId: documentMetadata.fileId,
      category: category,
      firebaseUrl: ''
    });

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Upload failed'
    });
  }
});

// Get user documents with enhanced filtering
router.get('/', SecurityMiddleware.verifyFirebaseToken, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const skip = (page - 1) * limit;

    const filter = {
      status: 'active',
      $or: [
        { uploadedBy: req.user.uid },
        { 'permissions.read': req.user.uid }
      ]
    };

    // Category filter
    if (req.query.category) {
      filter.category = req.query.category;
    }

    // Department filter
    if (req.query.department) {
      filter.department = req.query.department;
    }

    // Classification filter
    if (req.query.classification) {
      filter.classification = req.query.classification;
    }

    // Verification status filter
    if (req.query.verificationStatus) {
      filter.verificationStatus = req.query.verificationStatus;
    }

    // Date range filter
    if (req.query.dateFrom || req.query.dateTo) {
      filter.uploadDate = {};
      if (req.query.dateFrom) {
        filter.uploadDate.$gte = new Date(req.query.dateFrom);
      }
      if (req.query.dateTo) {
        filter.uploadDate.$lte = new Date(req.query.dateTo);
      }
    }

    // Search filter
    if (req.query.search) {
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { title: { $regex: req.query.search, $options: 'i' } },
          { description: { $regex: req.query.search, $options: 'i' } },
          { originalName: { $regex: req.query.search, $options: 'i' } },
          { documentNumber: { $regex: req.query.search, $options: 'i' } },
          { tags: { $in: [new RegExp(req.query.search, 'i')] } }
        ]
      });
    }

    // Sort options
    const sortOptions = {};
    const sortBy = req.query.sortBy || 'uploadDate';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    sortOptions[sortBy] = sortOrder;

    // Connect to MongoDB and fetch documents
    const { MongoClient } = require('mongodb');
    const client = new MongoClient(process.env.MONGODB_URI || 'mongodb://localhost:27017');
    await client.connect();
    const db = client.db('secureGovDocs');
    
    const documents = await db.collection('documents')
      .find(filter)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .toArray();

    const total = await db.collection('documents').countDocuments(filter);

    // Get category statistics
    const categoryStats = await db.collection('documents').aggregate([
      { $match: { uploadedBy: req.user.uid, status: 'active' } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();

    await client.close();

    res.json({
      success: true,
      documents: documents,
      pagination: {
        page: page,
        limit: limit,
        total: total,
        pages: Math.ceil(total / limit)
      },
      categoryStats: categoryStats,
      availableCategories: DOCUMENT_CATEGORIES
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

// Share document with individual user or family group
router.post('/:id/share', authenticateUser, checkDocumentPermission('admin'), async (req, res) => {
  try {
    const { email, permission, familyGroupId, shareType } = req.body;
    
    if (!permission || !['read', 'write'].includes(permission)) {
      return res.status(400).json({
        success: false,
        message: 'Valid permission (read/write) is required'
      });
    }

    const db = await getDB();
    const document = req.document;

    if (shareType === 'family' && familyGroupId) {
      // Share with family group
      const familyGroup = await FamilyGroup.findById(familyGroupId);
      
      if (!familyGroup) {
        return res.status(404).json({
          success: false,
          message: 'Family group not found'
        });
      }

      // Check if user is member of the family group
      if (!familyGroup.isMember(req.user.uid)) {
        return res.status(403).json({
          success: false,
          message: 'You are not a member of this family group'
        });
      }

      // Add all active family members to document permissions
      const activeMembers = familyGroup.members.filter(m => m.status === 'active');
      const memberIds = activeMembers.map(m => m.userId);

      const updateFields = {
        $addToSet: {
          [`permissions.${permission}`]: { $each: memberIds }
        },
        $set: { 
          lastModified: new Date(),
          [`familySharing.${familyGroupId}`]: {
            groupName: familyGroup.name,
            permission: permission,
            sharedAt: new Date(),
            sharedBy: req.user.uid
          }
        }
      };

      await collections.documents().updateOne(
        { _id: new ObjectId(req.params.id) },
        updateFields
      );

      res.json({
        success: true,
        message: `Document shared with family group "${familyGroup.name}"`,
        sharedWith: activeMembers.length,
        familyGroup: {
          id: familyGroup._id,
          name: familyGroup.name
        }
      });

    } else if (shareType === 'individual' && email) {
      // Share with individual user
      if (!email || !email.includes('@')) {
        return res.status(400).json({
          success: false,
          message: 'Valid email address is required'
        });
      }

      try {
        // Find user by email via Firebase Admin
        const targetUser = await admin.auth().getUserByEmail(email);
        
        // Update document permissions
        const updateResult = await collections.documents().updateOne(
          { _id: new ObjectId(req.params.id) },
          { 
            $addToSet: { [`permissions.${permission}`]: targetUser.uid },
            $set: { 
              lastModified: new Date(),
              [`individualSharing.${targetUser.uid}`]: {
                email: targetUser.email,
                displayName: targetUser.displayName || targetUser.email,
                permission: permission,
                sharedAt: new Date(),
                sharedBy: req.user.uid
              }
            }
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
          message: `Document shared with ${targetUser.email}`,
          sharedWith: {
            email: targetUser.email,
            displayName: targetUser.displayName || targetUser.email
          }
        });

      } catch (userError) {
        return res.status(404).json({
          success: false,
          message: 'User not found with this email address'
        });
      }

    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid share type or missing required fields'
      });
    }

  } catch (error) {
    console.error('Share error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to share document'
    });
  }
});

// Get shared documents (individual and family)
router.get('/shared', authenticateUser, async (req, res) => {
  try {
    const db = await getDB();
    const { type } = req.query; // 'individual', 'family', or 'all'
    
    // Find documents where user has read permission but is not the owner
    const sharedDocs = await collections.documents()
      .find({
        status: 'active',
        uploadedBy: { $ne: req.user.uid },
        'permissions.read': req.user.uid
      })
      .sort({ lastModified: -1 })
      .toArray();

    // Categorize documents by sharing type
    const categorizedDocs = {
      individual: [],
      family: [],
      all: sharedDocs
    };

    sharedDocs.forEach(doc => {
      const hasIndividualSharing = doc.individualSharing && 
        Object.keys(doc.individualSharing).includes(req.user.uid);
      const hasFamilySharing = doc.familySharing && 
        Object.keys(doc.familySharing).length > 0;

      if (hasIndividualSharing) {
        categorizedDocs.individual.push(doc);
      }
      if (hasFamilySharing) {
        categorizedDocs.family.push(doc);
      }
    });

    const responseData = {
      success: true,
      documents: type ? categorizedDocs[type] || [] : categorizedDocs.all,
      summary: {
        total: sharedDocs.length,
        individual: categorizedDocs.individual.length,
        family: categorizedDocs.family.length
      }
    };

    if (!type) {
      responseData.categorized = {
        individual: categorizedDocs.individual,
        family: categorizedDocs.family
      };
    }

    res.json(responseData);

  } catch (error) {
    console.error('Shared documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch shared documents'
    });
  }
});

// Get single document details
router.get('/:id', authenticateUser, checkDocumentPermission('read'), async (req, res) => {
  try {
    const document = req.document;
    
    res.json({
      success: true,
      document: document
    });

  } catch (error) {
    console.error('Get document error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch document'
    });
  }
});

// Update document metadata
router.put('/:id', authenticateUser, checkDocumentPermission('write'), async (req, res) => {
  try {
    const updateData = {
      lastModified: new Date()
    };

    // Only update allowed fields
    const allowedFields = [
      'title', 'description', 'category', 'subcategory', 'department', 
      'classification', 'tags', 'expiryDate', 'issueDate', 
      'documentNumber', 'issuingAuthority', 'verificationStatus'
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        if (field === 'tags' && typeof req.body[field] === 'string') {
          updateData[field] = req.body[field].split(',').map(tag => tag.trim());
        } else if (field === 'expiryDate' || field === 'issueDate') {
          updateData[field] = req.body[field] ? new Date(req.body[field]) : null;
        } else {
          updateData[field] = req.body[field];
        }
      }
    });

    // Validate category if provided
    if (updateData.category) {
      const validCategories = Object.values(DOCUMENT_CATEGORIES).flatMap(cat => Object.values(cat));
      if (!validCategories.includes(updateData.category)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid document category'
        });
      }
    }

    const db = await getDB();
    const result = await collections.documents().updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    // Get updated document
    const updatedDocument = await collections.documents().findOne({
      _id: new ObjectId(req.params.id)
    });

    res.json({
      success: true,
      message: 'Document updated successfully',
      document: updatedDocument
    });

  } catch (error) {
    console.error('Update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update document'
    });
  }
});

// Delete document with enhanced validation
router.delete('/:id', authenticateUser, checkDocumentPermission('admin'), async (req, res) => {
  try {
    const document = req.document;
    const db = await getDB();

    // Check if document has Firebase URL or GridFS fileId
    if (document.metadata && document.metadata.firebaseUrl) {
      // Delete from Firebase Storage
      try {
        await deleteFromFirebase(document.fileName);
      } catch (error) {
        console.warn('Firebase delete warning:', error.message);
      }
    } else if (document.fileId) {
      // Delete from GridFS
      try {
        const gridfsBucket = getGridFSBucket();
        await gridfsBucket.delete(new ObjectId(document.fileId));
      } catch (error) {
        console.warn('GridFS delete warning:', error.message);
      }
    }

    // Soft delete - mark as deleted instead of removing
    const result = await collections.documents().updateOne(
      { _id: new ObjectId(req.params.id) },
      { 
        $set: { 
          status: 'deleted',
          lastModified: new Date(),
          deletedAt: new Date(),
          deletedBy: req.user.uid
        }
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

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

// Restore deleted document
router.post('/:id/restore', authenticateUser, checkDocumentPermission('admin'), async (req, res) => {
  try {
    const db = await getDB();
    const result = await collections.documents().updateOne(
      { _id: new ObjectId(req.params.id), status: 'deleted' },
      { 
        $set: { 
          status: 'active',
          lastModified: new Date()
        },
        $unset: {
          deletedAt: '',
          deletedBy: ''
        }
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Deleted document not found'
      });
    }

    res.json({
      success: true,
      message: 'Document restored successfully'
    });

  } catch (error) {
    console.error('Restore error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to restore document'
    });
  }
});

// Get user's family groups for sharing
router.get('/family-groups', authenticateUser, async (req, res) => {
  try {
    const familyGroups = await FamilyGroup.find({
      $or: [
        { createdBy: req.user.uid },
        { 'members.userId': req.user.uid, 'members.status': 'active' }
      ],
      status: 'active'
    }).select('_id name description members statistics');

    // Only return groups where user has permission to share documents
    const shareableGroups = familyGroups.filter(group => {
      const userRole = group.getMemberRole(req.user.uid);
      return userRole === FAMILY_ROLES.ADMIN || userRole === FAMILY_ROLES.MEMBER;
    });

    res.json({
      success: true,
      familyGroups: shareableGroups
    });

  } catch (error) {
    console.error('Get family groups error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch family groups'
    });
  }
});

// Remove document sharing
router.delete('/:id/share', authenticateUser, checkDocumentPermission('admin'), async (req, res) => {
  try {
    const { userId, familyGroupId, shareType } = req.body;
    
    if (!shareType || !['individual', 'family'].includes(shareType)) {
      return res.status(400).json({
        success: false,
        message: 'Valid share type is required'
      });
    }

    const db = await getDB();
    let updateFields = {
      $set: { lastModified: new Date() }
    };

    if (shareType === 'individual' && userId) {
      // Remove individual user from permissions
      updateFields.$pull = {
        'permissions.read': userId,
        'permissions.write': userId
      };
      updateFields.$unset = {
        [`individualSharing.${userId}`]: ''
      };

    } else if (shareType === 'family' && familyGroupId) {
      // Remove family group sharing
      const familyGroup = await FamilyGroup.findById(familyGroupId);
      
      if (familyGroup) {
        const memberIds = familyGroup.members
          .filter(m => m.status === 'active')
          .map(m => m.userId);

        updateFields.$pullAll = {
          'permissions.read': memberIds,
          'permissions.write': memberIds
        };
        updateFields.$unset = {
          [`familySharing.${familyGroupId}`]: ''
        };
      }
    } else {
      return res.status(400).json({
        success: false,
        message: 'Missing required parameters for share removal'
      });
    }

    const result = await collections.documents().updateOne(
      { _id: new ObjectId(req.params.id) },
      updateFields
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Document not found'
      });
    }

    res.json({
      success: true,
      message: 'Document sharing removed successfully'
    });

  } catch (error) {
    console.error('Remove sharing error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove document sharing'
    });
  }
});

// Get document sharing details
router.get('/:id/sharing', authenticateUser, checkDocumentPermission('read'), async (req, res) => {
  try {
    const document = req.document;
    
    const sharingDetails = {
      individual: {},
      family: {},
      permissions: document.permissions
    };

    // Get individual sharing details
    if (document.individualSharing) {
      sharingDetails.individual = document.individualSharing;
    }

    // Get family sharing details with group info
    if (document.familySharing) {
      const familyGroupIds = Object.keys(document.familySharing);
      
      for (const groupId of familyGroupIds) {
        const familyGroup = await FamilyGroup.findById(groupId)
          .select('_id name description members statistics');
        
        if (familyGroup) {
          sharingDetails.family[groupId] = {
            ...document.familySharing[groupId],
            groupInfo: {
              name: familyGroup.name,
              description: familyGroup.description,
              memberCount: familyGroup.activeMembersCount
            }
          };
        }
      }
    }

    res.json({
      success: true,
      sharing: sharingDetails
    });

  } catch (error) {
    console.error('Get sharing details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sharing details'
    });
  }
});

module.exports = router;