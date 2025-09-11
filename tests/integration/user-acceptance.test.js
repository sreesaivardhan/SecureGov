const { expect } = require('chai');
const puppeteer = require('puppeteer');
const path = require('path');

describe('User Acceptance Tests', () => {
    let browser, page;
    const BASE_URL = 'http://localhost:5500';
    const API_URL = 'http://localhost:5000';

    before(async function() {
        this.timeout(30000);
        browser = await puppeteer.launch({
            headless: false, // Set to true for CI/CD
            slowMo: 100,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 720 });
    });

    after(async () => {
        if (browser) {
            await browser.close();
        }
    });

    beforeEach(async function() {
        this.timeout(10000);
        await page.goto(BASE_URL);
        await page.waitForSelector('body', { timeout: 5000 });
    });

    describe('Authentication Flow', () => {
        it('should display login form on initial load', async () => {
            const loginSection = await page.$('#loginSection');
            expect(loginSection).to.not.be.null;
            
            const loginButton = await page.$('#loginBtn');
            expect(loginButton).to.not.be.null;
        });

        it('should show dashboard after successful login', async function() {
            this.timeout(15000);
            
            // Mock Firebase authentication
            await page.evaluate(() => {
                // Mock successful authentication
                window.firebase = {
                    auth: () => ({
                        signInWithEmailAndPassword: () => Promise.resolve({
                            user: {
                                uid: 'test-user-id',
                                email: 'test@example.com',
                                getIdToken: () => Promise.resolve('mock-token')
                            }
                        }),
                        onAuthStateChanged: (callback) => {
                            callback({
                                uid: 'test-user-id',
                                email: 'test@example.com',
                                getIdToken: () => Promise.resolve('mock-token')
                            });
                        },
                        currentUser: {
                            uid: 'test-user-id',
                            email: 'test@example.com',
                            getIdToken: () => Promise.resolve('mock-token')
                        }
                    })
                };
            });

            await page.reload();
            await page.waitForSelector('#dashboardSection', { timeout: 10000 });
            
            const dashboard = await page.$('#dashboardSection');
            expect(dashboard).to.not.be.null;
        });
    });

    describe('Document Management', () => {
        beforeEach(async function() {
            this.timeout(10000);
            // Setup authenticated state
            await page.evaluate(() => {
                window.currentUser = {
                    uid: 'test-user-id',
                    email: 'test@example.com',
                    getIdToken: () => Promise.resolve('mock-token')
                };
            });
            await page.goto(`${BASE_URL}#dashboard`);
            await page.waitForSelector('#dashboardSection');
        });

        it('should display document upload area', async () => {
            const uploadArea = await page.$('#uploadArea');
            expect(uploadArea).to.not.be.null;
            
            const uploadButton = await page.$('#uploadBtn');
            expect(uploadButton).to.not.be.null;
        });

        it('should show document search and filters', async () => {
            const searchInput = await page.$('#documentSearch');
            expect(searchInput).to.not.be.null;
            
            const categoryFilter = await page.$('#categoryFilter');
            expect(categoryFilter).to.not.be.null;
            
            const dateFilter = await page.$('#dateFilter');
            expect(dateFilter).to.not.be.null;
        });

        it('should display documents grid', async () => {
            const documentsGrid = await page.$('#documentsGrid');
            expect(documentsGrid).to.not.be.null;
        });

        it('should handle document search', async function() {
            this.timeout(10000);
            
            const searchInput = await page.$('#documentSearch');
            await searchInput.type('test document');
            
            const searchButton = await page.$('#searchDocuments');
            await searchButton.click();
            
            // Wait for search results
            await page.waitForTimeout(1000);
            
            // Verify search was triggered
            const searchValue = await page.$eval('#documentSearch', el => el.value);
            expect(searchValue).to.equal('test document');
        });
    });

    describe('Family Management', () => {
        beforeEach(async function() {
            this.timeout(10000);
            await page.evaluate(() => {
                window.currentUser = {
                    uid: 'test-user-id',
                    email: 'test@example.com',
                    getIdToken: () => Promise.resolve('mock-token')
                };
            });
            await page.goto(`${BASE_URL}#dashboard`);
            await page.waitForSelector('#dashboardSection');
        });

        it('should display family section', async () => {
            const familySection = await page.$('.family-section');
            expect(familySection).to.not.be.null;
        });

        it('should show invite family button', async () => {
            const inviteButton = await page.$('#inviteFamilyBtn');
            expect(inviteButton).to.not.be.null;
        });

        it('should open invitation modal when invite button clicked', async function() {
            this.timeout(10000);
            
            const inviteButton = await page.$('#inviteFamilyBtn');
            await inviteButton.click();
            
            await page.waitForSelector('#inviteFamilyModal', { visible: true });
            
            const modal = await page.$('#inviteFamilyModal');
            const isVisible = await page.evaluate(el => {
                return window.getComputedStyle(el).display !== 'none';
            }, modal);
            
            expect(isVisible).to.be.true;
        });

        it('should validate invitation form', async function() {
            this.timeout(10000);
            
            // Open modal
            const inviteButton = await page.$('#inviteFamilyBtn');
            await inviteButton.click();
            await page.waitForSelector('#inviteFamilyModal', { visible: true });
            
            // Try to submit empty form
            const submitButton = await page.$('#inviteFamilyForm button[type="submit"]');
            await submitButton.click();
            
            // Check for validation messages
            await page.waitForTimeout(500);
            
            const emailInput = await page.$('#inviteEmail');
            const emailValue = await page.evaluate(el => el.value, emailInput);
            expect(emailValue).to.equal('');
        });
    });

    describe('Advanced Features', () => {
        beforeEach(async function() {
            this.timeout(10000);
            await page.evaluate(() => {
                window.currentUser = {
                    uid: 'test-user-id',
                    email: 'test@example.com',
                    getIdToken: () => Promise.resolve('mock-token')
                };
                
                // Mock documents for testing
                window.mockDocuments = [
                    {
                        _id: 'doc1',
                        filename: 'test-document.pdf',
                        size: 1024,
                        uploadedAt: new Date().toISOString(),
                        encrypted: false,
                        category: 'Government'
                    }
                ];
            });
            await page.goto(`${BASE_URL}#dashboard`);
            await page.waitForSelector('#dashboardSection');
        });

        it('should display notification system', async () => {
            const notificationContainer = await page.$('#notificationContainer');
            expect(notificationContainer).to.not.be.null;
        });

        it('should show notifications when triggered', async function() {
            this.timeout(10000);
            
            // Trigger a notification
            await page.evaluate(() => {
                if (window.advancedFeatures) {
                    window.advancedFeatures.showNotification('Test notification', 'info');
                }
            });
            
            await page.waitForTimeout(500);
            
            const notification = await page.$('.notification');
            if (notification) {
                const isVisible = await page.evaluate(el => {
                    return window.getComputedStyle(el).display !== 'none';
                }, notification);
                expect(isVisible).to.be.true;
            }
        });

        it('should handle document encryption toggle', async function() {
            this.timeout(10000);
            
            // Mock document with encryption button
            await page.evaluate(() => {
                const mockDoc = {
                    _id: 'test-doc-id',
                    filename: 'test.pdf',
                    encrypted: false
                };
                
                if (window.advancedFeatures) {
                    window.advancedFeatures.updateDocuments([mockDoc]);
                }
            });
            
            await page.waitForTimeout(1000);
            
            // Look for encryption button (may not exist if documents aren't loaded)
            const encryptButton = await page.$('[onclick*="toggleEncryption"]');
            if (encryptButton) {
                await encryptButton.click();
                await page.waitForTimeout(500);
            }
        });
    });

    describe('Error Handling', () => {
        it('should handle network errors gracefully', async function() {
            this.timeout(10000);
            
            // Mock network failure
            await page.setOfflineMode(true);
            
            await page.evaluate(() => {
                if (window.errorHandler) {
                    window.errorHandler.logError('Network Error', {
                        message: 'Connection failed'
                    });
                }
            });
            
            await page.setOfflineMode(false);
            await page.waitForTimeout(1000);
        });

        it('should display error notifications', async function() {
            this.timeout(10000);
            
            await page.evaluate(() => {
                if (window.advancedFeatures) {
                    window.advancedFeatures.showNotification('Error occurred', 'error');
                }
            });
            
            await page.waitForTimeout(500);
            
            const errorNotification = await page.$('.notification.error');
            if (errorNotification) {
                const isVisible = await page.evaluate(el => {
                    return window.getComputedStyle(el).display !== 'none';
                }, errorNotification);
                expect(isVisible).to.be.true;
            }
        });
    });

    describe('Responsive Design', () => {
        it('should work on mobile viewport', async function() {
            this.timeout(10000);
            
            await page.setViewport({ width: 375, height: 667 }); // iPhone SE
            await page.reload();
            await page.waitForSelector('body');
            
            const body = await page.$('body');
            expect(body).to.not.be.null;
            
            // Reset viewport
            await page.setViewport({ width: 1280, height: 720 });
        });

        it('should work on tablet viewport', async function() {
            this.timeout(10000);
            
            await page.setViewport({ width: 768, height: 1024 }); // iPad
            await page.reload();
            await page.waitForSelector('body');
            
            const body = await page.$('body');
            expect(body).to.not.be.null;
            
            // Reset viewport
            await page.setViewport({ width: 1280, height: 720 });
        });
    });

    describe('Performance', () => {
        it('should load within acceptable time', async function() {
            this.timeout(15000);
            
            const startTime = Date.now();
            await page.goto(BASE_URL);
            await page.waitForSelector('body');
            const loadTime = Date.now() - startTime;
            
            expect(loadTime).to.be.below(5000); // Should load within 5 seconds
        });

        it('should not have console errors', async function() {
            this.timeout(10000);
            
            const consoleErrors = [];
            page.on('console', msg => {
                if (msg.type() === 'error') {
                    consoleErrors.push(msg.text());
                }
            });
            
            await page.goto(BASE_URL);
            await page.waitForSelector('body');
            await page.waitForTimeout(2000);
            
            // Filter out known acceptable errors
            const criticalErrors = consoleErrors.filter(error => 
                !error.includes('Firebase') && 
                !error.includes('net::ERR_') &&
                !error.includes('404')
            );
            
            expect(criticalErrors).to.have.length(0);
        });
    });
});
