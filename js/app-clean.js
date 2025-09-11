// SecureGov Family Management - Clean Version
const API_BASE_URL = 'http://localhost:5000/api';

// Logger utility
const logger = {
    info: (message, data) => console.log(`[INFO] ${new Date().toISOString()}: ${message}`, data || ''),
    error: (message, data) => console.error(`[ERROR] ${new Date().toISOString()}: ${message}`, data || ''),
    warn: (message, data) => console.warn(`[WARN] ${new Date().toISOString()}: ${message}`, data || '')
};

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

// Load family invitations
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
                            <button onclick="removeInvitation('${token}')" class="btn-remove">Remove</button>
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
            clearFamilyData();
            setTimeout(() => {
                loadFamilyInvitations();
                loadFamilyMembers();
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
            clearFamilyData();
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

// Remove invitation from UI
async function removeInvitation(inviteToken) {
    if (!confirm('Are you sure you want to remove this invitation?')) {
        return;
    }
    
    const invitationElement = document.querySelector(`[onclick*="${inviteToken}"]`);
    if (invitationElement) {
        const inviteCard = invitationElement.closest('.invitation-item');
        if (inviteCard) {
            inviteCard.remove();
        }
    }
    
    showAlert('Invitation removed from display', 'info');
}

// Clear family data
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
    
    localStorage.removeItem('familyInvitations');
    localStorage.removeItem('familyMembers');
}

// Load family members
async function loadFamilyMembers() {
    try {
        const token = currentUser ? await currentUser.getIdToken() : localStorage.getItem('firebaseToken');
        
        const endpoints = [
            `${API_BASE_URL}/family/my-groups`,
            `${API_BASE_URL}/family/members`,
            `${API_BASE_URL}/family`
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
        
        if (response && response.ok) {
            const data = await response.json();
            if (data.success && data.familyGroups) {
                displayFamilyMembers(data.familyGroups);
            }
        }
        
    } catch (error) {
        console.error('❌ Error loading family members:', error);
    }
}

// Display family members
function displayFamilyMembers(familyGroups) {
    const familyGrid = document.getElementById('familyGrid');
    if (!familyGrid) return;
    
    if (!familyGroups || familyGroups.length === 0) {
        familyGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-users"></i>
                <p>No family members yet. Invite your family to get started!</p>
            </div>
        `;
        return;
    }
    
    let membersHTML = '';
    familyGroups.forEach(group => {
        if (group.members && group.members.length > 0) {
            group.members.forEach(member => {
                if (member.status === 'active') {
                    membersHTML += `
                        <div class="family-member-card">
                            <div class="member-info">
                                <h4>${member.displayName || member.email}</h4>
                                <p>Role: ${member.role || 'Member'}</p>
                                <p>Joined: ${new Date(member.joinedAt).toLocaleDateString()}</p>
                            </div>
                        </div>
                    `;
                }
            });
        }
    });
    
    familyGrid.innerHTML = membersHTML;
}
