const Joi = require('joi');

// Document upload validation
const documentUploadSchema = Joi.object({
  title: Joi.string().min(1).max(255).required(),
  description: Joi.string().max(1000).allow(''),
  type: Joi.string().valid(
    'aadhaar', 'pan', 'passport', 'license', 'marksheet', 
    'certificate', 'other'
  ).required(),
  department: Joi.string().max(100).default('citizen'),
  classification: Joi.string().valid(
    'public', 'personal', 'confidential', 'secret'
  ).default('personal'),
  tags: Joi.string().allow('')
});

// User profile validation
const userProfileSchema = Joi.object({
  name: Joi.string().min(2).max(100),
  phone: Joi.string().pattern(/^[6-9]\d{9}$/),
  department: Joi.string().max(100),
  role: Joi.string().valid('user', 'admin', 'editor', 'viewer')
});

// Document sharing validation
const shareDocumentSchema = Joi.object({
  email: Joi.string().email().required(),
  permission: Joi.string().valid('read', 'write', 'download').required()
});

// Generic validation middleware
function validateBody(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorMessages = error.details.map(detail => detail.message);
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errorMessages
      });
    }

    req.body = value;
    next();
  };
}

// File validation middleware
function validateFile(req, res, next) {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded'
    });
  }

  const allowedTypes = [
    'application/pdf',
    'image/jpeg',
    'image/jpg', 
    'image/png'
  ];

  if (!allowedTypes.includes(req.file.mimetype)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid file type. Only PDF, JPG, and PNG files are allowed.'
    });
  }

  const maxSize = 10 * 1024 * 1024; // 10MB
  if (req.file.size > maxSize) {
    return res.status(400).json({
      success: false,
      message: 'File too large. Maximum size is 10MB.'
    });
  }

  next();
}

// Query parameter validation
function validateQuery(schema) {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errorMessages = error.details.map(detail => detail.message);
      return res.status(400).json({
        success: false,
        message: 'Invalid query parameters',
        errors: errorMessages
      });
    }

    req.query = value;
    next();
  };
}

// Pagination query schema
const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().max(255).allow(''),
  sort: Joi.string().valid('uploadDate', 'title', 'type').default('uploadDate'),
  order: Joi.string().valid('asc', 'desc').default('desc')
});

module.exports = {
  validateBody,
  validateFile,
  validateQuery,
  documentUploadSchema,
  userProfileSchema,
  shareDocumentSchema,
  paginationSchema
};