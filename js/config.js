// API Configuration - Updated for Render deployment
if (typeof API_BASE_URL === 'undefined') {
    const API_BASE_URL = window.location.hostname === 'localhost' 
        ? 'http://localhost:5000' 
        : 'https://securegov-backend.onrender.com';
    
    // Export for use in other files
    window.API_CONFIG = { BASE_URL: API_BASE_URL };
}
