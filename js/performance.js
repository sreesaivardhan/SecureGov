// Performance optimization utilities
class PerformanceOptimizer {
    constructor() {
        this.cache = new Map();
        this.debounceTimers = new Map();
        this.throttleTimers = new Map();
        this.lazyLoadObserver = null;
        this.setupLazyLoading();
        this.setupPerformanceMonitoring();
    }

    // Debounce function calls
    debounce(func, delay, key) {
        return (...args) => {
            clearTimeout(this.debounceTimers.get(key));
            this.debounceTimers.set(key, setTimeout(() => func.apply(this, args), delay));
        };
    }

    // Throttle function calls
    throttle(func, delay, key) {
        return (...args) => {
            if (!this.throttleTimers.get(key)) {
                func.apply(this, args);
                this.throttleTimers.set(key, setTimeout(() => {
                    this.throttleTimers.delete(key);
                }, delay));
            }
        };
    }

    // Cache API responses
    cacheResponse(key, data, ttl = 300000) { // 5 minutes default TTL
        const expiry = Date.now() + ttl;
        this.cache.set(key, { data, expiry });
    }

    getCachedResponse(key) {
        const cached = this.cache.get(key);
        if (cached && cached.expiry > Date.now()) {
            return cached.data;
        }
        this.cache.delete(key);
        return null;
    }

    // Optimize API calls with caching
    async optimizedFetch(url, options = {}, cacheKey = null, ttl = 300000) {
        // Check cache first
        if (cacheKey) {
            const cached = this.getCachedResponse(cacheKey);
            if (cached) {
                return cached;
            }
        }

        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Cache successful responses
            if (cacheKey && response.status === 200) {
                this.cacheResponse(cacheKey, data, ttl);
            }
            
            return data;
        } catch (error) {
            console.error('Optimized fetch error:', error);
            throw error;
        }
    }

    // Setup lazy loading for images and content
    setupLazyLoading() {
        if ('IntersectionObserver' in window) {
            this.lazyLoadObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const element = entry.target;
                        
                        if (element.dataset.src) {
                            element.src = element.dataset.src;
                            element.removeAttribute('data-src');
                        }
                        
                        if (element.dataset.load) {
                            this.loadContent(element);
                        }
                        
                        this.lazyLoadObserver.unobserve(element);
                    }
                });
            }, {
                rootMargin: '50px 0px',
                threshold: 0.01
            });
        }
    }

    // Register element for lazy loading
    lazyLoad(element) {
        if (this.lazyLoadObserver) {
            this.lazyLoadObserver.observe(element);
        } else {
            // Fallback for browsers without IntersectionObserver
            if (element.dataset.src) {
                element.src = element.dataset.src;
            }
            if (element.dataset.load) {
                this.loadContent(element);
            }
        }
    }

    // Load content dynamically
    async loadContent(element) {
        const loadType = element.dataset.load;
        const loadUrl = element.dataset.url;
        
        try {
            switch (loadType) {
                case 'documents':
                    await this.loadDocuments(element);
                    break;
                case 'family':
                    await this.loadFamilyData(element);
                    break;
                default:
                    if (loadUrl) {
                        const response = await fetch(loadUrl);
                        const html = await response.text();
                        element.innerHTML = html;
                    }
            }
        } catch (error) {
            console.error('Content loading error:', error);
            element.innerHTML = '<p>Error loading content</p>';
        }
    }

    // Optimize document loading
    async loadDocuments(container) {
        const cacheKey = 'documents_list';
        try {
            const data = await this.optimizedFetch('/api/documents', {
                headers: {
                    'Authorization': `Bearer ${await this.getAuthToken()}`
                }
            }, cacheKey, 60000); // 1 minute cache

            if (window.displayDocuments) {
                window.displayDocuments(data.documents);
            }
        } catch (error) {
            console.error('Document loading error:', error);
        }
    }

    // Optimize family data loading
    async loadFamilyData(container) {
        const cacheKey = 'family_data';
        try {
            const data = await this.optimizedFetch('/api/family/members', {
                headers: {
                    'Authorization': `Bearer ${await this.getAuthToken()}`
                }
            }, cacheKey, 120000); // 2 minute cache

            if (window.displayFamilyMembers) {
                window.displayFamilyMembers(data.members);
            }
            if (window.displayPendingInvitations) {
                window.displayPendingInvitations(data.pendingInvitations);
            }
        } catch (error) {
            console.error('Family data loading error:', error);
        }
    }

    // Get authentication token
    async getAuthToken() {
        if (firebase.auth().currentUser) {
            return await firebase.auth().currentUser.getIdToken();
        }
        throw new Error('User not authenticated');
    }

    // Performance monitoring
    setupPerformanceMonitoring() {
        // Monitor page load performance
        window.addEventListener('load', () => {
            setTimeout(() => {
                const perfData = performance.getEntriesByType('navigation')[0];
                if (perfData) {
                    console.log('Page Load Performance:', {
                        domContentLoaded: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
                        loadComplete: perfData.loadEventEnd - perfData.loadEventStart,
                        totalTime: perfData.loadEventEnd - perfData.navigationStart
                    });
                }
            }, 0);
        });

        // Monitor resource loading
        const observer = new PerformanceObserver((list) => {
            list.getEntries().forEach((entry) => {
                if (entry.duration > 1000) { // Log slow resources
                    console.warn('Slow resource:', entry.name, `${entry.duration}ms`);
                }
            });
        });
        
        if ('PerformanceObserver' in window) {
            observer.observe({ entryTypes: ['resource'] });
        }
    }

    // Optimize images
    optimizeImage(img, maxWidth = 800, quality = 0.8) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            img.onload = () => {
                const ratio = Math.min(maxWidth / img.width, maxWidth / img.height);
                canvas.width = img.width * ratio;
                canvas.height = img.height * ratio;
                
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                canvas.toBlob(resolve, 'image/jpeg', quality);
            };
        });
    }

    // Preload critical resources
    preloadResource(url, type = 'fetch') {
        const link = document.createElement('link');
        link.rel = 'preload';
        link.href = url;
        
        switch (type) {
            case 'script':
                link.as = 'script';
                break;
            case 'style':
                link.as = 'style';
                break;
            case 'font':
                link.as = 'font';
                link.crossOrigin = 'anonymous';
                break;
            default:
                link.as = 'fetch';
                link.crossOrigin = 'anonymous';
        }
        
        document.head.appendChild(link);
    }

    // Bundle and minify inline scripts
    bundleScripts() {
        const scripts = document.querySelectorAll('script[data-bundle]');
        const bundledCode = Array.from(scripts).map(script => script.textContent).join('\n');
        
        // Remove original scripts
        scripts.forEach(script => script.remove());
        
        // Create bundled script
        const bundledScript = document.createElement('script');
        bundledScript.textContent = bundledCode;
        document.head.appendChild(bundledScript);
    }

    // Clean up resources
    cleanup() {
        this.cache.clear();
        this.debounceTimers.clear();
        this.throttleTimers.clear();
        
        if (this.lazyLoadObserver) {
            this.lazyLoadObserver.disconnect();
        }
    }

    // Get performance metrics
    getMetrics() {
        return {
            cacheSize: this.cache.size,
            cacheHitRate: this.calculateCacheHitRate(),
            memoryUsage: this.getMemoryUsage(),
            timing: this.getTimingMetrics()
        };
    }

    calculateCacheHitRate() {
        // Implementation would track hits/misses
        return 0.85; // Placeholder
    }

    getMemoryUsage() {
        if ('memory' in performance) {
            return {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            };
        }
        return null;
    }

    getTimingMetrics() {
        const timing = performance.timing;
        return {
            dns: timing.domainLookupEnd - timing.domainLookupStart,
            tcp: timing.connectEnd - timing.connectStart,
            request: timing.responseStart - timing.requestStart,
            response: timing.responseEnd - timing.responseStart,
            dom: timing.domContentLoadedEventEnd - timing.domLoading,
            load: timing.loadEventEnd - timing.loadEventStart
        };
    }
}

// Create global instance
window.performanceOptimizer = new PerformanceOptimizer();

// Optimize common functions
window.optimizedSearch = window.performanceOptimizer.debounce(
    window.advancedFeatures?.searchDocuments || (() => {}), 
    300, 
    'search'
);

window.optimizedFilter = window.performanceOptimizer.throttle(
    window.advancedFeatures?.filterDocuments || (() => {}), 
    100, 
    'filter'
);

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PerformanceOptimizer;
}
