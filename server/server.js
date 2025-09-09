// Install required packages first:
// npm install mongodb multer multer-gridfs-storage gridfs-stream

const { MongoClient, GridFSBucket } = require('mongodb');
const multer = require('multer');
const GridFSStorage = require('multer-gridfs-storage').GridFSStorage;
const Grid = require('gridfs-stream');

// Your MongoDB Atlas connection string
const MONGODB_URI = 'mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/secureGovDocs?retryWrites=true&w=majority';

let db, gfs, gridfsBucket;

// Connect to MongoDB
async function connectDB() {
  try {
    const client = await MongoClient.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Connected to MongoDB Atlas');
    db = client.db('secureGovDocs');
    
    // Initialize GridFS
    gridfsBucket = new GridFSBucket(db, { bucketName: 'documents' });
    gfs = Grid(db, require('mongoose'));
    gfs.collection('documents');
    
    return db;
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

// Configure multer for GridFS storage
const storage = new GridFSStorage({
  url: MONGODB_URI,
  file: (req, file) => {
    return new Promise((resolve, reject) => {
      const filename = `${Date.now()}-${file.originalname}`;
      const fileInfo = {
        filename: filename,
        bucketName: 'documents', // This creates documents.files and documents.chunks collections
        metadata: {
          originalName: file.originalname,
          uploadDate: new Date(),
          userId: req.user?.uid, // From Firebase auth
          fileType: file.mimetype,
          fileSize: file.size,
          department: req.body.department,
          classification: req.body.classification,
          description: req.body.description
        }
      };
      resolve(fileInfo);
    });
  }
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    // Only allow PDF files
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  }
});

// Document Schema for the documents collection (metadata only)
const documentSchema = {
  _id: "ObjectId", // Auto-generated
  title: "String",
  description: "String", 
  department: "String",
  classification: "String", // public, confidential, secret
  uploadDate: "Date",
  lastModified: "Date",
  uploadedBy: "String", // Firebase UID
  fileId: "ObjectId", // Reference to GridFS file
  fileName: "String",
  fileSize: "Number",
  mimeType: "String",
  downloadCount: "Number",
  tags: ["String"], // Array of tags
  permissions: {
    read: ["String"], // Array of user IDs who can read
    write: ["String"], // Array of user IDs who can write
    admin: ["String"]  // Array of user IDs who can admin
  },
  status: "String", // active, archived, deleted
  version: "Number"
};

// User Schema for the users collection (optional - Firebase handles auth)
const userSchema = {
  _id: "ObjectId",
  firebaseUID: "String", // Link to Firebase user
  email: "String",
  name: "String",
  department: "String",
  role: "String", // admin, editor, viewer
  permissions: ["String"], // Array of permission levels
  createdDate: "Date",
  lastLogin: "Date",
  isActive: "Boolean"
};

// API Routes Examples

// Upload file
app.post('/api/upload', authenticateUser, upload.single('document'), async (req, res) => {
  try {
    const { file } = req;
    
    // Create document metadata record
    const documentMetadata = {
      title: req.body.title,
      description: req.body.description,
      department: req.body.department,
      classification: req.body.classification,
      uploadDate: new Date(),
      lastModified: new Date(),
      uploadedBy: req.user.uid, // From Firebase
      fileId: file.id, // GridFS file ID
      fileName: file.filename,
      fileSize: file.size,
      mimeType: file.mimetype,
      downloadCount: 0,
      tags: req.body.tags ? req.body.tags.split(',') : [],
      permissions: {
        read: [req.user.uid],
        write: [req.user.uid],
        admin: [req.user.uid]
      },
      status: 'active',
      version: 1
    };
    
    // Save metadata to documents collection
    const result = await db.collection('documents').insertOne(documentMetadata);
    
    res.status(201).json({
      success: true,
      message: 'File uploaded successfully',
      documentId: result.insertedId,
      fileId: file.id
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ success: false, message: 'Upload failed' });
  }
});

// Download file
app.get('/api/download/:fileId', authenticateUser, async (req, res) => {
  try {
    const fileId = new require('mongodb').ObjectId(req.params.fileId);
    
    // Check permissions first
    const document = await db.collection('documents').findOne({ fileId: fileId });
    if (!document || !document.permissions.read.includes(req.user.uid)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Stream file from GridFS
    const downloadStream = gridfsBucket.openDownloadStream(fileId);
    
    downloadStream.on('error', (error) => {
      res.status(404).json({ message: 'File not found' });
    });
    
    res.set({
      'Content-Type': document.mimeType,
      'Content-Disposition': `attachment; filename="${document.fileName}"`
    });
    
    downloadStream.pipe(res);
    
    // Update download count
    await db.collection('documents').updateOne(
      { fileId: fileId },
      { $inc: { downloadCount: 1 } }
    );
    
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ message: 'Download failed' });
  }
});

// Get all documents (with pagination)
app.get('/api/documents', authenticateUser, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const filter = {
      status: 'active',
      'permissions.read': req.user.uid // User must have read permission
    };
    
    // Add search/filter options
    if (req.query.department) {
      filter.department = req.query.department;
    }
    
    if (req.query.classification) {
      filter.classification = req.query.classification;
    }
    
    if (req.query.search) {
      filter.$or = [
        { title: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } }
      ];
    }
    
    const documents = await db.collection('documents')
      .find(filter)
      .sort({ uploadDate: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();
    
    const total = await db.collection('documents').countDocuments(filter);
    
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
    res.status(500).json({ success: false, message: 'Failed to fetch documents' });
  }
});

// Initialize the connection
connectDB().then(() => {
  console.log('MongoDB setup complete');
}).catch(error => {
  console.error('Failed to setup MongoDB:', error);
});

module.exports = { db, gfs, gridfsBucket, upload, connectDB };