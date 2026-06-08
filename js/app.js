/**
 * js/app.js — Login / Register / Forgot Password page logic
 * Depends on: firebase-init.js, config.js, utils.js
 *
 * Features:
 *  - Email/password login
 *  - Email/password register
 *  - Google sign-in (popup) — login + register share same handler
 *  - Forgot password (Firebase password reset email)
 *  - Return URL support: ?return=<url> redirects after auth (used by accept-invitation)
 */

(function () {
  'use strict';

  /* ── Return URL (from invitation email link) ─────────────── */

  function getReturnUrl() {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('return');
    if (!raw) return null;
    try {
      const url = new URL(decodeURIComponent(raw));
      // Only allow same-origin or known Netlify return paths
      if (url.origin === window.location.origin || url.hostname.endsWith('.netlify.app')) {
        return url.href;
      }
    } catch (_) { /* ignore malformed */ }
    return null;
  }

  function afterAuthRedirect() {
    const returnUrl = getReturnUrl();
    window.location.href = returnUrl || 'pages/dashboard.html';
  }

  /* ── Screen switching ────────────────────────────────────── */

  function showScreen(id) {
    ['loginCard', 'registerCard', 'forgotCard'].forEach((cardId) => {
      const el = document.getElementById(cardId);
      if (el) el.style.display = cardId === id ? '' : 'none';
    });
  }

  /* ── Redirect if already logged in ──────────────────────── */

  firebase.auth().onAuthStateChanged((user) => {
    if (user) afterAuthRedirect();
  });

  /* ── Shared: sync user to backend after any auth method ─── */

  async function syncUser(user) {
    try {
      const token = await user.getIdToken();
      await fetch(`${window.API_BASE_URL}/api/auth/sync`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: user.displayName || '' }),
      });
    } catch (err) {
      // Non-fatal: backend sync failure should not block login
      console.warn('[auth] Backend sync failed:', err.message);
    }
  }

  /* ── Email / Password login ──────────────────────────────── */

  async function handleLogin(e) {
    e.preventDefault();
    const email    = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorEl  = document.getElementById('loginError');
    const btn      = document.getElementById('loginBtn');
    const text     = document.getElementById('loginBtnText');
    const spinner  = document.getElementById('loginBtnSpinner');

    errorEl.style.display = 'none';
    btn.disabled = true;
    text.style.display = 'none';
    spinner.style.display = '';

    try {
      const cred = await firebase.auth().signInWithEmailAndPassword(email, password);
      await syncUser(cred.user);
      afterAuthRedirect();
    } catch (err) {
      errorEl.textContent = friendlyAuthError(err.code);
      errorEl.style.display = 'flex';
      btn.disabled = false;
      text.style.display = '';
      spinner.style.display = 'none';
    }
  }

  /* ── Email / Password register ───────────────────────────── */

  async function handleRegister(e) {
    e.preventDefault();
    const name     = document.getElementById('regName').value.trim();
    const email    = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirm  = document.getElementById('regConfirm').value;
    const errorEl  = document.getElementById('registerError');
    const btn      = document.getElementById('registerBtn');
    const text     = document.getElementById('registerBtnText');
    const spinner  = document.getElementById('registerBtnSpinner');

    errorEl.style.display = 'none';

    if (!name) {
      errorEl.textContent = 'Please enter your full name.';
      errorEl.style.display = 'flex';
      return;
    }
    if (password !== confirm) {
      errorEl.textContent = 'Passwords do not match.';
      errorEl.style.display = 'flex';
      return;
    }

    btn.disabled = true;
    text.style.display = 'none';
    spinner.style.display = '';

    try {
      const cred = await firebase.auth().createUserWithEmailAndPassword(email, password);
      const user = cred.user;

      // Set Firebase display name before syncing so backend gets it
      await user.updateProfile({ displayName: name });

      await syncUser(user);
      afterAuthRedirect();
    } catch (err) {
      errorEl.textContent = friendlyAuthError(err.code);
      errorEl.style.display = 'flex';
      btn.disabled = false;
      text.style.display = '';
      spinner.style.display = 'none';
    }
  }

  /* ── Google sign-in (works from both login + register) ───── */

  async function handleGoogleSignIn(errorElId) {
    const errorEl = document.getElementById(errorElId);
    errorEl.style.display = 'none';

    const provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      const cred = await firebase.auth().signInWithPopup(provider);
      await syncUser(cred.user);
      afterAuthRedirect();
    } catch (err) {
      if (err.code === 'auth/popup-closed-by-user' || err.code === 'auth/cancelled-popup-request') {
        return; // user closed popup — silently ignore
      }
      errorEl.textContent = friendlyAuthError(err.code);
      errorEl.style.display = 'flex';
    }
  }

  /* ── Forgot password ─────────────────────────────────────── */

  async function handleForgotPassword(e) {
    e.preventDefault();
    const email   = document.getElementById('forgotEmail').value.trim();
    const errorEl = document.getElementById('forgotError');
    const successEl = document.getElementById('forgotSuccess');
    const btn     = document.getElementById('forgotBtn');
    const text    = document.getElementById('forgotBtnText');
    const spinner = document.getElementById('forgotBtnSpinner');

    errorEl.style.display   = 'none';
    successEl.style.display = 'none';

    if (!email) {
      errorEl.textContent = 'Please enter your email address.';
      errorEl.style.display = 'flex';
      return;
    }

    btn.disabled = true;
    text.style.display = 'none';
    spinner.style.display = '';

    try {
      await firebase.auth().sendPasswordResetEmail(email);
      successEl.innerHTML =
        '<i class="fas fa-check-circle"></i> Reset link sent! Check your inbox (and spam folder).';
      successEl.style.display = 'flex';
      document.getElementById('forgotForm').reset();
    } catch (err) {
      errorEl.textContent = friendlyAuthError(err.code);
      errorEl.style.display = 'flex';
    } finally {
      btn.disabled = false;
      text.style.display = '';
      spinner.style.display = 'none';
    }
  }

  /* ── Error messages ──────────────────────────────────────── */

  function friendlyAuthError(code) {
    const map = {
      'auth/user-not-found':                       'No account found with that email.',
      'auth/wrong-password':                       'Incorrect email or password.',
      'auth/invalid-credential':                   'Incorrect email or password.',
      'auth/invalid-login-credentials':            'Incorrect email or password.',
      'auth/invalid-email':                        'Please enter a valid email address.',
      'auth/email-already-in-use':                 'An account already exists with this email.',
      'auth/weak-password':                        'Password must be at least 6 characters.',
      'auth/too-many-requests':                    'Too many attempts. Please try again later.',
      'auth/network-request-failed':               'Network error. Check your connection and try again.',
      'auth/account-exists-with-different-credential':
                                                   'An account already exists with this email. Sign in with your password.',
      'auth/popup-blocked':                        'Popup was blocked. Please allow popups for this site and try again.',
      'auth/user-disabled':                        'This account has been disabled. Contact support.',
    };
    return map[code] || 'Something went wrong. Please try again.';
  }

  /* ── Event listeners ─────────────────────────────────────── */

  document.addEventListener('DOMContentLoaded', () => {
    initTheme();

    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('registerForm').addEventListener('submit', handleRegister);
    document.getElementById('forgotForm').addEventListener('submit', handleForgotPassword);

    document.getElementById('googleLoginBtn').addEventListener('click',    () => handleGoogleSignIn('loginError'));
    document.getElementById('googleRegisterBtn').addEventListener('click', () => handleGoogleSignIn('registerError'));

    document.getElementById('showRegister').addEventListener('click', (e) => { e.preventDefault(); showScreen('registerCard'); });
    document.getElementById('showLogin').addEventListener('click',    (e) => { e.preventDefault(); showScreen('loginCard'); });

    document.getElementById('forgotPasswordLink').addEventListener('click', (e) => { e.preventDefault(); showScreen('forgotCard'); });
    document.getElementById('backToLogin').addEventListener('click',        (e) => { e.preventDefault(); showScreen('loginCard'); });

    document.getElementById('themeToggle').addEventListener('click', toggleTheme);

    // Pre-fill forgot password email from login field when user clicks the link
    document.getElementById('forgotPasswordLink').addEventListener('click', () => {
      const loginEmail = document.getElementById('loginEmail').value.trim();
      if (loginEmail) document.getElementById('forgotEmail').value = loginEmail;
    });
  });

})();
