// Family Groups Management JavaScript

class FamilyManager {
    constructor() {
        this.currentUser = null;
        this.familyGroups = [];
        this.currentGroupId = null;
        this.pendingInvitations = [];
        
        this.init();
    }

    async init() {
        await this.checkAuth();
        await this.loadFamilyGroups();
        await this.checkPendingInvitations();
        this.setupEventListeners();
    }

    async checkAuth() {
        return new Promise((resolve) => {
            firebase.auth().onAuthStateChanged((user) => {
                if (!user) {
                    window.location.href = '../index.html';
                    return;
                }
                this.currentUser = user;
                resolve();
            });
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
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('API call failed:', error);
            this.showToast('API call failed: ' + error.message, 'error');
            throw error;
        }
    }

    async loadFamilyGroups() {
        try {
            this.showLoading(true);
            
            const response = await this.apiCall('/family/my-groups');
            
            if (response.success) {
                this.familyGroups = response.familyGroups;
                this.renderFamilyGroups();
            }
        } catch (error) {
            console.error('Failed to load family groups:', error);
            this.showEmptyState('Failed to load family groups');
        } finally {
            this.showLoading(false);
        }
    }

    async checkPendingInvitations() {
        try {
            const response = await this.apiCall('/family/invitations/pending');
            
            if (response.success) {
                this.pendingInvitations = response.invitations;
                this.updateInvitationBadge();
                
                if (this.pendingInvitations.length > 0) {
                    document.getElementById('pendingInvitationsAlert').style.display = 'block';
                }
            }
        } catch (error) {
            console.error('Failed to check pending invitations:', error);
        }
    }

    updateInvitationBadge() {
        const badge = document.getElementById('invitationBadge');
        badge.textContent = this.pendingInvitations.length;
        badge.style.display = this.pendingInvitations.length > 0 ? 'inline' : 'none';
    }

    renderFamilyGroups() {
        const container = document.getElementById('familyGroupsContainer');
        
        if (!this.familyGroups || this.familyGroups.length === 0) {
            this.showEmptyState('No family groups found. Create your first family group to get started!');
            return;
        }

        container.innerHTML = '';

        this.familyGroups.forEach(group => {
            const card = this.createFamilyGroupCard(group);
            container.appendChild(card);
        });
    }

    createFamilyGroupCard(group) {
        const card = document.createElement('div');
        card.className = 'family-group-card fade-in';
        
        const userRole = this.getUserRole(group);
        const createdDate = new Date(group.createdAt).toLocaleDateString();
        
        card.innerHTML = `
            <div class="group-header">
                <div class="group-info">
                    <h3>${group.name}</h3>
                    <p>${group.description || 'No description provided'}</p>
                </div>
                <span class="group-role ${userRole}">${userRole}</span>
            </div>
            
            <div class="group-stats">
                <div class="stat-item">
                    <span class="number">${group.statistics.totalMembers}</span>
                    <span class="label">Members</span>
                </div>
                <div class="stat-item">
                    <span class="number">${group.statistics.totalDocuments}</span>
                    <span class="label">Documents</span>
                </div>
                <div class="stat-item">
                    <span class="number">${group.pendingInvitationsCount || 0}</span>
                    <span class="label">Pending</span>
                </div>
            </div>
            
            <div class="group-meta">
                <small>Created: ${createdDate}</small>
            </div>
            
            <div class="group-actions">
                <button class="action-btn primary" onclick="familyManager.viewGroupDetails('${group._id}')">
                    <i class="fas fa-eye"></i> View Details
                </button>
                ${userRole === 'admin' ? `
                <button class="action-btn secondary" onclick="familyManager.editGroup('${group._id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="action-btn danger" onclick="familyManager.deleteGroup('${group._id}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
                ` : `
                <button class="action-btn secondary" onclick="familyManager.leaveGroup('${group._id}')">
                    <i class="fas fa-sign-out-alt"></i> Leave
                </button>
                `}
            </div>
        `;
        
        return card;
    }

    getUserRole(group) {
        const member = group.members.find(m => m.userId === this.currentUser.uid && m.status === 'active');
        return member ? member.role : 'unknown';
    }

    showEmptyState(message) {
        const container = document.getElementById('familyGroupsContainer');
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <h3>No Family Groups</h3>
                <p>${message}</p>
                <button class="btn btn-primary" onclick="openCreateGroupModal()">
                    <i class="fas fa-plus"></i> Create Your First Family Group
                </button>
            </div>
        `;
    }

    setupEventListeners() {
        // Create group form
        document.getElementById('createGroupForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createFamilyGroup();
        });

        // Invite member form
        document.getElementById('inviteMemberForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.inviteMember();
        });

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });
    }

    async createFamilyGroup() {
        try {
            this.showLoading(true);
            
            const formData = new FormData(document.getElementById('createGroupForm'));
            const groupData = {
                name: formData.get('name'),
                description: formData.get('description'),
                settings: {
                    allowMemberInvites: formData.get('allowMemberInvites') === 'on',
                    autoAcceptInvites: formData.get('autoAcceptInvites') === 'on',
                    maxMembers: parseInt(formData.get('maxMembers')) || 10
                }
            };

            const response = await this.apiCall('/family/create', {
                method: 'POST',
                body: JSON.stringify(groupData)
            });
            
            if (response.success) {
                this.showToast('Family group created successfully!', 'success');
                this.closeCreateGroupModal();
                await this.loadFamilyGroups();
            }
        } catch (error) {
            console.error('Create family group failed:', error);
            this.showToast('Failed to create family group: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async viewGroupDetails(groupId) {
        try {
            this.currentGroupId = groupId;
            this.showLoading(true);
            
            const response = await this.apiCall(`/family/${groupId}`);
            
            if (response.success) {
                this.populateGroupDetails(response.familyGroup);
                this.openGroupDetailsModal();
            }
        } catch (error) {
            console.error('Failed to load group details:', error);
            this.showToast('Failed to load group details', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    populateGroupDetails(group) {
        document.getElementById('groupDetailsTitle').innerHTML = 
            `<i class="fas fa-users"></i> ${group.name}`;
        
        // Populate members
        this.renderMembers(group.members);
        
        // Populate invitations
        this.renderInvitations(group.invitations);
        
        // Populate settings
        this.renderSettings(group);
    }

    renderMembers(members) {
        const container = document.getElementById('membersList');
        
        if (!members || members.length === 0) {
            container.innerHTML = '<p class="empty-message">No members found.</p>';
            return;
        }

        container.innerHTML = '';
        
        members.filter(m => m.status === 'active').forEach(member => {
            const memberItem = document.createElement('div');
            memberItem.className = 'member-item';
            
            const isCurrentUser = member.userId === this.currentUser.uid;
            const canManage = this.canManageMember(member);
            
            memberItem.innerHTML = `
                <div class="member-info">
                    <div class="member-avatar">
                        ${member.displayName.charAt(0).toUpperCase()}
                    </div>
                    <div class="member-details">
                        <h5>${member.displayName} ${isCurrentUser ? '(You)' : ''}</h5>
                        <p>${member.email}</p>
                        <small>Joined: ${new Date(member.joinedAt).toLocaleDateString()}</small>
                    </div>
                </div>
                <div class="member-role-actions">
                    <span class="member-role-badge ${member.role}">${member.role}</span>
                    ${canManage ? `
                    <div class="member-actions">
                        <button class="action-btn secondary btn-sm" onclick="familyManager.changeRole('${member.userId}')">
                            <i class="fas fa-user-cog"></i> Change Role
                        </button>
                        <button class="action-btn danger btn-sm" onclick="familyManager.removeMember('${member.userId}')">
                            <i class="fas fa-user-minus"></i> Remove
                        </button>
                    </div>
                    ` : ''}
                </div>
            `;
            
            container.appendChild(memberItem);
        });
    }

    renderInvitations(invitations) {
        const container = document.getElementById('invitationsList');
        
        const pendingInvitations = invitations.filter(inv => inv.status === 'pending');
        
        if (!pendingInvitations || pendingInvitations.length === 0) {
            container.innerHTML = '<p class="empty-message">No pending invitations.</p>';
            return;
        }

        container.innerHTML = '';
        
        pendingInvitations.forEach(invitation => {
            const invitationItem = document.createElement('div');
            invitationItem.className = 'invitation-item';
            
            invitationItem.innerHTML = `
                <div class="invitation-info">
                    <h5>${invitation.email}</h5>
                    <p>Role: ${invitation.role}</p>
                    <p>Invited by: ${invitation.invitedByName}</p>
                    <small>Sent: ${new Date(invitation.createdAt).toLocaleDateString()}</small>
                    <small>Expires: ${new Date(invitation.expiresAt).toLocaleDateString()}</small>
                </div>
                <div class="invitation-actions">
                    <span class="invitation-status ${invitation.status}">${invitation.status}</span>
                    <button class="action-btn danger btn-sm" onclick="familyManager.cancelInvitation('${invitation.invitationToken}')">
                        <i class="fas fa-times"></i> Cancel
                    </button>
                </div>
            `;
            
            container.appendChild(invitationItem);
        });
    }

    renderSettings(group) {
        const container = document.getElementById('groupSettingsForm');
        const isAdmin = this.getUserRole(group) === 'admin';
        
        container.innerHTML = `
            <div class="form-group">
                <label for="settingsName">Group Name</label>
                <input type="text" id="settingsName" value="${group.name}" ${!isAdmin ? 'disabled' : ''}>
            </div>
            
            <div class="form-group">
                <label for="settingsDescription">Description</label>
                <textarea id="settingsDescription" rows="3" ${!isAdmin ? 'disabled' : ''}>${group.description || ''}</textarea>
            </div>
            
            <div class="form-group">
                <label>Group Settings</label>
                <div class="checkbox-group">
                    <label class="checkbox-label">
                        <input type="checkbox" id="settingsAllowInvites" ${group.settings.allowMemberInvites ? 'checked' : ''} ${!isAdmin ? 'disabled' : ''}>
                        <span class="checkmark"></span>
                        Allow members to invite others
                    </label>
                    <label class="checkbox-label">
                        <input type="checkbox" id="settingsAutoAccept" ${group.settings.autoAcceptInvites ? 'checked' : ''} ${!isAdmin ? 'disabled' : ''}>
                        <span class="checkmark"></span>
                        Auto-accept invitations
                    </label>
                </div>
            </div>
            
            <div class="form-group">
                <label for="settingsMaxMembers">Maximum Members</label>
                <input type="number" id="settingsMaxMembers" min="2" max="50" value="${group.settings.maxMembers}" ${!isAdmin ? 'disabled' : ''}>
            </div>
            
            ${isAdmin ? `
            <div class="form-group">
                <button type="button" class="btn btn-primary" onclick="familyManager.updateGroupSettings()">
                    <i class="fas fa-save"></i> Save Settings
                </button>
            </div>
            ` : ''}
        `;
    }

    canManageMember(member) {
        const currentGroup = this.familyGroups.find(g => g._id === this.currentGroupId);
        if (!currentGroup) return false;
        
        const currentUserRole = this.getUserRole(currentGroup);
        return currentUserRole === 'admin' && member.userId !== this.currentUser.uid;
    }

    async inviteMember() {
        try {
            this.showLoading(true);
            
            const formData = new FormData(document.getElementById('inviteMemberForm'));
            const inviteData = {
                email: formData.get('email'),
                role: formData.get('role') // Backend expects 'role' field
            };

            const response = await this.apiCall(`/family/${this.currentGroupId}/invite`, {
                method: 'POST',
                body: JSON.stringify(inviteData)
            });
            
            if (response.success) {
                this.showToast('Invitation sent successfully!', 'success');
                this.closeInviteMemberModal();
                await this.viewGroupDetails(this.currentGroupId); // Refresh details
            }
        } catch (error) {
            console.error('Invite member failed:', error);
            this.showToast('Failed to send invitation: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async removeMember(memberId) {
        if (!confirm('Are you sure you want to remove this member from the family group?')) {
            return;
        }

        try {
            this.showLoading(true);
            
            const response = await this.apiCall(`/family/${this.currentGroupId}/members/${memberId}`, {
                method: 'DELETE'
            });
            
            if (response.success) {
                this.showToast('Member removed successfully!', 'success');
                await this.viewGroupDetails(this.currentGroupId); // Refresh details
            }
        } catch (error) {
            console.error('Remove member failed:', error);
            this.showToast('Failed to remove member: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async updateGroupSettings() {
        try {
            this.showLoading(true);
            
            const settingsData = {
                name: document.getElementById('settingsName').value,
                description: document.getElementById('settingsDescription').value,
                settings: {
                    allowMemberInvites: document.getElementById('settingsAllowInvites').checked,
                    autoAcceptInvites: document.getElementById('settingsAutoAccept').checked,
                    maxMembers: parseInt(document.getElementById('settingsMaxMembers').value)
                }
            };

            const response = await this.apiCall(`/family/${this.currentGroupId}`, {
                method: 'PUT',
                body: JSON.stringify(settingsData)
            });
            
            if (response.success) {
                this.showToast('Group settings updated successfully!', 'success');
                await this.loadFamilyGroups(); // Refresh list
                await this.viewGroupDetails(this.currentGroupId); // Refresh details
            }
        } catch (error) {
            console.error('Update settings failed:', error);
            this.showToast('Failed to update settings: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async showPendingInvitations() {
        const container = document.getElementById('pendingInvitationsList');
        
        if (!this.pendingInvitations || this.pendingInvitations.length === 0) {
            container.innerHTML = '<p class="empty-message">No pending invitations.</p>';
        } else {
            container.innerHTML = '';
            
            this.pendingInvitations.forEach(invitation => {
                const card = document.createElement('div');
                card.className = 'pending-invitation-card';
                
                card.innerHTML = `
                    <div class="invitation-header">
                        <h4>${invitation.familyGroupName}</h4>
                        <span class="invitation-status pending">Pending</span>
                    </div>
                    
                    <div class="invitation-meta">
                        <div class="meta-row">
                            <i class="fas fa-user"></i>
                            <span>Invited by: ${invitation.invitedBy}</span>
                        </div>
                        <div class="meta-row">
                            <i class="fas fa-user-tag"></i>
                            <span>Role: ${invitation.role}</span>
                        </div>
                        <div class="meta-row">
                            <i class="fas fa-calendar"></i>
                            <span>Expires: ${new Date(invitation.expiresAt).toLocaleDateString()}</span>
                        </div>
                        ${invitation.familyGroupDescription ? `
                        <div class="meta-row">
                            <i class="fas fa-info-circle"></i>
                            <span>${invitation.familyGroupDescription}</span>
                        </div>
                        ` : ''}
                    </div>
                    
                    <div class="invitation-actions">
                        <button class="btn btn-success" onclick="familyManager.acceptInvitation('${invitation.invitationToken}')">
                            <i class="fas fa-check"></i> Accept
                        </button>
                        <button class="btn btn-danger" onclick="familyManager.rejectInvitation('${invitation.invitationToken}')">
                            <i class="fas fa-times"></i> Reject
                        </button>
                    </div>
                `;
                
                container.appendChild(card);
            });
        }
        
        this.openPendingInvitationsModal();
    }

    async acceptInvitation(token) {
        try {
            this.showLoading(true);
            
            const response = await this.apiCall(`/family/accept-invitation/${token}`, {
                method: 'POST'
            });
            
            if (response.success) {
                this.showToast('Invitation accepted successfully!', 'success');
                this.closePendingInvitationsModal();
                await this.loadFamilyGroups();
                await this.checkPendingInvitations();
            }
        } catch (error) {
            console.error('Accept invitation failed:', error);
            this.showToast('Failed to accept invitation: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async rejectInvitation(token) {
        if (!confirm('Are you sure you want to reject this invitation?')) {
            return;
        }

        try {
            this.showLoading(true);
            
            const response = await this.apiCall(`/family/reject-invitation/${token}`, {
                method: 'POST'
            });
            
            if (response.success) {
                this.showToast('Invitation rejected', 'info');
                await this.checkPendingInvitations();
                await this.showPendingInvitations(); // Refresh modal
            }
        } catch (error) {
            console.error('Reject invitation failed:', error);
            this.showToast('Failed to reject invitation: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    switchTab(tabName) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`${tabName}Tab`).classList.add('active');
    }

    // Modal functions
    openCreateGroupModal() {
        document.getElementById('createGroupModal').style.display = 'block';
    }

    closeCreateGroupModal() {
        document.getElementById('createGroupModal').style.display = 'none';
        document.getElementById('createGroupForm').reset();
    }

    openGroupDetailsModal() {
        document.getElementById('groupDetailsModal').style.display = 'block';
    }

    closeGroupDetailsModal() {
        document.getElementById('groupDetailsModal').style.display = 'none';
        this.currentGroupId = null;
    }

    openInviteMemberModal() {
        document.getElementById('inviteMemberModal').style.display = 'block';
    }

    closeInviteMemberModal() {
        document.getElementById('inviteMemberModal').style.display = 'none';
        document.getElementById('inviteMemberForm').reset();
    }

    openPendingInvitationsModal() {
        document.getElementById('pendingInvitationsModal').style.display = 'block';
    }

    closePendingInvitationsModal() {
        document.getElementById('pendingInvitationsModal').style.display = 'none';
    }

    showLoading(show) {
        document.getElementById('loadingSpinner').style.display = show ? 'block' : 'none';
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>${message}</span>
                <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; font-size: 1.2rem; cursor: pointer;">&times;</button>
            </div>
        `;
        
        document.getElementById('toastContainer').appendChild(toast);
        
        // Auto remove after 5 seconds
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 5000);
    }
}

// Global functions for HTML onclick handlers
function openCreateGroupModal() {
    familyManager.openCreateGroupModal();
}

function closeCreateGroupModal() {
    familyManager.closeCreateGroupModal();
}

function closeGroupDetailsModal() {
    familyManager.closeGroupDetailsModal();
}

function openInviteMemberModal() {
    familyManager.openInviteMemberModal();
}

function closeInviteMemberModal() {
    familyManager.closeInviteMemberModal();
}

function closePendingInvitationsModal() {
    familyManager.closePendingInvitationsModal();
}

function checkPendingInvitations() {
    familyManager.checkPendingInvitations();
}

function showPendingInvitations() {
    familyManager.showPendingInvitations();
}

function logout() {
    firebase.auth().signOut().then(() => {
        window.location.href = '../index.html';
    }).catch((error) => {
        console.error('Logout error:', error);
    });
}

// Initialize family manager when page loads
document.addEventListener('DOMContentLoaded', () => {
    new FamilyManager();
});

// Close modals when clicking outside
window.addEventListener('click', (e) => {
    const modals = ['createGroupModal', 'groupDetailsModal', 'inviteMemberModal', 'pendingInvitationsModal'];
    
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
});
