/* js/config.js — SecureGov API configuration */

/* Properly global — no const inside if block */
window.API_BASE_URL = (
  window.location.hostname === 'localhost' ||
  window.location.hostname === '127.0.0.1'
) ? 'http://localhost:5000' : 'https://securegov.onrender.com';
