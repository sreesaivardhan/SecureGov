// Accept Family Invitation JavaScript

class InvitationHandler {
    constructor() {
        this.currentUser = null;
        this.invitationToken = null;
        this.invitationData = null;
        
        this.init();
    }

    async init() {
        // Get token from URL
        const urlParams = new URLSearchParams(window.location.search);
        this.invitationToken = urlParams.get('token');
        
        if (!this.invitationToken) {
            this.showError('Invalid invitation link. No token provided.');
            return;
        }

        // Check authentication state
        firebase.auth().onAuthStateChanged(async (user) => {
            if (user) {
                this.currentUser = user;
                await this.loadInvitationDetails();
            } else {
                this.showLoginPrompt();
            }
        });
    }

    async getAuthToken() {
        if (this.currentUser) {
            return await this.currentUser.getIdToken();
        }
        throw new Error('User not authenticated');
    }

    async apiCall(endpoint, options = {}) {
        try {
            const token = await this.getAuthToken();
            const response = await fetch(`http://localhost:5000/api${endpoint}`, {
                ...options,
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API call failed:', error);
            throw error;
        }
    }

    async loadInvitationDetails() {
        try {
            this.showLoading(true);
            
            // Try to get invitation details by token
            // Since we don't have a specific endpoint, we'll simulate the invitation data
            // In a real implementation, you'd have an endpoint like /family/invitation/:token
            this.invitationData = {
                inviterName: 'Family Member',
                relationship: 'Family',
                invitedAt: new Date(),
                expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            };
            
            this.displayInvitationDetails();
        } catch (error) {
            console.error('Failed to load invitation details:', error);
            this.showError('Failed to load invitation details: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    displayInvitationDetails() {
        const invitation = this.invitationData;
        
        // Populate invitation details
        document.getElementById('familyName').textContent = 'SecureGov Family Group';
        document.getElementById('familyDescription').textContent = 'Join this family group to share and manage documents securely';
        document.getElementById('inviterName').textContent = invitation.inviterName;
        document.getElementById('memberRole').textContent = invitation.relationship;
        document.getElementById('invitedDate').textContent = new Date(invitation.invitedAt).toLocaleDateString();
        document.getElementById('expiryDate').textContent = new Date(invitation.expiresAt).toLocaleDateString();
        
        // Check if invitation is expiring soon (within 24 hours)
        const expiryTime = new Date(invitation.expiresAt).getTime();
        const now = new Date().getTime();
        const hoursUntilExpiry = (expiryTime - now) / (1000 * 60 * 60);
        
        if (hoursUntilExpiry < 24 && hoursUntilExpiry > 0) {
            document.getElementById('expiryWarning').style.display = 'flex';
        }
        
        // Show invitation content
        document.getElementById('invitationContent').style.display = 'block';
    }

    showLoginPrompt() {
        document.getElementById('loginPrompt').style.display = 'block';
        this.showLoading(false);
    }

    showLoading(show) {
        document.getElementById('loadingSpinner').style.display = show ? 'block' : 'none';
    }

    showError(message) {
        const errorDiv = document.getElementById('errorMessage');
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        this.showLoading(false);
    }

    showSuccess(message) {
        const successDiv = document.getElementById('successMessage');
        successDiv.textContent = message;
        successDiv.style.display = 'block';
        
        // Hide error if showing
        document.getElementById('errorMessage').style.display = 'none';
    }

    async acceptInvitation() {
        try {
            // Disable buttons during processing
            document.getElementById('acceptBtn').disabled = true;
            document.getElementById('declineBtn').disabled = true;
            
            this.showLoading(true);
            
            const response = await this.apiCall(`/family/accept/${this.invitationToken}`, {
                method: 'POST'
            });
            
            if (response.success) {
                this.showSuccess('Successfully joined the family group! Redirecting to dashboard...');
                
                // Redirect to dashboard after 2 seconds
                setTimeout(() => {
                    window.location.href = '../index.html';
                }, 2000);
            }
        } catch (error) {
            console.error('Accept invitation failed:', error);
            this.showError('Failed to accept invitation: ' + error.message);
            
            // Re-enable buttons
            document.getElementById('acceptBtn').disabled = false;
            document.getElementById('declineBtn').disabled = false;
        } finally {
            this.showLoading(false);
        }
    }

    async declineInvitation() {
        if (!confirm('Are you sure you want to decline this invitation? This action cannot be undone.')) {
            return;
        }

        try {
            // Disable buttons during processing
            document.getElementById('acceptBtn').disabled = true;
            document.getElementById('declineBtn').disabled = true;
            
            this.showLoading(true);
            
            const response = await this.apiCall(`/family/reject-invitation/${this.invitationToken}`, {
                method: 'POST'
            });
            
            if (response.success) {
                this.showSuccess('Invitation declined. You can close this page.');
                
                // Hide invitation content
                document.getElementById('invitationContent').style.display = 'none';
            }
        } catch (error) {
            console.error('Decline invitation failed:', error);
            this.showError('Failed to decline invitation: ' + error.message);
            
            // Re-enable buttons
            document.getElementById('acceptBtn').disabled = false;
            document.getElementById('declineBtn').disabled = false;
        } finally {
            this.showLoading(false);
        }
    }
}

// Global functions for HTML onclick handlers
function acceptInvitation() {
    invitationHandler.acceptInvitation();
}

function declineInvitation() {
    invitationHandler.declineInvitation();
}

// Initialize invitation handler when page loads
let invitationHandler;
document.addEventListener('DOMContentLoaded', () => {
    invitationHandler = new InvitationHandler();
});
