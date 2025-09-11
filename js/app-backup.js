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

// Modal Functions
function showModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
}

function hideModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

// Add Family Member function
function addFamilyMember() {
    showModal('inviteFamilyModal');
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

// Family invitation form handler
document.addEventListener('DOMContentLoaded', function() {
    const inviteFamilyForm = document.getElementById('inviteFamilyForm');
    if (inviteFamilyForm) {
        // Handle invite family form submission
        inviteFamilyForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            // Prevent multiple submissions
            const submitButton = this.querySelector('button[type="submit"]');
            if (submitButton && submitButton.disabled) {
                return;
            }
            
            const inviteEmail = document.getElementById('inviteEmail').value.trim();
            const relationship = document.getElementById('inviteRelationship').value;
            
            if (!inviteEmail || !relationship) {
                showAlert('Please fill in all fields', 'error');
                return;
            }
            
            // Disable submit button to prevent multiple submissions
            if (submitButton) {
                submitButton.disabled = true;
                submitButton.textContent = 'Sending...';
            }

            try {
                // Call the invitation function
                const data = await sendFamilyInvitation(inviteEmail, relationship);
                
                if (data.success) {
                    showAlert('Family member invited successfully!', 'success');
                    hideModal('inviteFamilyModal');
                    this.reset();
                    
                    // Reload family data
                    await loadFamilyInvitations();
                    await loadFamilyMembers();
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

// Family invitation function
async function sendFamilyInvitation(email, relationship) {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        
        // First, get or create a family group
        let groupId = await getOrCreateFamilyGroup();
        
        const payload = {
            email: email,
            role: 'member' // Backend expects 'role' field
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
            showAlert('Family invitation sent successfully!', 'success');
            return data;
        } else {
            throw new Error(data.message || 'Failed to send invitation');
        }
        
    } catch (error) {
        console.error('❌ Error sending invitation:', error);
        throw error;
    }
}

// Helper function to get or create a family group
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
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                name: 'My Family',
                                description: 'Family group for document sharing'
                            })
                        });
                        
                        if (createResponse.ok) {
                            const createData = await createResponse.json();
                            if (createData.success) {
                                return createData.familyGroup._id;
                            }
                        }
                        
                        throw new Error('Failed to get or create family group');
                        
                    } catch (error) {
                        console.error('Error getting/creating family group:', error);
                        throw error;
                    }
                }
                
                const data = await sendFamilyInvitation(inviteEmail, relationship);
                
                if (data.success) {
                    showAlert('Family member invited successfully!', 'success');
                    hideModal('inviteFamilyModal');
                    document.getElementById('inviteFamilyForm').reset();
                    
                    // Force refresh all family data immediately
                    console.log('🔄 Refreshing family data after invitation...');
                    
                    // Update dashboard stats immediately
                    await loadDashboardOverview();
                    
                    // Update family sections if visible
                    const familySection = document.getElementById('familySection');
                    const familyGrid = document.getElementById('familyGrid');
                    
                    if (familySection || familyGrid) {
                        await loadFamilyMembers();
                        await loadFamilyInvitations();
                    }
                    
                    // Update family groups preview on dashboard
                    const familyGroupsPreview = document.getElementById('familyGroupsPreview');
                    if (familyGroupsPreview) {
                        await loadFamilyGroupsPreview();
                    }
                    
                    console.log('✅ Family data refreshed successfully');
                } else {
                    showAlert(data.message || 'Failed to send invitation. Please try again.', 'error');
                }
                
            } catch (error) {
                console.error('Error sending family invitation:', error);
                showAlert('Failed to send invitation. Please try again.', 'error');
            }
        });
    }
});

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
        const response = await fetch(`${API_BASE_URL}/users/sync`, {
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
            loadFamilyInvitations();
        } else if (section === 'profile') {
            loadUserProfile();
        } else if (section === 'overview') {
            loadDashboardOverview();
        } else if (section === 'upload') {
            // Upload section is already visible, no additional loading needed
        }
    }
}

// User Profile Functions
async function loadUserProfile() {
    try {
        if (!currentUser) return;
        
        const userDisplayName = currentUser.displayName || currentUser.email?.split('@')[0] || 'User';
        const userEmail = currentUser.email || '';
        const userPhone = currentUser.phoneNumber || '';
        
        // Update profile fields
        const profileNameEl = document.getElementById('profileName');
        const profileEmailEl = document.getElementById('profileEmail');
        const profilePhoneEl = document.getElementById('profilePhone');
        const profileAadhaarEl = document.getElementById('profileAadhaar');
        
        if (profileNameEl) profileNameEl.value = userDisplayName;
        if (profileEmailEl) profileEmailEl.value = userEmail;
        if (profilePhoneEl) profilePhoneEl.value = userPhone;
        if (profileAadhaarEl) profileAadhaarEl.value = 'XXXX-XXXX-1234'; // Mock Aadhaar
        
        logger.info('User profile loaded');
    } catch (error) {
        logger.error('Profile loading error', error);
    }
}

// Logout function
function logout() {
    if (confirm('Are you sure you want to logout?')) {
        auth.signOut().then(() => {
            logger.info('User logged out');
            showAlert('Logged out successfully', 'success');
        }).catch((error) => {
            logger.error('Logout error', error);
            showAlert('Error logging out', 'error');
        });
    }
}

// File Upload Functions
function triggerFileInput() {
    document.getElementById('fileInput').click();
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        selectedFile = file;
        const uploadArea = document.querySelector('.upload-area');
        if (uploadArea) {
            uploadArea.innerHTML = `
                <div class="upload-icon">
                    <i class="fas fa-file-alt"></i>
                </div>
                <h3>File Selected: ${file.name}</h3>
                <p>Size: ${formatFileSize(file.size)}</p>
            `;
        }
    }
}

// Alert System
function showAlert(message, type = 'info') {
    const alertContainer = document.getElementById('alertContainer');
    if (!alertContainer) return;
    
    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentElement.remove()" class="alert-close">&times;</button>
    `;
    
    alertContainer.appendChild(alert);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (alert.parentElement) {
            alert.remove();
        }
    }, 5000);
}

// Utility Functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getDocumentIcon(category) {
    const icons = {
        'aadhaar': 'fa-id-card',
        'pan': 'fa-credit-card',
        'passport': 'fa-passport',
        'license': 'fa-id-badge',
        'marksheet': 'fa-graduation-cap',
        'certificate': 'fa-certificate',
        'other': 'fa-file-alt'
    };
    return icons[category] || 'fa-file-alt';
}

// Document Management Functions
async function loadDocuments() {
    const documentsGrid = document.getElementById('documentsGrid');
    if (!documentsGrid) return;
    
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`${API_BASE_URL}/documents`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
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
                        <button onclick="viewDocument('${doc._id}', '${doc.mimeType}', '${doc.title}')" class="btn-icon" title="View">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button onclick="downloadDocument('${doc._id}', '${doc.title}')" class="btn-icon" title="Download">
                            <i class="fas fa-download"></i>
                        </button>
                        <button onclick="deleteDocument('${doc._id}')" class="btn-icon delete" title="Delete">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `).join('');
        }
    } catch (error) {
        console.error('Error loading documents:', error);
        showAlert('Failed to load documents', 'error');
    }
}

// Enhanced document viewing with PDF modal support
async function viewDocument(docId, mimeType, title) {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        
        if (mimeType && mimeType.includes('pdf')) {
            // Open PDF in modal viewer
            const response = await fetch(`http://localhost:5000/api/documents/${docId}/download`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const blob = await response.blob();
                const pdfUrl = URL.createObjectURL(blob);
                
                // Create PDF modal
                const modal = document.createElement('div');
                modal.className = 'document-modal active';
                modal.innerHTML = `
                    <div class="modal-content pdf-viewer">
                        <div class="modal-header">
                            <h3>${title}</h3>
                            <div class="modal-actions">
                                <button onclick="downloadDocument('${docId}', '${title}')" class="btn-secondary">
                                    <i class="fas fa-download"></i> Download
                                </button>
                                <button onclick="closeDocumentModal()" class="btn-close">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        </div>
                        <div class="pdf-container">
                            <iframe src="${pdfUrl}" width="100%" height="600px" frameborder="0"></iframe>
                        </div>
                    </div>
                `;
                
                document.body.appendChild(modal);
                
                // Add escape key listener
                const escapeHandler = (e) => {
                    if (e.key === 'Escape') {
                        closeDocumentModal();
                        document.removeEventListener('keydown', escapeHandler);
                    }
                };
                document.addEventListener('keydown', escapeHandler);
                
            } else {
                throw new Error('Failed to load PDF');
            }
        } else if (mimeType && mimeType.includes('image')) {
            // Open image in modal
            const response = await fetch(`http://localhost:5000/api/documents/${docId}/download`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (response.ok) {
                const blob = await response.blob();
                const imageUrl = URL.createObjectURL(blob);
                
                const modal = document.createElement('div');
                modal.className = 'document-modal active';
                modal.innerHTML = `
                    <div class="modal-content image-viewer">
                        <div class="modal-header">
                            <h3>${title}</h3>
                            <div class="modal-actions">
                                <button onclick="downloadDocument('${docId}', '${title}')" class="btn-secondary">
                                    <i class="fas fa-download"></i> Download
                                </button>
                                <button onclick="deleteDocument('${docId}')" class="btn-danger">
                                    <i class="fas fa-trash"></i> Delete
                                </button>
                                <button onclick="closeDocumentModal()" class="btn-close">
                                    <i class="fas fa-times"></i>
                                </button>
                            </div>
                        </div>
                        <div class="image-container">
                            <img src="${imageUrl}" alt="${title}" style="max-width: 100%; max-height: 70vh; object-fit: contain;">
                        </div>
                    </div>
                `;
                
                document.body.appendChild(modal);
                
                // Add escape key listener
                const escapeHandler = (e) => {
                    if (e.key === 'Escape') {
                        closeDocumentModal();
                        document.removeEventListener('keydown', escapeHandler);
                    }
                };
                document.addEventListener('keydown', escapeHandler);
                
            } else {
                throw new Error('Failed to load image');
            }
        } else {
            // For other file types, trigger download
            downloadDocument(docId, title);
        }
    } catch (error) {
        console.error('Error viewing document:', error);
        showAlert('Failed to view document', 'error');
    }
}

function closeDocumentModal() {
    const modal = document.querySelector('.document-modal');
    if (modal) {
        modal.remove();
    }
}

async function downloadDocument(docId, title) {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        
        const response = await fetch(`http://localhost:5000/api/documents/${docId}/download`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = title || 'document';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            showAlert('Document downloaded successfully', 'success');
        } else {
            throw new Error('Download failed');
        }
    } catch (error) {
        console.error('Error downloading document:', error);
        showAlert('Failed to download document', 'error');
    }
}

async function deleteDocument(docId) {
    if (!confirm('Are you sure you want to delete this document?')) {
        return;
    }
    
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        
        const response = await fetch(`${API_BASE_URL}/documents/${docId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Document deleted successfully', 'success');
            loadDocuments(); // Refresh the list
            loadDashboardOverview(); // Update dashboard stats
            closeDocumentModal(); // Close modal if open
        } else {
            throw new Error(data.message || 'Delete failed');
        }
    } catch (error) {
        console.error('Error deleting document:', error);
        showAlert('Failed to delete document', 'error');
    }
}

// Clear any existing family data to prevent stale invitations
function clearFamilyData() {
    const familyGrid = document.getElementById('familyGrid');
    if (familyGrid) {
        familyGrid.innerHTML = '';
    }
    
    const familySection = document.getElementById('familySection');
    if (familySection) {
        const existingInvites = familySection.querySelector('.family-invitations');
        if (existingInvites) {
            existingInvites.remove();
        }
    }
    
    // Clear localStorage cache if any
    localStorage.removeItem('familyInvitations');
    localStorage.removeItem('familyMembers');
}

// Force clear all old invitation data
function forceResetFamilyData() {
    // Remove all invitation elements
    document.querySelectorAll('.invitation-item').forEach(el => el.remove());
    document.querySelectorAll('.family-invitations').forEach(el => el.remove());
    
    // Clear family grid
    const familyGrid = document.getElementById('familyGrid');
    if (familyGrid) {
        familyGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <p>No family members yet. Invite your family to get started!</p>
            </div>
        `;
    }
    
    // Clear all storage
    localStorage.clear();
    sessionStorage.clear();
    
    showAlert('Family data cleared. Please refresh the page.', 'info');
}

// Call this function on page load to clear any problematic data
document.addEventListener('DOMContentLoaded', function() {
    // Clear any problematic invitation tokens on load
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('clearFamily') === 'true') {
        forceResetFamilyData();
    }
});

// Remove a specific invitation
async function removeInvitation(inviteToken) {
    if (!confirm('Are you sure you want to remove this invitation?')) {
        return;
    }
    
    // Clear the invitation from UI immediately
    const invitationElement = document.querySelector(`[onclick*="${inviteToken}"]`);
    if (invitationElement) {
        const inviteCard = invitationElement.closest('.invitation-item');
        if (inviteCard) {
            inviteCard.remove();
        }
    }
    
    showAlert('Invitation removed from display', 'info');
}

// Family Management Functions
async function loadFamilyInvitations() {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        
        const response = await fetch(`${API_BASE_URL}/family/invitations/pending`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        let data = null;
        if (response.ok) {
            data = await response.json();
        }
        
        clearFamilyData();
        
        const invitations = data && data.invitations ? data.invitations : [];
        
        const familySection = document.getElementById('familySection');
        if (!familySection) return;
        
        if (invitations.length > 0) {
            let invitationsHTML = `
                <div class="family-invitations">
                    <h4>📨 Pending Family Invitations</h4>
            `;
            
            invitations.forEach(invite => {
                // Ensure invitationToken exists
                const token = invite.invitationToken || invite.token || invite._id;
                if (!token) {
                    console.warn('Invitation missing token:', invite);
                    return;
                }
                
                invitationsHTML += `
                    <div class="invitation-item">
                        <div class="invitation-info">
                            <strong>${invite.invitedBy || 'Someone'}</strong> invited you to join <strong>${invite.familyGroupName || 'Family Group'}</strong>
                            <br><small>Role: ${invite.role || 'Member'} | Invited: ${new Date(invite.createdAt || Date.now()).toLocaleDateString()}</small>
                        </div>
                        <div class="invitation-actions">
                            <button class="btn-small btn-primary" onclick="acceptFamilyInvite('${token}')">
                                Accept
                            </button>
                            <button class="btn-small btn-danger" onclick="declineFamilyInvite('${token}')">
                                Decline
                            </button>
                            <button class="btn-small btn-secondary" onclick="removeInvitation('${token}')">
                                Remove
                            </button>
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

async function acceptFamilyInvite(inviteToken) {
    if (!inviteToken || inviteToken === 'undefined') {
        showAlert('Invalid invitation token. Please refresh the page.', 'error');
        return;
    }
    
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        
        const response = await fetch(`${API_BASE_URL}/family/accept-invitation/${inviteToken}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Accept invitation failed:', response.status, errorText);
            throw new Error(`Server error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation accepted successfully!', 'success');
            // Clear and reload family data
            clearFamilyData();
            setTimeout(() => {
                loadFamilyInvitations();
                loadFamilyMembers();
            }, 500);
            return data;
        } else {
            throw new Error(data.message || 'Failed to accept invitation');
        }
        
    } catch (error) {
        console.error('❌ Error accepting invitation:', error);
        showAlert(error.message || 'Failed to accept invitation. Please try again.', 'error');
    }
}

async function declineFamilyInvite(inviteToken) {
    if (!inviteToken || inviteToken === 'undefined') {
        showAlert('Invalid invitation token. Please refresh the page.', 'error');
        return;
    }
    
    if (!confirm('Are you sure you want to decline this family invitation?')) {
        return;
    }
    
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        
        const response = await fetch(`${API_BASE_URL}/family/reject-invitation/${inviteToken}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Decline invitation failed:', response.status, errorText);
            throw new Error(`Server error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Family invitation declined.', 'info');
            // Clear and reload family data
            clearFamilyData();
            loadFamilyInvitations();
            return data;
        } else {
            throw new Error(data.message || 'Failed to decline invitation');
        }
        
    } catch (error) {
        console.error('❌ Error declining invitation:', error);
        showAlert(error.message || 'Failed to decline invitation. Please try again.', 'error');
    }
}

async function loadFamilyMembers() {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        
        const response = await fetch(`${API_BASE_URL}/family/my-groups`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        let data = null;
        if (response.ok) {
            data = await response.json();
        }
        
        const familyGrid = document.getElementById('familyGrid');
        
        if (familyGrid && data && data.success) {
            const familyGroups = data.familyGroups || [];
            let allMembers = [];
            let currentGroupId = null;
            
            // Extract all members from all family groups
            familyGroups.forEach(group => {
                if (group.members && group.members.length > 0) {
                    currentGroupId = group._id; // Store group ID for removal operations
                    allMembers = allMembers.concat(group.members.map(member => ({
                        ...member,
                        groupId: group._id,
                        groupName: group.name
                    })));
                }
            });
            
            if (allMembers.length === 0) {
                familyGrid.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-users"></i>
                        <p>No family members yet. Invite your family to get started!</p>
                    </div>
                `;
            } else {
                familyGrid.innerHTML = allMembers.map(member => `
                    <div class="family-member-card">
                        <div class="member-info">
                            <h4>${member.email || member.displayName}</h4>
                            <p><strong>Role:</strong> ${member.role}</p>
                            <p><strong>Group:</strong> ${member.groupName}</p>
                            <p><strong>Joined:</strong> ${member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : 'Pending'}</p>
                        </div>
                        <div class="member-actions">
                            <button onclick="removeFamilyMember('${member.groupId}', '${member.userId}')" class="btn-small btn-danger">Remove Member</button>
                        </div>
                    </div>
                `).join('');
            }
            
            // Update dashboard family count
            updateFamilyStats(allMembers);
        }
    } catch (error) {
        console.error('Error loading family members:', error);
        const familyGrid = document.getElementById('familyGrid');
        if (familyGrid) {
            familyGrid.innerHTML = `
                <div class="error-message">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Failed to load family members</p>
                </div>
            `;
        }
    }
}

// Remove Family Member function
async function removeFamilyMember(groupId, memberId) {
    if (!confirm('Are you sure you want to remove this family member?')) {
        return;
    }
    
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        
        const response = await fetch(`${API_BASE_URL}/family/${groupId}/members/${memberId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (response.ok && data.success) {
            showAlert('Family member removed successfully!', 'success');
            // Reload family data
            loadFamilyMembers();
            return data;
        } else {
            throw new Error(data.message || 'Failed to remove family member');
        }
        
    } catch (error) {
        console.error('❌ Error removing family member:', error);
        showAlert('Failed to remove family member. Please try again.', 'error');
    }
}

// Update family stats on dashboard
function updateFamilyStats(members) {
    const familyCountElement = document.getElementById('familyCount');
    
    if (familyCountElement) {
        const activeMembers = members.filter(m => m.status === 'active').length;
        familyCountElement.textContent = activeMembers;
    }
    
    console.log('📊 Dashboard stats updated:', {
        totalMembers: members.length,
        activeMembers: members.filter(m => m.status === 'active').length,
        pendingMembers: members.filter(m => m.status === 'pending').length
    });
}

async function initializeDashboard() {
    try {
        if (!currentUser) return;
        
        const userDisplayName = currentUser.displayName || currentUser.email?.split('@')[0] || 'User';
        const userEmail = currentUser.email || '';
        const userPhone = currentUser.phoneNumber || '';
        
        // Update profile fields if they exist
        const profileNameEl = document.getElementById('profileName');
        const profileEmailEl = document.getElementById('profileEmail');
        const profilePhoneEl = document.getElementById('profilePhone');
        
        if (profileNameEl) profileNameEl.value = userDisplayName;
        if (profileEmailEl) profileEmailEl.value = userEmail;
        if (profilePhoneEl) profilePhoneEl.value = userPhone;
        
        // Update welcome message
        const welcomeEl = document.querySelector('.welcome-message h2');
        if (welcomeEl) {
            welcomeEl.textContent = `Welcome back, ${userDisplayName}!`;
        }
        
        loadDashboardOverview();
        logger.info('Dashboard initialized');
    } catch (error) {
        logger.error('Dashboard initialization error', error);
    }
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal')) {
        const modalId = e.target.id;
        hideModal(modalId);
    }
});

// Close modal with escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const openModal = document.querySelector('.modal[style*="block"]');
        if (openModal) {
            hideModal(openModal.id);
        }
    }
});

// Initialize dashboard when shown
function initializeDashboardSection() {
    // Load family data when dashboard is shown
    loadFamilyMembers();
    loadFamilyInvitations();
    loadFamilyGroupsPreview();
}

// Load family groups preview for dashboard
async function loadFamilyGroupsPreview() {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`${API_BASE_URL}/family/my-groups`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        console.log('👥 Family groups loaded:', data);
        
        const previewContainer = document.getElementById('familyGroupsPreview');
        if (previewContainer && data.success) {
            const groups = data.familyGroups || [];
            
            if (groups.length === 0) {
                previewContainer.innerHTML = `
                    <div class="no-data" style="text-align: center; padding: 20px; color: #6b7280;">
                        <i class="fas fa-users" style="font-size: 2rem; margin-bottom: 10px;"></i>
                        <p>No family groups yet. Create your first group!</p>
                        <button onclick="showModal('inviteFamilyModal')" class="btn btn-primary" style="margin-top: 10px;">
                            <i class="fas fa-plus"></i> Add Family Member
                        </button>
                    </div>
                `;
            } else {
                previewContainer.innerHTML = groups.slice(0, 3).map(group => `
                    <div class="family-group-card" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 15px; margin-bottom: 10px;">
                        <div class="family-group-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <h4 style="margin: 0; color: #1f2937;">${group.memberEmail}</h4>
                            <span class="status-badge status-${group.status}" style="padding: 4px 8px; border-radius: 12px; font-size: 0.75rem; font-weight: 500;">
                                ${group.status}
                            </span>
                        </div>
                        <p style="margin: 0; color: #6b7280; font-size: 0.9rem;">
                            <strong>Relationship:</strong> ${group.relationship}<br>
                            <strong>Invited:</strong> ${new Date(group.invitedAt).toLocaleDateString()}
                        </p>
                    </div>
                `).join('');
            }
        }
    } catch (error) {
        console.error('Error loading family groups preview:', error);
        const previewContainer = document.getElementById('familyGroupsPreview');
        if (previewContainer) {
            previewContainer.innerHTML = `
                <div class="error-message" style="text-align: center; padding: 20px; color: #dc2626;">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Failed to load family groups</p>
                </div>
            `;
        }
    }
}

async function loadDashboardOverview() {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        const response = await fetch(`${API_BASE_URL}/documents/stats`, {
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
                const totalDocsElement = document.getElementById('totalDocs');
                const sharedDocsElement = document.getElementById('sharedDocs');
                const familyCountElement = document.getElementById('familyCount');
                
                if (totalDocsElement) totalDocsElement.textContent = `${data.stats.totalDocuments || 0} documents`;
                if (sharedDocsElement) sharedDocsElement.textContent = `${data.stats.sharedDocuments || 0} documents`;
                if (familyCountElement) familyCountElement.textContent = `${data.stats.familyMembers || 0} members`;
                
                console.log('📊 Dashboard stats updated:', data.stats);
            }
        }
    } catch (error) {
        console.error('Error loading dashboard stats:', error);
    }
}

function loadUserProfile() {
    if (!currentUser) return;
    
    // Load real user data from Firebase
    const profileName = document.getElementById('profileName');
    const profileEmail = document.getElementById('profileEmail');
    const profilePhone = document.getElementById('profilePhone');
    
    if (profileName) profileName.value = currentUser.displayName || currentUser.email?.split('@')[0] || 'User';
    if (profileEmail) profileEmail.value = currentUser.email || '';
    if (profilePhone) profilePhone.value = currentUser.phoneNumber || '';
}

// Utility Functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

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

// Alert System
function showAlert(message, type = 'success') {
    const alertContainer = document.getElementById('alertContainer') || document.body;
    const alertId = 'alert_' + Date.now();
    
    const alertHTML = `
        <div id="${alertId}" class="alert alert-${type} show" style="position: fixed; top: 20px; right: 20px; z-index: 10000; padding: 15px; border-radius: 5px; color: white; background: ${type === 'success' ? '#28a745' : '#dc3545'};">
            <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-triangle'}"></i>
            ${message}
        </div>
    `;
    
    alertContainer.insertAdjacentHTML('beforeend', alertHTML);
    logger.info('Alert shown', { message, type });
    
    setTimeout(() => {
        const alert = document.getElementById(alertId);
        if (alert) alert.remove();
    }, 5000);
}

// Authentication Functions
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

// Missing Functions
function addFamilyMember() {
    showAlert('Add family member functionality would open here', 'info');
}

function triggerFileInput() {
    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.click();
    }
}

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        selectedFile = file;
        const uploadArea = document.querySelector('.upload-area');
        if (uploadArea) {
            uploadArea.innerHTML = `
                <div class="upload-icon">
                    <i class="fas fa-file-check"></i>
                </div>
                <h3>File Selected: ${file.name}</h3>
                <p>Size: ${(file.size / 1024 / 1024).toFixed(2)} MB</p>
            `;
        }
        console.log('File selected:', file.name);
    }
}

// Event Listeners
document.addEventListener('DOMContentLoaded', function() {
    // Document upload form
    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm) {
        uploadForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const fileInput = document.getElementById('fileInput');
            const docName = document.getElementById('docName');
            const docType = document.getElementById('docType');
            const docDescription = document.getElementById('docDescription');
            
            console.log('File input element:', fileInput);
            console.log('Files:', fileInput ? fileInput.files : 'no element');
            console.log('Selected file variable:', selectedFile);
            
            if (!fileInput || !fileInput.files[0]) {
                showAlert('Please select a file to upload', 'error');
                return;
            }
            
            if (!docName || !docName.value.trim()) {
                showAlert('Please enter a document name', 'error');
                return;
            }
            
            const uploadBtn = document.querySelector('#uploadForm button[type="submit"]');
            const originalText = uploadBtn ? uploadBtn.textContent : 'Upload Document';
            
            try {
                if (uploadBtn) uploadBtn.textContent = 'Uploading...';
                
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
                    const documentsSection = document.getElementById('documentsSection');
                    if (documentsSection && documentsSection.style.display !== 'none') {
                        loadDocuments();
                    }
                    
                    // Update dashboard stats
                    loadDashboardOverview();
                } else {
                    showAlert(data.message || 'Upload failed', 'error');
                }
            } catch (error) {
                console.error('Upload error:', error);
                showAlert('Upload failed. Please try again.', 'error');
            } finally {
                if (uploadBtn) uploadBtn.textContent = originalText;
            }
        });
    }
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('loginBtnText');
            const loader = document.getElementById('loginLoader');
            
            try {
                if (submitBtn) submitBtn.classList.add('hidden');
                if (loader) loader.classList.remove('hidden');
                
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
                if (submitBtn) submitBtn.classList.remove('hidden');
                if (loader) loader.classList.add('hidden');
            }
        });
    }
    
    // Register form
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = document.getElementById('registerBtnText');
            const loader = document.getElementById('registerLoader');
            
            try {
                if (submitBtn) submitBtn.classList.add('hidden');
                if (loader) loader.classList.remove('hidden');
                
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
                
                logger.info('User registered successfully', { uid: userCredential.user.uid });
                showAlert('Account created successfully!', 'success');
                
            } catch (error) {
                logger.error('Registration error', error);
                showAlert(error.message, 'error');
            } finally {
                if (submitBtn) submitBtn.classList.remove('hidden');
                if (loader) loader.classList.add('hidden');
            }
        });
    }
});
