/**
 * js/utils.js — Shared utilities for SecureGov
 *
 * Load AFTER: firebase-init.js, config.js
 * Load BEFORE: any page-specific JS
 */

/* ── Theme ───────────────────────────────────────────────────── */

function initTheme() {
  const saved = localStorage.getItem('sg-theme') || 'dark';
  applyTheme(saved);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('sg-theme', theme);
  const btn = document.getElementById('themeToggle');
  if (btn) {
    btn.innerHTML = theme === 'dark'
      ? '<i class="fas fa-sun"></i>'
      : '<i class="fas fa-moon"></i>';
    btn.title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

/* ── Toast Notifications ─────────────────────────────────────── */

function showToast(message, type = 'info') {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    success: 'fa-check-circle',
    error:   'fa-times-circle',
    warning: 'fa-exclamation-triangle',
    info:    'fa-info-circle',
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type === 'error' ? 'error' : type}`;
  toast.innerHTML = `
    <i class="fas ${icons[type] || icons.info} toast-icon toast-${type}"></i>
    <span class="toast-message">${escapeHtml(message)}</span>
    <button class="toast-close" onclick="this.closest('.toast').remove()" aria-label="Close">&times;</button>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    if (toast.isConnected) {
      toast.style.transition = 'opacity 0.3s';
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }
  }, 4000);
}

/* ── API Fetch Wrapper ───────────────────────────────────────── */

async function apiFetch(path, options = {}) {
  const user = firebase.auth().currentUser;
  let token = null;
  if (user) {
    try { token = await user.getIdToken(false); } catch (_) {}
  }

  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  // Don't set Content-Type for FormData (browser sets multipart boundary)
  const isFormData = options.body instanceof FormData;
  if (!isFormData) headers['Content-Type'] = 'application/json';

  // Merge caller headers last so they can override
  Object.assign(headers, options.headers || {});

  let response;
  try {
    response = await fetch(`${window.API_BASE_URL}${path}`, {
      ...options,
      headers,
    });
  } catch (networkErr) {
    throw new Error('Network error — is the backend running?');
  }

  let data = {};
  try {
    const text = await response.text();
    if (text) {
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        console.warn(`[apiFetch] Response was not valid JSON (status ${response.status}):`, text.substring(0, 200));
        // If response is not ok, we handle it below. If it IS ok, we just leave data as {}.
      }
    }
  } catch (textErr) {
    console.warn('[apiFetch] Failed to read response text:', textErr);
  }

  if (!response.ok) {
    const msg = data.message || `Request failed (${response.status})`;
    throw Object.assign(new Error(msg), { status: response.status, data });
  }

  return data;
}

/* ── Auth helpers ────────────────────────────────────────────── */

function requireAuth(redirectPath = '../index.html') {
  return new Promise((resolve) => {
    firebase.auth().onAuthStateChanged((user) => {
      if (!user) {
        window.location.href = redirectPath;
      } else {
        resolve(user);
      }
    });
  });
}

async function logout() {
  try {
    await firebase.auth().signOut();
    window.location.href = '../index.html';
  } catch (err) {
    showToast('Sign out failed', 'error');
  }
}

/* ── Sidebar + mobile menu ───────────────────────────────────── */

function initSidebar() {
  const btn = document.getElementById('mobileMenuBtn');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebarOverlay');

  if (btn && sidebar) {
    btn.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay && overlay.classList.toggle('open');
    });
  }
  if (overlay) {
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('open');
    });
  }
}

/* ── Populate user display in sidebar ───────────────────────── */

function setUserDisplay(user, profile) {
  const nameEl  = document.getElementById('sidebarUserName');
  const emailEl = document.getElementById('sidebarUserEmail');
  const avatarEl = document.getElementById('sidebarUserAvatar');

  const name  = (profile && profile.name) || user.displayName || '';
  const email = user.email || '';
  const initial = (name || email || '?')[0].toUpperCase();

  if (nameEl)  nameEl.textContent  = name || email.split('@')[0];
  if (emailEl) emailEl.textContent = email;
  if (avatarEl) avatarEl.textContent = initial;
}

/* ── Modal helpers ───────────────────────────────────────────── */

function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('open');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('open');
}

// Close modal when clicking backdrop
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
    // If the confirm modal was closed via backdrop, resolve false
    if (e.target.id === 'confirmModal' && typeof _confirmResolve === 'function') {
      _confirmResolve(false);
      _confirmResolve = null;
    }
  }
});

/* ── In-app confirmation modal ───────────────────────────────── */

// Internal state — one confirm at a time
let _confirmResolve = null;

/**
 * Show a styled in-app confirmation modal.
 * Returns Promise<boolean> — true if confirmed, false if cancelled.
 *
 * Requires #confirmModal markup to be present on the page.
 * @param {string} title
 * @param {string} message
 * @param {string} [confirmLabel='Confirm']
 * @param {boolean} [isDanger=true]
 */
function confirmAction(title, message, confirmLabel = 'Confirm', isDanger = true) {
  const titleEl = document.getElementById('confirmModalTitle');
  const msgEl   = document.getElementById('confirmModalMessage');
  const okBtn   = document.getElementById('confirmModalOkBtn');

  if (!titleEl || !msgEl || !okBtn) {
    // Fallback if markup missing — should not happen in production
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }

  titleEl.textContent  = title;
  msgEl.textContent    = message;
  okBtn.textContent    = confirmLabel;
  okBtn.className      = `btn ${isDanger ? 'btn-danger' : 'btn-primary'}`;

  openModal('confirmModal');

  return new Promise((resolve) => {
    _confirmResolve = resolve;
  });
}

function _resolveConfirm(result) {
  closeModal('confirmModal');
  if (typeof _confirmResolve === 'function') {
    _confirmResolve(result);
    _confirmResolve = null;
  }
}

/* ── Formatting ──────────────────────────────────────────────── */

function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ── Category metadata ───────────────────────────────────────── */

const CATEGORIES = {
  aadhaar:         { label: 'Aadhaar',          icon: 'fa-id-card',     color: 'badge-info'    },
  pan:             { label: 'PAN Card',          icon: 'fa-credit-card', color: 'badge-accent'  },
  passport:        { label: 'Passport',          icon: 'fa-passport',    color: 'badge-success' },
  driving_license: { label: 'Driving Licence',   icon: 'fa-car',         color: 'badge-warning' },
  marksheet:       { label: 'Marksheet',         icon: 'fa-graduation-cap', color: 'badge-info' },
  certificate:     { label: 'Certificate',       icon: 'fa-certificate', color: 'badge-success' },
  medical:         { label: 'Medical',           icon: 'fa-heartbeat',   color: 'badge-danger'  },
  financial:       { label: 'Financial',         icon: 'fa-file-invoice-dollar', color: 'badge-warning' },
  other:           { label: 'Other',             icon: 'fa-file-alt',    color: 'badge-muted'   },
};

function getCategoryMeta(cat) {
  return CATEGORIES[cat] || CATEGORIES.other;
}

function getFileIcon(mimeType) {
  if (!mimeType) return { icon: 'fa-file', cls: 'file' };
  if (mimeType.includes('pdf'))   return { icon: 'fa-file-pdf',   cls: 'pdf'   };
  if (mimeType.includes('image')) return { icon: 'fa-file-image', cls: 'image' };
  return { icon: 'fa-file-alt', cls: 'file' };
}

/* ── Pending invitation badge ────────────────────────────────── */

/**
 * Fetches pending received invitations and shows a count badge
 * on the Family nav link. Silent fail if not on an authenticated page.
 */
async function loadInviteBadge() {
  try {
    const navLink = document.querySelector('a.nav-link[href*="family"]');
    if (!navLink) return;

    const res  = await apiFetch('/api/family/invitations');
    const invs = res.invitations || [];
    const count = invs.filter(i => i.direction === 'received' && i.status === 'pending').length;

    // Remove any existing badge first
    const existing = navLink.querySelector('.nav-badge');
    if (existing) existing.remove();

    if (count > 0) {
      const badge = document.createElement('span');
      badge.className = 'nav-badge';
      badge.textContent = count > 9 ? '9+' : count;
      navLink.appendChild(badge);
    }
  } catch (_) {
    // Not authenticated yet or network error — silent
  }
}

/* ── Init on DOMContentLoaded ────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initSidebar();
  document.getElementById('themeToggle')
    && document.getElementById('themeToggle').addEventListener('click', toggleTheme);
  document.getElementById('logoutBtn')
    && document.getElementById('logoutBtn').addEventListener('click', logout);

  // Load invite badge on all app pages (non-auth pages have no .nav-link so it silently skips)
  firebase.auth().onAuthStateChanged((user) => {
    if (user) loadInviteBadge();
  });
});
