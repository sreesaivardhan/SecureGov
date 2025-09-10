// Initialize Firebase (only for authentication)
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore(); // Keep for user management, but documents will use MongoDB

// Backend API Configuration
const API_BASE_URL = 'http://localhost:5000/api';

// Global Variables
let currentUser = null;
let selectedFile = null;
let currentDocumentId = null;

// Logging System
const logger = {
    info: (message, data = {}) => {
        console.log(`[INFO] ${new Date().toISOString()}: ${message}`, data);
    },
    error: (message, error = {}) => {
        console.error(`[ERROR] ${new Date().toISOString()}: ${message}`, error);
    },
    warn: (message, data = {}) => {
        console.warn(`[WARN] ${new Date().toISOString()}: ${message}`, data);
    }
};

// API Helper Functions
async function apiCall(endpoint, options = {}) {
    try {
        const token = currentUser ? await currentUser.getIdToken() : null;
        
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` })
            }
        };

        // Don't set Content-Type for FormData
        if (options.body instanceof FormData) {
            delete defaultOptions.headers['Content-Type'];
        }

        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...defaultOptions,
            ...options,
            headers: {
                ...defaultOptions.headers,
                ...options.headers
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `HTTP ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        logger.error('API call failed', { endpoint, error: error.message });
        throw error;
    }
}

// Authentication State Observer
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        logger.info('User authenticated', { uid: user.uid });
        
        // Create/update user in MongoDB via backend
        try {
            await createOrUpdateUser(user);
        } catch (error) {
            logger.error('Failed to sync user with backend', error);
        }
        
        initializeDashboard();
        showScreen('dashboardScreen');
        updateNavigation(true);
    } else {
        currentUser = null;
        logger.info('User signed out');
        showScreen('loginScreen');
        updateNavigation(false);
    }
});

// Create or update user in MongoDB
async function createOrUpdateUser(firebaseUser) {
    try {
        const userData = {
            firebaseUID: firebaseUser.uid,
            email: firebaseUser.email,
            name: firebaseUser.displayName || '',
            emailVerified: firebaseUser.emailVerified,
            lastLogin: new Date().toISOString()
        };

        await apiCall('/users/sync', {
            method: 'POST',
            body: JSON.stringify(userData)
        });

        logger.info('User synced with backend', { uid: firebaseUser.uid });
    } catch (error) {
        logger.error('User sync failed', error);
        // Don't block authentication if backend sync fails
    }
}

// Navigation Functions
function updateNavigation(isLoggedIn) {
    const navLinks = document.getElementById('navLinks');
    if (navLinks) {
        if (isLoggedIn) {
            navLinks.innerHTML = `
                <li><a href="#" onclick="showDashboardSection('overview')">Dashboard</a></li>
                <li><a href="pages/documents.html">Documents</a></li>
                <li><a href="pages/family.html">Family</a></li>
                <li><a href="pages/profile.html">Profile</a></li>
                <li><a href="#" onclick="logout()">Logout</a></li>
            `;
        } else {
            navLinks.innerHTML = `
                <li><a href="#" onclick="showScreen('loginScreen')">Login</a></li>
                <li><a href="#" onclick="showScreen('registerScreen')">Register</a></li>
            `;
        }
    }
}

function showScreen(screenId) {
    const screens = document.querySelectorAll('.main-content');
    screens.forEach(screen => screen.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    logger.info('Screen changed', { screen: screenId });
}

function showDashboardSection(section) {
    // Hide all sections first
    const sections = document.querySelectorAll('.dashboard-section');
    sections.forEach(s => s.style.display = 'none');
    
    // Update sidebar active state
    const sidebarLinks = document.querySelectorAll('.sidebar-menu a');
    sidebarLinks.forEach(link => link.classList.remove('active'));
    
    // Show the requested section
    const targetSection = document.getElementById(section + 'Section');
    if (targetSection) {
        targetSection.style.display = 'block';
        
        // Update active sidebar link
        const activeLink = document.querySelector(`.sidebar-menu a[onclick*="${section}"]`);
        if (activeLink) {
            activeLink.classList.add('active');
        }
        
        // Load section-specific data
        if (section === 'documents') {
            loadDocuments();
        } else if (section === 'family') {
            loadFamilyMembers();
        } else if (section === 'profile') {
            loadUserProfile();
        } else if (section === 'overview') {
            loadDashboardOverview();
        }
    }
}

// Load documents for documents section
function loadDocuments() {
    const documentsGrid = document.getElementById('documentsGrid');
    if (!documentsGrid) return;
    
    // Fetch documents from backend
    fetch('/api/documents', {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('firebaseToken')}`,
            'Content-Type': 'application/json'
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.success && data.documents) {
            if (data.documents.length === 0) {
                documentsGrid.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-file-alt" style="font-size: 3rem; color: #ccc; margin-bottom: 1rem;"></i>
                        <p>No documents uploaded yet</p>
                        <p style="color: #666; font-size: 0.9rem;">Click "Add Document" to upload your first document</p>
                    </div>
                `;
                return;
            }
            
            documentsGrid.innerHTML = data.documents.map(doc => `
                <div class="document-card">
                    <div class="document-icon">
                        <i class="fas ${getDocumentIcon(doc.category)}"></i>
                    </div>
                    <div class="document-info">
                        <h4>${doc.title}</h4>
                        <p>Uploaded: ${new Date(doc.uploadDate).toLocaleDateString()}</p>
                        <p>Size: ${formatFileSize(doc.fileSize)}</p>
                        <span class="status ${doc.verificationStatus}">${doc.verificationStatus}</span>
                    </div>
                    <div class="document-actions">
                        <button onclick="viewDocument('${doc._id}')" class="btn-icon" title="View">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button onclick="downloadDocument('${doc._id}')" class="btn-icon" title="Download">
                            <i class="fas fa-download"></i>
                        </button>
                        <button onclick="deleteDocument('${doc._id}')" class="btn-icon delete" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `).join('');
        } else {
            // Fallback to mock data if API fails
            loadMockDocuments();
        }
    })
    .catch(error => {
        console.error('Error loading documents:', error);
        // Fallback to mock data
        loadMockDocuments();
    });
}

// Fallback mock documents function
function loadMockDocuments() {
    const documentsGrid = document.getElementById('documentsGrid');
    if (!documentsGrid) return;
    
    const mockDocuments = [
        {
            id: 1,
            name: 'Aadhaar Card',
            type: 'aadhaar',
            uploadDate: '2024-01-15',
            size: '2.3 MB',
            status: 'verified'
        },
        {
            id: 2,
            name: 'PAN Card',
            type: 'pan',
            uploadDate: '2024-01-10',
            size: '1.8 MB',
            status: 'pending'
        }
    ];
    
    documentsGrid.innerHTML = mockDocuments.map(doc => `
        <div class="document-card">
            <div class="document-icon">
                <i class="fas ${getDocumentIcon(doc.type)}"></i>
            </div>
            <div class="document-info">
                <h4>${doc.name}</h4>
                <p>Uploaded: ${doc.uploadDate}</p>
                <p>Size: ${doc.size}</p>
                <span class="status ${doc.status}">${doc.status}</span>
            </div>
            <div class="document-actions">
                <button onclick="viewDocument(${doc.id})" class="btn-icon" title="View">
                    <i class="fas fa-eye"></i>
                </button>
                <button onclick="downloadDocument(${doc.id})" class="btn-icon" title="Download">
                    <i class="fas fa-download"></i>
                </button>
                <button onclick="deleteDocument(${doc.id})" class="btn-icon delete" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
}

// Format file size helper
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Get document icon based on type
function getDocumentIcon(type) {
    const icons = {
        'aadhaar': 'fa-id-card',
        'pan': 'fa-credit-card',
        'passport': 'fa-passport',
        'license': 'fa-car',
        'marksheet': 'fa-graduation-cap',
        'certificate': 'fa-certificate',
        'other': 'fa-file-alt'
    };
    return icons[type] || 'fa-file-alt';
}

// Handle file selection for upload
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        const uploadArea = document.querySelector('.upload-area');
        uploadArea.innerHTML = `
            <div class="upload-icon">
                <i class="fas fa-file-check"></i>
            </div>
            <h3>File Selected: ${file.name}</h3>
            <p>Size: ${(file.size / 1024 / 1024).toFixed(2)} MB</p>
        `;
    }
}

// Load family members
function loadFamilyMembers() {
    const familyGrid = document.getElementById('familyGrid');
    if (!familyGrid) return;
    
    // Mock family data
    const mockFamily = [
        {
            id: 1,
            name: 'John Doe',
            relation: 'Self',
            aadhaar: '****-****-1234',
            status: 'verified'
        },
        {
            id: 2,
            name: 'Jane Doe',
            relation: 'Spouse',
            aadhaar: '****-****-5678',
            status: 'pending'
        }
    ];
    
    familyGrid.innerHTML = mockFamily.map(member => `
        <div class="family-card">
            <div class="family-avatar">
                <i class="fas fa-user"></i>
            </div>
            <div class="family-info">
                <h4>${member.name}</h4>
                <p>Relation: ${member.relation}</p>
                <p>Aadhaar: ${member.aadhaar}</p>
                <span class="status ${member.status}">${member.status}</span>
            </div>
        </div>
    `).join('');
}

// Load user profile
function loadUserProfile() {
    const profileName = document.getElementById('profileName');
    const profileEmail = document.getElementById('profileEmail');
    const profilePhone = document.getElementById('profilePhone');
    const profileAadhaar = document.getElementById('profileAadhaar');
    
    if (profileName) {
        // Mock profile data
        profileName.value = 'John Doe';
        profileEmail.value = 'john.doe@example.com';
        profilePhone.value = '+91 9876543210';
        profileAadhaar.value = '****-****-1234';
    }
}

// Document actions
function viewDocument(id) {
    showAlert('Document viewer would open here', 'info');
}

function downloadDocument(id) {
    showAlert('Document download started', 'success');
}

function deleteDocument(id) {
    if (confirm('Are you sure you want to delete this document?')) {
        showAlert('Document deleted successfully', 'success');
        loadDocuments(); // Refresh the list
    }
}

// Upload form handler
document.addEventListener('DOMContentLoaded', function() {
    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm) {
        uploadForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const fileInput = document.getElementById('fileInput');
            const docType = document.getElementById('docType');
            const docName = document.getElementById('docName');
            const docDescription = document.getElementById('docDescription');
            
            if (!fileInput || !fileInput.files || !fileInput.files[0]) {
                showAlert('Please select a file to upload', 'error');
                return;
            }
            
            if (!docType || !docName || !docType.value || !docName.value) {
                showAlert('Please fill in all required fields', 'error');
                return;
            }
            
            // Upload to backend API
            const uploadBtn = document.getElementById('uploadBtnText');
            const uploadLoader = document.getElementById('uploadLoader');
            
            uploadBtn.textContent = 'Uploading...';
            uploadLoader.classList.remove('hidden');
            
            // Create FormData for file upload
            const formData = new FormData();
            formData.append('document', fileInput.files[0]);
            formData.append('title', docName.value);
            formData.append('category', docType.value);
            if (docDescription && docDescription.value) {
                formData.append('description', docDescription.value);
            }
            
            // Upload to backend
            fetch('/api/documents/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('firebaseToken')}`
                },
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showAlert('Document uploaded successfully!', 'success');
                    
                    // Reset form
                    uploadForm.reset();
                    const uploadArea = document.querySelector('.upload-area');
                    uploadArea.innerHTML = `
                        <div class="upload-icon">
                            <i class="fas fa-cloud-upload-alt"></i>
                        </div>
                        <h3>Click to upload or drag and drop</h3>
                        <p>PDF, JPG, PNG files only (Max 10MB)</p>
                    `;
                    
                    // Refresh documents if on documents section
                    if (document.getElementById('documentsSection').style.display !== 'none') {
                        loadDocuments();
                    }
                } else {
                    showAlert(data.message || 'Upload failed', 'error');
                }
            })
            .catch(error => {
                console.error('Upload error:', error);
                showAlert('Upload failed. Please try again.', 'error');
            })
            .finally(() => {
                uploadBtn.textContent = 'Upload Document';
                uploadLoader.classList.add('hidden');
            });
        });
    }
});

// Add family member function
function addFamilyMember() {
    showAlert('Add family member functionality would open here', 'info');
}

// Alert System
function showAlert(message, type = 'success') {
    const alertContainer = document.getElementById('alertContainer');
    const alertId = 'alert_' + Date.now();
    
    const alertHTML = `
        <div id="${alertId}" class="alert alert-${type} show">
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-triangle'}"></i>
            ${message}
        </div>
    `;
    
    alertContainer.innerHTML = alertHTML;
    logger.info('Alert shown', { message, type });
    
    setTimeout(() => {
        const alert = document.getElementById(alertId);
        if (alert) alert.remove();
    }, 5000);
}

// Modal Functions
function showModal(modalId) {
    document.getElementById(modalId).classList.add('active');
    logger.info('Modal shown', { modal: modalId });
}

function hideModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
    logger.info('Modal hidden', { modal: modalId });
}

// Authentication Functions (keep Firebase auth)
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('registerBtnText');
    const loader = document.getElementById('registerLoader');
    
    try {
        submitBtn.classList.add('hidden');
        loader.classList.remove('hidden');
        
        const formData = {
            fullName: document.getElementById('fullName').value,
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value,
            aadhaar: document.getElementById('aadhaar').value,
            password: document.getElementById('password').value,
            confirmPassword: document.getElementById('confirmPassword').value
        };
        
        // Validation
        if (formData.password !== formData.confirmPassword) {
            throw new Error('Passwords do not match');
        }
        
        if (formData.aadhaar.length !== 12 || !/^\d{12}$/.test(formData.aadhaar)) {
            throw new Error('Please enter a valid 12-digit Aadhaar number');
        }
        
        // Create user account in Firebase
        const userCredential = await auth.createUserWithEmailAndPassword(formData.email, formData.password);
        
        // Update Firebase user profile
        await userCredential.user.updateProfile({
            displayName: formData.fullName
        });
        
        // Store additional user data in Firestore (for profile management)
        await db.collection('users').doc(userCredential.user.uid).set({
            fullName: formData.fullName,
            email: formData.email,
            phone: formData.phone,
            aadhaar: formData.aadhaar,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            isEmailVerified: false
        });
        
        logger.info('User registered successfully', { uid: userCredential.user.uid });
        
        // Send verification email
        await userCredential.user.sendEmailVerification();
        showAlert('Account created successfully! Please check your email for verification.', 'success');
        
        // Simulate OTP verification for demo
        showScreen('otpScreen');
        
    } catch (error) {
        logger.error('Registration error', error);
        showAlert(error.message, 'error');
    } finally {
        submitBtn.classList.remove('hidden');
        loader.classList.add('hidden');
    }
});

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('loginBtnText');
    const loader = document.getElementById('loginLoader');
    
    try {
        submitBtn.classList.add('hidden');
        loader.classList.remove('hidden');
        
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        logger.info('User logged in successfully', { uid: userCredential.user.uid });
        showAlert('Login successful!', 'success');
        
    } catch (error) {
        logger.error('Login error', error);
        let errorMessage = 'Login failed. Please try again.';
        
        if (error.code === 'auth/user-not-found') {
            errorMessage = 'No account found with this email.';
        } else if (error.code === 'auth/wrong-password') {
            errorMessage = 'Incorrect password.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Invalid email address.';
        }
        
        showAlert(errorMessage, 'error');
    } finally {
        submitBtn.classList.remove('hidden');
        loader.classList.add('hidden');
    }
});

document.getElementById('otpForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const otpCode = document.getElementById('otpCode').value;
    
    // Simulate OTP verification
    if (otpCode === '123456' || otpCode.length === 6) {
        showAlert('OTP verified successfully!', 'success');
        
        // Update user verification status
        if (currentUser) {
            await db.collection('users').doc(currentUser.uid).update({
                isEmailVerified: true,
                verifiedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        
        showScreen('dashboardScreen');
    } else {
        showAlert('Invalid OTP. Please try again.', 'error');
    }
});

function resendOTP() {
    showAlert('OTP resent to your email/phone!', 'success');
    logger.info('OTP resent');
}

async function logout() {
    try {
        await auth.signOut();
        showAlert('Logged out successfully!', 'success');
        logger.info('User logged out');
    } catch (error) {
        logger.error('Logout error', error);
        showAlert('Error logging out', 'error');
    }
}

// Dashboard Functions
async function initializeDashboard() {
    if (!currentUser) return;
    
    try {
        // Load user profile data from backend API instead of Firestore
        try {
            const profileResponse = await apiCall('/profile');
            if (profileResponse.success && profileResponse.profile) {
                const profile = profileResponse.profile;
                const profileNameEl = document.getElementById('profileName');
                const profileEmailEl = document.getElementById('profileEmail');
                const profilePhoneEl = document.getElementById('profilePhone');
                
                if (profileNameEl) profileNameEl.value = profile.personalInfo?.firstName || '';
                if (profileEmailEl) profileEmailEl.value = profile.email || '';
                if (profilePhoneEl) profilePhoneEl.value = profile.phoneNumber || '';
            }
        } catch (profileError) {
            logger.warn('Profile data not available yet', profileError);
            // Continue without profile data
        }
        
        loadDashboardOverview();
        logger.info('Dashboard initialized');
    } catch (error) {
        logger.error('Dashboard initialization error', error);
    }
}

async function loadDashboardOverview() {
    try {
        // Load document statistics from MongoDB backend
        const stats = await apiCall('/documents/stats');
        
        if (document.getElementById('totalDocs')) {
            document.getElementById('totalDocs').textContent = `${stats.stats?.totalDocuments || 0} documents`;
        }
        if (document.getElementById('sharedDocs')) {
            document.getElementById('sharedDocs').textContent = `${stats.stats?.sharedDocuments || 0} documents`;
        }
        
        logger.info('Dashboard overview loaded');
    } catch (error) {
        logger.error('Error loading dashboard overview', error);
    }
}

function loadFamilySection() {
    try {
        logger.info('Loading family section');
        // Redirect to family page or load family data
        if (document.getElementById('familyContent')) {
            document.getElementById('familyContent').innerHTML = '<p>Family management coming soon...</p>';
        }
    } catch (error) {
        logger.error('Error loading family section', error);
    }
}

function loadProfileSection() {
    try {
        logger.info('Loading profile section');
        // Redirect to profile page or load profile data
        if (document.getElementById('profileContent')) {
            document.getElementById('profileContent').innerHTML = '<p>Profile management available on profile page...</p>';
        }
    } catch (error) {
        logger.error('Error loading profile section', error);
    }
}

// Document Management Functions (Updated for MongoDB)
function handleFileSelect(event) {
    selectedFile = event.target.files[0];
    if (selectedFile) {
        // Validate file
        const maxSize = 10 * 1024 * 1024; // 10MB
        const allowedTypes = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];
        
        if (selectedFile.size > maxSize) {
            showAlert('File size should be less than 10MB', 'error');
            selectedFile = null;
            const fileInput = document.getElementById('fileInput');
            if (fileInput) fileInput.value = '';
            return;
        }
        
        if (!allowedTypes.includes(selectedFile.type)) {
            showAlert('Only PDF, JPG, and PNG files are allowed', 'error');
            selectedFile = null;
            const fileInput = document.getElementById('fileInput');
            if (fileInput) fileInput.value = '';
            return;
        }
        
        // Update UI to show selected file
        const uploadArea = document.querySelector('.upload-area');
        if (uploadArea) {
            uploadArea.innerHTML = `
                <div class="upload-icon">
                    <i class="fas fa-file-alt"></i>
                </div>
                <h3>File Selected: ${selectedFile.name}</h3>
                <p>Size: ${(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                <button type="button" onclick="clearFileSelection()" style="margin-top: 10px; padding: 5px 10px; background: #dc3545; color: white; border: none; border-radius: 5px;">Remove</button>
            `;
        }
        
        logger.info('File selected', { name: selectedFile.name, size: selectedFile.size });
    }
}

function clearFileSelection() {
    selectedFile = null;
    const fileInput = document.getElementById('fileInput');
    if (fileInput) fileInput.value = '';
    
    // Reset upload area
    const uploadArea = document.querySelector('.upload-area');
    if (uploadArea) {
        uploadArea.innerHTML = `
            <div class="upload-icon">
                <i class="fas fa-cloud-upload-alt"></i>
            </div>
            <h3>Click to upload or drag and drop</h3>
            <p>PDF, JPG, PNG files only (Max 10MB)</p>
            <input type="file" id="fileInput" accept=".pdf,.jpg,.jpeg,.png" style="display: none;" onchange="handleFileSelect(event)">
        `;
        uploadArea.onclick = () => {
            const newFileInput = document.getElementById('fileInput');
            if (newFileInput) newFileInput.click();
        };
    }
}

// Updated upload form to use MongoDB backend
const uploadForm = document.getElementById('uploadForm');
if (uploadForm) {
    uploadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!selectedFile) {
            showAlert('Please select a file to upload', 'error');
            return;
        }
        
        const submitBtn = document.getElementById('uploadBtnText');
        const loader = document.getElementById('uploadLoader');
        
        try {
            if (submitBtn) submitBtn.classList.add('hidden');
            if (loader) loader.classList.remove('hidden');
        
        const docType = document.getElementById('docType').value;
        const docName = document.getElementById('docName').value;
        const docDescription = document.getElementById('docDescription').value;
        
        // Create FormData for file upload
        const formData = new FormData();
        formData.append('document', selectedFile);
        formData.append('title', docName);
        formData.append('type', docType);
        formData.append('description', docDescription);
        formData.append('department', 'citizen'); // Default department
        formData.append('classification', 'personal'); // Default classification
        
        // Upload to MongoDB backend
        const result = await apiCall('/documents/upload', {
            method: 'POST',
            body: formData
        });
        
        logger.info('Document uploaded successfully', { 
            documentId: result.documentId,
            name: docName, 
            type: docType 
        });
        
            showAlert('Document uploaded successfully!', 'success');
            
            // Reset form
            const uploadFormReset = document.getElementById('uploadForm');
            if (uploadFormReset) uploadFormReset.reset();
            clearFileSelection();
            
            // Refresh documents list if on documents page
            loadUserDocuments();
            loadDashboardOverview();
            
        } catch (error) {
            logger.error('Document upload error', error);
            showAlert(error.message || 'Failed to upload document. Please try again.', 'error');
        } finally {
            if (submitBtn) submitBtn.classList.remove('hidden');
            if (loader) loader.classList.add('hidden');
        }
    });
}

// Load user documents from MongoDB
async function loadUserDocuments() {
    try {
        const documentsGrid = document.getElementById('documentsGrid');
        documentsGrid.innerHTML = '<div style="text-align: center; padding: 20px;">Loading documents...</div>';
        
        // Get documents from MongoDB backend
        const response = await apiCall('/documents?limit=50');
        const documents = response.documents || [];
        
        if (documents.length === 0) {
            documentsGrid.innerHTML = `
                <div style="text-align: center; padding: 40px; grid-column: 1 / -1;">
                    <i class="fas fa-file-alt" style="font-size: 60px; color: #ccc; margin-bottom: 20px;"></i>
                    <h3 style="color: #666;">No documents found</h3>
                    <p style="color: #999;">Upload your first document to get started</p>
                    <button class="btn" style="margin-top: 20px; width: auto; padding: 10px 20px;" onclick="showDashboardSection('upload')">
                        Upload Document
                    </button>
                </div>
            `;
            return;
        }
        
        let documentsHTML = '';
        documents.forEach(doc => {
            const uploadDate = doc.uploadDate ? new Date(doc.uploadDate).toLocaleDateString() : 'Unknown';
            const fileSize = doc.fileSize ? (doc.fileSize / 1024 / 1024).toFixed(2) + ' MB' : 'Unknown';
            
            documentsHTML += `
                <div class="document-card">
                    <div class="document-icon">
                        <i class="fas fa-${getDocumentIcon(doc.type)}"></i>
                    </div>
                    <div class="document-title">${doc.title || doc.name}</div>
                    <div class="document-meta">
                        <div>Type: ${(doc.type || 'unknown').toUpperCase()}</div>
                        <div>Size: ${fileSize}</div>
                        <div>Uploaded: ${uploadDate}</div>
                        ${doc.classification ? `<div>Classification: ${doc.classification}</div>` : ''}
                    </div>
                    <div class="document-actions">
                        <button class="btn-small btn-view" onclick="viewDocument('${doc._id}')">
                            <i class="fas fa-eye"></i> View
                        </button>
                        <button class="btn-small btn-share" onclick="shareDocument('${doc._id}')">
                            <i class="fas fa-share"></i> Share
                        </button>
                        <button class="btn-small btn-delete" onclick="deleteDocument('${doc._id}')">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </div>
                </div>
            `;
        });
        
        documentsGrid.innerHTML = documentsHTML;
        logger.info('Documents loaded from MongoDB', { count: documents.length });
        
    } catch (error) {
        logger.error('Error loading documents from MongoDB', error);
        document.getElementById('documentsGrid').innerHTML = `
            <div style="text-align: center; padding: 40px; grid-column: 1 / -1; color: #dc3545;">
                <i class="fas fa-exclamation-triangle" style="font-size: 60px; margin-bottom: 20px;"></i>
                <h3>Error loading documents</h3>
                <p>Please try refreshing the page</p>
                <p style="font-size: 12px; color: #666;">Error: ${error.message}</p>
            </div>
        `;
    }
}

function getDocumentIcon(type) {
    const icons = {
        'aadhaar': 'id-card',
        'pan': 'credit-card',
        'passport': 'passport',
        'license': 'car',
        'marksheet': 'graduation-cap',
        'certificate': 'certificate',
        'pdf': 'file-pdf',
        'image': 'file-image',
        'other': 'file-alt'
    };
    return icons[type] || 'file-alt';
}

// Updated view document for MongoDB
async function viewDocument(docId) {
    try {
        // Get download URL from backend
        const response = await apiCall(`/documents/${docId}/download`);
        if (response.downloadUrl) {
            window.open(response.downloadUrl, '_blank');
        } else {
            // Fallback: redirect to download endpoint
            const token = await currentUser.getIdToken();
            window.open(`${API_BASE_URL}/documents/${docId}/download?token=${token}`, '_blank');
        }
        logger.info('Document viewed', { docId });
    } catch (error) {
        logger.error('Error viewing document', error);
        showAlert('Failed to open document', 'error');
    }
}

function shareDocument(docId) {
    currentDocumentId = docId;
    showModal('shareModal');
    logger.info('Share modal opened', { docId });
}

// Updated delete document for MongoDB
async function deleteDocument(docId) {
    if (!confirm('Are you sure you want to delete this document?')) {
        return;
    }
    
    try {
        await apiCall(`/documents/${docId}`, {
            method: 'DELETE'
        });
        
        showAlert('Document deleted successfully', 'success');
        loadUserDocuments();
        loadDashboardOverview();
        logger.info('Document deleted from MongoDB', { docId });
    } catch (error) {
        logger.error('Error deleting document from MongoDB', error);
        showAlert(error.message || 'Failed to delete document', 'error');
    }
}

// Share Document Form (to be updated for MongoDB backend later)
document.getElementById('shareForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
        const shareEmail = document.getElementById('shareEmail').value;
        const permission = document.getElementById('sharePermission').value;
        
        // For now, implement sharing through backend API
        await apiCall(`/documents/${currentDocumentId}/share`, {
            method: 'POST',
            body: JSON.stringify({
                email: shareEmail,
                permission: permission
            })
        });
        
        showAlert(`Document shared successfully with ${shareEmail}`, 'success');
        hideModal('shareModal');
        document.getElementById('shareForm').reset();
        
        logger.info('Document shared via MongoDB backend', { 
            docId: currentDocumentId, 
            sharedWith: shareEmail,
            permission 
        });
        
    } catch (error) {
        logger.error('Error sharing document', error);
        showAlert(error.message || 'Failed to share document', 'error');
    }
});

// Load shared documents from MongoDB
async function loadSharedDocuments() {
    try {
        const sharedGrid = document.getElementById('sharedGrid');
        sharedGrid.innerHTML = '<div style="text-align: center; padding: 20px;">Loading shared documents...</div>';
        
        // Get shared documents from MongoDB backend
        const response = await apiCall('/documents/shared');
        const sharedDocuments = response.documents || [];
        
        if (sharedDocuments.length === 0) {
            sharedGrid.innerHTML = `
                <div style="text-align: center; padding: 40px; grid-column: 1 / -1;">
                    <i class="fas fa-share-alt" style="font-size: 60px; color: #ccc; margin-bottom: 20px;"></i>
                    <h3 style="color: #666;">No shared documents</h3>
                    <p style="color: #999;">Documents shared with you will appear here</p>
                </div>
            `;
            return;
        }
        
        let sharedHTML = '';
        sharedDocuments.forEach(doc => {
            const sharedDate = doc.sharedAt ? new Date(doc.sharedAt).toLocaleDateString() : 'Unknown';
            const fileSize = doc.fileSize ? (doc.fileSize / 1024 / 1024).toFixed(2) + ' MB' : 'Unknown';
            
            sharedHTML += `
                <div class="document-card">
                    <div class="document-icon">
                        <i class="fas fa-${getDocumentIcon(doc.type)}"></i>
                    </div>
                    <div class="document-title">${doc.title || doc.name}</div>
                    <div class="document-meta">
                        <div>Shared by: ${doc.sharedByName || 'Unknown'}</div>
                        <div>Type: ${(doc.type || 'unknown').toUpperCase()}</div>
                        <div>Size: ${fileSize}</div>
                        <div>Shared: ${sharedDate}</div>
                        <div>Permission: ${doc.permission || 'read'}</div>
                    </div>
                    <div class="document-actions">
                        <button class="btn-small btn-view" onclick="viewDocument('${doc._id}')">
                            <i class="fas fa-eye"></i> View
                        </button>
                        ${doc.permission === 'download' ? 
                            `<button class="btn-small btn-share" onclick="downloadDocument('${doc._id}')">
                                <i class="fas fa-download"></i> Download
                            </button>` : ''}
                    </div>
                </div>
            `;
        });
        
        sharedGrid.innerHTML = sharedHTML;
        logger.info('Shared documents loaded from MongoDB', { count: sharedDocuments.length });
        
    } catch (error) {
        logger.error('Error loading shared documents from MongoDB', error);
        document.getElementById('sharedGrid').innerHTML = `
            <div style="text-align: center; padding: 40px; grid-column: 1 / -1; color: #dc3545;">
                <i class="fas fa-exclamation-triangle" style="font-size: 60px; margin-bottom: 20px;"></i>
                <h3>Error loading shared documents</h3>
                <p>Please try refreshing the page</p>
            </div>
        `;
    }
}

async function downloadDocument(docId) {
    try {
        const token = await currentUser.getIdToken();
        const downloadUrl = `${API_BASE_URL}/documents/${docId}/download?token=${token}`;
        
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = '';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        logger.info('Document downloaded from MongoDB', { docId });
    } catch (error) {
        logger.error('Error downloading document', error);
        showAlert('Failed to download document', 'error');
    }
}

// Family Management Functions (keep Firestore for now, can migrate later)
document.getElementById('inviteFamilyForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
        const inviteEmail = document.getElementById('inviteEmail').value;
        const relationship = document.getElementById('relationship').value;
        
        // Check if user exists in Firestore
        const userQuery = await db.collection('users').where('email', '==', inviteEmail).get();
        
        if (userQuery.empty) {
            showAlert('User not found with this email. They need to register first.', 'error');
            return;
        }
        
        const invitedUser = userQuery.docs[0];
        
        // Check if already family member
        const existingQuery = await db.collection('family_members')
            .where('userId', '==', currentUser.uid)
            .where('memberId', '==', invitedUser.id)
            .get();
        
        if (!existingQuery.empty) {
            showAlert('This user is already a family member', 'error');
            return;
        }
        
        // Add family member
        await db.collection('family_members').add({
            userId: currentUser.uid,
            memberId: invitedUser.id,
            relationship: relationship,
            invitedAt: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'active'
        });
        
        // Add reverse relationship
        await db.collection('family_members').add({
            userId: invitedUser.id,
            memberId: currentUser.uid,
            relationship: getReverseRelationship(relationship),
            invitedAt: firebase.firestore.FieldValue.serverTimestamp(),
            status: 'active'
        });
        
        showAlert(`Family member added successfully!`, 'success');
        hideModal('inviteFamilyModal');
        document.getElementById('inviteFamilyForm').reset();
        loadFamilyMembers();
        loadDashboardOverview();
        
        logger.info('Family member added', { 
            email: inviteEmail,
            relationship 
        });
        
    } catch (error) {
        logger.error('Error adding family member', error);
        showAlert('Failed to add family member', 'error');
    }
});

function getReverseRelationship(relationship) {
    const reverseMap = {
        'spouse': 'spouse',
        'parent': 'child',
        'child': 'parent',
        'sibling': 'sibling',
        'other': 'other'
    };
    return reverseMap[relationship] || 'other';
}