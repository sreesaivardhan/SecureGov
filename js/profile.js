// Profile Management JavaScript
class ProfileManager {
    constructor() {
        this.currentUser = null;
        this.profile = null;
        this.currentVerificationId = null;
        this.init();
    }

    async init() {
        // Wait for Firebase auth
        firebase.auth().onAuthStateChanged(async (user) => {
            if (user) {
                this.currentUser = user;
                await this.loadProfile();
                this.setupEventListeners();
            } else {
                window.location.href = 'login.html';
            }
        });
    }

    async loadProfile() {
        try {
            const token = await this.currentUser.getIdToken();
            const response = await fetch('/api/profile', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.profile = data.profile;
                this.renderProfile();
                await this.loadCompletion();
            } else if (response.status === 404) {
                // Profile doesn't exist, show basic info
                this.renderBasicProfile();
            } else {
                throw new Error('Failed to load profile');
            }
        } catch (error) {
            console.error('Load profile error:', error);
            this.showToast('Failed to load profile', 'error');
        }
    }

    renderProfile() {
        if (!this.profile) return;

        // Update header info
        const profileName = document.getElementById('profileName');
        const profileEmail = document.getElementById('profileEmail');
        const profileAvatar = document.getElementById('profileAvatar');
        const userAvatar = document.getElementById('userAvatar');

        const fullName = this.getFullName();
        profileName.textContent = fullName || 'User';
        profileEmail.textContent = this.profile.email;

        // Update avatars
        if (this.profile.personalInfo?.profilePicture?.url) {
            const img = document.createElement('img');
            img.src = this.profile.personalInfo.profilePicture.url;
            img.alt = 'Profile Picture';
            profileAvatar.innerHTML = '';
            profileAvatar.appendChild(img);
            
            const userImg = document.createElement('img');
            userImg.src = this.profile.personalInfo.profilePicture.url;
            userImg.alt = 'Profile Picture';
            userAvatar.innerHTML = '';
            userAvatar.appendChild(userImg);
        }

        // Render verification badges
        this.renderVerificationBadges();

        // Fill form data
        this.fillPersonalForm();
        this.renderGovernmentIds();
        this.renderAddresses();
        this.renderSecuritySettings();
        this.loadActivity();
    }

    renderBasicProfile() {
        const profileName = document.getElementById('profileName');
        const profileEmail = document.getElementById('profileEmail');
        
        profileName.textContent = this.currentUser.displayName || 'User';
        profileEmail.textContent = this.currentUser.email;
    }

    getFullName() {
        if (!this.profile?.personalInfo) return '';
        const { firstName, middleName, lastName } = this.profile.personalInfo;
        return [firstName, middleName, lastName].filter(Boolean).join(' ');
    }

    renderVerificationBadges() {
        const badgesContainer = document.getElementById('profileBadges');
        badgesContainer.innerHTML = '';

        if (!this.profile?.profileStatus?.verificationBadges) return;

        this.profile.profileStatus.verificationBadges.forEach(badge => {
            const badgeEl = document.createElement('div');
            badgeEl.className = 'verification-badge verified';
            badgeEl.innerHTML = `
                <i class="fas fa-check"></i>
                ${badge.type.charAt(0).toUpperCase() + badge.type.slice(1)}
            `;
            badgesContainer.appendChild(badgeEl);
        });
    }

    async loadCompletion() {
        try {
            const token = await this.currentUser.getIdToken();
            const response = await fetch('/api/profile/completion', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.renderCompletion(data.completion);
            }
        } catch (error) {
            console.error('Load completion error:', error);
        }
    }

    renderCompletion(completion) {
        const percentageEl = document.getElementById('completionPercentage');
        const levelEl = document.getElementById('completionLevel');
        const circleEl = document.getElementById('completionCircle');

        percentageEl.textContent = `${completion.percentage}%`;
        levelEl.textContent = completion.level.charAt(0).toUpperCase() + completion.level.slice(1);
        
        // Update circle progress
        const angle = (completion.percentage / 100) * 360;
        circleEl.style.setProperty('--completion-angle', `${angle}deg`);
    }

    fillPersonalForm() {
        if (!this.profile?.personalInfo) return;

        const form = document.getElementById('personalForm');
        const info = this.profile.personalInfo;

        form.firstName.value = info.firstName || '';
        form.lastName.value = info.lastName || '';
        form.middleName.value = info.middleName || '';
        form.displayName.value = info.displayName || '';
        form.nationality.value = info.nationality || 'Indian';
        form.occupation.value = info.occupation || '';
        
        if (info.dateOfBirth) {
            form.dateOfBirth.value = new Date(info.dateOfBirth).toISOString().split('T')[0];
        }
        
        if (info.gender) {
            form.gender.value = info.gender;
        }

        // Disable form initially
        this.toggleFormEdit('personalForm', false);
    }

    renderGovernmentIds() {
        // Aadhaar
        const aadhaarStatus = document.getElementById('aadhaarStatus');
        const aadhaarNumber = document.getElementById('aadhaarNumber');
        const linkAadhaarBtn = document.getElementById('linkAadhaarBtn');
        const verifyAadhaarBtn = document.getElementById('verifyAadhaarBtn');

        if (this.profile?.governmentIds?.aadhaar) {
            const aadhaar = this.profile.governmentIds.aadhaar;
            
            aadhaarStatus.innerHTML = `<span class="status-badge status-${aadhaar.status.replace('_', '-')}">${this.formatStatus(aadhaar.status)}</span>`;
            
            if (aadhaar.status === 'verified') {
                aadhaarNumber.textContent = aadhaar.maskedAadhaar || 'XXXX-XXXX-XXXX';
                linkAadhaarBtn.style.display = 'none';
                verifyAadhaarBtn.style.display = 'none';
            } else if (aadhaar.status === 'pending') {
                aadhaarNumber.textContent = aadhaar.maskedAadhaar || 'XXXX-XXXX-XXXX';
                linkAadhaarBtn.style.display = 'none';
                verifyAadhaarBtn.style.display = 'inline-flex';
            } else {
                aadhaarNumber.textContent = 'Not linked';
                linkAadhaarBtn.style.display = 'inline-flex';
                verifyAadhaarBtn.style.display = 'none';
            }
        }

        // PAN
        const panStatus = document.getElementById('panStatus');
        const panNumber = document.getElementById('panNumber');

        if (this.profile?.governmentIds?.pan?.number) {
            const pan = this.profile.governmentIds.pan;
            panStatus.innerHTML = `<span class="status-badge status-${pan.isVerified ? 'verified' : 'pending'}">${pan.isVerified ? 'Verified' : 'Added'}</span>`;
            panNumber.textContent = pan.number;
        }

        // Other IDs
        if (this.profile?.governmentIds) {
            const ids = this.profile.governmentIds;
            
            if (ids.passport?.number) {
                document.getElementById('passportNumber').textContent = ids.passport.number;
            }
            if (ids.drivingLicense?.number) {
                document.getElementById('dlNumber').textContent = ids.drivingLicense.number;
            }
            if (ids.voterId?.number) {
                document.getElementById('voterIdNumber').textContent = ids.voterId.number;
            }
        }
    }

    renderAddresses() {
        const addressesList = document.getElementById('addressesList');
        
        if (!this.profile?.addresses || this.profile.addresses.length === 0) {
            addressesList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-map-marker-alt"></i>
                    <h3>No addresses added</h3>
                    <p>Add your addresses to complete your profile</p>
                </div>
            `;
            return;
        }

        addressesList.innerHTML = '';
        this.profile.addresses.forEach((address, index) => {
            const addressCard = document.createElement('div');
            addressCard.className = 'address-card';
            addressCard.innerHTML = `
                <div class="address-type">${address.type}</div>
                <div class="address-details">
                    ${address.addressLine1}<br>
                    ${address.addressLine2 ? address.addressLine2 + '<br>' : ''}
                    ${address.city}, ${address.state} ${address.pincode}<br>
                    ${address.country}
                </div>
                <div class="address-actions">
                    <button class="btn btn-secondary btn-sm" onclick="profileManager.editAddress(${index})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="profileManager.deleteAddress('${address.type}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            addressesList.appendChild(addressCard);
        });
    }

    renderSecuritySettings() {
        if (!this.profile?.security) return;

        const security = this.profile.security;
        
        document.getElementById('twoFactorToggle').checked = security.twoFactorEnabled || false;
        document.getElementById('loginNotificationsToggle').checked = security.loginNotifications !== false;
        document.getElementById('documentNotificationsToggle').checked = security.documentAccessNotifications !== false;
        document.getElementById('sessionTimeoutSelect').value = security.sessionTimeout || 30;

        // Security questions
        const questionsList = document.getElementById('securityQuestionsList');
        if (security.securityQuestions && security.securityQuestions.length > 0) {
            questionsList.innerHTML = `<p class="text-success">${security.securityQuestions.length} security questions configured</p>`;
        } else {
            questionsList.innerHTML = '<p class="text-muted">No security questions set up</p>';
        }
    }

    async loadActivity() {
        try {
            const token = await this.currentUser.getIdToken();
            const response = await fetch('/api/profile/activity?limit=10', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                this.renderActivity(data.activities);
            }
        } catch (error) {
            console.error('Load activity error:', error);
        }
    }

    renderActivity(activities) {
        const activityList = document.getElementById('activityList');
        
        if (!activities || activities.length === 0) {
            activityList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-history"></i>
                    <h3>No recent activity</h3>
                    <p>Your account activity will appear here</p>
                </div>
            `;
            return;
        }

        activityList.innerHTML = '';
        activities.forEach(activity => {
            const activityItem = document.createElement('div');
            activityItem.className = 'activity-item';
            activityItem.innerHTML = `
                <div class="activity-icon">
                    <i class="fas fa-${this.getActivityIcon(activity.action)}"></i>
                </div>
                <div class="activity-details">
                    <p class="activity-action">${activity.action}</p>
                    <p class="activity-meta">
                        ${new Date(activity.timestamp).toLocaleString()}
                        ${activity.ipAddress ? `• ${activity.ipAddress}` : ''}
                    </p>
                </div>
            `;
            activityList.appendChild(activityItem);
        });
    }

    setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.profile-nav-btn').forEach(btn => {
            btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
        });

        // Personal info form
        document.getElementById('editPersonalBtn').addEventListener('click', () => {
            this.toggleFormEdit('personalForm', true);
        });

        document.getElementById('cancelPersonalBtn').addEventListener('click', () => {
            this.toggleFormEdit('personalForm', false);
            this.fillPersonalForm();
        });

        document.getElementById('personalForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.savePersonalInfo();
        });

        // Profile picture
        document.getElementById('changeAvatarBtn').addEventListener('click', () => {
            document.getElementById('avatarInput').click();
        });

        document.getElementById('avatarInput').addEventListener('change', (e) => {
            if (e.target.files[0]) {
                this.uploadProfilePicture(e.target.files[0]);
            }
        });

        // Government IDs
        document.getElementById('linkAadhaarBtn').addEventListener('click', () => {
            this.openModal('aadhaarModal');
        });

        document.getElementById('verifyAadhaarBtn').addEventListener('click', () => {
            this.openModal('aadhaarVerificationModal');
        });

        document.getElementById('addPanBtn').addEventListener('click', () => {
            this.openModal('panModal');
        });

        // Address management
        document.getElementById('addAddressBtn').addEventListener('click', () => {
            this.openAddressModal();
        });

        // Security settings
        document.getElementById('setupSecurityQuestionsBtn').addEventListener('click', () => {
            this.openModal('securityQuestionsModal');
        });

        // Security toggles
        document.getElementById('twoFactorToggle').addEventListener('change', () => {
            this.updateSecuritySettings();
        });

        document.getElementById('loginNotificationsToggle').addEventListener('change', () => {
            this.updateSecuritySettings();
        });

        document.getElementById('documentNotificationsToggle').addEventListener('change', () => {
            this.updateSecuritySettings();
        });

        document.getElementById('sessionTimeoutSelect').addEventListener('change', () => {
            this.updateSecuritySettings();
        });

        // Form submissions
        document.getElementById('aadhaarForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.linkAadhaar();
        });

        document.getElementById('aadhaarVerificationForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.verifyAadhaar();
        });

        document.getElementById('panForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addPAN();
        });

        document.getElementById('addressForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveAddress();
        });

        document.getElementById('securityQuestionsForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveSecurityQuestions();
        });

        // Modal close handlers
        document.querySelectorAll('[data-modal]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.closeModal(btn.dataset.modal);
            });
        });

        // Activity refresh
        document.getElementById('refreshActivityBtn').addEventListener('click', () => {
            this.loadActivity();
        });
    }

    switchTab(tabName) {
        // Update nav buttons
        document.querySelectorAll('.profile-nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

        // Update tab content
        document.querySelectorAll('.profile-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.getElementById(`${tabName}Tab`).classList.add('active');
    }

    toggleFormEdit(formId, enable) {
        const form = document.getElementById(formId);
        const inputs = form.querySelectorAll('input, select');
        const editBtn = document.getElementById('editPersonalBtn');
        const actions = form.querySelector('.form-actions');

        inputs.forEach(input => {
            input.disabled = !enable;
        });

        editBtn.style.display = enable ? 'none' : 'inline-flex';
        actions.style.display = enable ? 'flex' : 'none';
    }

    async savePersonalInfo() {
        try {
            const form = document.getElementById('personalForm');
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());

            const token = await this.currentUser.getIdToken();
            const response = await fetch('/api/profile', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                this.showToast('Profile updated successfully', 'success');
                this.toggleFormEdit('personalForm', false);
                await this.loadProfile();
            } else {
                throw new Error('Failed to update profile');
            }
        } catch (error) {
            console.error('Save personal info error:', error);
            this.showToast('Failed to update profile', 'error');
        }
    }

    async uploadProfilePicture(file) {
        try {
            const formData = new FormData();
            formData.append('profilePicture', file);

            const token = await this.currentUser.getIdToken();
            const response = await fetch('/api/profile/picture', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (response.ok) {
                this.showToast('Profile picture updated successfully', 'success');
                await this.loadProfile();
            } else {
                throw new Error('Failed to upload profile picture');
            }
        } catch (error) {
            console.error('Upload profile picture error:', error);
            this.showToast('Failed to upload profile picture', 'error');
        }
    }

    async linkAadhaar() {
        try {
            const aadhaarNumber = document.getElementById('aadhaarInput').value.trim();
            
            if (!/^\d{12}$/.test(aadhaarNumber)) {
                this.showToast('Please enter a valid 12-digit Aadhaar number', 'error');
                return;
            }

            const token = await this.currentUser.getIdToken();
            const response = await fetch('/api/profile/aadhaar/link', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ aadhaarNumber })
            });

            const data = await response.json();

            if (response.ok) {
                this.currentVerificationId = data.verificationId;
                document.getElementById('maskedAadhaar').textContent = data.maskedAadhaar;
                this.closeModal('aadhaarModal');
                this.openModal('aadhaarVerificationModal');
                this.showToast('Aadhaar linked successfully. Please verify with OTP.', 'success');
                await this.loadProfile();
            } else {
                throw new Error(data.error || 'Failed to link Aadhaar');
            }
        } catch (error) {
            console.error('Link Aadhaar error:', error);
            this.showToast(error.message, 'error');
        }
    }

    async verifyAadhaar() {
        try {
            const otp = document.getElementById('otpInput').value.trim();
            
            if (!/^\d{6}$/.test(otp)) {
                this.showToast('Please enter a valid 6-digit OTP', 'error');
                return;
            }

            const token = await this.currentUser.getIdToken();
            const response = await fetch('/api/profile/aadhaar/verify', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    verificationId: this.currentVerificationId,
                    otp
                })
            });

            const data = await response.json();

            if (response.ok) {
                this.closeModal('aadhaarVerificationModal');
                this.showToast('Aadhaar verified successfully!', 'success');
                await this.loadProfile();
            } else {
                throw new Error(data.error || 'Failed to verify Aadhaar');
            }
        } catch (error) {
            console.error('Verify Aadhaar error:', error);
            this.showToast(error.message, 'error');
        }
    }

    async addPAN() {
        try {
            const panNumber = document.getElementById('panInput').value.trim().toUpperCase();
            
            if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panNumber)) {
                this.showToast('Please enter a valid PAN number', 'error');
                return;
            }

            const token = await this.currentUser.getIdToken();
            const response = await fetch('/api/profile/pan', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ number: panNumber })
            });

            if (response.ok) {
                this.closeModal('panModal');
                this.showToast('PAN details added successfully', 'success');
                await this.loadProfile();
            } else {
                const data = await response.json();
                throw new Error(data.error || 'Failed to add PAN');
            }
        } catch (error) {
            console.error('Add PAN error:', error);
            this.showToast(error.message, 'error');
        }
    }

    openAddressModal(address = null, index = null) {
        const modal = document.getElementById('addressModal');
        const form = document.getElementById('addressForm');
        const title = document.getElementById('addressModalTitle');
        
        if (address) {
            title.textContent = 'Edit Address';
            form.type.value = address.type;
            form.addressLine1.value = address.addressLine1;
            form.addressLine2.value = address.addressLine2 || '';
            form.city.value = address.city;
            form.state.value = address.state;
            form.pincode.value = address.pincode;
            form.country.value = address.country;
            form.dataset.editIndex = index;
        } else {
            title.textContent = 'Add Address';
            form.reset();
            delete form.dataset.editIndex;
        }
        
        this.openModal('addressModal');
    }

    async saveAddress() {
        try {
            const form = document.getElementById('addressForm');
            const formData = new FormData(form);
            const data = Object.fromEntries(formData.entries());

            const token = await this.currentUser.getIdToken();
            const response = await fetch('/api/profile/address', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                this.closeModal('addressModal');
                this.showToast('Address saved successfully', 'success');
                await this.loadProfile();
            } else {
                const responseData = await response.json();
                throw new Error(responseData.error || 'Failed to save address');
            }
        } catch (error) {
            console.error('Save address error:', error);
            this.showToast(error.message, 'error');
        }
    }

    async deleteAddress(type) {
        if (!confirm('Are you sure you want to delete this address?')) return;

        try {
            const token = await this.currentUser.getIdToken();
            const response = await fetch(`/api/profile/address/${type}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                this.showToast('Address deleted successfully', 'success');
                await this.loadProfile();
            } else {
                throw new Error('Failed to delete address');
            }
        } catch (error) {
            console.error('Delete address error:', error);
            this.showToast('Failed to delete address', 'error');
        }
    }

    editAddress(index) {
        const address = this.profile.addresses[index];
        this.openAddressModal(address, index);
    }

    async updateSecuritySettings() {
        try {
            const settings = {
                twoFactorEnabled: document.getElementById('twoFactorToggle').checked,
                loginNotifications: document.getElementById('loginNotificationsToggle').checked,
                documentAccessNotifications: document.getElementById('documentNotificationsToggle').checked,
                sessionTimeout: parseInt(document.getElementById('sessionTimeoutSelect').value)
            };

            const token = await this.currentUser.getIdToken();
            const response = await fetch('/api/profile/security/settings', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(settings)
            });

            if (response.ok) {
                this.showToast('Security settings updated', 'success');
            } else {
                throw new Error('Failed to update security settings');
            }
        } catch (error) {
            console.error('Update security settings error:', error);
            this.showToast('Failed to update security settings', 'error');
        }
    }

    async saveSecurityQuestions() {
        try {
            const form = document.getElementById('securityQuestionsForm');
            const formData = new FormData(form);
            
            const questions = [
                {
                    question: formData.get('question1'),
                    answer: formData.get('answer1')
                },
                {
                    question: formData.get('question2'),
                    answer: formData.get('answer2')
                }
            ];

            // Validate
            if (!questions[0].question || !questions[0].answer || !questions[1].question || !questions[1].answer) {
                this.showToast('Please fill in all security questions and answers', 'error');
                return;
            }

            if (questions[0].question === questions[1].question) {
                this.showToast('Please choose different security questions', 'error');
                return;
            }

            const token = await this.currentUser.getIdToken();
            const response = await fetch('/api/profile/security/questions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ questions })
            });

            if (response.ok) {
                this.closeModal('securityQuestionsModal');
                this.showToast('Security questions saved successfully', 'success');
                await this.loadProfile();
            } else {
                const data = await response.json();
                throw new Error(data.error || 'Failed to save security questions');
            }
        } catch (error) {
            console.error('Save security questions error:', error);
            this.showToast(error.message, 'error');
        }
    }

    // Utility methods
    formatStatus(status) {
        return status.split('_').map(word => 
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }

    getActivityIcon(action) {
        if (action.includes('login')) return 'sign-in-alt';
        if (action.includes('profile')) return 'user-edit';
        if (action.includes('document')) return 'file-alt';
        if (action.includes('security')) return 'shield-alt';
        return 'circle';
    }

    openModal(modalId) {
        document.getElementById(modalId).classList.add('active');
    }

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
        // Clear form data
        const form = document.querySelector(`#${modalId} form`);
        if (form) form.reset();
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'exclamation-triangle' : 'info'}"></i>
                <span>${message}</span>
            </div>
            <button class="toast-close">
                <i class="fas fa-times"></i>
            </button>
        `;

        const container = document.getElementById('toastContainer');
        container.appendChild(toast);

        // Auto remove after 5 seconds
        setTimeout(() => {
            toast.remove();
        }, 5000);

        // Manual close
        toast.querySelector('.toast-close').addEventListener('click', () => {
            toast.remove();
        });
    }
}

// Global logout function
function logout() {
    firebase.auth().signOut().then(() => {
        window.location.href = '../index.html';
    }).catch((error) => {
        console.error('Logout error:', error);
        showToast('Error logging out', 'error');
    });
}

// Initialize profile manager
const profileManager = new ProfileManager();
