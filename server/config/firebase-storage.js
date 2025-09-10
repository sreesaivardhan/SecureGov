const admin = require('firebase-admin');
const multer = require('multer');
const path = require('path');

// Initialize Firebase Storage
const bucket = admin.storage().bucket('securegov-documents');

// Configure multer for memory storage (files will be uploaded to Firebase)
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow PDFs and images
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/gif',
      'image/webp'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, JPG, PNG, GIF, and WebP files are allowed'), false);
    }
  }
});

// Upload file to Firebase Storage
async function uploadToFirebase(file, userId, category) {
  try {
    const timestamp = Date.now();
    const fileName = `documents/${userId}/${category}/${timestamp}-${file.originalname}`;
    
    const fileUpload = bucket.file(fileName);
    
    const stream = fileUpload.createWriteStream({
      metadata: {
        contentType: file.mimetype,
        metadata: {
          originalName: file.originalname,
          uploadedBy: userId,
          uploadDate: new Date().toISOString(),
          category: category
        }
      }
    });

    return new Promise((resolve, reject) => {
      stream.on('error', (error) => {
        reject(error);
      });

      stream.on('finish', async () => {
        try {
          // Make the file publicly readable (optional, adjust based on security needs)
          await fileUpload.makePublic();
          
          // Get the public URL
          const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
          
          resolve({
            fileName: fileName,
            originalName: file.originalname,
            publicUrl: publicUrl,
            size: file.size,
            mimeType: file.mimetype
          });
        } catch (error) {
          reject(error);
        }
      });

      stream.end(file.buffer);
    });
  } catch (error) {
    throw new Error(`Firebase upload failed: ${error.message}`);
  }
}

// Delete file from Firebase Storage
async function deleteFromFirebase(fileName) {
  try {
    await bucket.file(fileName).delete();
    return true;
  } catch (error) {
    console.warn('Firebase delete warning:', error.message);
    return false;
  }
}

// Get signed URL for private file access
async function getSignedUrl(fileName, expiresIn = 3600) {
  try {
    const file = bucket.file(fileName);
    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: Date.now() + expiresIn * 1000, // expires in seconds
    });
    return url;
  } catch (error) {
    throw new Error(`Failed to generate signed URL: ${error.message}`);
  }
}

// Generate thumbnail for images (optional)
async function generateThumbnail(fileName, width = 200, height = 200) {
  try {
    const file = bucket.file(fileName);
    const thumbnailName = fileName.replace(/(\.[^.]+)$/, `_thumb_${width}x${height}$1`);
    
    // This would require additional image processing library like Sharp
    // For now, return the original file name
    return fileName;
  } catch (error) {
    console.warn('Thumbnail generation failed:', error.message);
    return fileName;
  }
}

module.exports = {
  upload,
  uploadToFirebase,
  deleteFromFirebase,
  getSignedUrl,
  generateThumbnail,
  bucket
};
