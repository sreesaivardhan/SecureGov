// API Configuration - Updated for production deployment
const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:5000' 
    : 'https://your-backend-server.herokuapp.com';

// Export for use in other files
window.API_CONFIG = { BASE_URL: API_BASE_URL };
window.API_CONFIG = API_CONFIG;
