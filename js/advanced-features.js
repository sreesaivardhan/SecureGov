// Advanced Features for SecureGov
// Search, Encryption, Download/Print, Notifications

class AdvancedFeatures {
    constructor() {
        this.documents = [];
        this.filteredDocuments = [];
        this.notifications = [];
        this.encryptionKey = null;
        this.init();
    }

    init() {
        this.setupNotificationSystem();
        this.generateEncryptionKey();
    }

    // Search Functionality
    searchDocuments() {
        const searchTerm = document.getElementById('documentSearch')?.value.toLowerCase() || '';
        const categoryFilter = document.getElementById('categoryFilter')?.value || '';
        const dateFilter = document.getElementById('dateFilter')?.value || '';

        this.filteredDocuments = this.documents.filter(doc => {
            const matchesSearch = !searchTerm || 
                doc.name.toLowerCase().includes(searchTerm) ||
                doc.description?.toLowerCase().includes(searchTerm) ||
                doc.tags?.some(tag => tag.toLowerCase().includes(searchTerm));

            const matchesCategory = !categoryFilter || doc.category === categoryFilter;

            const matchesDate = !dateFilter || this.matchesDateFilter(doc.uploadedAt, dateFilter);

            return matchesSearch && matchesCategory && matchesDate;
        });

        this.displayFilteredDocuments();
    }

    matchesDateFilter(docDate, filter) {
        const now = new Date();
        const docDateTime = new Date(docDate);

        switch (filter) {
            case 'today':
                return docDateTime.toDateString() === now.toDateString();
            case 'week':
                const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                return docDateTime >= weekAgo;
            case 'month':
                return docDateTime.getMonth() === now.getMonth() && 
                       docDateTime.getFullYear() === now.getFullYear();
            case 'year':
                return docDateTime.getFullYear() === now.getFullYear();
            default:
                return true;
        }
    }

    displayFilteredDocuments() {
        const container = document.getElementById('documentsGrid');
        if (!container) return;

        if (this.filteredDocuments.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search" style="font-size: 3rem; color: #ccc; margin-bottom: 1rem;"></i>
                    <h3>No documents found</h3>
                    <p>Try adjusting your search criteria or filters.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.filteredDocuments.map(doc => this.createDocumentCard(doc)).join('');
    }

    createDocumentCard(doc) {
        const isEncrypted = doc.encrypted || false;
        return `
            <div class="document-card" data-doc-id="${doc._id}">
                <div class="document-icon">
                    <i class="fas fa-file-alt"></i>
                </div>
                <div class="document-info">
                    <h4>${doc.name}</h4>
                    <p class="document-size">${this.formatFileSize(doc.size)}</p>
                    <p class="document-date">${new Date(doc.uploadedAt).toLocaleDateString()}</p>
                    <div class="document-meta">
                        <span class="document-category">${doc.category || 'General'}</span>
                        <span class="encryption-status ${isEncrypted ? 'encrypted' : 'unencrypted'}">
                            <i class="fas fa-${isEncrypted ? 'lock' : 'unlock'}"></i>
                            ${isEncrypted ? 'Encrypted' : 'Unencrypted'}
                        </span>
                    </div>
                </div>
                <div class="document-actions">
                    <button class="btn btn-small btn-view" onclick="viewDocument('${doc._id}')">
                        <i class="fas fa-eye"></i> View
                    </button>
                    <button class="btn btn-small btn-download" onclick="advancedFeatures.downloadDocument('${doc._id}')">
                        <i class="fas fa-download"></i> Download
                    </button>
                    <button class="btn btn-small btn-print" onclick="advancedFeatures.printDocument('${doc._id}')">
                        <i class="fas fa-print"></i> Print
                    </button>
                    <button class="btn btn-small btn-encrypt" onclick="advancedFeatures.toggleEncryption('${doc._id}')">
                        <i class="fas fa-${isEncrypted ? 'unlock' : 'lock'}"></i> 
                        ${isEncrypted ? 'Decrypt' : 'Encrypt'}
                    </button>
                    <button class="btn btn-small btn-delete" onclick="deleteDocument('${doc._id}')">
                        <i class="fas fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        `;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // Document Encryption
    generateEncryptionKey() {
        // Generate a simple encryption key for demo purposes
        this.encryptionKey = btoa(Math.random().toString(36).substring(2, 15) + 
                                 Math.random().toString(36).substring(2, 15));
    }

    async toggleEncryption(docId) {
        try {
            const doc = this.documents.find(d => d._id === docId);
            if (!doc) {
                this.showNotification('Document not found', 'error');
                return;
            }

            const isCurrentlyEncrypted = doc.encrypted || false;
            const action = isCurrentlyEncrypted ? 'decrypt' : 'encrypt';

            // Simulate encryption/decryption process
            this.showNotification(`${action === 'encrypt' ? 'Encrypting' : 'Decrypting'} document...`, 'info');

            // Update document encryption status
            doc.encrypted = !isCurrentlyEncrypted;
            doc.encryptionTimestamp = new Date().toISOString();

            // Update backend (simulate API call)
            const token = currentUser ? await currentUser.getIdToken() : null;
            if (token) {
                const response = await fetch(`${API_BASE_URL}/documents/${docId}/encryption`, {
                    method: 'PATCH',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ 
                        encrypted: doc.encrypted,
                        encryptionKey: this.encryptionKey 
                    })
                });

                if (response.ok) {
                    this.showNotification(
                        `Document ${action}ed successfully`, 
                        'success',
                        `Your document is now ${doc.encrypted ? 'encrypted and secure' : 'unencrypted'}`
                    );
                } else {
                    // Revert on failure
                    doc.encrypted = isCurrentlyEncrypted;
                    this.showNotification(`Failed to ${action} document`, 'error');
                }
            }

            // Refresh display
            this.searchDocuments();

        } catch (error) {
            console.error('Encryption toggle error:', error);
            this.showNotification('Encryption operation failed', 'error');
        }
    }

    // Download Functionality
    async downloadDocument(docId) {
        try {
            const doc = this.documents.find(d => d._id === docId);
            if (!doc) {
                this.showNotification('Document not found', 'error');
                return;
            }

            this.showNotification('Preparing download...', 'info');

            const token = currentUser ? await currentUser.getIdToken() : null;
            if (!token) {
                this.showNotification('Please log in to download documents', 'error');
                return;
            }

            const response = await fetch(`${API_BASE_URL}/documents/${docId}/download`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Download failed');
            }

            // Get filename from response headers or use document name
            const contentDisposition = response.headers.get('content-disposition');
            let filename = doc.name;
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

            this.showNotification(
                'Download completed', 
                'success',
                `${filename} has been downloaded to your device`
            );

        } catch (error) {
            console.error('Download error:', error);
            this.showNotification('Download failed', 'error', 'Please try again or contact support');
        }
    }

    // Print Functionality
    async printDocument(docId) {
        try {
            const doc = this.documents.find(d => d._id === docId);
            if (!doc) {
                this.showNotification('Document not found', 'error');
                return;
            }

            if (doc.encrypted) {
                const confirmPrint = confirm('This document is encrypted. Printing will create an unencrypted copy. Continue?');
                if (!confirmPrint) return;
            }

            this.showNotification('Preparing document for printing...', 'info');

            const token = currentUser ? await currentUser.getIdToken() : null;
            if (!token) {
                this.showNotification('Please log in to print documents', 'error');
                return;
            }

            // Open document in new window for printing
            const printWindow = window.open(`${API_BASE_URL}/documents/${docId}/view?token=${token}&print=true`, '_blank');
            
            if (printWindow) {
                printWindow.onload = () => {
                    setTimeout(() => {
                        printWindow.print();
                        this.showNotification(
                            'Print dialog opened', 
                            'success',
                            'Your document is ready to print'
                        );
                    }, 1000);
                };
            } else {
                this.showNotification('Print failed', 'error', 'Please allow popups and try again');
            }

        } catch (error) {
            console.error('Print error:', error);
            this.showNotification('Print failed', 'error', 'Please try again or contact support');
        }
    }

    // Notification System
    setupNotificationSystem() {
        // Create notification container if it doesn't exist
        if (!document.getElementById('notificationContainer')) {
            const container = document.createElement('div');
            container.id = 'notificationContainer';
            container.className = 'notification-container';
            document.body.appendChild(container);
        }
    }

    showNotification(title, type = 'info', message = '', duration = 5000) {
        const container = document.getElementById('notificationContainer');
        if (!container) return;

        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };

        notification.innerHTML = `
            <div class="notification-icon">
                <i class="${icons[type] || icons.info}"></i>
            </div>
            <div class="notification-content">
                <h4>${title}</h4>
                ${message ? `<p>${message}</p>` : ''}
            </div>
            <button class="notification-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;

        container.appendChild(notification);

        // Auto-remove notification after duration
        if (duration > 0) {
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, duration);
        }

        // Store notification for history
        this.notifications.push({
            title,
            message,
            type,
            timestamp: new Date().toISOString()
        });

        // Keep only last 50 notifications
        if (this.notifications.length > 50) {
            this.notifications = this.notifications.slice(-50);
        }
    }

    // Update documents array (called from main app)
    updateDocuments(documents) {
        this.documents = documents;
        this.filteredDocuments = documents;
    }

    // Clear all notifications
    clearAllNotifications() {
        const container = document.getElementById('notificationContainer');
        if (container) {
            container.innerHTML = '';
        }
        this.notifications = [];
    }

    // Get notification history
    getNotificationHistory() {
        return this.notifications;
    }
}

// Global functions for HTML onclick handlers
function searchDocuments() {
    if (window.advancedFeatures) {
        window.advancedFeatures.searchDocuments();
    }
}

function filterDocuments() {
    if (window.advancedFeatures) {
        window.advancedFeatures.searchDocuments();
    }
}

// Initialize advanced features when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.advancedFeatures = new AdvancedFeatures();
});
