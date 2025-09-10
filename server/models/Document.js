const mongoose = require('mongoose');

// Document categories for government documents
const DOCUMENT_CATEGORIES = {
  IDENTITY: {
    PAN: 'pan_card',
    AADHAAR: 'aadhaar_card',
    PASSPORT: 'passport',
    VOTER_ID: 'voter_id',
    DRIVING_LICENSE: 'driving_license'
  },
  FINANCIAL: {
    BANK_STATEMENT: 'bank_statement',
    ITR: 'income_tax_return',
    SALARY_SLIP: 'salary_slip',
    FORM_16: 'form_16'
  },
  PROPERTY: {
    PROPERTY_DEED: 'property_deed',
    RENT_AGREEMENT: 'rent_agreement',
    UTILITY_BILL: 'utility_bill'
  },
  EDUCATION: {
    DEGREE_CERTIFICATE: 'degree_certificate',
    MARKSHEET: 'marksheet',
    DIPLOMA: 'diploma'
  },
  OTHER: {
    MEDICAL: 'medical_document',
    LEGAL: 'legal_document',
    GENERAL: 'general_document'
  }
};

const documentSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  description: {
    type: String,
    trim: true,
    maxlength: 1000
  },
  category: {
    type: String,
    required: true,
    enum: Object.values(DOCUMENT_CATEGORIES).flatMap(cat => Object.values(cat)),
    default: DOCUMENT_CATEGORIES.OTHER.GENERAL
  },
  subcategory: {
    type: String,
    trim: true
  },
  department: {
    type: String,
    enum: ['citizen', 'government', 'municipal', 'state', 'central'],
    default: 'citizen'
  },
  classification: {
    type: String,
    enum: ['public', 'private', 'confidential', 'restricted'],
    default: 'private'
  },
  uploadDate: {
    type: Date,
    default: Date.now
  },
  lastModified: {
    type: Date,
    default: Date.now
  },
  uploadedBy: {
    type: String,
    required: true
  },
  fileId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  fileName: {
    type: String,
    required: true
  },
  originalName: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  downloadCount: {
    type: Number,
    default: 0
  },
  tags: [{
    type: String,
    trim: true
  }],
  permissions: {
    read: [{
      type: String
    }],
    write: [{
      type: String
    }],
    admin: [{
      type: String
    }]
  },
  status: {
    type: String,
    enum: ['active', 'archived', 'deleted'],
    default: 'active'
  },
  version: {
    type: Number,
    default: 1
  },
  expiryDate: {
    type: Date
  },
  issueDate: {
    type: Date
  },
  documentNumber: {
    type: String,
    trim: true
  },
  issuingAuthority: {
    type: String,
    trim: true
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected', 'expired'],
    default: 'pending'
  },
  metadata: {
    extractedText: String,
    ocrProcessed: {
      type: Boolean,
      default: false
    },
    thumbnailPath: String,
    checksum: String
  }
}, {
  timestamps: true
});

// Indexes for better query performance
documentSchema.index({ uploadedBy: 1, status: 1 });
documentSchema.index({ category: 1, uploadedBy: 1 });
documentSchema.index({ 'permissions.read': 1 });
documentSchema.index({ uploadDate: -1 });
documentSchema.index({ title: 'text', description: 'text' });

// Virtual for document age
documentSchema.virtual('age').get(function() {
  return Math.floor((Date.now() - this.uploadDate) / (1000 * 60 * 60 * 24));
});

// Method to check if document is expired
documentSchema.methods.isExpired = function() {
  return this.expiryDate && this.expiryDate < new Date();
};

// Method to get category display name
documentSchema.methods.getCategoryDisplayName = function() {
  const categoryMap = {
    'pan_card': 'PAN Card',
    'aadhaar_card': 'Aadhaar Card',
    'passport': 'Passport',
    'voter_id': 'Voter ID',
    'driving_license': 'Driving License',
    'bank_statement': 'Bank Statement',
    'income_tax_return': 'Income Tax Return',
    'salary_slip': 'Salary Slip',
    'form_16': 'Form 16',
    'property_deed': 'Property Deed',
    'rent_agreement': 'Rent Agreement',
    'utility_bill': 'Utility Bill',
    'degree_certificate': 'Degree Certificate',
    'marksheet': 'Marksheet',
    'diploma': 'Diploma',
    'medical_document': 'Medical Document',
    'legal_document': 'Legal Document',
    'general_document': 'General Document'
  };
  return categoryMap[this.category] || this.category;
};

// Pre-save middleware to update lastModified
documentSchema.pre('save', function(next) {
  this.lastModified = new Date();
  next();
});

const Document = mongoose.model('Document', documentSchema);

module.exports = {
  Document,
  DOCUMENT_CATEGORIES
};