# SecureGov - Government Document Management System

![SecureGov Logo](assets/images/logo.png)

A comprehensive, secure platform for managing government documents with advanced family sharing, encryption, and search capabilities.

## 🌟 Features

### 📄 Document Management
- **Upload & Storage**: Secure document upload with multiple file format support
- **Organization**: Category-based document organization (Government, Personal, Financial, Medical, Legal)
- **Advanced Search**: Real-time search with filters by name, category, date, and content
- **Document Actions**: View, download, print, encrypt/decrypt, and share documents
- **File Validation**: Automatic file type and size validation

### 👨‍👩‍👧‍👦 Family Management
- **Family Groups**: Create and manage family groups for document sharing
- **Secure Invitations**: Email-based invitation system with token-based security
- **Role Management**: Control access levels for family members
- **Invitation Tracking**: Monitor pending, accepted, and rejected invitations
- **Member Management**: Add, remove, and manage family members

### 🔐 Security & Privacy
- **Firebase Authentication**: Secure user authentication and authorization
- **Document Encryption**: Toggle encryption for sensitive documents
- **Access Control**: User-based document access with family sharing permissions
- **Security Logging**: Comprehensive security event tracking
- **Token-based API**: Secure API access with Firebase ID tokens

### 🚀 Advanced Features
- **Real-time Notifications**: Toast notifications for user feedback
- **Performance Optimization**: Caching, lazy loading, and debounced search
- **Error Handling**: Comprehensive error tracking and user-friendly messages
- **Responsive Design**: Mobile-first design that works on all devices
- **Progressive Web App**: PWA capabilities for offline access

## 🛠️ Tech Stack

### Frontend
- **HTML5/CSS3**: Modern semantic markup and responsive styling
- **JavaScript (ES6+)**: Vanilla JavaScript with modern features
- **Firebase SDK**: Authentication and real-time features
- **Progressive Web App**: Service worker and offline capabilities

### Backend
- **Node.js**: Server-side JavaScript runtime
- **Express.js**: Web application framework
- **MongoDB**: NoSQL database for document and user data
- **Firebase Admin**: Server-side Firebase integration
- **Multer**: File upload handling

### Development & Testing
- **Mocha/Chai**: Unit and integration testing
- **Puppeteer**: End-to-end testing
- **NYC**: Code coverage reporting
- **ESLint**: Code quality and consistency

### Deployment
- **Netlify**: Frontend hosting and deployment
- **Heroku**: Backend API hosting
- **MongoDB Atlas**: Cloud database hosting

## 🚀 Quick Start

### Prerequisites

- Node.js (v18 or higher)
- MongoDB (local or MongoDB Atlas)
- Firebase project with Authentication enabled
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/sreesaivhan/SecureGov.git
   cd securegov-project
   ```

2. **Install dependencies**
   ```bash
   npm install
   cd server && npm install
   ```

3. **Configure Firebase**
   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com)
   - Enable Authentication with Email/Password
   - Download service account key and place in `server/config/`
   - Update `js/firebase-config.js` with your Firebase config

4. **Configure MongoDB**
   ```bash
   # Set environment variable
   export MONGODB_URI="mongodb://localhost:27017/secureGovDocs"
   # Or use MongoDB Atlas connection string
   ```

5. **Start the development servers**
   ```bash
   # Start backend server
   cd server && node server-clean.js

   # Start frontend server (new terminal)
   npm run dev
   ```

6. **Access the application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

## 📁 Project Structure

```
securegov-project/
├── assets/                 # Static assets (images, icons, docs)
├── components/            # Reusable HTML components
├── css/                   # Stylesheets
│   ├── style.css         # Main stylesheet
│   ├── documents.css     # Document-specific styles
│   ├── family.css        # Family management styles
│   └── profile.css       # User profile styles
├── js/                    # JavaScript modules
│   ├── app.js            # Main application logic
│   ├── advanced-features.js # Advanced functionality
│   ├── errorHandler.js   # Error handling utilities
│   ├── performance.js    # Performance optimization
│   └── firebase-config.js # Firebase configuration
├── pages/                 # Additional HTML pages
├── server/                # Backend server code
│   ├── config/           # Configuration files
│   ├── middleware/       # Express middleware
│   ├── models/           # Data models
│   ├── utils/            # Utility functions
│   └── server-clean.js   # Main server file
├── tests/                 # Test suites
│   ├── unit/             # Unit tests
│   ├── integration/      # Integration tests
│   └── run-tests.js      # Test runner
├── index.html            # Main HTML file
├── netlify.toml          # Netlify configuration
├── _redirects            # Netlify redirects
└── package.json          # Dependencies and scripts