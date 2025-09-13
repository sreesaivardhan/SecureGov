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

    async clearAllFamilyData() {
        try {
            console.log('🧹 Starting COMPLETE data cleanup...');
            const token = await firebase.auth().currentUser.getIdToken();
            const response = await fetch(`${API_BASE_URL}/api/family/cleanup`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                console.log('✅ COMPLETE cleanup result:', data);
                this.showToast('All old family data cleared successfully', 'success');
            }
        } catch (error) {
            console.warn('⚠️ Cleanup failed:', error);
        }
    }

    async loadFamilyGroups() {
        try {
            console.log('🔄 Loading family groups...');
            console.log('🔍 Current user:', firebase.auth().currentUser);
            
            // Clear all old data first
            await this.clearAllFamilyData();
            
            const token = await firebase.auth().currentUser.getIdToken();
            console.log('🔑 Token obtained, making API call...');
            
            const response = await fetch(`${API_BASE_URL}/family/members`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            console.log('📡 API Response status:', response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('❌ API Error response:', errorText);
                throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            console.log('📊 RAW Family data received:', JSON.stringify(data, null, 2));
            console.log('📊 Members array:', data.members);
            
            if (data.members && Array.isArray(data.members)) {
                console.log('🔍 DETAILED MEMBER ANALYSIS:');
                data.members.forEach((member, index) => {
                    console.log(`📋 Member ${index} RAW DATA:`, member);
                    console.log(`📋 Member ${index} memberName:`, typeof member.memberName, '|', member.memberName);
                    console.log(`📋 Member ${index} memberEmail:`, typeof member.memberEmail, '|', member.memberEmail);
                    console.log(`📋 Member ${index} name:`, typeof member.name, '|', member.name);
                    console.log(`📋 Member ${index} email:`, typeof member.email, '|', member.email);
                    console.log(`📋 Member ${index} relationship:`, typeof member.relationship, '|', member.relationship);
                    console.log(`📋 Member ${index} status:`, typeof member.status, '|', member.status);
                    console.log('---');
                });
            }

            if (data.success && data.members) {
                this.familyGroups = data.members; // Store the data
                this.renderFamilyGroups(); // Use the existing render method
                this.updateMemberCount(data.members.length);
            } else {
                console.log('⚠️ No members found or API call failed');
                this.showEmptyState('No family members found. Start by inviting someone!');
            }
        } catch (error) {
            console.error('❌ Error loading family groups:', error);
            console.error('❌ Error stack:', error.stack);
            this.showEmptyState('Failed to load family members. Please try again.');
        }
    }

    async checkPendingInvitations() {
        try {
            const response = await this.apiCall('/family/invitations');
            
            if (response.success) {
                // Filter invitations for current user's email
                this.pendingInvitations = response.invitations.filter(inv => 
                    inv.email === this.currentUser.email && inv.status === 'pending'
                );
                this.updateInvitationBadge();
                
                if (this.pendingInvitations.length > 0) {
                    document.getElementById('pendingInvitationsAlert').style.display = 'block';
                    this.showInvitationNotificationBar();
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
        const container = document.getElementById('familyMembersList');
        
        if (!this.familyGroups || this.familyGroups.length === 0) {
            this.showEmptyState('No family members found. Invite your first family member to get started!');
            return;
        }

        container.innerHTML = '';

        this.familyGroups.forEach(member => {
            const card = this.createFamilyMemberCard(member);
            container.appendChild(card);
        });
    }

    createFamilyMemberCard(member) {
        console.log('🎨 Creating card for member:', member); // Debug log
        console.log('🎨 Member object keys:', Object.keys(member));
        console.log('🎨 Member memberName value:', member.memberName, 'type:', typeof member.memberName);
        console.log('🎨 Member memberEmail value:', member.memberEmail, 'type:', typeof member.memberEmail);
        
        const card = document.createElement('div');
        card.className = 'family-member-card fade-in';

        const addedDate = member.addedAt ? new Date(member.addedAt).toLocaleDateString() : 'Recently';

        // STEP BY STEP name extraction with detailed logging
        let memberName = 'Unknown Member';
        
        console.log('🔍 STEP 1: Checking member.memberName...');
        if (member.memberName) {
            console.log('🔍 memberName exists:', member.memberName);
            if (member.memberName !== 'undefined') {
                console.log('🔍 memberName is not string "undefined"');
                if (member.memberName.trim && member.memberName.trim()) {
                    memberName = member.memberName.trim();
                    console.log('✅ SUCCESS: Using memberName:', memberName);
                } else {
                    console.log('❌ memberName.trim() failed or empty');
                }
            } else {
                console.log('❌ memberName is string "undefined"');
            }
        } else {
            console.log('❌ memberName does not exist');
        }
        
        if (memberName === 'Unknown Member') {
            console.log('🔍 STEP 2: Checking member.name...');
            if (member.name && member.name !== 'undefined' && member.name.trim()) {
                memberName = member.name.trim();
                console.log('✅ SUCCESS: Using name:', memberName);
            } else {
                console.log('❌ member.name failed');
            }
        }
        
        if (memberName === 'Unknown Member') {
            console.log('🔍 STEP 3: Extracting from memberEmail...');
            if (member.memberEmail && member.memberEmail.includes('@')) {
                memberName = member.memberEmail.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                console.log('✅ SUCCESS: Extracted from memberEmail:', memberName);
            } else {
                console.log('❌ memberEmail extraction failed');
            }
        }
        
        if (memberName === 'Unknown Member') {
            console.log('🔍 STEP 4: Extracting from email...');
            if (member.email && member.email.includes('@')) {
                memberName = member.email.split('@')[0].replace(/[._-]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                console.log('✅ SUCCESS: Extracted from email:', memberName);
            } else {
                console.log('❌ email extraction failed');
            }
        }
        
        if (memberName === 'Unknown Member') {
            memberName = 'Family Member';
            console.log('⚠️ FALLBACK: Using default name:', memberName);
        }
        
        console.log('🎯 FINAL memberName for display:', memberName);
        console.log('🎯 About to render card with name:', memberName);

        // Extract email with validation
        let memberEmail = 'No email';
        if (member.memberEmail && member.memberEmail !== 'undefined' && member.memberEmail.includes('@')) {
            memberEmail = member.memberEmail;
        } else if (member.email && member.email !== 'undefined' && member.email.includes('@')) {
            memberEmail = member.email;
        }

        // Extract relationship
        let relationship = 'Family Member';
        if (member.relationship && member.relationship !== 'undefined' && member.relationship.trim()) {
            relationship = member.relationship.charAt(0).toUpperCase() + member.relationship.slice(1);
        }

        // Extract status
        let status = 'Active';
        if (member.status && member.status !== 'undefined' && member.status.trim()) {
            status = member.status.charAt(0).toUpperCase() + member.status.slice(1);
        }

        console.log('🎭 Creating card for member:', { memberName, memberEmail, relationship, status, rawMember: member });

        card.innerHTML = `
            <div class="member-header">
                <div class="member-avatar">
                    ${memberName.charAt(0).toUpperCase()}
                </div>
                <div class="member-info">
                    <h3>${memberName}</h3>
                    <p>${memberEmail}</p>
                    <span class="relationship-badge">${relationship}</span>
                </div>
            </div>
            
            <div class="member-meta">
                <small>Added: ${addedDate}</small>
                <small>Status: ${status}</small>
            </div>
            <div class="member-actions">
                ${status === 'pending' ? 
                    `<button class="action-btn secondary" onclick="familyManager.cancelInvitation('${member._id}')">Cancel</button>` :
                    `<button class="action-btn danger" onclick="familyManager.removeFamilyMember('${member._id}')">Remove</button>`
                }
            </div>
        `;
        
        return card;
    }

    getUserRole(group) {
        const member = group.members.find(m => m.userId === this.currentUser.uid && m.status === 'active');
        return member ? member.role : 'unknown';
    }

    showEmptyState(message) {
        const container = document.getElementById('familyMembersList');
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
        // Invite family member form
        const inviteFamilyForm = document.getElementById('inviteFamilyForm');
        if (inviteFamilyForm) {
            inviteFamilyForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.inviteFamilyMember();
            });
        }

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchTab(tabName);
            });
        });
    }

    openInviteFamilyModal() {
        const modal = document.getElementById('inviteFamilyModal');
        if (modal) {
            modal.style.display = 'block';
            modal.classList.add('active');
        }
    }

    closeInviteFamilyModal() {
        const modal = document.getElementById('inviteFamilyModal');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('active');
            // Reset form
            const form = document.getElementById('inviteFamilyForm');
            if (form) form.reset();
        }
    }

    checkPendingInvitations() {
        this.showPendingInvitations();
    }

    showPendingInvitations() {
        const modal = document.getElementById('pendingInvitationsModal');
        if (modal) {
            modal.style.display = 'block';
            modal.classList.add('active');
            this.renderPendingInvitations();
        }
    }

    closePendingInvitationsModal() {
        const modal = document.getElementById('pendingInvitationsModal');
        if (modal) {
            modal.style.display = 'none';
            modal.classList.remove('active');
        }
    }

    renderPendingInvitations() {
        const container = document.getElementById('pendingInvitationsList');
        if (!container) return;

        if (!this.pendingInvitations || this.pendingInvitations.length === 0) {
            container.innerHTML = '<p class="empty-message">No pending invitations.</p>';
            return;
        }

        container.innerHTML = '';
        this.pendingInvitations.forEach(invitation => {
            const card = document.createElement('div');
            card.className = 'invitation-card';
            
            const inviterName = invitation.inviterName || invitation.inviterEmail || 'Someone';
            const relationship = invitation.relationship || 'family member';
            
            card.innerHTML = `
                <div class="invitation-info">
                    <h4>Family Invitation</h4>
                    <p><strong>${inviterName}</strong> invited you to join their family as a <strong>${relationship}</strong></p>
                    <small>Sent: ${new Date(invitation.createdAt).toLocaleDateString()}</small>
                </div>
                <div class="invitation-actions">
                    <button class="btn btn-success btn-sm" onclick="familyManager.acceptInvitation('${invitation.token}')">
                        <i class="fas fa-check"></i> Accept
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="familyManager.rejectInvitation('${invitation.token}')">
                        <i class="fas fa-times"></i> Decline
                    </button>
                </div>
            `;
            
            container.appendChild(card);
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
                        <h4>Family Invitation</h4>
                        <span class="invitation-status pending">Pending</span>
                    </div>
                    
                    <div class="invitation-meta">
                        <div class="meta-row">
                            <i class="fas fa-user"></i>
                            <span>Invited by: ${invitation.inviterName || invitation.invitedBy || 'Unknown'}</span>
                        </div>
                        <div class="meta-row">
                            <i class="fas fa-user-tag"></i>
                            <span>Relationship: ${invitation.relationship || 'Family Member'}</span>
                        </div>
                        <div class="meta-row">
                            <i class="fas fa-calendar"></i>
                            <span>Expires: ${new Date(invitation.expiresAt).toLocaleDateString()}</span>
                        </div>
                        <div class="meta-row">
                            <i class="fas fa-envelope"></i>
                            <span>Your email: ${invitation.email}</span>
                        </div>
                    </div>
                    
                    <div class="invitation-actions">
                        <button class="btn btn-success" onclick="familyManager.acceptInvitation('${invitation.token}')">
                            <i class="fas fa-check"></i> Accept
                        </button>
                        <button class="btn btn-danger" onclick="familyManager.rejectInvitation('${invitation.token}')">
                            <i class="fas fa-times"></i> Reject
                        </button>
                    </div>
                `;
                
                container.appendChild(card);
            });
        }
        
        this.openPendingInvitationsModal();
    }

    async forceCleanupFamilyData() {
        try {
            console.log('🧹 Force cleaning family data...');
            
            // Call cleanup endpoint
            const response = await this.apiCall('/family/cleanup', 'DELETE');
            
            if (response.success) {
                console.log('✅ Family data cleaned successfully');
                this.showToast('Family data cleaned successfully', 'success');
                
                // Clear local data
                this.familyGroups = [];
                this.pendingInvitations = [];
                
                return true;
            }
        } catch (error) {
            console.error('❌ Failed to cleanup family data:', error);
            this.showToast('Failed to cleanup family data', 'error');
            return false;
        } finally {
            this.showLoading(false);
        }
    }

    async acceptInvitation(token) {
        try {
            this.showLoading(true);
            
            const response = await this.apiCall(`/family/accept/${token}`, {
                method: 'POST'
            });
            
            if (response.success) {
                this.showToast('Invitation accepted successfully!', 'success');
                this.closePendingInvitationsModal();
                this.hideInvitationNotificationBar();
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
                this.hideInvitationNotificationBar();
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

    showInvitationNotificationBar() {
        // Remove existing notification bar if any
        const existing = document.getElementById('invitationNotificationBar');
        if (existing) {
            existing.remove();
        }

        if (this.pendingInvitations.length === 0) return;

        const notificationBar = document.createElement('div');
        notificationBar.id = 'invitationNotificationBar';
        notificationBar.className = 'invitation-notification-bar';
        
        const invitation = this.pendingInvitations[0]; // Show first invitation
        const inviterName = invitation.inviterName || invitation.invitedBy || 'Someone';
        const relationship = invitation.relationship || 'family member';
        
        notificationBar.innerHTML = `
            <div class="notification-content">
                <div class="notification-icon">
                    <i class="fas fa-envelope"></i>
                </div>
                <div class="notification-text">
                    <strong>${inviterName}</strong> invited you to join their family
                    <span class="relationship-info">as ${relationship}</span>
                </div>
                <div class="notification-actions">
                    <button class="btn btn-success btn-sm" onclick="familyManager.acceptInvitation('${invitation.token}')">
                        <i class="fas fa-check"></i> Accept
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="familyManager.rejectInvitation('${invitation.token}')">
                        <i class="fas fa-times"></i> Reject
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="familyManager.hideInvitationNotificationBar()">
                        <i class="fas fa-times"></i> Dismiss
                    </button>
                </div>
            </div>
        `;

        // Insert after header
        const header = document.querySelector('.header');
        header.insertAdjacentElement('afterend', notificationBar);
    }

    hideInvitationNotificationBar() {
        const notificationBar = document.getElementById('invitationNotificationBar');
        if (notificationBar) {
            notificationBar.remove();
        }
    }

    async removeFamilyMember(memberId) {
        if (!confirm('Are you sure you want to remove this family member?')) {
            return;
        }

        try {
            this.showLoading(true);
            
            const response = await this.apiCall(`/family/members/${memberId}`, {
                method: 'DELETE'
            });
            
            if (response.success) {
                this.showToast('Family member removed successfully!', 'success');
                await this.loadFamilyGroups();
            }
        } catch (error) {
            console.error('Remove family member failed:', error);
            this.showToast('Failed to remove family member: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async inviteFamilyMember() {
        try {
            this.showLoading(true);
            
            const response = await this.apiCall(`/family/accept/${token}`, {
                method: 'POST'
            });
            
            if (response.success) {
                this.showToast('Invitation accepted successfully!', 'success');
                await this.loadFamilyGroups();
                await this.checkPendingInvitations();
                this.hideInvitationNotificationBar();
            }
        } catch (error) {
            console.error('Accept invitation failed:', error);
            this.showToast('Failed to accept invitation: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async rejectInvitation(token) {
        try {
            this.showLoading(true);
            
            const response = await this.apiCall(`/family/reject-invitation/${token}`, {
                method: 'POST'
            });
            
            if (response.success) {
                this.showToast('Invitation rejected', 'info');
                await this.checkPendingInvitations();
                this.hideInvitationNotificationBar();
            }
        } catch (error) {
            console.error('Reject invitation failed:', error);
            this.showToast('Failed to reject invitation: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async cancelInvitation(invitationId) {
        try {
            this.showLoading(true);
            
            const response = await this.apiCall(`/family/invitations/${invitationId}`, {
                method: 'DELETE'
            });
            
            if (response.success) {
                this.showToast('Invitation cancelled', 'info');
                await this.loadFamilyGroups();
            }
        } catch (error) {
            console.error('Cancel invitation failed:', error);
            this.showToast('Failed to cancel invitation: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
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
function openInviteFamilyModal() {
    document.getElementById('inviteFamilyModal').style.display = 'block';
}

function closeInviteFamilyModal() {
    document.getElementById('inviteFamilyModal').style.display = 'none';
    document.getElementById('inviteFamilyForm').reset();
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

// Accept invitation function
async function acceptInvitation(token) {
    if (window.familyManager) {
        await window.familyManager.acceptInvitation(token);
    }
}

// Reject invitation function
async function rejectInvitation(token) {
    if (window.familyManager) {
        await window.familyManager.rejectInvitation(token);
    }
}

function logout() {
    firebase.auth().signOut().then(() => {
        window.location.href = '../index.html';
    }).catch((error) => {
        console.error('Logout error:', error);
    });
}

// Global functions for HTML onclick handlers
function openInviteFamilyModal() {
    if (window.familyManager) {
        window.familyManager.openInviteFamilyModal();
    }
}

function closeInviteFamilyModal() {
    if (window.familyManager) {
        window.familyManager.closeInviteFamilyModal();
    }
}

function checkPendingInvitations() {
    if (window.familyManager) {
        window.familyManager.checkPendingInvitations();
    }
}

function showPendingInvitations() {
    if (window.familyManager) {
        window.familyManager.showPendingInvitations();
    }
}

function closePendingInvitationsModal() {
    if (window.familyManager) {
        window.familyManager.closePendingInvitationsModal();
    }
}

function logout() {
    firebase.auth().signOut().then(() => {
        window.location.href = '../index.html';
    });
}

// Initialize family manager when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.familyManager = new FamilyManager();
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
