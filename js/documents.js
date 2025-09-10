// Document Management JavaScript

class DocumentManager {
    constructor() {
        this.currentPage = 1;
        this.currentLimit = 20;
        this.currentFilters = {};
        this.currentView = 'grid';
        this.documents = [];
        this.categories = {};
        
        this.init();
    }

    async init() {
        await this.checkAuth();
        await this.loadCategories();
        await this.loadDocuments();
        await this.loadStats();
        this.setupEventListeners();
        this.setupFileUpload();
    }

    async checkAuth() {
        return new Promise((resolve) => {
            // For demo purposes, create a mock user if none exists
            const mockUser = {
                uid: 'demo-user-123',
                email: 'demo@securegov.com',
                displayName: 'Demo User',
                getIdToken: () => Promise.resolve('demo-token')
            };
            
            firebase.auth().onAuthStateChanged((user) => {
                if (!user) {
                    // Use mock user for demo
                    this.currentUser = mockUser;
                    resolve();
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

    async loadCategories() {
        try {
            // Use default categories for demo
            this.categories = {
                'identity': 'Identity Documents',
                'education': 'Education Certificates',
                'employment': 'Employment Documents',
                'financial': 'Financial Documents',
                'medical': 'Medical Records',
                'legal': 'Legal Documents',
                'other': 'Other'
            };
            this.populateCategorySelects();
        } catch (error) {
            console.error('Error loading categories:', error);
        }
    }

    populateCategorySelects() {
        const categorySelects = ['categoryFilter', 'documentCategory', 'editCategory'];
        
        categorySelects.forEach(selectId => {
            const select = document.getElementById(selectId);
            if (!select) return;

            // Clear existing options (except first one for filters)
            if (selectId === 'categoryFilter') {
                select.innerHTML = '<option value="">All Categories</option>';
            } else {
                select.innerHTML = '<option value="">Select Category</option>';
            }

            // Add category options
            Object.entries(this.categories).forEach(([groupName, categories]) => {
                const optgroup = document.createElement('optgroup');
                optgroup.label = groupName.charAt(0) + groupName.slice(1).toLowerCase();
                
                Object.entries(categories).forEach(([value, label]) => {
                    const option = document.createElement('option');
                    option.value = value;
                    option.textContent = label;
                    optgroup.appendChild(option);
                });
                
                select.appendChild(optgroup);
            });
        });
    }

    async loadDocuments() {
        try {
            // Use mock documents for demo
            this.documents = [
                {
                    id: 'doc1',
                    title: 'Aadhaar Card',
                    category: 'identity',
                    department: 'citizen',
                    status: 'verified',
                    verificationStatus: 'verified',
                    uploadDate: new Date().toISOString(),
                    fileSize: 2621440, // 2.5 MB in bytes
                    mimeType: 'application/pdf'
                },
                {
                    id: 'doc2',
                    title: 'PAN Card',
                    category: 'identity',
                    department: 'citizen',
                    status: 'verified',
                    verificationStatus: 'verified',
                    uploadDate: new Date().toISOString(),
                    fileSize: 1258291, // 1.2 MB in bytes
                    mimeType: 'application/pdf'
                }
            ];
            this.renderDocuments();
            this.renderPagination({ total: 2, page: 1, pages: 1 });
        } catch (error) {
            console.error('Failed to load documents:', error);
            this.showEmptyState('Failed to load documents');
        } finally {
            this.showLoading(false);
        }
    }

    async loadStats() {
        try {
            // Use mock stats for demo
            const totalDocsEl = document.getElementById('totalDocs');
            const sharedDocsEl = document.getElementById('sharedDocs');
            const recentDocsEl = document.getElementById('recentDocs');
            const expiringDocsEl = document.getElementById('expiringDocs');
            
            if (totalDocsEl) totalDocsEl.textContent = '2';
            if (sharedDocsEl) sharedDocsEl.textContent = '0';
            if (recentDocsEl) recentDocsEl.textContent = '2';
            if (expiringDocsEl) expiringDocsEl.textContent = '0';
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    }

    renderDocuments() {
        const container = document.getElementById('documentsContainer');
        
        if (!this.documents || this.documents.length === 0) {
            this.showEmptyState('No documents found');
            return;
        }

        container.className = this.currentView === 'grid' ? 'documents-grid' : 'documents-list';
        container.innerHTML = '';

        this.documents.forEach(doc => {
            const card = this.createDocumentCard(doc);
            container.appendChild(card);
        });
    }

    createDocumentCard(doc) {
        const card = document.createElement('div');
        card.className = 'document-card';
        
        const categoryLabel = this.getCategoryLabel(doc.category);
        const uploadDate = new Date(doc.uploadDate).toLocaleDateString();
        const fileSize = this.formatFileSize(doc.fileSize);
        
        card.innerHTML = `
            <div class="status-indicator status-${doc.verificationStatus}">
                ${doc.verificationStatus}
            </div>
            <div class="document-header">
                <div>
                    <div class="document-icon">
                        <i class="${this.getFileIcon(doc.mimeType)}"></i>
                    </div>
                    <h3 class="document-title">${doc.title}</h3>
                    <span class="document-category">${categoryLabel}</span>
                </div>
            </div>
            <div class="document-meta">
                <div class="meta-item">
                    <i class="fas fa-calendar"></i>
                    <span>Uploaded: ${uploadDate}</span>
                </div>
                <div class="meta-item">
                    <i class="fas fa-file"></i>
                    <span>Size: ${fileSize}</span>
                </div>
                ${doc.documentNumber ? `
                <div class="meta-item">
                    <i class="fas fa-hashtag"></i>
                    <span>Number: ${doc.documentNumber}</span>
                </div>` : ''}
                ${doc.expiryDate ? `
                <div class="meta-item">
                    <i class="fas fa-clock"></i>
                    <span>Expires: ${new Date(doc.expiryDate).toLocaleDateString()}</span>
                </div>` : ''}
            </div>
            ${doc.description ? `<p class="document-description">${doc.description}</p>` : ''}
            ${doc.tags && doc.tags.length > 0 ? `
            <div class="document-tags">
                ${doc.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
            </div>` : ''}
            <div class="document-actions">
                <button class="action-btn view" onclick="documentManager.viewDocument('${doc._id}')">
                    <i class="fas fa-eye"></i> View
                </button>
                <button class="action-btn edit" onclick="documentManager.editDocument('${doc._id}')">
                    <i class="fas fa-edit"></i> Edit
                </button>
                <button class="action-btn delete" onclick="documentManager.deleteDocument('${doc._id}')">
                    <i class="fas fa-trash"></i> Delete
                </button>
            </div>
        `;
        
        return card;
    }

    getCategoryLabel(category) {
        if (!category) return 'Unknown';
        
        // Direct lookup for simple categories object
        if (this.categories && this.categories[category]) {
            return this.categories[category];
        }
        
        // Fallback to category name with proper formatting
        return category.charAt(0).toUpperCase() + category.slice(1);
    }

    getFileIcon(mimeType) {
        if (!mimeType || typeof mimeType !== 'string') return 'fas fa-file';
        if (mimeType.includes('pdf')) return 'fas fa-file-pdf';
        if (mimeType.includes('image')) return 'fas fa-file-image';
        if (mimeType.includes('word')) return 'fas fa-file-word';
        if (mimeType.includes('excel')) return 'fas fa-file-excel';
        return 'fas fa-file';
    }

    formatFileSize(bytes) {
        if (!bytes || bytes === 0) return '0 Bytes';
        if (typeof bytes === 'string') return bytes; // Already formatted
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    showLoading(show) {
        const spinner = document.getElementById('loadingSpinner');
        if (spinner) {
            if (show) {
                spinner.style.display = 'flex';
            } else {
                spinner.style.display = 'none';
            }
        }
    }

    showEmptyState(message) {
        const container = document.getElementById('documentsContainer');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-folder-open"></i>
                    <h3>${message}</h3>
                    <p>Upload your first document to get started</p>
                    <button class="btn btn-primary" onclick="openUploadModal()">
                        <i class="fas fa-plus"></i> Upload Document
                    </button>
                </div>
            `;
        }
    }

    renderPagination(pagination) {
        const container = document.getElementById('pagination');
        if (!pagination || pagination.pages <= 1) {
            container.innerHTML = '';
            return;
        }

        let paginationHTML = '';
        
        // Previous button
        paginationHTML += `
            <button ${pagination.page <= 1 ? 'disabled' : ''} 
                    onclick="documentManager.changePage(${pagination.page - 1})">
                <i class="fas fa-chevron-left"></i> Previous
            </button>
        `;

        // Page numbers
        const startPage = Math.max(1, pagination.page - 2);
        const endPage = Math.min(pagination.pages, pagination.page + 2);

        if (startPage > 1) {
            paginationHTML += `<button onclick="documentManager.changePage(1)">1</button>`;
            if (startPage > 2) {
                paginationHTML += `<span>...</span>`;
            }
        }

        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `
                <button class="${i === pagination.page ? 'active' : ''}" 
                        onclick="documentManager.changePage(${i})">
                    ${i}
                </button>
            `;
        }

        if (endPage < pagination.pages) {
            if (endPage < pagination.pages - 1) {
                paginationHTML += `<span>...</span>`;
            }
            paginationHTML += `<button onclick="documentManager.changePage(${pagination.pages})">${pagination.pages}</button>`;
        }

        // Next button
        paginationHTML += `
            <button ${pagination.page >= pagination.pages ? 'disabled' : ''} 
                    onclick="documentManager.changePage(${pagination.page + 1})">
                Next <i class="fas fa-chevron-right"></i>
            </button>
        `;

        container.innerHTML = paginationHTML;
    }

    changePage(page) {
        this.currentPage = page;
        this.loadDocuments();
    }

    setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('searchInput');
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.currentFilters.search = e.target.value;
                this.currentPage = 1;
                this.loadDocuments();
            }, 500);
        });

        // Filter functionality
        ['categoryFilter', 'departmentFilter', 'statusFilter'].forEach(filterId => {
            const filter = document.getElementById(filterId);
            filter.addEventListener('change', (e) => {
                const filterKey = filterId.replace('Filter', '');
                if (e.target.value) {
                    this.currentFilters[filterKey] = e.target.value;
                } else {
                    delete this.currentFilters[filterKey];
                }
                this.currentPage = 1;
                this.loadDocuments();
            });
        });

        // View toggle
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentView = e.target.dataset.view;
                this.renderDocuments();
            });
        });

        // Form submissions
        document.getElementById('uploadForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.uploadDocument();
        });

        document.getElementById('editForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.updateDocument();
        });
    }

    setupFileUpload() {
        const fileInput = document.getElementById('documentFile');
        const fileDisplay = document.querySelector('.file-input-display span');
        
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                fileDisplay.textContent = file.name;
                // Auto-fill title if empty
                const titleInput = document.getElementById('documentTitle');
                if (!titleInput.value) {
                    titleInput.value = file.name.replace(/\.[^/.]+$/, '');
                }
            } else {
                fileDisplay.textContent = 'Choose file or drag here';
            }
        });
    }

    async uploadDocument() {
        try {
            this.showLoading(true);
            
            const formData = new FormData();
            const form = document.getElementById('uploadForm');
            
            // Append all form fields to FormData
            const formElements = form.elements;
            for (let element of formElements) {
                if (element.type !== 'submit' && element.name) {
                    if (element.type === 'file') {
                        if (element.files[0]) {
                            formData.append(element.name, element.files[0]);
                        }
                    } else {
                        formData.append(element.name, element.value);
                    }
                }
            }

            const token = await this.getAuthToken();
            const response = await fetch('http://localhost:5000/api/documents/upload', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            const result = await response.json();
            
            if (result.success) {
                this.showToast('Document uploaded successfully!', 'success');
                this.closeUploadModal();
                this.loadDocuments();
                this.loadStats();
            } else {
                throw new Error(result.message || 'Upload failed');
            }
        } catch (error) {
            console.error('Upload failed:', error);
            this.showToast('Upload failed: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async viewDocument(documentId) {
        try {
            const response = await this.apiCall(`/documents/${documentId}`);
            if (response.success) {
                // Open document in new tab or show in modal
                if (response.document.metadata && response.document.metadata.firebaseUrl) {
                    window.open(response.document.metadata.firebaseUrl, '_blank');
                } else {
                    // Download from server
                    window.open(`http://localhost:5000/api/documents/${documentId}/download`, '_blank');
                }
            }
        } catch (error) {
            console.error('Failed to view document:', error);
            this.showToast('Failed to view document', 'error');
        }
    }

    async editDocument(documentId) {
        try {
            const response = await this.apiCall(`/documents/${documentId}`);
            if (response.success) {
                this.populateEditForm(response.document);
                this.openEditModal();
                this.currentEditId = documentId;
            }
        } catch (error) {
            console.error('Failed to load document for editing:', error);
            this.showToast('Failed to load document', 'error');
        }
    }

    populateEditForm(document) {
        document.getElementById('editTitle').value = document.title || '';
        document.getElementById('editCategory').value = document.category || '';
        document.getElementById('editDescription').value = document.description || '';
        document.getElementById('editDocumentNumber').value = document.documentNumber || '';
        document.getElementById('editIssuingAuthority').value = document.issuingAuthority || '';
        document.getElementById('editIssueDate').value = document.issueDate ? document.issueDate.split('T')[0] : '';
        document.getElementById('editExpiryDate').value = document.expiryDate ? document.expiryDate.split('T')[0] : '';
        document.getElementById('editTags').value = document.tags ? document.tags.join(', ') : '';
    }

    async updateDocument() {
        try {
            this.showLoading(true);
            
            const formData = new FormData(document.getElementById('editForm'));
            const updateData = Object.fromEntries(formData.entries());
            
            const response = await this.apiCall(`/documents/${this.currentEditId}`, {
                method: 'PUT',
                body: JSON.stringify(updateData)
            });
            
            if (response.success) {
                this.showToast('Document updated successfully!', 'success');
                this.closeEditModal();
                this.loadDocuments();
            } else {
                throw new Error(response.message || 'Update failed');
            }
        } catch (error) {
            console.error('Update failed:', error);
            this.showToast('Update failed: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async deleteDocument(documentId) {
        if (!confirm('Are you sure you want to delete this document? This action cannot be undone.')) {
            return;
        }

        try {
            this.showLoading(true);
            
            const response = await this.apiCall(`/documents/${documentId}`, {
                method: 'DELETE'
            });
            
            if (response.success) {
                this.showToast('Document deleted successfully!', 'success');
                this.loadDocuments();
                this.loadStats();
            } else {
                throw new Error(response.message || 'Delete failed');
            }
        } catch (error) {
            console.error('Delete failed:', error);
            this.showToast('Delete failed: ' + error.message, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    clearFilters() {
        this.currentFilters = {};
        this.currentPage = 1;
        
        // Reset form elements
        document.getElementById('searchInput').value = '';
        document.getElementById('categoryFilter').value = '';
        document.getElementById('departmentFilter').value = '';
        document.getElementById('statusFilter').value = '';
        
        this.loadDocuments();
    }

    openUploadModal() {
        document.getElementById('uploadModal').style.display = 'block';
    }

    closeUploadModal() {
        document.getElementById('uploadModal').style.display = 'none';
        document.getElementById('uploadForm').reset();
        document.querySelector('.file-input-display span').textContent = 'Choose file or drag here';
    }

    openEditModal() {
        document.getElementById('editModal').style.display = 'block';
    }

    closeEditModal() {
        document.getElementById('editModal').style.display = 'none';
        document.getElementById('editForm').reset();
        this.currentEditId = null;
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
function openUploadModal() {
    documentManager.openUploadModal();
}

function closeUploadModal() {
    documentManager.closeUploadModal();
}

function closeEditModal() {
    documentManager.closeEditModal();
}

function clearFilters() {
    documentManager.clearFilters();
}

function logout() {
    firebase.auth().signOut().then(() => {
        window.location.href = '../index.html';
    }).catch((error) => {
        console.error('Logout error:', error);
    });
}

// Initialize document manager when page loads
document.addEventListener('DOMContentLoaded', () => {
    new DocumentManager();
});

// Close modals when clicking outside
window.addEventListener('click', (e) => {
    const uploadModal = document.getElementById('uploadModal');
    const editModal = document.getElementById('editModal');
    
    if (e.target === uploadModal) {
        closeUploadModal();
    }
    if (e.target === editModal) {
        closeEditModal();
    }
});
