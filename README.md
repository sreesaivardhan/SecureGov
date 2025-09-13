# SecureGov - Government Document Management System

![SecureGov Logo](assets/images/logo.png)

A comprehensive, secure platform for managing government documents with advanced family sharing, authentication, and document management capabilities. This project demonstrates a full-stack web application with modern security practices and user-friendly interfaces.

## 🌟 Features

### 📄 Document Management
- **Secure Upload & Storage**: Multi-format document upload (PDF, JPG, PNG) with 10MB limit
- **Category Organization**: Organize documents by Government, Personal, Financial, Medical, Legal categories
- **Advanced Search & Filter**: Real-time search with category and date filters
- **Document Actions**: View, download, delete documents with proper authorization
- **File Validation**: Automatic file type validation and size restrictions

### 👨‍👩‍👧‍👦 Family Management
- **Family Groups**: Create and manage family groups for secure document sharing
- **Email Invitations**: Send secure email-based invitations with token authentication
- **Custom Member Names**: Enter full names for family members instead of auto-extracting from emails
- **Relationship Management**: Define and edit family relationships (Parent, Spouse, Child, etc.)
- **Invitation Tracking**: Monitor pending, accepted, and rejected invitations with real-time updates
- **Member Management**: Add, remove, and manage family members with proper permissions
- **Duplicate Prevention**: Advanced backend validation prevents duplicate invitations and members
- **Single-Click Operations**: Optimized UI for single-click invitation management

### 🔐 Security & Authentication
- **Firebase Authentication**: Secure user registration and login with email/password
- **JWT Token Verification**: Server-side token validation for API security
- **User Authorization**: Role-based access control for documents and family features
- **Secure API Endpoints**: Protected routes with proper authentication middleware
- **Data Validation**: Input validation and sanitization on both client and server

### 🚀 Technical Features
- **Real-time Updates**: Dynamic UI updates without page refreshes
- **Error Handling**: Comprehensive error tracking and user-friendly messages
- **Responsive Design**: Mobile-first design that works on all devices
- **Performance Optimization**: Efficient data loading and caching strategies
- **Cross-browser Compatibility**: Works on all modern browsers
- **Enhanced Form Protection**: Button disable mechanisms prevent double submissions
- **Advanced Database Operations**: MongoDB operations with duplicate handling and cleanup
- **Robust Error Recovery**: Graceful handling of ObjectId and token format mismatches

## 🛠️ Tech Stack

### Frontend
- **HTML5/CSS3**: Semantic markup with modern styling and flexbox/grid layouts
- **Vanilla JavaScript (ES6+)**: Modern JavaScript with async/await, modules, and DOM manipulation
- **Firebase SDK v9**: Client-side authentication and real-time features
- **CSS Grid & Flexbox**: Responsive layout system
- **Font Awesome**: Icon library for enhanced UI

### Backend
- **Node.js v18+**: Server-side JavaScript runtime
- **Express.js v5**: Web application framework with middleware support
- **MongoDB**: NoSQL database for document and user data storage
- **Firebase Admin SDK**: Server-side Firebase integration for token verification
- **Multer**: Middleware for handling multipart/form-data file uploads
- **CORS**: Cross-Origin Resource Sharing configuration

### Development Tools
- **Live Server**: Development server with hot reload
- **Mocha/Chai**: Unit and integration testing framework
- **Puppeteer**: End-to-end browser testing
- **NYC**: Code coverage reporting
- **Nodemon**: Development server with auto-restart

## 🚀 Complete Setup Guide

### Prerequisites

Before starting, ensure you have the following installed:

- **Node.js v18 or higher** - [Download here](https://nodejs.org/)
- **MongoDB** - Either local installation or MongoDB Atlas account
- **Git** - For version control
- **Code Editor** - VS Code recommended
- **Web Browser** - Chrome, Firefox, or Safari

### Step 1: Clone and Install

```bash
# Clone the repository
git clone https://github.com/sreesaivardhan/SecureGov.git
cd securegov-project

# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install
cd ..
```

### Step 2: Database Setup

#### Option A: Local MongoDB
```bash
# Install MongoDB locally
# Windows: Download from https://www.mongodb.com/try/download/community
# macOS: brew install mongodb-community
# Linux: Follow official MongoDB installation guide

# Start MongoDB service
# Windows: Start MongoDB service from Services
# macOS/Linux: sudo systemctl start mongod
```

#### Option B: MongoDB Atlas (Recommended)
1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create a free account and cluster
3. Get your connection string
4. Replace `<password>` and `<dbname>` in the connection string

### Step 3: Firebase Configuration

1. **Create Firebase Project**
   - Go to [Firebase Console](https://console.firebase.google.com)
   - Click "Create a project"
   - Enter project name: `securegov-project`
   - Enable Google Analytics (optional)

2. **Enable Authentication**
   - In Firebase Console, go to Authentication > Sign-in method
   - Enable "Email/Password" provider
   - Save changes

3. **Get Firebase Config**
   - Go to Project Settings > General
   - Scroll to "Your apps" section
   - Click "Web app" icon and register app
   - Copy the Firebase configuration object

4. **Update Frontend Config**
   ```javascript
   // Edit js/firebase-config.js
   const firebaseConfig = {
     apiKey: "your-api-key",
     authDomain: "your-project.firebaseapp.com",
     projectId: "your-project-id",
     storageBucket: "your-project.appspot.com",
     messagingSenderId: "123456789",
     appId: "your-app-id"
   };
   ```

5. **Setup Service Account (Backend)**
   - In Firebase Console, go to Project Settings > Service accounts
   - Click "Generate new private key"
   - Download the JSON file
   - Rename it to `serviceAccountKey.json`
   - Place it in the `server/` directory

### Step 4: Environment Configuration

Create environment variables for the backend:

```bash
# Windows (Command Prompt)
set MONGODB_URI=mongodb://127.0.0.1:27017/secureGovDocs
set PORT=5000

# Windows (PowerShell)
$env:MONGODB_URI="mongodb://127.0.0.1:27017/secureGovDocs"
$env:PORT="5000"

# macOS/Linux
export MONGODB_URI="mongodb://127.0.0.1:27017/secureGovDocs"
export PORT=5000

# For MongoDB Atlas, use your connection string:
# mongodb+srv://username:password@cluster.mongodb.net/secureGovDocs
```

### Step 5: Start the Application

#### Terminal 1 - Backend Server
```bash
cd server
npm start
# or for development with auto-restart:
npm run dev
```

You should see:
```
✅ MongoDB connected
✅ Firebase Admin initialized
🚀 Server running on port 5000
```

#### Terminal 2 - Frontend Server
```bash
# From project root directory
npm start
# or
npm run dev
```

You should see:
```
Starting up http-server, serving ./
Available on:
  http://127.0.0.1:3000
  http://localhost:3000
```

### Step 6: Access the Application

1. **Open your browser** and navigate to: `http://localhost:3000`
2. **Register a new account** using the signup form
3. **Verify the setup** by checking both terminals for successful connections

## 🧪 Testing All Functionalities

### 1. User Authentication Testing

**Registration:**
1. Go to `http://localhost:3000`
2. Click "Sign Up" 
3. Enter email and password
4. Click "Create Account"
5. ✅ Should redirect to dashboard

**Login:**
1. Click "Sign Out" if logged in
2. Click "Sign In"
3. Enter credentials
4. ✅ Should redirect to dashboard

### 2. Document Management Testing

**Upload Documents:**
1. Click "Upload Document" button
2. Select a PDF, JPG, or PNG file (max 10MB)
3. Enter title and description
4. Select category
5. Click "Upload"
6. ✅ Document should appear in documents list

**View Documents:**
1. Click on any document in the list
2. ✅ Document should open in new tab/window

**Download Documents:**
1. Click download icon on any document
2. ✅ File should download to your computer

**Delete Documents:**
1. Click delete (trash) icon on any document
2. Confirm deletion
3. ✅ Document should be removed from list

### 3. Family Management Testing

**Send Invitations:**
1. Click "Family" in navigation
2. Click "Invite Family Member"
3. Enter member name, email address, and relationship
4. Click "Send Invitation" (button will disable during processing)
5. ✅ Invitation should appear in pending list with custom member name

**Manage Family Members:**
1. View family members list with proper names displayed
2. Edit relationships using edit button
3. Remove members using delete button (single-click removal)
4. Cancel pending invitations with cancel button
5. ✅ Changes should be reflected immediately with real-time updates

**Duplicate Prevention Testing:**
1. Try sending invitation to same email twice
2. ✅ Should prevent duplicate invitations with proper error message
3. Try inviting yourself
4. ✅ Should prevent self-invitations with validation error

### 4. Dashboard Testing

**Statistics Verification:**
1. Go to dashboard
2. Check document count matches uploaded documents
3. Check family member count
4. ✅ All statistics should be accurate and update in real-time

## 🔧 Server Management Commands

### Backend Server Commands
```bash
cd server

# Start production server
npm start

# Start development server with auto-restart
npm run dev

# Install dependencies
npm install

# Check server status
curl http://localhost:5000/test
```

### Frontend Server Commands
```bash
# Start frontend development server
npm start
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Install dependencies
npm install
```

## 📁 Detailed Project Structure

```
securegov-project/
├── 📁 assets/                    # Static assets
│   ├── 📁 docs/                 # Documentation files
│   ├── 📁 icons/                # Application icons
│   └── 📁 images/               # Images and logos
├── 📁 components/               # Reusable HTML components
│   ├── footer.html              # Footer component
│   └── header.html              # Header component
├── 📁 css/                      # Stylesheets
│   ├── style.css               # Main application styles
│   ├── documents.css           # Document management styles
│   ├── family.css              # Family management styles
│   ├── family-dashboard.css    # Family dashboard styles
│   └── profile.css             # User profile styles
├── 📁 js/                       # JavaScript modules
│   ├── app.js                  # Main application logic
│   ├── advanced-features.js    # Advanced functionality
│   ├── documents.js            # Document management
│   ├── family.js               # Family management
│   ├── firebase-config.js      # Firebase configuration
│   ├── config.js               # Application configuration
│   └── errorHandler.js         # Error handling utilities
├── 📁 pages/                    # Additional HTML pages
│   ├── dashboard.html          # User dashboard
│   ├── documents.html          # Document management page
│   ├── family.html             # Family management page
│   └── profile.html            # User profile page
├── 📁 server/                   # Backend server code
│   ├── 📁 config/              # Server configuration
│   │   └── firebase-storage.js # Firebase storage config
│   ├── 📁 middleware/          # Express middleware
│   │   ├── auth.js             # Authentication middleware
│   │   ├── authMiddleware.js   # Additional auth middleware
│   │   └── security.js         # Security middleware
│   ├── 📁 models/              # Data models
│   │   ├── Document.js         # Document model
│   │   ├── FamilyGroup.js      # Family group model
│   │   └── UserProfile.js      # User profile model
│   ├── server-simple.js        # Main server file
│   ├── package.json            # Server dependencies
│   └── serviceAccountKey.json  # Firebase service account (you need to add this)
├── 📁 tests/                    # Test suites
│   ├── 📁 unit/                # Unit tests
│   ├── 📁 integration/         # Integration tests
│   └── run-tests.js            # Test runner
├── index.html                  # Main HTML entry point
├── package.json                # Frontend dependencies and scripts
├── netlify.toml               # Netlify deployment config
├── _redirects                 # Netlify redirects
├── firebase.json              # Firebase configuration
├── .firebaserc               # Firebase project settings
└── README.md                 # This file
```

## 🌐 API Endpoints

### Authentication Endpoints
- `POST /api/users/sync` - Sync user data with database
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update user profile

### Document Endpoints
- `GET /api/documents` - Get user documents
- `POST /api/documents/upload` - Upload new document
- `GET /api/documents/:id/download` - Download document
- `DELETE /api/documents/:id` - Delete document
- `GET /api/documents/stats` - Get document statistics

### Family Management Endpoints
- `GET /api/family/members` - Get family members and pending invitations
- `GET /api/family/count` - Get family member count for dashboard
- `POST /api/family/invite` - Send family invitation with custom member name
- `DELETE /api/family/invitations/:id` - Cancel invitation (supports ObjectId and token)
- `DELETE /api/family/members/:id` - Remove family member (handles duplicates)
- `POST /api/family/invitations/:id/resend` - Resend invitation
- `PUT /api/family/members/:id/relationship` - Update member relationship
- `POST /api/family/accept/:token` - Accept invitation via secure token
- `POST /api/family/reject-invitation/:token` - Reject invitation

## 🔍 Troubleshooting

### Common Issues and Solutions

#### 1. "Connection Refused" Error
**Problem:** Backend server not running
**Solution:**
```bash
cd server
npm start
# Check if port 5000 is available
netstat -an | findstr :5000
```

#### 2. "Firebase Auth Error"
**Problem:** Firebase configuration missing or incorrect
**Solution:**
1. Verify `js/firebase-config.js` has correct values
2. Check Firebase project settings
3. Ensure Authentication is enabled in Firebase Console

#### 3. "MongoDB Connection Failed"
**Problem:** MongoDB not running or wrong connection string
**Solution:**
```bash
# Check MongoDB status
# Windows: Check Services for MongoDB
# macOS/Linux: sudo systemctl status mongod

# Verify connection string
echo $MONGODB_URI
```

#### 4. "File Upload Failed"
**Problem:** File size too large or unsupported format
**Solution:**
- Ensure file is under 10MB
- Use only PDF, JPG, PNG formats
- Check browser console for detailed errors

#### 5. "Token Verification Failed"
**Problem:** Firebase service account key missing
**Solution:**
1. Download service account key from Firebase Console
2. Place `serviceAccountKey.json` in `server/` directory
3. Restart backend server

#### 6. "Duplicate Invitation" or "500 Error on Deletion"
**Problem:** Database contains duplicate records or ObjectId format issues
**Solution:**
1. Check server logs for detailed error messages
2. Restart backend server to clear any cached connections
3. Use MongoDB Compass to manually check for duplicate records
4. Backend automatically handles ObjectId vs string ID formats

#### 7. "Family Member Name Shows as Undefined"
**Problem:** Member name not being passed correctly in invitation form
**Solution:**
1. Ensure all form fields (memberName, email, relationship) are filled
2. Check browser console for JavaScript errors
3. Verify backend is receiving memberName field in request
4. Clear browser cache and reload page

### Debug Mode

Enable detailed logging:
```bash
# Backend debug mode
cd server
DEBUG=* npm start

# Check browser console for frontend errors
# Press F12 in browser and check Console tab
```

## 🚀 Production Deployment

### Frontend (Netlify)
1. Push code to GitHub
2. Connect repository to Netlify
3. Build settings: `npm run build`
4. Publish directory: `./`

### Backend (Render/Heroku)
1. Create account on Render or Heroku
2. Connect GitHub repository
3. Set environment variables:
   - `MONGODB_URI`
   - `FIREBASE_ADMIN_KEY_PATH`
4. Deploy backend service

## 📞 Support

If you encounter any issues during setup:

1. **Check the console logs** in both terminal windows
2. **Verify all prerequisites** are installed correctly
3. **Ensure Firebase configuration** is complete
4. **Check MongoDB connection** is working
5. **Review the troubleshooting section** above

For additional help, check the browser console (F12) for detailed error messages.

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**Built with ❤️ for secure government document management**
