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
    
    logger.info('Dashboard section changed', { section });
}

// Initialize Dashboard
function initializeDashboard() {
    showDashboardSection('overview');
    loadDashboardOverview();
    loadFamilyInvitations();
}

// Load Dashboard Overview
async function loadDashboardOverview() {
    try {
        const user = firebase.auth().currentUser;
        if (!user) return;

        const token = await user.getIdToken();
        
        // Load family groups for preview
        const response = await fetch(`${API_BASE_URL}/family/my-groups`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.familyGroups) {
                displayFamilyGroupsPreview(data.familyGroups);
            }
        }
        
    } catch (error) {
        logger.error('Error loading dashboard overview', error);
    }
}

// Display Family Groups Preview
function displayFamilyGroupsPreview(familyGroups) {
    const container = document.getElementById('familyGroupsPreview');
    if (!container) {
        console.warn('familyGroupsPreview container not found, skipping...');
        return;
    }
    
    container.innerHTML = '';
    
    // Show up to 3 family groups
    const previewGroups = familyGroups.slice(0, 3);
    
    previewGroups.forEach(group => {
        const userRole = getUserRole(group);
        const card = document.createElement('div');
        card.className = 'family-group-preview-card';
        card.onclick = () => window.location.href = 'pages/family.html';
        
        card.innerHTML = `
            <div class="family-group-header">
                <h4 class="family-group-name">${group.name}</h4>
                <span class="family-role-badge">${userRole}</span>
            </div>
            <p style="color: #6b7280; font-size: 0.9rem; margin: 0 0 15px 0;">
                ${group.description || 'No description'}
            </p>
            <div class="family-group-stats">
                <div class="family-stat">
                    <div class="family-stat-number">${group.statistics?.totalMembers || 0}</div>
                    <div class="family-stat-label">Members</div>
                </div>
                <div class="family-stat">
                    <div class="family-stat-number">${group.statistics?.totalDocuments || 0}</div>
                    <div class="family-stat-label">Documents</div>
                </div>
                <div class="family-stat">
                    <div class="family-stat-number">${group.pendingInvitationsCount || 0}</div>
                    <div class="family-stat-label">Pending</div>
                </div>
            </div>
        `;
        
        container.appendChild(card);
    });
}

function getUserRole(group) {
    const user = firebase.auth().currentUser;
    if (!user) return 'unknown';
    
    const member = group.members?.find(m => m.userId === user.uid && m.status === 'active');
    return member ? member.role : 'unknown';
}

// Load family invitations for current user
async function loadFamilyInvitations() {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        
        const endpoints = [
            `${API_BASE_URL}/family/invitations/pending`,
            `${API_BASE_URL}/family/invitations`,
            `${API_BASE_URL}/family/pending`
        ];
        
        let response = null;
        for (const endpoint of endpoints) {
            try {
                response = await fetch(endpoint, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                if (response.ok) break;
            } catch (err) {
                console.warn(`Failed to fetch from ${endpoint}:`, err.message);
            }
        }
        
        let data = null;
        if (response && response.ok) {
            data = await response.json();
        }
        
        const invitations = data && data.invitations ? data.invitations : [];
        
        // Update pending invitations count
        const pendingElement = document.getElementById('pendingInvitations');
        if (pendingElement) {
            pendingElement.textContent = invitations.length;
        } else {
            console.warn('pendingInvitations element not found, skipping stats update');
        }
        
        const familySection = document.getElementById('familySection');
        if (!familySection) return;
        
        // Clear existing invitations
        const existingInvites = familySection.querySelector('.family-invitations');
        if (existingInvites) {
            existingInvites.remove();
        }
        
        if (invitations.length > 0) {
            let invitationsHTML = `
                <div class="family-invitations">
                    <h4>📨 Pending Family Invitations</h4>
            `;
            
            invitations.forEach(invite => {
                const token = invite.invitationToken || invite.token || invite._id;
                if (!token) {
                    console.warn('Invitation missing token:', invite);
                    return;
                }
                
                invitationsHTML += `
                    <div class="invitation-item">
                        <div class="invitation-info">
                            <strong>${invite.familyGroupName || 'Family Group'}</strong>
                            <p>Invited by: ${invite.invitedBy || 'Unknown'}</p>
                            <p>Role: ${invite.role || 'Member'}</p>
                        </div>
                        <div class="invitation-actions">
                            <button onclick="acceptFamilyInvite('${token}')" class="btn-accept">Accept</button>
                            <button onclick="declineFamilyInvite('${token}')" class="btn-decline">Decline</button>
                        </div>
                    </div>
                `;
            });
            
            invitationsHTML += '</div>';
            familySection.insertAdjacentHTML('afterbegin', invitationsHTML);
        }
        
    } catch (error) {
        console.error('❌ Error loading family invitations:', error);
    }
}

// Accept family invitation
async function acceptFamilyInvite(inviteToken) {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const endpoints = [
            `${API_BASE_URL}/family/accept-invitation/${inviteToken}`,
            `${API_BASE_URL}/family/invitations/accept/${inviteToken}`,
            `${API_BASE_URL}/family/invitations/${inviteToken}/accept`
        ];
        
        let success = false;
        for (const endpoint of endpoints) {
            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        success = true;
                        showAlert('Family invitation accepted successfully!', 'success');
                        break;
                    }
                }
            } catch (err) {
                console.warn(`Failed to accept via ${endpoint}:`, err.message);
            }
        }
        
        if (success) {
            setTimeout(() => {
                loadFamilyInvitations();
                loadDashboardOverview();
            }, 500);
        } else {
            throw new Error('Failed to accept invitation');
        }
        
    } catch (error) {
        console.error('❌ Error accepting invitation:', error);
        showAlert(error.message || 'Failed to accept invitation. Please try again.', 'error');
    }
}

// Decline family invitation
async function declineFamilyInvite(inviteToken) {
    if (!confirm('Are you sure you want to decline this family invitation?')) {
        return;
    }
    
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const endpoints = [
            `${API_BASE_URL}/family/reject-invitation/${inviteToken}`,
            `${API_BASE_URL}/family/invitations/decline/${inviteToken}`,
            `${API_BASE_URL}/family/invitations/${inviteToken}/decline`
        ];
        
        let success = false;
        for (const endpoint of endpoints) {
            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.success) {
                        success = true;
                        showAlert('Family invitation declined successfully!', 'success');
                        break;
                    }
                }
            } catch (err) {
                console.warn(`Failed to decline via ${endpoint}:`, err.message);
            }
        }
        
        if (success) {
            setTimeout(() => {
                loadFamilyInvitations();
            }, 500);
        } else {
            throw new Error('Failed to decline invitation');
        }
        
    } catch (error) {
        console.error('❌ Error declining invitation:', error);
        showAlert(error.message || 'Failed to decline invitation. Please try again.', 'error');
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

// Register Form Handler
document.getElementById('registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('registerBtnText');
    const loader = document.getElementById('registerLoader');
    
    try {
        submitBtn.classList.add('hidden');
        loader.classList.remove('hidden');
        
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        if (password !== confirmPassword) {
            throw new Error('Passwords do not match');
        }
        
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        logger.info('User registered successfully', { uid: userCredential.user.uid });
        showAlert('Registration successful!', 'success');
        
    } catch (error) {
        logger.error('Registration error', error);
        let errorMessage = 'Registration failed. Please try again.';
        
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'An account with this email already exists.';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'Password should be at least 6 characters.';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Invalid email address.';
        }
        
        showAlert(errorMessage, 'error');
    } finally {
        submitBtn.classList.remove('hidden');
        loader.classList.add('hidden');
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
            const relationship = document.getElementById('inviteRelationship').value;
            
            if (!inviteEmail || !relationship) {
                showAlert('Please fill in all fields', 'error');
                return;
            }
            
            // Disable submit button
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = 'Sending...';
            }

            try {
                const data = await sendFamilyInvitation(inviteEmail, relationship);
                
                if (data.success) {
                    showAlert('Family member invited successfully!', 'success');
                    hideModal('inviteFamilyModal');
                    this.reset();
                    
                    // Reload family data
                    await loadFamilyInvitations();
                }
            } catch (error) {
                console.error('Error sending invitation:', error);
                showAlert(error.message || 'Failed to send invitation. Please try again.', 'error');
            } finally {
                // Re-enable submit button
                if (submitButton) {
                    submitButton.disabled = false;
                    submitButton.textContent = 'Send Invitation';
                }
            }
        });
    }
});

// Send family invitation
async function sendFamilyInvitation(email, relationship) {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        
        // First, get or create a family group
        let groupId = await getOrCreateFamilyGroup();
        
        const payload = {
            email: email,
            role: 'member'
        };
        
        const response = await fetch(`${API_BASE_URL}/family/${groupId}/invite`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            return data;
        } else {
            throw new Error(data.message || 'Failed to send invitation');
        }
        
    } catch (error) {
        console.error('❌ Error sending invitation:', error);
        throw error;
    }
}

// Get or create family group
async function getOrCreateFamilyGroup() {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        
        // First try to get existing groups
        const response = await fetch(`${API_BASE_URL}/family/my-groups`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.familyGroups && data.familyGroups.length > 0) {
                return data.familyGroups[0]._id;
            }
        }
        
        // No existing group, create one
        const createResponse = await fetch(`${API_BASE_URL}/family/create`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: 'My Family',
                description: 'Family group for document sharing'
            })
        });
        
        if (createResponse.ok) {
            const createData = await createResponse.json();
            if (createData.success && createData.familyGroup) {
                return createData.familyGroup._id;
            }
        }
        
        throw new Error('Failed to get or create family group');
        
    } catch (error) {
        console.error('Error getting/creating family group:', error);
        throw error;
    }
}

// Modal management
function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}
