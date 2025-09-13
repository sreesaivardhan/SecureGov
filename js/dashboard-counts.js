// Dashboard count management functions

// Load documents count for dashboard
async function loadDocumentsCount() {
    try {
        const token = currentUser ? await currentUser.getIdToken() : null;
        if (!token) return;
        
        const response = await fetch(`${API_BASE_URL}/api/documents`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const documentsCountElement = document.getElementById('documentsCount');
            if (documentsCountElement) {
                documentsCountElement.textContent = data.documents ? data.documents.length : 0;
            }
        }
    } catch (error) {
        console.error('Error loading documents count:', error);
    }
}

// Load family statistics for dashboard
async function loadFamilyStats() {
    try {
        const token = currentUser ? await currentUser.getIdToken() : null;
        if (!token) return;
        
        const response = await fetch(`${API_BASE_URL}/api/family/members`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const members = data.members || [];
            
            // Count active members and pending invitations
            const activeMembers = members.filter(m => m.status === 'active' && !m.isPending);
            const pendingInvitations = members.filter(m => m.status === 'pending' || m.isPending);
            
            // Update dashboard counts
            const familyMembersElement = document.getElementById('familyMembers');
            const pendingInvitesElement = document.getElementById('pendingInvites');
            
            if (familyMembersElement) {
                familyMembersElement.textContent = activeMembers.length;
            }
            
            if (pendingInvitesElement) {
                pendingInvitesElement.textContent = pendingInvitations.length;
            }
        }
    } catch (error) {
        console.error('Error loading family stats:', error);
    }
}

// Update all dashboard counts
async function updateAllDashboardCounts() {
    await Promise.all([
        loadDocumentsCount(),
        loadFamilyStats()
    ]);
}

// Auto-refresh dashboard counts every 30 seconds
let dashboardRefreshInterval;

function startDashboardRefresh() {
    // Clear existing interval
    if (dashboardRefreshInterval) {
        clearInterval(dashboardRefreshInterval);
    }
    
    // Set up new interval
    dashboardRefreshInterval = setInterval(updateAllDashboardCounts, 30000);
}

function stopDashboardRefresh() {
    if (dashboardRefreshInterval) {
        clearInterval(dashboardRefreshInterval);
        dashboardRefreshInterval = null;
    }
}
