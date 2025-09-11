# SecureGov Deployment Guide

## 🚀 Netlify Deployment (Frontend)

### Step 1: Prepare Your Repository

1. **Ensure all files are committed to Git**
   ```bash
   git add .
   git commit -m "Prepare for deployment"
   git push origin main
   ```

2. **Verify deployment files are in place**
   - `netlify.toml` - Netlify configuration
   - `_redirects` - URL redirects for SPA
   - `index.html` - Main entry point

### Step 2: Deploy to Netlify

#### Option A: Git Integration (Recommended)

1. **Connect to Netlify**
   - Go to [Netlify](https://netlify.com)
   - Click "New site from Git"
   - Connect your GitHub repository
   - Select the `securegov-project` repository

2. **Configure Build Settings**
   - **Build command**: `echo 'Static site - no build required'`
   - **Publish directory**: `.` (root directory)
   - **Branch to deploy**: `main`

3. **Set Environment Variables**
   In Netlify dashboard → Site settings → Environment variables:
   ```
   FIREBASE_API_KEY=your-firebase-api-key
   FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
   FIREBASE_PROJECT_ID=your-project-id
   FIREBASE_STORAGE_BUCKET=your-project.appspot.com
   FIREBASE_MESSAGING_SENDER_ID=123456789
   FIREBASE_APP_ID=your-app-id
   BACKEND_URL=https://your-backend-server.herokuapp.com
   ```

4. **Deploy**
   - Click "Deploy site"
   - Wait for deployment to complete
   - Your site will be available at `https://random-name.netlify.app`

#### Option B: Manual Deploy

1. **Install Netlify CLI**
   ```bash
   npm install -g netlify-cli
   ```

2. **Login to Netlify**
   ```bash
   netlify login
   ```

3. **Deploy**
   ```bash
   # From project root
   netlify deploy --prod --dir=.
   ```

### Step 3: Custom Domain (Optional)

1. **Add Custom Domain**
   - Go to Site settings → Domain management
   - Click "Add custom domain"
   - Enter your domain (e.g., `securegov.yourdomain.com`)

2. **Configure DNS**
   - Add CNAME record pointing to your Netlify subdomain
   - Or use Netlify DNS for automatic configuration

3. **Enable HTTPS**
   - Netlify automatically provides SSL certificates
   - Force HTTPS in Site settings → HTTPS

## 🔧 Backend Deployment Options

### Option 1: Heroku (Recommended)

1. **Prepare Backend for Heroku**
   ```bash
   cd server
   
   # Create Procfile
   echo "web: node server-clean.js" > Procfile
   
   # Update package.json
   ```

2. **Add to server/package.json**:
   ```json
   {
     "engines": {
       "node": "18.x"
     },
     "scripts": {
       "start": "node server-clean.js"
     }
   }
   ```

3. **Deploy to Heroku**
   ```bash
   # Install Heroku CLI
   # Create Heroku app
   heroku create your-securegov-backend
   
   # Set environment variables
   heroku config:set MONGODB_URI=your-mongodb-atlas-connection-string
   heroku config:set NODE_ENV=production
   heroku config:set FIREBASE_PROJECT_ID=your-project-id
   heroku config:set FIREBASE_PRIVATE_KEY="your-private-key"
   heroku config:set FIREBASE_CLIENT_EMAIL=your-client-email
   
   # Deploy
   git subtree push --prefix server heroku main
   ```

### Option 2: Railway

1. **Connect Repository**
   - Go to [Railway](https://railway.app)
   - Connect GitHub repository
   - Select the `server` folder as root

2. **Configure Environment Variables**
   - Add all required environment variables
   - Set `PORT` to `$PORT` (Railway provides this)

3. **Deploy**
   - Railway automatically deploys on git push

### Option 3: Render

1. **Create Web Service**
   - Go to [Render](https://render.com)
   - Create new Web Service
   - Connect repository

2. **Configure Service**
   - **Build Command**: `npm install`
   - **Start Command**: `node server-clean.js`
   - **Root Directory**: `server`

## 🗄️ Database Setup

### MongoDB Atlas (Recommended)

1. **Create Cluster**
   - Go to [MongoDB Atlas](https://cloud.mongodb.com)
   - Create free cluster
   - Choose cloud provider and region

2. **Configure Access**
   - Create database user
   - Add IP addresses to whitelist (0.0.0.0/0 for all)
   - Get connection string

3. **Update Environment Variables**
   ```
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/secureGovDocs?retryWrites=true&w=majority
   ```

## 🔐 Environment Configuration

### Frontend Environment Variables

Update `js/firebase-config.js` for production:

```javascript
const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "your-api-key",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "your-project.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "your-project-id",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "your-project.appspot.com",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "123456789",
  appId: process.env.FIREBASE_APP_ID || "your-app-id"
};
```

### Backend Environment Variables

Required environment variables for production:

```env
# Database
MONGODB_URI=mongodb+srv://...

# Firebase Admin
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-...@your-project.iam.gserviceaccount.com

# Server
NODE_ENV=production
PORT=5000

# CORS
FRONTEND_URL=https://your-site.netlify.app
```

## 🔗 Connect Frontend to Backend

1. **Update API Configuration**
   
   In `js/config.js`:
   ```javascript
   const API_BASE_URL = window.location.hostname === 'localhost' 
     ? 'http://localhost:5000' 
     : 'https://your-backend-server.herokuapp.com';
   ```

2. **Update Netlify Redirects**
   
   In `netlify.toml`:
   ```toml
   [[redirects]]
     from = "/api/*"
     to = "https://your-backend-server.herokuapp.com/api/:splat"
     status = 200
     force = true
   ```

3. **Update CORS in Backend**
   
   In `server/server-clean.js`:
   ```javascript
   app.use(cors({
     origin: [
       'http://localhost:3000',
       'http://localhost:5500',
       'https://your-site.netlify.app'
     ]
   }));
   ```

## ✅ Deployment Checklist

### Pre-Deployment

- [ ] All code committed and pushed to Git
- [ ] Firebase project configured
- [ ] MongoDB Atlas cluster created
- [ ] Environment variables documented
- [ ] API endpoints tested locally
- [ ] Frontend builds without errors

### Frontend Deployment

- [ ] Netlify site created and connected to Git
- [ ] Build settings configured
- [ ] Environment variables set in Netlify
- [ ] Custom domain configured (if applicable)
- [ ] HTTPS enabled
- [ ] Redirects working for SPA routing

### Backend Deployment

- [ ] Heroku app created
- [ ] Environment variables set in Heroku
- [ ] Database connection string updated
- [ ] CORS configured for production domain
- [ ] API endpoints accessible from frontend

### Post-Deployment

- [ ] Frontend loads correctly
- [ ] User authentication works
- [ ] Document upload/download works
- [ ] Family invitations work
- [ ] Search functionality works
- [ ] Error handling works
- [ ] Performance is acceptable
- [ ] Security headers are set

## 🐛 Troubleshooting

### Common Issues

1. **CORS Errors**
   - Ensure backend CORS is configured for your Netlify domain
   - Check that API_BASE_URL points to correct backend URL

2. **Firebase Authentication Issues**
   - Verify Firebase config is correct
   - Check that domain is authorized in Firebase console
   - Ensure environment variables are set correctly

3. **Database Connection Issues**
   - Verify MongoDB Atlas connection string
   - Check IP whitelist includes 0.0.0.0/0
   - Ensure database user has correct permissions

4. **File Upload Issues**
   - Check file size limits in both frontend and backend
   - Verify upload directory permissions
   - Ensure multer is configured correctly

5. **Build/Deploy Failures**
   - Check build logs for specific errors
   - Verify all dependencies are in package.json
   - Ensure Node.js version compatibility

### Debug Commands

```bash
# Check Netlify deployment status
netlify status

# View Netlify build logs
netlify logs

# Check Heroku app status
heroku ps -a your-app-name

# View Heroku logs
heroku logs --tail -a your-app-name

# Test API endpoints
curl https://your-backend.herokuapp.com/test
```

## 🚀 Going Live

1. **Final Testing**
   - Test all functionality on production URLs
   - Verify performance is acceptable
   - Check mobile responsiveness
   - Test error scenarios

2. **Monitoring Setup**
   - Set up error tracking (Sentry, LogRocket)
   - Configure uptime monitoring
   - Set up performance monitoring

3. **Backup Strategy**
   - Regular database backups
   - Code repository backups
   - Environment variable backups

4. **Security Review**
   - Review security headers
   - Check for exposed sensitive data
   - Verify HTTPS is enforced
   - Review CORS configuration

Your SecureGov application is now ready for production! 🎉
