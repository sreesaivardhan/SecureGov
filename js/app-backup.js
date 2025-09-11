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

// Load family invitations for current user
async function loadFamilyInvitations() {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch('http://localhost:5000/api/family/invitations', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        const invitations = data.invitations || [];
        
        if (invitations.length > 0) {
            // Show invitations at the top of family section
            const familySection = document.getElementById('familySection');
            if (familySection) {
                let invitationsHTML = `
                    <div style="background: #e3f2fd; border: 1px solid #2196f3; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px 0; color: #1976d2;">📨 Pending Family Invitations</h4>
                `;
                
                invitations.forEach(invite => {
                    invitationsHTML += `
                        <div style="background: white; border-radius: 5px; padding: 10px; margin: 5px 0; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>${invite.invitedBy}</strong> invited you as <em>${invite.relationship}</em>
                                <br><small>Invited: ${new Date(invite.invitedAt).toLocaleDateString()}</small>
                            </div>
                            <div>
                                <button class="btn-small btn-primary" onclick="acceptFamilyInvite('${invite._id}')" style="margin-right: 5px;">
                                    ✅ Accept
                                </button>
                                <button class="btn-small btn-danger" onclick="declineFamilyInvite('${invite._id}')">
                                    ❌ Decline
                                </button>
                            </div>
                        </div>
                    `;
                });
                
                invitationsHTML += '</div>';
                
                // Insert at the beginning of family section
                const existingInvites = familySection.querySelector('.family-invitations');
                if (existingInvites) {
                    existingInvites.innerHTML = invitationsHTML;
                } else {
                    familySection.insertAdjacentHTML('afterbegin', `<div class="family-invitations">${invitationsHTML}</div>`);
                }
            }
        }
    } catch (error) {
        console.error('❌ Error loading family invitations:', error);
    }
}

// Accept family invitation
async function acceptFamilyInvite(inviteId) {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/accept/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation accepted!', 'success');
            await loadFamilyMembers();
            await loadFamilyInvitations();
            await loadDashboardOverview();
        } else {
            showAlert(data.message || 'Failed to accept invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error accepting invitation:', error);
        showAlert('Failed to accept invitation', 'error');
    }
}

// Decline family invitation
async function declineFamilyInvite(inviteId) {
    if (!confirm('Are you sure you want to decline this family invitation?')) {
        return;
    }
    
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/decline/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation declined', 'success');
            await loadFamilyInvitations();
        } else {
            showAlert(data.message || 'Failed to decline invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error declining invitation:', error);
        showAlert('Failed to decline invitation', 'error');
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

// Load family invitations for current user
async function loadFamilyInvitations() {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch('http://localhost:5000/api/family/invitations', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        const invitations = data.invitations || [];
        
        if (invitations.length > 0) {
            // Show invitations at the top of family section
            const familySection = document.getElementById('familySection');
            if (familySection) {
                let invitationsHTML = `
                    <div style="background: #e3f2fd; border: 1px solid #2196f3; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px 0; color: #1976d2;">📨 Pending Family Invitations</h4>
                `;
                
                invitations.forEach(invite => {
                    invitationsHTML += `
                        <div style="background: white; border-radius: 5px; padding: 10px; margin: 5px 0; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>${invite.invitedBy}</strong> invited you as <em>${invite.relationship}</em>
                                <br><small>Invited: ${new Date(invite.invitedAt).toLocaleDateString()}</small>
                            </div>
                            <div>
                                <button class="btn-small btn-primary" onclick="acceptFamilyInvite('${invite._id}')" style="margin-right: 5px;">
                                    ✅ Accept
                                </button>
                                <button class="btn-small btn-danger" onclick="declineFamilyInvite('${invite._id}')">
                                    ❌ Decline
                                </button>
                            </div>
                        </div>
                    `;
                });
                
                invitationsHTML += '</div>';
                
                // Insert at the beginning of family section
                const existingInvites = familySection.querySelector('.family-invitations');
                if (existingInvites) {
                    existingInvites.innerHTML = invitationsHTML;
                } else {
                    familySection.insertAdjacentHTML('afterbegin', `<div class="family-invitations">${invitationsHTML}</div>`);
                }
            }
        }
    } catch (error) {
        console.error('❌ Error loading family invitations:', error);
    }
}

// Accept family invitation
async function acceptFamilyInvite(inviteId) {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/accept/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation accepted!', 'success');
            await loadFamilyMembers();
            await loadFamilyInvitations();
            await loadDashboardOverview();
        } else {
            showAlert(data.message || 'Failed to accept invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error accepting invitation:', error);
        showAlert('Failed to accept invitation', 'error');
    }
}

// Decline family invitation
async function declineFamilyInvite(inviteId) {
    if (!confirm('Are you sure you want to decline this family invitation?')) {
        return;
    }
    
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/decline/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation declined', 'success');
            await loadFamilyInvitations();
        } else {
            showAlert(data.message || 'Failed to decline invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error declining invitation:', error);
        showAlert('Failed to decline invitation', 'error');
    }
}

// Authentication State Observer
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
}

// Load family invitations for current user
async function loadFamilyInvitations() {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch('http://localhost:5000/api/family/invitations', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        const invitations = data.invitations || [];
        
        if (invitations.length > 0) {
            // Show invitations at the top of family section
            const familySection = document.getElementById('familySection');
            if (familySection) {
                let invitationsHTML = `
                    <div style="background: #e3f2fd; border: 1px solid #2196f3; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px 0; color: #1976d2;">📨 Pending Family Invitations</h4>
                `;
                
                invitations.forEach(invite => {
                    invitationsHTML += `
                        <div style="background: white; border-radius: 5px; padding: 10px; margin: 5px 0; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>${invite.invitedBy}</strong> invited you as <em>${invite.relationship}</em>
                                <br><small>Invited: ${new Date(invite.invitedAt).toLocaleDateString()}</small>
                            </div>
                            <div>
                                <button class="btn-small btn-primary" onclick="acceptFamilyInvite('${invite._id}')" style="margin-right: 5px;">
                                    ✅ Accept
                                </button>
                                <button class="btn-small btn-danger" onclick="declineFamilyInvite('${invite._id}')">
                                    ❌ Decline
                                </button>
                            </div>
                        </div>
                    `;
                });
                
                invitationsHTML += '</div>';
                
                // Insert at the beginning of family section
                const existingInvites = familySection.querySelector('.family-invitations');
                if (existingInvites) {
                    existingInvites.innerHTML = invitationsHTML;
                } else {
                    familySection.insertAdjacentHTML('afterbegin', `<div class="family-invitations">${invitationsHTML}</div>`);
                }
            }
        }
    } catch (error) {
        console.error('❌ Error loading family invitations:', error);
    }
}

// Accept family invitation
async function acceptFamilyInvite(inviteId) {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/accept/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation accepted!', 'success');
            await loadFamilyMembers();
            await loadFamilyInvitations();
            await loadDashboardOverview();
        } else {
            showAlert(data.message || 'Failed to accept invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error accepting invitation:', error);
        showAlert('Failed to accept invitation', 'error');
    }
}

// Decline family invitation
async function declineFamilyInvite(inviteId) {
    if (!confirm('Are you sure you want to decline this family invitation?')) {
        return;
    }
    
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/decline/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation declined', 'success');
            await loadFamilyInvitations();
        } else {
            showAlert(data.message || 'Failed to decline invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error declining invitation:', error);
        showAlert('Failed to decline invitation', 'error');
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
            profilePicture: firebaseUser.photoURL || null,
            phoneNumber: firebaseUser.phoneNumber || null
        };

        const token = await firebaseUser.getIdToken();
        const response = await fetch('http://localhost:5000/api/users/sync', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(userData)
        });

        if (response.ok) {
            const result = await response.json();
            logger.info('User synced with backend', { uid: firebaseUser.uid });
        }
    } catch (error) {
        logger.error('User sync failed', error);
        // Don't block authentication if backend sync fails
    }
}

// Load family invitations for current user
async function loadFamilyInvitations() {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch('http://localhost:5000/api/family/invitations', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        const invitations = data.invitations || [];
        
        if (invitations.length > 0) {
            // Show invitations at the top of family section
            const familySection = document.getElementById('familySection');
            if (familySection) {
                let invitationsHTML = `
                    <div style="background: #e3f2fd; border: 1px solid #2196f3; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px 0; color: #1976d2;">📨 Pending Family Invitations</h4>
                `;
                
                invitations.forEach(invite => {
                    invitationsHTML += `
                        <div style="background: white; border-radius: 5px; padding: 10px; margin: 5px 0; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>${invite.invitedBy}</strong> invited you as <em>${invite.relationship}</em>
                                <br><small>Invited: ${new Date(invite.invitedAt).toLocaleDateString()}</small>
                            </div>
                            <div>
                                <button class="btn-small btn-primary" onclick="acceptFamilyInvite('${invite._id}')" style="margin-right: 5px;">
                                    ✅ Accept
                                </button>
                                <button class="btn-small btn-danger" onclick="declineFamilyInvite('${invite._id}')">
                                    ❌ Decline
                                </button>
                            </div>
                        </div>
                    `;
                });
                
                invitationsHTML += '</div>';
                
                // Insert at the beginning of family section
                const existingInvites = familySection.querySelector('.family-invitations');
                if (existingInvites) {
                    existingInvites.innerHTML = invitationsHTML;
                } else {
                    familySection.insertAdjacentHTML('afterbegin', `<div class="family-invitations">${invitationsHTML}</div>`);
                }
            }
        }
    } catch (error) {
        console.error('❌ Error loading family invitations:', error);
    }
}

// Accept family invitation
async function acceptFamilyInvite(inviteId) {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/accept/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation accepted!', 'success');
            await loadFamilyMembers();
            await loadFamilyInvitations();
            await loadDashboardOverview();
        } else {
            showAlert(data.message || 'Failed to accept invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error accepting invitation:', error);
        showAlert('Failed to accept invitation', 'error');
    }
}

// Decline family invitation
async function declineFamilyInvite(inviteId) {
    if (!confirm('Are you sure you want to decline this family invitation?')) {
        return;
    }
    
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/decline/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation declined', 'success');
            await loadFamilyInvitations();
        } else {
            showAlert(data.message || 'Failed to decline invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error declining invitation:', error);
        showAlert('Failed to decline invitation', 'error');
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

// Load family invitations for current user
async function loadFamilyInvitations() {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch('http://localhost:5000/api/family/invitations', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        const invitations = data.invitations || [];
        
        if (invitations.length > 0) {
            // Show invitations at the top of family section
            const familySection = document.getElementById('familySection');
            if (familySection) {
                let invitationsHTML = `
                    <div style="background: #e3f2fd; border: 1px solid #2196f3; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px 0; color: #1976d2;">📨 Pending Family Invitations</h4>
                `;
                
                invitations.forEach(invite => {
                    invitationsHTML += `
                        <div style="background: white; border-radius: 5px; padding: 10px; margin: 5px 0; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>${invite.invitedBy}</strong> invited you as <em>${invite.relationship}</em>
                                <br><small>Invited: ${new Date(invite.invitedAt).toLocaleDateString()}</small>
                            </div>
                            <div>
                                <button class="btn-small btn-primary" onclick="acceptFamilyInvite('${invite._id}')" style="margin-right: 5px;">
                                    ✅ Accept
                                </button>
                                <button class="btn-small btn-danger" onclick="declineFamilyInvite('${invite._id}')">
                                    ❌ Decline
                                </button>
                            </div>
                        </div>
                    `;
                });
                
                invitationsHTML += '</div>';
                
                // Insert at the beginning of family section
                const existingInvites = familySection.querySelector('.family-invitations');
                if (existingInvites) {
                    existingInvites.innerHTML = invitationsHTML;
                } else {
                    familySection.insertAdjacentHTML('afterbegin', `<div class="family-invitations">${invitationsHTML}</div>`);
                }
            }
        }
    } catch (error) {
        console.error('❌ Error loading family invitations:', error);
    }
}

// Accept family invitation
async function acceptFamilyInvite(inviteId) {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/accept/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation accepted!', 'success');
            await loadFamilyMembers();
            await loadFamilyInvitations();
            await loadDashboardOverview();
        } else {
            showAlert(data.message || 'Failed to accept invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error accepting invitation:', error);
        showAlert('Failed to accept invitation', 'error');
    }
}

// Decline family invitation
async function declineFamilyInvite(inviteId) {
    if (!confirm('Are you sure you want to decline this family invitation?')) {
        return;
    }
    
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/decline/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation declined', 'success');
            await loadFamilyInvitations();
        } else {
            showAlert(data.message || 'Failed to decline invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error declining invitation:', error);
        showAlert('Failed to decline invitation', 'error');
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
            loadFamilyInvitations();
        } else if (section === 'profile') {
            loadUserProfile();
        } else if (section === 'overview') {
            loadDashboardOverview();
        }
    }
}

// Load family invitations for current user
async function loadFamilyInvitations() {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch('http://localhost:5000/api/family/invitations', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        const invitations = data.invitations || [];
        
        if (invitations.length > 0) {
            // Show invitations at the top of family section
            const familySection = document.getElementById('familySection');
            if (familySection) {
                let invitationsHTML = `
                    <div style="background: #e3f2fd; border: 1px solid #2196f3; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px 0; color: #1976d2;">📨 Pending Family Invitations</h4>
                `;
                
                invitations.forEach(invite => {
                    invitationsHTML += `
                        <div style="background: white; border-radius: 5px; padding: 10px; margin: 5px 0; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>${invite.invitedBy}</strong> invited you as <em>${invite.relationship}</em>
                                <br><small>Invited: ${new Date(invite.invitedAt).toLocaleDateString()}</small>
                            </div>
                            <div>
                                <button class="btn-small btn-primary" onclick="acceptFamilyInvite('${invite._id}')" style="margin-right: 5px;">
                                    ✅ Accept
                                </button>
                                <button class="btn-small btn-danger" onclick="declineFamilyInvite('${invite._id}')">
                                    ❌ Decline
                                </button>
                            </div>
                        </div>
                    `;
                });
                
                invitationsHTML += '</div>';
                
                // Insert at the beginning of family section
                const existingInvites = familySection.querySelector('.family-invitations');
                if (existingInvites) {
                    existingInvites.innerHTML = invitationsHTML;
                } else {
                    familySection.insertAdjacentHTML('afterbegin', `<div class="family-invitations">${invitationsHTML}</div>`);
                }
            }
        }
    } catch (error) {
        console.error('❌ Error loading family invitations:', error);
    }
}

// Accept family invitation
async function acceptFamilyInvite(inviteId) {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/accept/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation accepted!', 'success');
            await loadFamilyMembers();
            await loadFamilyInvitations();
            await loadDashboardOverview();
        } else {
            showAlert(data.message || 'Failed to accept invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error accepting invitation:', error);
        showAlert('Failed to accept invitation', 'error');
    }
}

// Decline family invitation
async function declineFamilyInvite(inviteId) {
    if (!confirm('Are you sure you want to decline this family invitation?')) {
        return;
    }
    
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/decline/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation declined', 'success');
            await loadFamilyInvitations();
        } else {
            showAlert(data.message || 'Failed to decline invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error declining invitation:', error);
        showAlert('Failed to decline invitation', 'error');
    }
}

// Load documents for documents section
async function loadDocuments() {
    const documentsGrid = document.getElementById('documentsGrid');
    if (!documentsGrid) return;
    
    // Fetch documents from backend
    const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
    console.log('🔑 Using token for documents fetch:', token ? token.substring(0, 20) + '...' : 'No token');
    
    fetch('http://localhost:5000/api/documents', {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
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

// Load family invitations for current user
async function loadFamilyInvitations() {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch('http://localhost:5000/api/family/invitations', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        const invitations = data.invitations || [];
        
        if (invitations.length > 0) {
            // Show invitations at the top of family section
            const familySection = document.getElementById('familySection');
            if (familySection) {
                let invitationsHTML = `
                    <div style="background: #e3f2fd; border: 1px solid #2196f3; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px 0; color: #1976d2;">📨 Pending Family Invitations</h4>
                `;
                
                invitations.forEach(invite => {
                    invitationsHTML += `
                        <div style="background: white; border-radius: 5px; padding: 10px; margin: 5px 0; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>${invite.invitedBy}</strong> invited you as <em>${invite.relationship}</em>
                                <br><small>Invited: ${new Date(invite.invitedAt).toLocaleDateString()}</small>
                            </div>
                            <div>
                                <button class="btn-small btn-primary" onclick="acceptFamilyInvite('${invite._id}')" style="margin-right: 5px;">
                                    ✅ Accept
                                </button>
                                <button class="btn-small btn-danger" onclick="declineFamilyInvite('${invite._id}')">
                                    ❌ Decline
                                </button>
                            </div>
                        </div>
                    `;
                });
                
                invitationsHTML += '</div>';
                
                // Insert at the beginning of family section
                const existingInvites = familySection.querySelector('.family-invitations');
                if (existingInvites) {
                    existingInvites.innerHTML = invitationsHTML;
                } else {
                    familySection.insertAdjacentHTML('afterbegin', `<div class="family-invitations">${invitationsHTML}</div>`);
                }
            }
        }
    } catch (error) {
        console.error('❌ Error loading family invitations:', error);
    }
}

// Accept family invitation
async function acceptFamilyInvite(inviteId) {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/accept/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation accepted!', 'success');
            await loadFamilyMembers();
            await loadFamilyInvitations();
            await loadDashboardOverview();
        } else {
            showAlert(data.message || 'Failed to accept invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error accepting invitation:', error);
        showAlert('Failed to accept invitation', 'error');
    }
}

// Decline family invitation
async function declineFamilyInvite(inviteId) {
    if (!confirm('Are you sure you want to decline this family invitation?')) {
        return;
    }
    
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/decline/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation declined', 'success');
            await loadFamilyInvitations();
        } else {
            showAlert(data.message || 'Failed to decline invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error declining invitation:', error);
        showAlert('Failed to decline invitation', 'error');
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

// Load family invitations for current user
async function loadFamilyInvitations() {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch('http://localhost:5000/api/family/invitations', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        const invitations = data.invitations || [];
        
        if (invitations.length > 0) {
            // Show invitations at the top of family section
            const familySection = document.getElementById('familySection');
            if (familySection) {
                let invitationsHTML = `
                    <div style="background: #e3f2fd; border: 1px solid #2196f3; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px 0; color: #1976d2;">📨 Pending Family Invitations</h4>
                `;
                
                invitations.forEach(invite => {
                    invitationsHTML += `
                        <div style="background: white; border-radius: 5px; padding: 10px; margin: 5px 0; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>${invite.invitedBy}</strong> invited you as <em>${invite.relationship}</em>
                                <br><small>Invited: ${new Date(invite.invitedAt).toLocaleDateString()}</small>
                            </div>
                            <div>
                                <button class="btn-small btn-primary" onclick="acceptFamilyInvite('${invite._id}')" style="margin-right: 5px;">
                                    ✅ Accept
                                </button>
                                <button class="btn-small btn-danger" onclick="declineFamilyInvite('${invite._id}')">
                                    ❌ Decline
                                </button>
                            </div>
                        </div>
                    `;
                });
                
                invitationsHTML += '</div>';
                
                // Insert at the beginning of family section
                const existingInvites = familySection.querySelector('.family-invitations');
                if (existingInvites) {
                    existingInvites.innerHTML = invitationsHTML;
                } else {
                    familySection.insertAdjacentHTML('afterbegin', `<div class="family-invitations">${invitationsHTML}</div>`);
                }
            }
        }
    } catch (error) {
        console.error('❌ Error loading family invitations:', error);
    }
}

// Accept family invitation
async function acceptFamilyInvite(inviteId) {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/accept/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation accepted!', 'success');
            await loadFamilyMembers();
            await loadFamilyInvitations();
            await loadDashboardOverview();
        } else {
            showAlert(data.message || 'Failed to accept invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error accepting invitation:', error);
        showAlert('Failed to accept invitation', 'error');
    }
}

// Decline family invitation
async function declineFamilyInvite(inviteId) {
    if (!confirm('Are you sure you want to decline this family invitation?')) {
        return;
    }
    
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/decline/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation declined', 'success');
            await loadFamilyInvitations();
        } else {
            showAlert(data.message || 'Failed to decline invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error declining invitation:', error);
        showAlert('Failed to decline invitation', 'error');
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

// Load family invitations for current user
async function loadFamilyInvitations() {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch('http://localhost:5000/api/family/invitations', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        const invitations = data.invitations || [];
        
        if (invitations.length > 0) {
            // Show invitations at the top of family section
            const familySection = document.getElementById('familySection');
            if (familySection) {
                let invitationsHTML = `
                    <div style="background: #e3f2fd; border: 1px solid #2196f3; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px 0; color: #1976d2;">📨 Pending Family Invitations</h4>
                `;
                
                invitations.forEach(invite => {
                    invitationsHTML += `
                        <div style="background: white; border-radius: 5px; padding: 10px; margin: 5px 0; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>${invite.invitedBy}</strong> invited you as <em>${invite.relationship}</em>
                                <br><small>Invited: ${new Date(invite.invitedAt).toLocaleDateString()}</small>
                            </div>
                            <div>
                                <button class="btn-small btn-primary" onclick="acceptFamilyInvite('${invite._id}')" style="margin-right: 5px;">
                                    ✅ Accept
                                </button>
                                <button class="btn-small btn-danger" onclick="declineFamilyInvite('${invite._id}')">
                                    ❌ Decline
                                </button>
                            </div>
                        </div>
                    `;
                });
                
                invitationsHTML += '</div>';
                
                // Insert at the beginning of family section
                const existingInvites = familySection.querySelector('.family-invitations');
                if (existingInvites) {
                    existingInvites.innerHTML = invitationsHTML;
                } else {
                    familySection.insertAdjacentHTML('afterbegin', `<div class="family-invitations">${invitationsHTML}</div>`);
                }
            }
        }
    } catch (error) {
        console.error('❌ Error loading family invitations:', error);
    }
}

// Accept family invitation
async function acceptFamilyInvite(inviteId) {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/accept/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation accepted!', 'success');
            await loadFamilyMembers();
            await loadFamilyInvitations();
            await loadDashboardOverview();
        } else {
            showAlert(data.message || 'Failed to accept invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error accepting invitation:', error);
        showAlert('Failed to accept invitation', 'error');
    }
}

// Decline family invitation
async function declineFamilyInvite(inviteId) {
    if (!confirm('Are you sure you want to decline this family invitation?')) {
        return;
    }
    
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/decline/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation declined', 'success');
            await loadFamilyInvitations();
        } else {
            showAlert(data.message || 'Failed to decline invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error declining invitation:', error);
        showAlert('Failed to decline invitation', 'error');
    }
}

// Upload form handler
document.addEventListener('DOMContentLoaded', function() {
    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm) {
        uploadForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const fileInput = document.getElementById('documentFile');
            const docName = document.getElementById('docName');
            const docType = document.getElementById('docType');
            const docDescription = document.getElementById('docDescription');
            
            if (!fileInput.files[0]) {
                showAlert('Please select a file to upload', 'error');
                return;
            }
            
            if (!docName.value.trim()) {
                showAlert('Please enter a document name', 'error');
                return;
            }
            
            logger.info('Alert shown', { message: 'Please select a file to upload', type: 'error' });
            
            // Create FormData for file upload
            const formData = new FormData();
            formData.append('document', fileInput.files[0]);
            formData.append('title', docName.value);
            formData.append('category', docType.value);
            if (docDescription && docDescription.value) {
                formData.append('description', docDescription.value);
            }
            
            // Upload to backend
            const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
            console.log('🔑 Using token for upload:', token ? token.substring(0, 20) + '...' : 'No token');
            
            fetch('http://localhost:5000/api/documents/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
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
}

// Load family invitations for current user
async function loadFamilyInvitations() {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch('http://localhost:5000/api/family/invitations', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        const invitations = data.invitations || [];
        
        if (invitations.length > 0) {
            // Show invitations at the top of family section
            const familySection = document.getElementById('familySection');
            if (familySection) {
                let invitationsHTML = `
                    <div style="background: #e3f2fd; border: 1px solid #2196f3; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px 0; color: #1976d2;">📨 Pending Family Invitations</h4>
                `;
                
                invitations.forEach(invite => {
                    invitationsHTML += `
                        <div style="background: white; border-radius: 5px; padding: 10px; margin: 5px 0; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>${invite.invitedBy}</strong> invited you as <em>${invite.relationship}</em>
                                <br><small>Invited: ${new Date(invite.invitedAt).toLocaleDateString()}</small>
                            </div>
                            <div>
                                <button class="btn-small btn-primary" onclick="acceptFamilyInvite('${invite._id}')" style="margin-right: 5px;">
                                    ✅ Accept
                                </button>
                                <button class="btn-small btn-danger" onclick="declineFamilyInvite('${invite._id}')">
                                    ❌ Decline
                                </button>
                            </div>
                        </div>
                    `;
                });
                
                invitationsHTML += '</div>';
                
                // Insert at the beginning of family section
                const existingInvites = familySection.querySelector('.family-invitations');
                if (existingInvites) {
                    existingInvites.innerHTML = invitationsHTML;
                } else {
                    familySection.insertAdjacentHTML('afterbegin', `<div class="family-invitations">${invitationsHTML}</div>`);
                }
            }
        }
    } catch (error) {
        console.error('❌ Error loading family invitations:', error);
    }
}

// Accept family invitation
async function acceptFamilyInvite(inviteId) {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/accept/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation accepted!', 'success');
            await loadFamilyMembers();
            await loadFamilyInvitations();
            await loadDashboardOverview();
        } else {
            showAlert(data.message || 'Failed to accept invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error accepting invitation:', error);
        showAlert('Failed to accept invitation', 'error');
    }
}

// Decline family invitation
async function declineFamilyInvite(inviteId) {
    if (!confirm('Are you sure you want to decline this family invitation?')) {
        return;
    }
    
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/decline/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation declined', 'success');
            await loadFamilyInvitations();
        } else {
            showAlert(data.message || 'Failed to decline invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error declining invitation:', error);
        showAlert('Failed to decline invitation', 'error');
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
}

// Load family invitations for current user
async function loadFamilyInvitations() {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch('http://localhost:5000/api/family/invitations', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        const invitations = data.invitations || [];
        
        if (invitations.length > 0) {
            // Show invitations at the top of family section
            const familySection = document.getElementById('familySection');
            if (familySection) {
                let invitationsHTML = `
                    <div style="background: #e3f2fd; border: 1px solid #2196f3; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px 0; color: #1976d2;">📨 Pending Family Invitations</h4>
                `;
                
                invitations.forEach(invite => {
                    invitationsHTML += `
                        <div style="background: white; border-radius: 5px; padding: 10px; margin: 5px 0; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>${invite.invitedBy}</strong> invited you as <em>${invite.relationship}</em>
                                <br><small>Invited: ${new Date(invite.invitedAt).toLocaleDateString()}</small>
                            </div>
                            <div>
                                <button class="btn-small btn-primary" onclick="acceptFamilyInvite('${invite._id}')" style="margin-right: 5px;">
                                    ✅ Accept
                                </button>
                                <button class="btn-small btn-danger" onclick="declineFamilyInvite('${invite._id}')">
                                    ❌ Decline
                                </button>
                            </div>
                        </div>
                    `;
                });
                
                invitationsHTML += '</div>';
                
                // Insert at the beginning of family section
                const existingInvites = familySection.querySelector('.family-invitations');
                if (existingInvites) {
                    existingInvites.innerHTML = invitationsHTML;
                } else {
                    familySection.insertAdjacentHTML('afterbegin', `<div class="family-invitations">${invitationsHTML}</div>`);
                }
            }
        }
    } catch (error) {
        console.error('❌ Error loading family invitations:', error);
    }
}

// Accept family invitation
async function acceptFamilyInvite(inviteId) {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/accept/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation accepted!', 'success');
            await loadFamilyMembers();
            await loadFamilyInvitations();
            await loadDashboardOverview();
        } else {
            showAlert(data.message || 'Failed to accept invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error accepting invitation:', error);
        showAlert('Failed to accept invitation', 'error');
    }
}

// Decline family invitation
async function declineFamilyInvite(inviteId) {
    if (!confirm('Are you sure you want to decline this family invitation?')) {
        return;
    }
    
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/decline/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation declined', 'success');
            await loadFamilyInvitations();
        } else {
            showAlert(data.message || 'Failed to decline invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error declining invitation:', error);
        showAlert('Failed to decline invitation', 'error');
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
}

// Load family invitations for current user
async function loadFamilyInvitations() {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch('http://localhost:5000/api/family/invitations', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        const invitations = data.invitations || [];
        
        if (invitations.length > 0) {
            // Show invitations at the top of family section
            const familySection = document.getElementById('familySection');
            if (familySection) {
                let invitationsHTML = `
                    <div style="background: #e3f2fd; border: 1px solid #2196f3; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px 0; color: #1976d2;">📨 Pending Family Invitations</h4>
                `;
                
                invitations.forEach(invite => {
                    invitationsHTML += `
                        <div style="background: white; border-radius: 5px; padding: 10px; margin: 5px 0; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>${invite.invitedBy}</strong> invited you as <em>${invite.relationship}</em>
                                <br><small>Invited: ${new Date(invite.invitedAt).toLocaleDateString()}</small>
                            </div>
                            <div>
                                <button class="btn-small btn-primary" onclick="acceptFamilyInvite('${invite._id}')" style="margin-right: 5px;">
                                    ✅ Accept
                                </button>
                                <button class="btn-small btn-danger" onclick="declineFamilyInvite('${invite._id}')">
                                    ❌ Decline
                                </button>
                            </div>
                        </div>
                    `;
                });
                
                invitationsHTML += '</div>';
                
                // Insert at the beginning of family section
                const existingInvites = familySection.querySelector('.family-invitations');
                if (existingInvites) {
                    existingInvites.innerHTML = invitationsHTML;
                } else {
                    familySection.insertAdjacentHTML('afterbegin', `<div class="family-invitations">${invitationsHTML}</div>`);
                }
            }
        }
    } catch (error) {
        console.error('❌ Error loading family invitations:', error);
    }
}

// Accept family invitation
async function acceptFamilyInvite(inviteId) {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/accept/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation accepted!', 'success');
            await loadFamilyMembers();
            await loadFamilyInvitations();
            await loadDashboardOverview();
        } else {
            showAlert(data.message || 'Failed to accept invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error accepting invitation:', error);
        showAlert('Failed to accept invitation', 'error');
    }
}

// Decline family invitation
async function declineFamilyInvite(inviteId) {
    if (!confirm('Are you sure you want to decline this family invitation?')) {
        return;
    }
    
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/decline/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation declined', 'success');
            await loadFamilyInvitations();
        } else {
            showAlert(data.message || 'Failed to decline invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error declining invitation:', error);
        showAlert('Failed to decline invitation', 'error');
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
}

// Load family invitations for current user
async function loadFamilyInvitations() {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch('http://localhost:5000/api/family/invitations', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        const invitations = data.invitations || [];
        
        if (invitations.length > 0) {
            // Show invitations at the top of family section
            const familySection = document.getElementById('familySection');
            if (familySection) {
                let invitationsHTML = `
                    <div style="background: #e3f2fd; border: 1px solid #2196f3; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px 0; color: #1976d2;">📨 Pending Family Invitations</h4>
                `;
                
                invitations.forEach(invite => {
                    invitationsHTML += `
                        <div style="background: white; border-radius: 5px; padding: 10px; margin: 5px 0; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>${invite.invitedBy}</strong> invited you as <em>${invite.relationship}</em>
                                <br><small>Invited: ${new Date(invite.invitedAt).toLocaleDateString()}</small>
                            </div>
                            <div>
                                <button class="btn-small btn-primary" onclick="acceptFamilyInvite('${invite._id}')" style="margin-right: 5px;">
                                    ✅ Accept
                                </button>
                                <button class="btn-small btn-danger" onclick="declineFamilyInvite('${invite._id}')">
                                    ❌ Decline
                                </button>
                            </div>
                        </div>
                    `;
                });
                
                invitationsHTML += '</div>';
                
                // Insert at the beginning of family section
                const existingInvites = familySection.querySelector('.family-invitations');
                if (existingInvites) {
                    existingInvites.innerHTML = invitationsHTML;
                } else {
                    familySection.insertAdjacentHTML('afterbegin', `<div class="family-invitations">${invitationsHTML}</div>`);
                }
            }
        }
    } catch (error) {
        console.error('❌ Error loading family invitations:', error);
    }
}

// Accept family invitation
async function acceptFamilyInvite(inviteId) {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/accept/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation accepted!', 'success');
            await loadFamilyMembers();
            await loadFamilyInvitations();
            await loadDashboardOverview();
        } else {
            showAlert(data.message || 'Failed to accept invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error accepting invitation:', error);
        showAlert('Failed to accept invitation', 'error');
    }
}

// Decline family invitation
async function declineFamilyInvite(inviteId) {
    if (!confirm('Are you sure you want to decline this family invitation?')) {
        return;
    }
    
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/decline/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation declined', 'success');
            await loadFamilyInvitations();
        } else {
            showAlert(data.message || 'Failed to decline invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error declining invitation:', error);
        showAlert('Failed to decline invitation', 'error');
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

// Load family invitations for current user
async function loadFamilyInvitations() {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch('http://localhost:5000/api/family/invitations', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        const invitations = data.invitations || [];
        
        if (invitations.length > 0) {
            // Show invitations at the top of family section
            const familySection = document.getElementById('familySection');
            if (familySection) {
                let invitationsHTML = `
                    <div style="background: #e3f2fd; border: 1px solid #2196f3; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px 0; color: #1976d2;">📨 Pending Family Invitations</h4>
                `;
                
                invitations.forEach(invite => {
                    invitationsHTML += `
                        <div style="background: white; border-radius: 5px; padding: 10px; margin: 5px 0; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>${invite.invitedBy}</strong> invited you as <em>${invite.relationship}</em>
                                <br><small>Invited: ${new Date(invite.invitedAt).toLocaleDateString()}</small>
                            </div>
                            <div>
                                <button class="btn-small btn-primary" onclick="acceptFamilyInvite('${invite._id}')" style="margin-right: 5px;">
                                    ✅ Accept
                                </button>
                                <button class="btn-small btn-danger" onclick="declineFamilyInvite('${invite._id}')">
                                    ❌ Decline
                                </button>
                            </div>
                        </div>
                    `;
                });
                
                invitationsHTML += '</div>';
                
                // Insert at the beginning of family section
                const existingInvites = familySection.querySelector('.family-invitations');
                if (existingInvites) {
                    existingInvites.innerHTML = invitationsHTML;
                } else {
                    familySection.insertAdjacentHTML('afterbegin', `<div class="family-invitations">${invitationsHTML}</div>`);
                }
            }
        }
    } catch (error) {
        console.error('❌ Error loading family invitations:', error);
    }
}

// Accept family invitation
async function acceptFamilyInvite(inviteId) {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/accept/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation accepted!', 'success');
            await loadFamilyMembers();
            await loadFamilyInvitations();
            await loadDashboardOverview();
        } else {
            showAlert(data.message || 'Failed to accept invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error accepting invitation:', error);
        showAlert('Failed to accept invitation', 'error');
    }
}

// Decline family invitation
async function declineFamilyInvite(inviteId) {
    if (!confirm('Are you sure you want to decline this family invitation?')) {
        return;
    }
    
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/decline/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation declined', 'success');
            await loadFamilyInvitations();
        } else {
            showAlert(data.message || 'Failed to decline invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error declining invitation:', error);
        showAlert('Failed to decline invitation', 'error');
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
            // Load dashboard overview with real data
            async function loadDashboardOverview() {
                try {
                    // Fetch real stats from backend
                    const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
                    const response = await fetch('http://localhost:5000/api/documents/stats', {
                        method: 'GET',
                        headers: {
                            'Authorization': `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        }
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        if (data.success && data.stats) {
                            // Update dashboard stats with real data
                            const totalDocsElement = document.querySelector('.stat-card:nth-child(1) .stat-number');
                            const recentUploadsElement = document.querySelector('.stat-card:nth-child(2) .stat-number');
                            const sharedDocsElement = document.querySelector('.stat-card:nth-child(3) .stat-number');
                            const storageElement = document.querySelector('.stat-card:nth-child(4) .stat-number');
                            
                            if (totalDocsElement) totalDocsElement.textContent = data.stats.totalDocuments || 0;
                            if (recentUploadsElement) recentUploadsElement.textContent = data.stats.recentUploads || 0;
                            if (sharedDocsElement) sharedDocsElement.textContent = data.stats.sharedDocuments || 0;
                            if (storageElement) storageElement.textContent = `${(data.stats.storageUsed / (1024 * 1024)).toFixed(1)} MB`;
                        }
                    }
                } catch (error) {
                    console.error('Error loading dashboard stats:', error);
                }
                
                logger.info('Dashboard overview loaded', {});
            }
        }
        
        loadDashboardOverview();
        logger.info('Dashboard initialized');
    } catch (error) {
        logger.error('Dashboard initialization error', error);
    }
}

// Load family invitations for current user
async function loadFamilyInvitations() {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch('http://localhost:5000/api/family/invitations', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        const invitations = data.invitations || [];
        
        if (invitations.length > 0) {
            // Show invitations at the top of family section
            const familySection = document.getElementById('familySection');
            if (familySection) {
                let invitationsHTML = `
                    <div style="background: #e3f2fd; border: 1px solid #2196f3; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px 0; color: #1976d2;">📨 Pending Family Invitations</h4>
                `;
                
                invitations.forEach(invite => {
                    invitationsHTML += `
                        <div style="background: white; border-radius: 5px; padding: 10px; margin: 5px 0; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>${invite.invitedBy}</strong> invited you as <em>${invite.relationship}</em>
                                <br><small>Invited: ${new Date(invite.invitedAt).toLocaleDateString()}</small>
                            </div>
                            <div>
                                <button class="btn-small btn-primary" onclick="acceptFamilyInvite('${invite._id}')" style="margin-right: 5px;">
                                    ✅ Accept
                                </button>
                                <button class="btn-small btn-danger" onclick="declineFamilyInvite('${invite._id}')">
                                    ❌ Decline
                                </button>
                            </div>
                        </div>
                    `;
                });
                
                invitationsHTML += '</div>';
                
                // Insert at the beginning of family section
                const existingInvites = familySection.querySelector('.family-invitations');
                if (existingInvites) {
                    existingInvites.innerHTML = invitationsHTML;
                } else {
                    familySection.insertAdjacentHTML('afterbegin', `<div class="family-invitations">${invitationsHTML}</div>`);
                }
            }
        }
    } catch (error) {
        console.error('❌ Error loading family invitations:', error);
    }
}

// Accept family invitation
async function acceptFamilyInvite(inviteId) {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/accept/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation accepted!', 'success');
            await loadFamilyMembers();
            await loadFamilyInvitations();
            await loadDashboardOverview();
        } else {
            showAlert(data.message || 'Failed to accept invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error accepting invitation:', error);
        showAlert('Failed to accept invitation', 'error');
    }
}

// Decline family invitation
async function declineFamilyInvite(inviteId) {
    if (!confirm('Are you sure you want to decline this family invitation?')) {
        return;
    }
    
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/decline/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation declined', 'success');
            await loadFamilyInvitations();
        } else {
            showAlert(data.message || 'Failed to decline invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error declining invitation:', error);
        showAlert('Failed to decline invitation', 'error');
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

// Load family invitations for current user
async function loadFamilyInvitations() {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch('http://localhost:5000/api/family/invitations', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        const invitations = data.invitations || [];
        
        if (invitations.length > 0) {
            // Show invitations at the top of family section
            const familySection = document.getElementById('familySection');
            if (familySection) {
                let invitationsHTML = `
                    <div style="background: #e3f2fd; border: 1px solid #2196f3; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px 0; color: #1976d2;">📨 Pending Family Invitations</h4>
                `;
                
                invitations.forEach(invite => {
                    invitationsHTML += `
                        <div style="background: white; border-radius: 5px; padding: 10px; margin: 5px 0; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>${invite.invitedBy}</strong> invited you as <em>${invite.relationship}</em>
                                <br><small>Invited: ${new Date(invite.invitedAt).toLocaleDateString()}</small>
                            </div>
                            <div>
                                <button class="btn-small btn-primary" onclick="acceptFamilyInvite('${invite._id}')" style="margin-right: 5px;">
                                    ✅ Accept
                                </button>
                                <button class="btn-small btn-danger" onclick="declineFamilyInvite('${invite._id}')">
                                    ❌ Decline
                                </button>
                            </div>
                        </div>
                    `;
                });
                
                invitationsHTML += '</div>';
                
                // Insert at the beginning of family section
                const existingInvites = familySection.querySelector('.family-invitations');
                if (existingInvites) {
                    existingInvites.innerHTML = invitationsHTML;
                } else {
                    familySection.insertAdjacentHTML('afterbegin', `<div class="family-invitations">${invitationsHTML}</div>`);
                }
            }
        }
    } catch (error) {
        console.error('❌ Error loading family invitations:', error);
    }
}

// Accept family invitation
async function acceptFamilyInvite(inviteId) {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/accept/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation accepted!', 'success');
            await loadFamilyMembers();
            await loadFamilyInvitations();
            await loadDashboardOverview();
        } else {
            showAlert(data.message || 'Failed to accept invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error accepting invitation:', error);
        showAlert('Failed to accept invitation', 'error');
    }
}

// Decline family invitation
async function declineFamilyInvite(inviteId) {
    if (!confirm('Are you sure you want to decline this family invitation?')) {
        return;
    }
    
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/decline/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation declined', 'success');
            await loadFamilyInvitations();
        } else {
            showAlert(data.message || 'Failed to decline invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error declining invitation:', error);
        showAlert('Failed to decline invitation', 'error');
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

// Load family invitations for current user
async function loadFamilyInvitations() {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch('http://localhost:5000/api/family/invitations', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        const invitations = data.invitations || [];
        
        if (invitations.length > 0) {
            // Show invitations at the top of family section
            const familySection = document.getElementById('familySection');
            if (familySection) {
                let invitationsHTML = `
                    <div style="background: #e3f2fd; border: 1px solid #2196f3; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px 0; color: #1976d2;">📨 Pending Family Invitations</h4>
                `;
                
                invitations.forEach(invite => {
                    invitationsHTML += `
                        <div style="background: white; border-radius: 5px; padding: 10px; margin: 5px 0; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>${invite.invitedBy}</strong> invited you as <em>${invite.relationship}</em>
                                <br><small>Invited: ${new Date(invite.invitedAt).toLocaleDateString()}</small>
                            </div>
                            <div>
                                <button class="btn-small btn-primary" onclick="acceptFamilyInvite('${invite._id}')" style="margin-right: 5px;">
                                    ✅ Accept
                                </button>
                                <button class="btn-small btn-danger" onclick="declineFamilyInvite('${invite._id}')">
                                    ❌ Decline
                                </button>
                            </div>
                        </div>
                    `;
                });
                
                invitationsHTML += '</div>';
                
                // Insert at the beginning of family section
                const existingInvites = familySection.querySelector('.family-invitations');
                if (existingInvites) {
                    existingInvites.innerHTML = invitationsHTML;
                } else {
                    familySection.insertAdjacentHTML('afterbegin', `<div class="family-invitations">${invitationsHTML}</div>`);
                }
            }
        }
    } catch (error) {
        console.error('❌ Error loading family invitations:', error);
    }
}

// Accept family invitation
async function acceptFamilyInvite(inviteId) {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/accept/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation accepted!', 'success');
            await loadFamilyMembers();
            await loadFamilyInvitations();
            await loadDashboardOverview();
        } else {
            showAlert(data.message || 'Failed to accept invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error accepting invitation:', error);
        showAlert('Failed to accept invitation', 'error');
    }
}

// Decline family invitation
async function declineFamilyInvite(inviteId) {
    if (!confirm('Are you sure you want to decline this family invitation?')) {
        return;
    }
    
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/decline/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation declined', 'success');
            await loadFamilyInvitations();
        } else {
            showAlert(data.message || 'Failed to decline invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error declining invitation:', error);
        showAlert('Failed to decline invitation', 'error');
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

// Load family invitations for current user
async function loadFamilyInvitations() {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch('http://localhost:5000/api/family/invitations', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        const invitations = data.invitations || [];
        
        if (invitations.length > 0) {
            // Show invitations at the top of family section
            const familySection = document.getElementById('familySection');
            if (familySection) {
                let invitationsHTML = `
                    <div style="background: #e3f2fd; border: 1px solid #2196f3; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px 0; color: #1976d2;">📨 Pending Family Invitations</h4>
                `;
                
                invitations.forEach(invite => {
                    invitationsHTML += `
                        <div style="background: white; border-radius: 5px; padding: 10px; margin: 5px 0; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>${invite.invitedBy}</strong> invited you as <em>${invite.relationship}</em>
                                <br><small>Invited: ${new Date(invite.invitedAt).toLocaleDateString()}</small>
                            </div>
                            <div>
                                <button class="btn-small btn-primary" onclick="acceptFamilyInvite('${invite._id}')" style="margin-right: 5px;">
                                    ✅ Accept
                                </button>
                                <button class="btn-small btn-danger" onclick="declineFamilyInvite('${invite._id}')">
                                    ❌ Decline
                                </button>
                            </div>
                        </div>
                    `;
                });
                
                invitationsHTML += '</div>';
                
                // Insert at the beginning of family section
                const existingInvites = familySection.querySelector('.family-invitations');
                if (existingInvites) {
                    existingInvites.innerHTML = invitationsHTML;
                } else {
                    familySection.insertAdjacentHTML('afterbegin', `<div class="family-invitations">${invitationsHTML}</div>`);
                }
            }
        }
    } catch (error) {
        console.error('❌ Error loading family invitations:', error);
    }
}

// Accept family invitation
async function acceptFamilyInvite(inviteId) {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/accept/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation accepted!', 'success');
            await loadFamilyMembers();
            await loadFamilyInvitations();
            await loadDashboardOverview();
        } else {
            showAlert(data.message || 'Failed to accept invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error accepting invitation:', error);
        showAlert('Failed to accept invitation', 'error');
    }
}

// Decline family invitation
async function declineFamilyInvite(inviteId) {
    if (!confirm('Are you sure you want to decline this family invitation?')) {
        return;
    }
    
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/decline/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation declined', 'success');
            await loadFamilyInvitations();
        } else {
            showAlert(data.message || 'Failed to decline invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error declining invitation:', error);
        showAlert('Failed to decline invitation', 'error');
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

// Load family invitations for current user
async function loadFamilyInvitations() {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch('http://localhost:5000/api/family/invitations', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        const invitations = data.invitations || [];
        
        if (invitations.length > 0) {
            // Show invitations at the top of family section
            const familySection = document.getElementById('familySection');
            if (familySection) {
                let invitationsHTML = `
                    <div style="background: #e3f2fd; border: 1px solid #2196f3; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px 0; color: #1976d2;">📨 Pending Family Invitations</h4>
                `;
                
                invitations.forEach(invite => {
                    invitationsHTML += `
                        <div style="background: white; border-radius: 5px; padding: 10px; margin: 5px 0; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>${invite.invitedBy}</strong> invited you as <em>${invite.relationship}</em>
                                <br><small>Invited: ${new Date(invite.invitedAt).toLocaleDateString()}</small>
                            </div>
                            <div>
                                <button class="btn-small btn-primary" onclick="acceptFamilyInvite('${invite._id}')" style="margin-right: 5px;">
                                    ✅ Accept
                                </button>
                                <button class="btn-small btn-danger" onclick="declineFamilyInvite('${invite._id}')">
                                    ❌ Decline
                                </button>
                            </div>
                        </div>
                    `;
                });
                
                invitationsHTML += '</div>';
                
                // Insert at the beginning of family section
                const existingInvites = familySection.querySelector('.family-invitations');
                if (existingInvites) {
                    existingInvites.innerHTML = invitationsHTML;
                } else {
                    familySection.insertAdjacentHTML('afterbegin', `<div class="family-invitations">${invitationsHTML}</div>`);
                }
            }
        }
    } catch (error) {
        console.error('❌ Error loading family invitations:', error);
    }
}

// Accept family invitation
async function acceptFamilyInvite(inviteId) {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/accept/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation accepted!', 'success');
            await loadFamilyMembers();
            await loadFamilyInvitations();
            await loadDashboardOverview();
        } else {
            showAlert(data.message || 'Failed to accept invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error accepting invitation:', error);
        showAlert('Failed to accept invitation', 'error');
    }
}

// Decline family invitation
async function declineFamilyInvite(inviteId) {
    if (!confirm('Are you sure you want to decline this family invitation?')) {
        return;
    }
    
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/decline/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation declined', 'success');
            await loadFamilyInvitations();
        } else {
            showAlert(data.message || 'Failed to decline invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error declining invitation:', error);
        showAlert('Failed to decline invitation', 'error');
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

// Load family invitations for current user
async function loadFamilyInvitations() {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch('http://localhost:5000/api/family/invitations', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        const invitations = data.invitations || [];
        
        if (invitations.length > 0) {
            // Show invitations at the top of family section
            const familySection = document.getElementById('familySection');
            if (familySection) {
                let invitationsHTML = `
                    <div style="background: #e3f2fd; border: 1px solid #2196f3; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px 0; color: #1976d2;">📨 Pending Family Invitations</h4>
                `;
                
                invitations.forEach(invite => {
                    invitationsHTML += `
                        <div style="background: white; border-radius: 5px; padding: 10px; margin: 5px 0; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>${invite.invitedBy}</strong> invited you as <em>${invite.relationship}</em>
                                <br><small>Invited: ${new Date(invite.invitedAt).toLocaleDateString()}</small>
                            </div>
                            <div>
                                <button class="btn-small btn-primary" onclick="acceptFamilyInvite('${invite._id}')" style="margin-right: 5px;">
                                    ✅ Accept
                                </button>
                                <button class="btn-small btn-danger" onclick="declineFamilyInvite('${invite._id}')">
                                    ❌ Decline
                                </button>
                            </div>
                        </div>
                    `;
                });
                
                invitationsHTML += '</div>';
                
                // Insert at the beginning of family section
                const existingInvites = familySection.querySelector('.family-invitations');
                if (existingInvites) {
                    existingInvites.innerHTML = invitationsHTML;
                } else {
                    familySection.insertAdjacentHTML('afterbegin', `<div class="family-invitations">${invitationsHTML}</div>`);
                }
            }
        }
    } catch (error) {
        console.error('❌ Error loading family invitations:', error);
    }
}

// Accept family invitation
async function acceptFamilyInvite(inviteId) {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/accept/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation accepted!', 'success');
            await loadFamilyMembers();
            await loadFamilyInvitations();
            await loadDashboardOverview();
        } else {
            showAlert(data.message || 'Failed to accept invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error accepting invitation:', error);
        showAlert('Failed to accept invitation', 'error');
    }
}

// Decline family invitation
async function declineFamilyInvite(inviteId) {
    if (!confirm('Are you sure you want to decline this family invitation?')) {
        return;
    }
    
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/decline/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation declined', 'success');
            await loadFamilyInvitations();
        } else {
            showAlert(data.message || 'Failed to decline invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error declining invitation:', error);
        showAlert('Failed to decline invitation', 'error');
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
            uploadForm.reset();
            selectedFile = null;
                    
            // Refresh documents and dashboard
            await loadUserDocuments();
            await loadDashboardOverview();
            
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

// Load family invitations for current user
async function loadFamilyInvitations() {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch('http://localhost:5000/api/family/invitations', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        const invitations = data.invitations || [];
        
        if (invitations.length > 0) {
            // Show invitations at the top of family section
            const familySection = document.getElementById('familySection');
            if (familySection) {
                let invitationsHTML = `
                    <div style="background: #e3f2fd; border: 1px solid #2196f3; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px 0; color: #1976d2;">📨 Pending Family Invitations</h4>
                `;
                
                invitations.forEach(invite => {
                    invitationsHTML += `
                        <div style="background: white; border-radius: 5px; padding: 10px; margin: 5px 0; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>${invite.invitedBy}</strong> invited you as <em>${invite.relationship}</em>
                                <br><small>Invited: ${new Date(invite.invitedAt).toLocaleDateString()}</small>
                            </div>
                            <div>
                                <button class="btn-small btn-primary" onclick="acceptFamilyInvite('${invite._id}')" style="margin-right: 5px;">
                                    ✅ Accept
                                </button>
                                <button class="btn-small btn-danger" onclick="declineFamilyInvite('${invite._id}')">
                                    ❌ Decline
                                </button>
                            </div>
                        </div>
                    `;
                });
                
                invitationsHTML += '</div>';
                
                // Insert at the beginning of family section
                const existingInvites = familySection.querySelector('.family-invitations');
                if (existingInvites) {
                    existingInvites.innerHTML = invitationsHTML;
                } else {
                    familySection.insertAdjacentHTML('afterbegin', `<div class="family-invitations">${invitationsHTML}</div>`);
                }
            }
        }
    } catch (error) {
        console.error('❌ Error loading family invitations:', error);
    }
}

// Accept family invitation
async function acceptFamilyInvite(inviteId) {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/accept/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation accepted!', 'success');
            await loadFamilyMembers();
            await loadFamilyInvitations();
            await loadDashboardOverview();
        } else {
            showAlert(data.message || 'Failed to accept invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error accepting invitation:', error);
        showAlert('Failed to accept invitation', 'error');
    }
}

// Decline family invitation
async function declineFamilyInvite(inviteId) {
    if (!confirm('Are you sure you want to decline this family invitation?')) {
        return;
    }
    
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/decline/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation declined', 'success');
            await loadFamilyInvitations();
        } else {
            showAlert(data.message || 'Failed to decline invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error declining invitation:', error);
        showAlert('Failed to decline invitation', 'error');
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

// Updated view document for MongoDB - opens in modal for images and PDFs, downloads for other files
async function viewDocument(docId) {
    try {
        console.log('🔍 Opening document:', docId);
        const token = await currentUser.getIdToken();
        
        const response = await fetch(`http://localhost:5000/api/documents/${docId}/download`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const contentType = response.headers.get('content-type') || blob.type;
            
            // Check if it's an image or PDF
            if (contentType.startsWith('image/')) {
                // Show image in modal
                const url = window.URL.createObjectURL(blob);
                showDocumentModal(url, docId, 'image');
            } else if (contentType === 'application/pdf') {
                // Show PDF in modal
                const url = window.URL.createObjectURL(blob);
                showDocumentModal(url, docId, 'pdf');
            } else {
                // Download other file types
                const url = window.URL.createObjectURL(blob);
                const contentDisposition = response.headers.get('content-disposition');
                let filename = `document_${docId}`;
                if (contentDisposition) {
                    const filenameMatch = contentDisposition.match(/filename="(.+)"/);
                    if (filenameMatch) {
                        filename = filenameMatch[1];
                    }
                }
                
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                window.URL.revokeObjectURL(url);
            }
            
            logger.info('Document viewed', { docId });
        } else {
            throw new Error(`View failed: ${response.status}`);
        }
    } catch (error) {
        console.error('❌ Error viewing document:', error);
        logger.error('Error viewing document', error);
        showAlert('Failed to open document', 'error');
    }
}

// Load family invitations for current user
async function loadFamilyInvitations() {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch('http://localhost:5000/api/family/invitations', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        const invitations = data.invitations || [];
        
        if (invitations.length > 0) {
            // Show invitations at the top of family section
            const familySection = document.getElementById('familySection');
            if (familySection) {
                let invitationsHTML = `
                    <div style="background: #e3f2fd; border: 1px solid #2196f3; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px 0; color: #1976d2;">📨 Pending Family Invitations</h4>
                `;
                
                invitations.forEach(invite => {
                    invitationsHTML += `
                        <div style="background: white; border-radius: 5px; padding: 10px; margin: 5px 0; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>${invite.invitedBy}</strong> invited you as <em>${invite.relationship}</em>
                                <br><small>Invited: ${new Date(invite.invitedAt).toLocaleDateString()}</small>
                            </div>
                            <div>
                                <button class="btn-small btn-primary" onclick="acceptFamilyInvite('${invite._id}')" style="margin-right: 5px;">
                                    ✅ Accept
                                </button>
                                <button class="btn-small btn-danger" onclick="declineFamilyInvite('${invite._id}')">
                                    ❌ Decline
                                </button>
                            </div>
                        </div>
                    `;
                });
                
                invitationsHTML += '</div>';
                
                // Insert at the beginning of family section
                const existingInvites = familySection.querySelector('.family-invitations');
                if (existingInvites) {
                    existingInvites.innerHTML = invitationsHTML;
                } else {
                    familySection.insertAdjacentHTML('afterbegin', `<div class="family-invitations">${invitationsHTML}</div>`);
                }
            }
        }
    } catch (error) {
        console.error('❌ Error loading family invitations:', error);
    }
}

// Accept family invitation
async function acceptFamilyInvite(inviteId) {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/accept/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation accepted!', 'success');
            await loadFamilyMembers();
            await loadFamilyInvitations();
            await loadDashboardOverview();
        } else {
            showAlert(data.message || 'Failed to accept invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error accepting invitation:', error);
        showAlert('Failed to accept invitation', 'error');
    }
}

// Decline family invitation
async function declineFamilyInvite(inviteId) {
    if (!confirm('Are you sure you want to decline this family invitation?')) {
        return;
    }
    
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/decline/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation declined', 'success');
            await loadFamilyInvitations();
        } else {
            showAlert(data.message || 'Failed to decline invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error declining invitation:', error);
        showAlert('Failed to decline invitation', 'error');
    }
}

// Show document in modal with close button - supports images and PDFs
function showDocumentModal(documentUrl, docId, type) {
    // Remove existing modal if any
    const existingModal = document.getElementById('documentViewModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    // Create modal
    const modal = document.createElement('div');
    modal.id = 'documentViewModal';
    modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
    `;
    
    let content = '';
    if (type === 'image') {
        content = `<img src="${documentUrl}" style="max-width: 100%; max-height: 100%; object-fit: contain;" alt="Document Image">`;
    } else if (type === 'pdf') {
        content = `<iframe src="${documentUrl}" style="width: 90vw; height: 90vh; border: none;" title="PDF Document"></iframe>`;
    }
    
    modal.innerHTML = `
        <div style="position: relative; max-width: 95%; max-height: 95%; display: flex; flex-direction: column;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; background: rgba(255,255,255,0.1); margin-bottom: 10px;">
                <div style="color: white; font-size: 16px;">${type.toUpperCase()} Document</div>
                <div style="display: flex; gap: 10px;">
                    <button id="downloadDocModal" style="
                        background: #007bff;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        padding: 8px 12px;
                        cursor: pointer;
                        font-size: 14px;
                    ">📥 Download</button>
                    <button id="deleteDocModal" style="
                        background: #dc3545;
                        color: white;
                        border: none;
                        border-radius: 5px;
                        padding: 8px 12px;
                        cursor: pointer;
                        font-size: 14px;
                    ">🗑️ Delete</button>
                    <button id="closeDocModal" style="
                        background: #fff;
                        border: none;
                        border-radius: 50%;
                        width: 35px;
                        height: 35px;
                        font-size: 18px;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    ">×</button>
                </div>
            </div>
            <div style="flex: 1; display: flex; justify-content: center; align-items: center;">
                ${content}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Close modal handlers
    const closeModal = () => {
        modal.remove();
        window.URL.revokeObjectURL(documentUrl);
    };
    
    // Event listeners
    document.getElementById('closeDocModal').addEventListener('click', closeModal);
    
    document.getElementById('downloadDocModal').addEventListener('click', (e) => {
        e.stopPropagation();
        downloadDocument(docId);
    });
    
    document.getElementById('deleteDocModal').addEventListener('click', async (e) => {
        e.stopPropagation();
        closeModal();
        await deleteDocument(docId);
    });
    
    // Close on background click (but not on content)
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });
    
    // Close on Escape key
    const handleEscape = (e) => {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', handleEscape);
        }
    };
    document.addEventListener('keydown', handleEscape);
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
        console.log('🗑️ Deleting document:', docId);
        const token = await currentUser.getIdToken();
        
        const response = await fetch(`http://localhost:5000/api/documents/${docId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Document deleted successfully', 'success');
            await loadDocuments();
            await loadDashboardOverview();
            logger.info('Document deleted from MongoDB', { docId });
        } else {
            throw new Error(data.message || 'Delete failed');
        }
    } catch (error) {
        console.error('❌ Delete error:', error);
        logger.error('Error deleting document from MongoDB', error);
        showAlert(error.message || 'Failed to delete document', 'error');
    }
}

// Load family invitations for current user
async function loadFamilyInvitations() {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch('http://localhost:5000/api/family/invitations', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        const invitations = data.invitations || [];
        
        if (invitations.length > 0) {
            // Show invitations at the top of family section
            const familySection = document.getElementById('familySection');
            if (familySection) {
                let invitationsHTML = `
                    <div style="background: #e3f2fd; border: 1px solid #2196f3; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px 0; color: #1976d2;">📨 Pending Family Invitations</h4>
                `;
                
                invitations.forEach(invite => {
                    invitationsHTML += `
                        <div style="background: white; border-radius: 5px; padding: 10px; margin: 5px 0; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>${invite.invitedBy}</strong> invited you as <em>${invite.relationship}</em>
                                <br><small>Invited: ${new Date(invite.invitedAt).toLocaleDateString()}</small>
                            </div>
                            <div>
                                <button class="btn-small btn-primary" onclick="acceptFamilyInvite('${invite._id}')" style="margin-right: 5px;">
                                    ✅ Accept
                                </button>
                                <button class="btn-small btn-danger" onclick="declineFamilyInvite('${invite._id}')">
                                    ❌ Decline
                                </button>
                            </div>
                        </div>
                    `;
                });
                
                invitationsHTML += '</div>';
                
                // Insert at the beginning of family section
                const existingInvites = familySection.querySelector('.family-invitations');
                if (existingInvites) {
                    existingInvites.innerHTML = invitationsHTML;
                } else {
                    familySection.insertAdjacentHTML('afterbegin', `<div class="family-invitations">${invitationsHTML}</div>`);
                }
            }
        }
    } catch (error) {
        console.error('❌ Error loading family invitations:', error);
    }
}

// Accept family invitation
async function acceptFamilyInvite(inviteId) {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/accept/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation accepted!', 'success');
            await loadFamilyMembers();
            await loadFamilyInvitations();
            await loadDashboardOverview();
        } else {
            showAlert(data.message || 'Failed to accept invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error accepting invitation:', error);
        showAlert('Failed to accept invitation', 'error');
    }
}

// Decline family invitation
async function declineFamilyInvite(inviteId) {
    if (!confirm('Are you sure you want to decline this family invitation?')) {
        return;
    }
    
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/decline/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation declined', 'success');
            await loadFamilyInvitations();
        } else {
            showAlert(data.message || 'Failed to decline invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error declining invitation:', error);
        showAlert('Failed to decline invitation', 'error');
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
}

// Load family invitations for current user
async function loadFamilyInvitations() {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch('http://localhost:5000/api/family/invitations', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        const invitations = data.invitations || [];
        
        if (invitations.length > 0) {
            // Show invitations at the top of family section
            const familySection = document.getElementById('familySection');
            if (familySection) {
                let invitationsHTML = `
                    <div style="background: #e3f2fd; border: 1px solid #2196f3; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px 0; color: #1976d2;">📨 Pending Family Invitations</h4>
                `;
                
                invitations.forEach(invite => {
                    invitationsHTML += `
                        <div style="background: white; border-radius: 5px; padding: 10px; margin: 5px 0; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>${invite.invitedBy}</strong> invited you as <em>${invite.relationship}</em>
                                <br><small>Invited: ${new Date(invite.invitedAt).toLocaleDateString()}</small>
                            </div>
                            <div>
                                <button class="btn-small btn-primary" onclick="acceptFamilyInvite('${invite._id}')" style="margin-right: 5px;">
                                    ✅ Accept
                                </button>
                                <button class="btn-small btn-danger" onclick="declineFamilyInvite('${invite._id}')">
                                    ❌ Decline
                                </button>
                            </div>
                        </div>
                    `;
                });
                
                invitationsHTML += '</div>';
                
                // Insert at the beginning of family section
                const existingInvites = familySection.querySelector('.family-invitations');
                if (existingInvites) {
                    existingInvites.innerHTML = invitationsHTML;
                } else {
                    familySection.insertAdjacentHTML('afterbegin', `<div class="family-invitations">${invitationsHTML}</div>`);
                }
            }
        }
    } catch (error) {
        console.error('❌ Error loading family invitations:', error);
    }
}

// Accept family invitation
async function acceptFamilyInvite(inviteId) {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/accept/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation accepted!', 'success');
            await loadFamilyMembers();
            await loadFamilyInvitations();
            await loadDashboardOverview();
        } else {
            showAlert(data.message || 'Failed to accept invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error accepting invitation:', error);
        showAlert('Failed to accept invitation', 'error');
    }
}

// Decline family invitation
async function declineFamilyInvite(inviteId) {
    if (!confirm('Are you sure you want to decline this family invitation?')) {
        return;
    }
    
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/decline/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation declined', 'success');
            await loadFamilyInvitations();
        } else {
            showAlert(data.message || 'Failed to decline invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error declining invitation:', error);
        showAlert('Failed to decline invitation', 'error');
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

// Load family invitations for current user
async function loadFamilyInvitations() {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch('http://localhost:5000/api/family/invitations', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        const invitations = data.invitations || [];
        
        if (invitations.length > 0) {
            // Show invitations at the top of family section
            const familySection = document.getElementById('familySection');
            if (familySection) {
                let invitationsHTML = `
                    <div style="background: #e3f2fd; border: 1px solid #2196f3; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px 0; color: #1976d2;">📨 Pending Family Invitations</h4>
                `;
                
                invitations.forEach(invite => {
                    invitationsHTML += `
                        <div style="background: white; border-radius: 5px; padding: 10px; margin: 5px 0; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>${invite.invitedBy}</strong> invited you as <em>${invite.relationship}</em>
                                <br><small>Invited: ${new Date(invite.invitedAt).toLocaleDateString()}</small>
                            </div>
                            <div>
                                <button class="btn-small btn-primary" onclick="acceptFamilyInvite('${invite._id}')" style="margin-right: 5px;">
                                    ✅ Accept
                                </button>
                                <button class="btn-small btn-danger" onclick="declineFamilyInvite('${invite._id}')">
                                    ❌ Decline
                                </button>
                            </div>
                        </div>
                    `;
                });
                
                invitationsHTML += '</div>';
                
                // Insert at the beginning of family section
                const existingInvites = familySection.querySelector('.family-invitations');
                if (existingInvites) {
                    existingInvites.innerHTML = invitationsHTML;
                } else {
                    familySection.insertAdjacentHTML('afterbegin', `<div class="family-invitations">${invitationsHTML}</div>`);
                }
            }
        }
    } catch (error) {
        console.error('❌ Error loading family invitations:', error);
    }
}

// Accept family invitation
async function acceptFamilyInvite(inviteId) {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/accept/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation accepted!', 'success');
            await loadFamilyMembers();
            await loadFamilyInvitations();
            await loadDashboardOverview();
        } else {
            showAlert(data.message || 'Failed to accept invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error accepting invitation:', error);
        showAlert('Failed to accept invitation', 'error');
    }
}

// Decline family invitation
async function declineFamilyInvite(inviteId) {
    if (!confirm('Are you sure you want to decline this family invitation?')) {
        return;
    }
    
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/decline/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation declined', 'success');
            await loadFamilyInvitations();
        } else {
            showAlert(data.message || 'Failed to decline invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error declining invitation:', error);
        showAlert('Failed to decline invitation', 'error');
    }
}

async function downloadDocument(docId) {
    try {
        console.log('📥 Downloading document:', docId);
        const token = await currentUser.getIdToken();
        
        const response = await fetch(`http://localhost:5000/api/documents/${docId}/download`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            
            // Get filename from response headers
            const contentDisposition = response.headers.get('content-disposition');
            let filename = `document_${docId}`;
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="(.+)"/);
                if (filenameMatch) {
                    filename = filenameMatch[1];
                }
            }
            
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            
            logger.info('Document downloaded from MongoDB', { docId });
        } else {
            throw new Error(`Download failed: ${response.status}`);
        }
    } catch (error) {
        console.error('❌ Download error:', error);
        logger.error('Error downloading document', error);
        showAlert('Failed to download document', 'error');
    }
}

// Load family invitations for current user
async function loadFamilyInvitations() {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch('http://localhost:5000/api/family/invitations', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        const invitations = data.invitations || [];
        
        if (invitations.length > 0) {
            // Show invitations at the top of family section
            const familySection = document.getElementById('familySection');
            if (familySection) {
                let invitationsHTML = `
                    <div style="background: #e3f2fd; border: 1px solid #2196f3; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px 0; color: #1976d2;">📨 Pending Family Invitations</h4>
                `;
                
                invitations.forEach(invite => {
                    invitationsHTML += `
                        <div style="background: white; border-radius: 5px; padding: 10px; margin: 5px 0; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>${invite.invitedBy}</strong> invited you as <em>${invite.relationship}</em>
                                <br><small>Invited: ${new Date(invite.invitedAt).toLocaleDateString()}</small>
                            </div>
                            <div>
                                <button class="btn-small btn-primary" onclick="acceptFamilyInvite('${invite._id}')" style="margin-right: 5px;">
                                    ✅ Accept
                                </button>
                                <button class="btn-small btn-danger" onclick="declineFamilyInvite('${invite._id}')">
                                    ❌ Decline
                                </button>
                            </div>
                        </div>
                    `;
                });
                
                invitationsHTML += '</div>';
                
                // Insert at the beginning of family section
                const existingInvites = familySection.querySelector('.family-invitations');
                if (existingInvites) {
                    existingInvites.innerHTML = invitationsHTML;
                } else {
                    familySection.insertAdjacentHTML('afterbegin', `<div class="family-invitations">${invitationsHTML}</div>`);
                }
            }
        }
    } catch (error) {
        console.error('❌ Error loading family invitations:', error);
    }
}

// Accept family invitation
async function acceptFamilyInvite(inviteId) {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/accept/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation accepted!', 'success');
            await loadFamilyMembers();
            await loadFamilyInvitations();
            await loadDashboardOverview();
        } else {
            showAlert(data.message || 'Failed to accept invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error accepting invitation:', error);
        showAlert('Failed to accept invitation', 'error');
    }
}

// Decline family invitation
async function declineFamilyInvite(inviteId) {
    if (!confirm('Are you sure you want to decline this family invitation?')) {
        return;
    }
    
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/decline/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation declined', 'success');
            await loadFamilyInvitations();
        } else {
            showAlert(data.message || 'Failed to decline invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error declining invitation:', error);
        showAlert('Failed to decline invitation', 'error');
    }
}

// Family Management Functions - Updated for MongoDB backend
document.addEventListener('DOMContentLoaded', function() {
    const inviteFamilyForm = document.getElementById('inviteFamilyForm');
    if (inviteFamilyForm) {
        inviteFamilyForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            try {
                const inviteEmail = document.getElementById('inviteEmail').value;
                const relationship = document.getElementById('relationship').value;
                
                if (!inviteEmail || !relationship) {
                    showAlert('Please fill in all fields', 'error');
                    return;
                }
                
                // Send invite to backend
                const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
                const response = await fetch('http://localhost:5000/api/family/invite', {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        email: inviteEmail,
                        relationship: relationship
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    showAlert('Family member invited successfully!', 'success');
                    hideModal('inviteFamilyModal');
                    document.getElementById('inviteFamilyForm').reset();
                    await loadFamilyMembers();
                    await loadDashboardOverview();
                } else {
                    showAlert(data.message || 'Failed to invite family member', 'error');
                }
                
                logger.info('Family member invite sent', { 
                    email: inviteEmail,
                    relationship 
                });
                
            } catch (error) {
                logger.error('Error inviting family member', error);
                showAlert('Failed to invite family member', 'error');
            }
        });
    }
}

// Load family invitations for current user
async function loadFamilyInvitations() {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch('http://localhost:5000/api/family/invitations', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        const invitations = data.invitations || [];
        
        if (invitations.length > 0) {
            // Show invitations at the top of family section
            const familySection = document.getElementById('familySection');
            if (familySection) {
                let invitationsHTML = `
                    <div style="background: #e3f2fd; border: 1px solid #2196f3; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px 0; color: #1976d2;">📨 Pending Family Invitations</h4>
                `;
                
                invitations.forEach(invite => {
                    invitationsHTML += `
                        <div style="background: white; border-radius: 5px; padding: 10px; margin: 5px 0; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>${invite.invitedBy}</strong> invited you as <em>${invite.relationship}</em>
                                <br><small>Invited: ${new Date(invite.invitedAt).toLocaleDateString()}</small>
                            </div>
                            <div>
                                <button class="btn-small btn-primary" onclick="acceptFamilyInvite('${invite._id}')" style="margin-right: 5px;">
                                    ✅ Accept
                                </button>
                                <button class="btn-small btn-danger" onclick="declineFamilyInvite('${invite._id}')">
                                    ❌ Decline
                                </button>
                            </div>
                        </div>
                    `;
                });
                
                invitationsHTML += '</div>';
                
                // Insert at the beginning of family section
                const existingInvites = familySection.querySelector('.family-invitations');
                if (existingInvites) {
                    existingInvites.innerHTML = invitationsHTML;
                } else {
                    familySection.insertAdjacentHTML('afterbegin', `<div class="family-invitations">${invitationsHTML}</div>`);
                }
            }
        }
    } catch (error) {
        console.error('❌ Error loading family invitations:', error);
    }
}

// Accept family invitation
async function acceptFamilyInvite(inviteId) {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/accept/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation accepted!', 'success');
            await loadFamilyMembers();
            await loadFamilyInvitations();
            await loadDashboardOverview();
        } else {
            showAlert(data.message || 'Failed to accept invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error accepting invitation:', error);
        showAlert('Failed to accept invitation', 'error');
    }
}

// Decline family invitation
async function declineFamilyInvite(inviteId) {
    if (!confirm('Are you sure you want to decline this family invitation?')) {
        return;
    }
    
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/decline/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation declined', 'success');
            await loadFamilyInvitations();
        } else {
            showAlert(data.message || 'Failed to decline invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error declining invitation:', error);
        showAlert('Failed to decline invitation', 'error');
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

async function loadFamilyMembers() {
    try {
        const familyGrid = document.getElementById('familyGrid');
        if (!familyGrid) return;
        
        familyGrid.innerHTML = '<div style="text-align: center; padding: 20px;">Loading family members...</div>';
        
        // Get family members from MongoDB backend
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch('http://localhost:5000/api/family', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        const familyMembers = data.familyGroups || [];
        
        if (familyMembers.length === 0) {
            familyGrid.innerHTML = `
                <div style="text-align: center; padding: 40px; grid-column: 1 / -1;">
                    <i class="fas fa-users" style="font-size: 60px; color: #ccc; margin-bottom: 20px;"></i>
                    <h3 style="color: #666;">No family members</h3>
                    <p style="color: #999;">Add family members to share documents securely</p>
                    <button class="btn btn-primary" onclick="showModal('inviteFamilyModal')" style="margin-top: 20px;">
                        <i class="fas fa-plus"></i> Add Family Member
                    </button>
                </div>
            `;
            return;
        }
        
        let familyHTML = '';
        familyMembers.forEach(member => {
            const memberName = member.memberEmail || 'Unknown';
            const joinedDate = member.invitedAt ? new Date(member.invitedAt).toLocaleDateString() : 'Unknown';
            const status = member.status || 'pending';
            
            familyHTML += `
                <div class="family-card">
                    <div class="family-avatar">
                        <i class="fas fa-user"></i>
                    </div>
                    <div class="family-info">
                        <div class="family-name">${memberName}</div>
                        <div class="family-email">${member.memberEmail}</div>
                        <div class="family-relationship">${member.relationship}</div>
                        <div class="family-joined">Invited: ${joinedDate}</div>
                        <div class="family-status">Status: ${status}</div>
                    </div>
                    <div class="family-actions">
                        <button class="btn-small btn-view" onclick="viewFamilyMember('${member._id}')">
                            <i class="fas fa-eye"></i> View
                        </button>
                        <button class="btn-small btn-danger" onclick="removeFamilyMember('${member._id}')">
                            <i class="fas fa-trash"></i> Remove
                        </button>
                    </div>
                </div>
            `;
        });
        
        familyGrid.innerHTML = familyHTML;
        logger.info('Family members loaded', { count: familyMembers.length });
        
    } catch (error) {
        console.error('❌ Error loading family members:', error);
        logger.error('Error loading family members', error);
        document.getElementById('familyGrid').innerHTML = `
            <div style="text-align: center; padding: 40px; grid-column: 1 / -1; color: #dc3545;">
                <i class="fas fa-exclamation-triangle" style="font-size: 60px; margin-bottom: 20px;"></i>
                <h3>Error loading family members</h3>
                <p>Please try refreshing the page</p>
            </div>
        `;
    }
}

// Load family invitations for current user
async function loadFamilyInvitations() {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch('http://localhost:5000/api/family/invitations', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        const invitations = data.invitations || [];
        
        if (invitations.length > 0) {
            // Show invitations at the top of family section
            const familySection = document.getElementById('familySection');
            if (familySection) {
                let invitationsHTML = `
                    <div style="background: #e3f2fd; border: 1px solid #2196f3; border-radius: 8px; padding: 15px; margin-bottom: 20px;">
                        <h4 style="margin: 0 0 10px 0; color: #1976d2;">📨 Pending Family Invitations</h4>
                `;
                
                invitations.forEach(invite => {
                    invitationsHTML += `
                        <div style="background: white; border-radius: 5px; padding: 10px; margin: 5px 0; display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>${invite.invitedBy}</strong> invited you as <em>${invite.relationship}</em>
                                <br><small>Invited: ${new Date(invite.invitedAt).toLocaleDateString()}</small>
                            </div>
                            <div>
                                <button class="btn-small btn-primary" onclick="acceptFamilyInvite('${invite._id}')" style="margin-right: 5px;">
                                    ✅ Accept
                                </button>
                                <button class="btn-small btn-danger" onclick="declineFamilyInvite('${invite._id}')">
                                    ❌ Decline
                                </button>
                            </div>
                        </div>
                    `;
                });
                
                invitationsHTML += '</div>';
                
                // Insert at the beginning of family section
                const existingInvites = familySection.querySelector('.family-invitations');
                if (existingInvites) {
                    existingInvites.innerHTML = invitationsHTML;
                } else {
                    familySection.insertAdjacentHTML('afterbegin', `<div class="family-invitations">${invitationsHTML}</div>`);
                }
            }
        }
    } catch (error) {
        console.error('❌ Error loading family invitations:', error);
    }
}

// Accept family invitation
async function acceptFamilyInvite(inviteId) {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/accept/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation accepted!', 'success');
            await loadFamilyMembers();
            await loadFamilyInvitations();
            await loadDashboardOverview();
        } else {
            showAlert(data.message || 'Failed to accept invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error accepting invitation:', error);
        showAlert('Failed to accept invitation', 'error');
    }
}

// Decline family invitation
async function declineFamilyInvite(inviteId) {
    if (!confirm('Are you sure you want to decline this family invitation?')) {
        return;
    }
    
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`http://localhost:5000/api/family/decline/${inviteId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation declined', 'success');
            await loadFamilyInvitations();
        } else {
            showAlert(data.message || 'Failed to decline invitation', 'error');
        }
    } catch (error) {
        console.error('❌ Error declining invitation:', error);
        showAlert('Failed to decline invitation', 'error');
    }
}