// Initialize Firebase (only for authentication)
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore(); // Keep for user management, but documents will use MongoDB

// Backend API Configuration
const API_BASE_URL = 'http://localhost:5000/api';

// Global Variables
let currentUser = null;
let currentDocumentId = null;
let currentViewingDocument = null;

// File upload functions
function triggerFileInput() {
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.click();
    }
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        const uploadArea = document.querySelector('.upload-area');
        if (uploadArea) {
            uploadArea.innerHTML = `
                <div class="upload-icon">
                    <i class="fas fa-file-alt"></i>
                </div>
                <h3>File Selected: ${file.name}</h3>
                <p>Size: ${(file.size / 1024 / 1024).toFixed(2)} MB</p>
            `;
        }
    }
}

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
}

// Authentication State Listener
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user;
        logger.info('User authenticated', { uid: user.uid });
        
        // Store Firebase token for API calls
        const token = await user.getIdToken();
        localStorage.setItem('firebaseToken', token);
        
        // Create or update user in backend with real user data
        await createOrUpdateUser(user);
        
        // Show dashboard
        showScreen('dashboardScreen');
        initializeDashboard();
        updateNavigation(true);
    } else {
        currentUser = null;
        localStorage.removeItem('firebaseToken');
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
            name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
            emailVerified: firebaseUser.emailVerified,
            lastLogin: new Date().toISOString(),
            profilePicture: firebaseUser.photoURL || null
        };

        const token = await firebaseUser.getIdToken();
        const response = await fetch(`${API_BASE_URL}/users/sync`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });

        if (response.ok) {
            const data = await response.json();
            logger.info('User synced successfully', data);
        } else {
            logger.warn('User sync failed', { status: response.status });
        }
    } catch (error) {
        logger.error('Error syncing user', error);
    }
}

// Screen Management
function showScreen(screenId) {
    const screens = ['loginScreen', 'registerScreen', 'dashboardScreen'];
    screens.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.style.display = id === screenId ? 'block' : 'none';
            if (id === screenId) {
                element.classList.add('active');
            } else {
                element.classList.remove('active');
            }
        }
    });
    logger.info('Screen changed', { screen: screenId });
}

// Dashboard Section Management
function showDashboardSection(section) {
    // Hide all sections first
    const sections = document.querySelectorAll('.dashboard-section');
    sections.forEach(s => s.style.display = 'none');
    
    // Show the selected section
    const targetSection = document.getElementById(`${section}Section`);
    if (targetSection) {
        targetSection.style.display = 'block';
    }
    
    // Update navigation
    const navLinks = document.querySelectorAll('.dashboard-nav a');
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('onclick')?.includes(section)) {
            link.classList.add('active');
        }
    });
    
    // Load section-specific data
    if (section === 'profile') {
        loadUserProfile();
    } else if (section === 'documents') {
        loadDocuments();
    } else if (section === 'family') {
        loadFamilyMembers();
    }
    
    logger.info('Dashboard section changed', { section });
}

// Initialize Dashboard
function initializeDashboard() {
    showDashboardSection('overview');
    loadDashboardOverview();
    setupEventListeners();
}

// Load Dashboard Overview
async function loadDashboardOverview() {
    try {
        const user = firebase.auth().currentUser;
        if (!user) return;

        const token = await user.getIdToken();
        
        // Load family members count for dashboard
        loadFamilyMembersCount();
        
    } catch (error) {
        logger.error('Error loading dashboard overview', error);
    }
}



// Navigation Management
function updateNavigation(isLoggedIn) {
    const navLinks = document.querySelector('.nav-links');
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

// Alert System
function showAlert(message, type = 'info') {
    const alertContainer = document.getElementById('alertContainer');
    if (!alertContainer) return;
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-triangle' : 'info-circle'}"></i>
        ${message}
    `;
    
    alertContainer.appendChild(alertDiv);
    
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.parentNode.removeChild(alertDiv);
        }
    }, 5000);
}

// Logout function
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

// Login Form Handler
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('loginBtnText');
    const loader = document.getElementById('loginLoader');
    
    try {
        // Show loading state
        submitBtn.classList.add('hidden');
        loader?.classList.remove('hidden');
        
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        
        // Sign in with email and password
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        logger.info('User logged in successfully', { uid: userCredential.user.uid });
        showAlert('Login successful!', 'success');
        
        // The auth state listener will handle the redirect to dashboard
    } catch (error) {
        logger.error('Login error', error);
        let errorMessage = 'Login failed. Please try again.';
        
        // Handle specific error cases
        if (error.code) {
            switch(error.code) {
                case 'auth/user-not-found':
                case 'auth/wrong-password':
                    errorMessage = 'Invalid email or password.';
                    break;
                case 'auth/too-many-requests':
                    errorMessage = 'Too many failed attempts. Please try again later.';
                    break;
                case 'auth/user-disabled':
                    errorMessage = 'This account has been disabled.';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Please enter a valid email address.';
                    break;
            }
        }
        
        showAlert(errorMessage, 'error');
    } finally {
        // Reset form and loading state
        if (submitBtn) submitBtn.classList.remove('hidden');
        if (loader) loader.classList.add('hidden');
    }
});

// Register Form Handler
document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('registerBtnText');
    const loader = document.getElementById('registerLoader');
    const form = e.target;
    
    try {
        // Show loading state
        submitBtn?.classList.add('hidden');
        loader?.classList.remove('hidden');
        
        const email = form.querySelector('#registerEmail').value.trim();
        const password = form.querySelector('#registerPassword').value;
        const confirmPassword = form.querySelector('#confirmPassword').value;
        const fullName = form.querySelector('#registerName')?.value.trim() || '';
        
        // Basic validation
        if (password !== confirmPassword) {
            throw { code: 'passwords-dont-match', message: 'Passwords do not match' };
        }
        
        if (password.length < 6) {
            throw { code: 'weak-password', message: 'Password must be at least 6 characters' };
        }
        
        // Create user with Firebase Auth
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        
        // Update user profile with display name if provided
        if (fullName) {
            await userCredential.user.updateProfile({
                displayName: fullName
            });
        }
        
        // Send email verification
        await userCredential.user.sendEmailVerification();
        
        logger.info('User registered successfully', { uid: userCredential.user.uid });
        showAlert('Registration successful! Please check your email to verify your account.', 'success');
        
        // Reset form
        form.reset();
        
        // Redirect to login after a short delay
        setTimeout(() => showScreen('loginScreen'), 2000);
        
    } catch (error) {
        logger.error('Registration error', error);
        let errorMessage = 'Registration failed. Please try again.';
        
        // Handle specific error cases
        if (error.code) {
            switch (error.code) {
                case 'auth/email-already-in-use':
                    errorMessage = 'An account with this email already exists.';
                    break;
                case 'auth/weak-password':
                case 'weak-password':
                    errorMessage = 'Password should be at least 6 characters.';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Please enter a valid email address.';
                    break;
                case 'passwords-dont-match':
                    errorMessage = 'Passwords do not match.';
                    break;
                case 'auth/operation-not-allowed':
                    errorMessage = 'Email/password accounts are not enabled.';
                    break;
                default:
                    errorMessage = error.message || errorMessage;
            }
        }
        
        showAlert(errorMessage, 'error');
    } finally {
        // Reset loading state
        submitBtn?.classList.remove('hidden');
        loader?.classList.add('hidden');
    }
});

// Family invitation form handler
document.addEventListener('DOMContentLoaded', function() {
    const inviteFamilyForm = document.getElementById('inviteFamilyForm');
    if (inviteFamilyForm) {
        inviteFamilyForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const submitButton = this.querySelector('button[type="submit"]');
            if (submitButton && submitButton.disabled) {
                return; // Prevent multiple submissions
            }
            
            const inviteEmail = document.getElementById('inviteEmail').value.trim();
            const relationship = document.getElementById('memberRelationship').value;
            
            if (!inviteEmail || !relationship) {
                showAlert('Please fill in all fields', 'error');
                return;
            }
            
            // Disable submit button
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = 'Sending...';
            }

            // Family invitation functionality will be implemented later
            showAlert('Family features are being redesigned. Please check back later.', 'info');
            
            // Re-enable submit button
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.textContent = 'Send Invitation';
            }
        });
    }
});


// Modal management
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
        modal.classList.add('active');
        logger.info('Modal shown', { modalId });
    }
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
        logger.info('Modal hidden', { modalId });
    }
}

// Profile Management Functions
async function loadUserProfile() {
    try {
        if (!currentUser) return;
        
        const profileName = document.getElementById('profileName');
        const profileEmail = document.getElementById('profileEmail');
        const profilePhone = document.getElementById('profilePhone');
        const profileAddress = document.getElementById('profileAddress');
        
        if (profileName) profileName.value = currentUser.displayName || '';
        if (profileEmail) profileEmail.value = currentUser.email || '';
        
        // Load additional profile data from backend
        const token = await currentUser.getIdToken();
        const response = await fetch(`${API_BASE_URL}/users/profile`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const profileData = data.profile || data;
            if (profilePhone) profilePhone.value = profileData.phone || '';
            if (profileAddress) profileAddress.value = profileData.address || '';
        }
        
        logger.info('User profile loaded successfully');
    } catch (error) {
        logger.error('Error loading user profile', error);
    }
}

async function saveUserProfile() {
    try {
        if (!currentUser) return;
        
        const profileName = document.getElementById('profileName')?.value;
        const profilePhone = document.getElementById('profilePhone')?.value;
        const profileAddress = document.getElementById('profileAddress')?.value;
        
        // Update Firebase profile
        if (profileName && profileName !== currentUser.displayName) {
            await currentUser.updateProfile({
                displayName: profileName
            });
        }
        
        // Update backend profile
        const token = await currentUser.getIdToken();
        const response = await fetch(`${API_BASE_URL}/users/profile`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: profileName,
                phone: profilePhone,
                address: profileAddress
            })
        });
        
        if (response.ok) {
            showAlert('Profile updated successfully!', 'success');
            logger.info('User profile updated successfully');
        } else {
            throw new Error('Failed to update profile');
        }
        
    } catch (error) {
        logger.error('Error saving user profile', error);
        showAlert('Failed to update profile. Please try again.', 'error');
    }
}


// Load documents for documents section
async function loadDocuments() {
    const documentsGrid = document.getElementById('documentsGrid');
    if (!documentsGrid) return;
    
    try {
        documentsGrid.innerHTML = '<div style="text-align: center; padding: 20px;">Loading documents...</div>';
        
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`${API_BASE_URL}/documents`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const documents = data.documents || [];
            
            if (documents.length === 0) {
                documentsGrid.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-file-alt" style="font-size: 3rem; color: #ccc; margin-bottom: 1rem;"></i>
                        <p>No documents uploaded yet</p>
                        <button class="btn" onclick="showDashboardSection('upload')">Upload Your First Document</button>
                    </div>
                `;
                return;
            }
            
            documentsGrid.innerHTML = documents.map(doc => `
                <div class="document-card">
                    <div class="document-icon">
                        <i class="fas ${getDocumentIcon(doc.mimeType)}"></i>
                    </div>
                    <div class="document-info">
                        <h4>${doc.title}</h4>
                        <p>Uploaded: ${new Date(doc.uploadDate).toLocaleDateString()}</p>
                        <p>Size: ${formatFileSize(doc.fileSize)}</p>
                    </div>
                    <div class="document-actions">
                        <button class="btn-icon" onclick="viewDocument('${doc._id}')" title="View">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn-icon" onclick="downloadDocument('${doc._id}')" title="Download">
                            <i class="fas fa-download"></i>
                        </button>
                        <button class="btn-icon delete-btn" onclick="deleteDocument('${doc._id}')" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `).join('');
            
            // Update document count in overview
            const totalDocsElement = document.getElementById('totalDocs');
            if (totalDocsElement) {
                totalDocsElement.textContent = documents.length;
            }
            
        } else {
            documentsGrid.innerHTML = '<div class="error-state">Failed to load documents</div>';
        }
    } catch (error) {
        logger.error('Error loading documents', error);
        documentsGrid.innerHTML = '<div class="error-state">Error loading documents</div>';
    }
}

// Setup event listeners
function setupEventListeners() {
    // Upload form handler
    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm) {
        uploadForm.addEventListener('submit', handleDocumentUpload);
    }
    
    // Family invitation form handler
    const inviteFamilyForm = document.getElementById('inviteFamilyForm');
    if (inviteFamilyForm) {
        inviteFamilyForm.addEventListener('submit', handleFamilyInvitation);
    }
}

// Family Management Functions
async function loadFamilyMembers() {
    try {
        const token = currentUser ? await currentUser.getIdToken() : null;
        if (!token) return;
        
        const response = await fetch(`${API_BASE_URL}/family/members`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            displayFamilyMembers(data.members || []);
            displayPendingInvitations(data.pendingInvitations || []);
        } else {
            displayFamilyMembers([]);
            displayPendingInvitations([]);
        }
    } catch (error) {
        console.error('Error loading family members:', error);
        displayFamilyMembers([]);
        displayPendingInvitations([]);
    }
}

async function loadFamilyMembersCount() {
    try {
        const token = currentUser ? await currentUser.getIdToken() : null;
        if (!token) return;
        
        const response = await fetch(`${API_BASE_URL}/family/count`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const familyMembersElement = document.getElementById('familyMembers');
            if (familyMembersElement) {
                familyMembersElement.textContent = data.count || 0;
            }
        }
    } catch (error) {
        console.error('Error loading family members count:', error);
    }
}

function displayFamilyMembers(members) {
    const container = document.getElementById('familyMembersList');
    if (!container) return;
    
    if (members.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users" style="font-size: 3rem; color: #ccc; margin-bottom: 1rem;"></i>
                <h3>No Family Members Yet</h3>
                <p>Start by inviting family members to share documents securely.</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = members.map(member => `
        <div class="family-member-card">
            <div class="member-info">
                <h4>${member.name || member.email}</h4>
                <span class="member-relationship">${member.relationship}</span>
                <p class="member-email">${member.email}</p>
                <span class="member-status status-${member.status}">${member.status}</span>
            </div>
            <div class="member-actions">
                ${member.status === 'active' ? `
                    <button class="btn btn-sm btn-danger" onclick="removeFamilyMember('${member._id}')">
                        <i class="fas fa-trash"></i> Remove
                    </button>
                ` : ''}
            </div>
        </div>
    `).join('');
}

function displayPendingInvitations(invitations) {
    const container = document.getElementById('pendingInvitationsList');
    if (!container) return;
    
    if (invitations.length === 0) {
        container.innerHTML = '';
        return;
    }
    
    // Separate sent and received invitations
    const sentInvitations = invitations.filter(inv => inv.inviterId === currentUser?.uid);
    const receivedInvitations = invitations.filter(inv => inv.email === currentUser?.email);
    
    let html = '';
    
    // Show sent invitations
    if (sentInvitations.length > 0) {
        html += `
            <div class="pending-invitations-section">
                <h3>Sent Invitations (${sentInvitations.length})</h3>
                ${sentInvitations.map(invitation => `
                    <div class="invitation-card">
                        <div class="invitation-info">
                            <strong>${invitation.email}</strong>
                            <span class="invitation-relationship">${invitation.relationship}</span>
                            <p class="invitation-date">Invited on ${new Date(invitation.invitedAt).toLocaleDateString()}</p>
                        </div>
                        <div class="invitation-actions">
                            <button class="btn btn-sm btn-secondary" onclick="resendInvitation('${invitation._id}')">
                                <i class="fas fa-paper-plane"></i> Resend
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="cancelInvitation('${invitation._id}')">
                                <i class="fas fa-times"></i> Cancel
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    // Show received invitations
    if (receivedInvitations.length > 0) {
        html += `
            <div class="pending-invitations-section">
                <h3>Received Invitations (${receivedInvitations.length})</h3>
                ${receivedInvitations.map(invitation => `
                    <div class="invitation-card">
                        <div class="invitation-info">
                            <strong>From: ${invitation.inviterName || invitation.inviterEmail}</strong>
                            <span class="invitation-relationship">${invitation.relationship}</span>
                            <p class="invitation-date">Invited on ${new Date(invitation.invitedAt).toLocaleDateString()}</p>
                        </div>
                        <div class="invitation-actions">
                            <button class="btn btn-sm btn-primary" onclick="acceptInvitation('${invitation.inviteToken}')">
                                <i class="fas fa-check"></i> Accept
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="rejectInvitation('${invitation.inviteToken}')">
                                <i class="fas fa-times"></i> Decline
                            </button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    container.innerHTML = html;
}

async function acceptInvitation(token) {
    try {
        const authToken = await currentUser.getIdToken();
        const response = await fetch(`${API_BASE_URL}/family/accept/${token}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            loadFamilyMembers();
            loadFamilyMembersCount();
        } else {
            showAlert(data.message || 'Failed to accept invitation', 'error');
        }
    } catch (error) {
        console.error('Error accepting invitation:', error);
        showAlert('Failed to accept invitation. Please try again.', 'error');
    }
}

async function rejectInvitation(token) {
    if (!confirm('Are you sure you want to decline this invitation?')) {
        return;
    }
    
    try {
        const authToken = await currentUser.getIdToken();
        const response = await fetch(`${API_BASE_URL}/family/reject-invitation/${token}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            loadFamilyMembers();
        } else {
            showAlert(data.message || 'Failed to decline invitation', 'error');
        }
    } catch (error) {
        console.error('Error declining invitation:', error);
        showAlert('Failed to decline invitation. Please try again.', 'error');
    }
}

// Modal Management
function showInviteModal() {
    const modal = document.getElementById('inviteFamilyModal');
    if (modal) {
        modal.style.display = 'block';
        modal.classList.add('active');
    }
}

function hideInviteModal() {
    const modal = document.getElementById('inviteFamilyModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
        // Reset form
        const form = document.getElementById('inviteFamilyForm');
        if (form) form.reset();
    }
}

// Handle family invitation form submission
async function handleFamilyInvitation(event) {
    event.preventDefault();
    
    const email = document.getElementById('inviteEmail').value;
    const relationship = document.getElementById('memberRelationship').value;
    
    if (!email || !relationship) {
        showAlert('Please fill in all fields', 'error');
        return;
    }
    
    try {
        const token = await currentUser.getIdToken();
        const response = await fetch(`${API_BASE_URL}/family/invite`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ email, relationship })
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            hideInviteModal();
            loadFamilyMembers(); // Refresh the list
            loadFamilyMembersCount(); // Update dashboard count
        } else {
            showAlert(data.message || 'Failed to send invitation', 'error');
        }
    } catch (error) {
        console.error('Error sending invitation:', error);
        showAlert('Failed to send invitation. Please try again.', 'error');
    }
}

async function removeFamilyMember(memberId) {
    if (!confirm('Are you sure you want to remove this family member?')) {
        return;
    }
    
    try {
        const token = await currentUser.getIdToken();
        const response = await fetch(`${API_BASE_URL}/family/members/${memberId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            showAlert('Family member removed successfully', 'success');
            loadFamilyMembers(); // Refresh the list
            loadFamilyMembersCount(); // Update dashboard count
        } else {
            showAlert(data.message || 'Failed to remove family member', 'error');
        }
    } catch (error) {
        console.error('Error removing family member:', error);
        showAlert('Failed to remove family member. Please try again.', 'error');
    }
}

async function cancelInvitation(invitationId) {
    if (!confirm('Are you sure you want to cancel this invitation?')) {
        return;
    }
    
    try {
        const token = await currentUser.getIdToken();
        const response = await fetch(`${API_BASE_URL}/family/invitations/${invitationId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            showAlert('Invitation cancelled successfully', 'success');
            loadFamilyMembers(); // Refresh the list
        } else {
            showAlert(data.message || 'Failed to cancel invitation', 'error');
        }
    } catch (error) {
        console.error('Error cancelling invitation:', error);
        showAlert('Failed to cancel invitation. Please try again.', 'error');
    }
}

async function resendInvitation(invitationId) {
    try {
        const token = await currentUser.getIdToken();
        const response = await fetch(`${API_BASE_URL}/family/invitations/${invitationId}/resend`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            showAlert('Invitation resent successfully', 'success');
        } else {
            showAlert(data.message || 'Failed to resend invitation', 'error');
        }
    } catch (error) {
        console.error('Error resending invitation:', error);
        showAlert('Failed to resend invitation. Please try again.', 'error');
    }
}

// Handle document upload
async function handleDocumentUpload(event) {
    event.preventDefault();
    
    const fileInput = document.getElementById('fileInput');
    const docType = document.getElementById('docType');
    const docName = document.getElementById('docName');
    const docDescription = document.getElementById('docDescription');
    const uploadBtn = document.getElementById('uploadBtnText');
    const uploadLoader = document.getElementById('uploadLoader');
    
    if (!fileInput.files[0]) {
        showAlert('Please select a file to upload', 'error');
        return;
    }
    
    // Show loading state
    if (uploadBtn) uploadBtn.textContent = 'Uploading...';
    if (uploadLoader) uploadLoader.classList.remove('hidden');
    
    try {
        const formData = new FormData();
        formData.append('document', fileInput.files[0]);
        formData.append('title', docName.value);
        formData.append('classification', docType.value);
        formData.append('description', docDescription.value || '');
        
        const token = await currentUser.getIdToken();
        const response = await fetch(`${API_BASE_URL}/documents/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Document uploaded successfully!', 'success');
            
            // Reset form
            uploadForm.reset();
            const uploadArea = document.querySelector('.upload-area');
            if (uploadArea) {
                uploadArea.innerHTML = `
                    <div class="upload-icon">
                        <i class="fas fa-cloud-upload-alt"></i>
                    </div>
                    <h3>Click to upload or drag and drop</h3>
                    <p>PDF, JPG, PNG files only (Max 10MB)</p>
                `;
            }
            
            // Refresh documents if on documents section
            if (document.getElementById('documentsSection').style.display !== 'none') {
                loadDocuments();
            }
        } else {
            showAlert(data.message || 'Upload failed', 'error');
        }
    } catch (error) {
        logger.error('Upload error', error);
        showAlert('Upload failed. Please try again.', 'error');
    } finally {
        // Reset loading state
        if (uploadBtn) uploadBtn.textContent = 'Upload Document';
        if (uploadLoader) uploadLoader.classList.add('hidden');
    }
}

// Utility functions
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

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// View document in modal
async function viewDocument(documentId) {
    try {
        if (!currentUser) {
            showAlert('Please log in to view documents', 'error');
            return;
        }
        
        const token = await currentUser.getIdToken();
        
        // Get document metadata
        const response = await fetch(`${API_BASE_URL}/documents`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        const docData = data.documents.find(doc => doc._id === documentId);
        
        if (!docData) {
            showAlert('Document not found', 'error');
            return;
        }
        
        currentViewingDocument = docData;
        
        // Set modal title
        document.getElementById('documentViewerTitle').textContent = docData.title;
        
        // Load document preview
        const preview = document.getElementById('documentPreview');
        
        if (docData.mimeType && docData.mimeType.startsWith('image/')) {
            // For images, create authenticated request
            const imageResponse = await fetch(`${API_BASE_URL}/documents/${documentId}/download`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (imageResponse.ok) {
                const blob = await imageResponse.blob();
                const imageUrl = URL.createObjectURL(blob);
                preview.innerHTML = `<img src="${imageUrl}" alt="${docData.title}" onload="URL.revokeObjectURL('${imageUrl}')">`;
            } else {
                throw new Error('Failed to load image');
            }
        } else if (docData.mimeType === 'application/pdf') {
            // For PDFs, create authenticated request and blob URL
            const pdfResponse = await fetch(`${API_BASE_URL}/documents/${documentId}/download`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (pdfResponse.ok) {
                const blob = await pdfResponse.blob();
                const pdfUrl = URL.createObjectURL(blob);
                preview.innerHTML = `<iframe src="${pdfUrl}" type="application/pdf" style="width: 100%; height: 500px;"></iframe>`;
            } else {
                throw new Error('Failed to load PDF');
            }
        } else {
            // For other files, show download option
            preview.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <i class="fas fa-file" style="font-size: 60px; color: #666; margin-bottom: 20px;"></i>
                    <h3>${docData.title}</h3>
                    <p>This file type cannot be previewed. Click download to view the file.</p>
                    <button class="btn" onclick="downloadDocument('${documentId}')">
                        <i class="fas fa-download"></i> Download File
                    </button>
                </div>
            `;
        }
        
        // Show modal
        showModal('documentViewerModal');
        
    } catch (error) {
        console.error('Error viewing document:', error);
        showAlert('Failed to load document', 'error');
    }
}

// Download current document
async function downloadCurrentDocument() {
    if (currentViewingDocument) {
        await downloadDocument(currentViewingDocument._id);
    }
}


// Download document
async function downloadDocument(documentId) {
    try {
        if (!currentUser) {
            showAlert('Please log in to download documents', 'error');
            return;
        }
        
        const token = await currentUser.getIdToken();
        
        const response = await fetch(`${API_BASE_URL}/documents/${documentId}/download`, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Download failed');
        }
        
        // Get filename from response headers or use default
        const contentDisposition = response.headers.get('content-disposition');
        let filename = 'document';
        if (contentDisposition) {
            const matches = /filename="([^"]*)"/.exec(contentDisposition);
            if (matches && matches[1]) {
                filename = matches[1];
            }
        }
        
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        showAlert('Document downloaded successfully', 'success');
        
    } catch (error) {
        console.error('Download error:', error);
        showAlert('Failed to download document', 'error');
    }
}


// Delete document
async function deleteDocument(docId) {
    if (!confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
        return;
    }
    
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        
        const response = await fetch(`${API_BASE_URL}/documents/${docId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Document deleted successfully', 'success');
            loadDocuments(); // Refresh the document list
        } else {
            showAlert(data.message || 'Failed to delete document', 'error');
        }
        
    } catch (error) {
        console.error('Delete error:', error);
        showAlert('Failed to delete document', 'error');
    }
}
