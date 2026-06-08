'use strict';
/**
 * js/accept-invitation.js
 * Handles the invitation accept/reject page.
 * Works as a standalone page — no sidebar auth redirect.
 */

(function () {
  const params = new URLSearchParams(window.location.search);
  const token  = params.get('token');
  const action = params.get('action'); // 'accept' | 'reject' | null

  /* ── Pre-flight: no token → show invalid ─────────────────── */
  if (!token) {
    showState('invalid');
    document.getElementById('invalidTitle').textContent = 'Missing Token';
    document.getElementById('invalidMsg').textContent   = 'No invitation token found in this link.';
    return;
  }

  /* ── Wait for Firebase auth state ────────────────────────── */
  firebase.auth().onAuthStateChanged(async (user) => {
    if (!user) {
      // Not logged in — store token so login page can redirect back
      sessionStorage.setItem('pendingInviteToken',  token);
      sessionStorage.setItem('pendingInviteAction', action || 'view');

      // Update login button to go back here after sign in
      const loginBtn = document.getElementById('loginRedirectBtn');
      if (loginBtn) {
        const returnUrl = encodeURIComponent(window.location.href);
        loginBtn.href = `../index.html?return=${returnUrl}`;
      }

      showState('login');
      return;
    }

    // Logged in — show invite card
    document.getElementById('currentUserEmail').textContent = user.email || '';
    showState('invite');

    // Load invitation details from /api/family/invitations
    await loadInviteDetails(user, token, action);
  });

  /* ── Load invite details ─────────────────────────────────── */

  async function loadInviteDetails(user, token, action) {
    try {
      const res  = await apiFetch('/api/family/invitations');
      const invs = res.invitations || [];

      // Find the matching invitation by token
      const inv = invs.find(i => i.token === token);

      if (!inv) {
        showState('invalid');
        document.getElementById('invalidTitle').textContent = 'Invitation Not Found';
        document.getElementById('invalidMsg').textContent   =
          'This invitation may have expired or already been used.';
        return;
      }

      // Already responded
      if (inv.status !== 'pending') {
        showState('invalid');
        document.getElementById('invalidTitle').textContent =
          inv.status === 'accepted' ? 'Already Accepted' : 'Invitation Closed';
        document.getElementById('invalidMsg').textContent =
          inv.status === 'accepted'
            ? `You already joined "${inv.groupName}".`
            : `This invitation was ${inv.status}.`;
        return;
      }

      // Populate details
      document.getElementById('inviterName').textContent     = inv.invitedByName || 'A family member';
      document.getElementById('groupNameDisplay').textContent = inv.groupName || '—';
      document.getElementById('inviteGroupDisplay').textContent = inv.groupName || '—';
      document.getElementById('inviteRoleDisplay').textContent  = inv.role || 'member';
      document.getElementById('inviteExpiryDisplay').textContent = formatDate(inv.expiresAt);

      // Wire buttons
      document.getElementById('acceptBtn').addEventListener('click',  () => respond(token, 'accept'));
      document.getElementById('declineBtn').addEventListener('click', () => respond(token, 'reject'));

      // If action param is set, auto-trigger after a short delay
      if (action === 'accept' || action === 'reject') {
        setTimeout(() => respond(token, action === 'accept' ? 'accept' : 'reject'), 600);
      }
    } catch (err) {
      showInviteError(err.message);
    }
  }

  /* ── Respond (accept or reject) ─────────────────────────── */

  async function respond(token, type) {
    const acceptBtn  = document.getElementById('acceptBtn');
    const declineBtn = document.getElementById('declineBtn');

    if (acceptBtn)  acceptBtn.disabled  = true;
    if (declineBtn) declineBtn.disabled = true;
    if (acceptBtn)  acceptBtn.innerHTML = '<span class="spinner"></span>';

    try {
      const endpoint = type === 'accept'
        ? `/api/family/accept/${token}`
        : `/api/family/reject/${token}`;

      const res = await apiFetch(endpoint, { method: 'POST' });

      // Show success state
      document.getElementById('inviteContent').style.display = 'none';
      document.getElementById('inviteSuccess').style.display = '';

      if (type === 'accept') {
        document.getElementById('successTitle').textContent = `You're in!`;
        document.getElementById('successMsg').textContent   =
          res.message || 'You have joined the family group.';
      } else {
        document.getElementById('successTitle').textContent = 'Invitation Declined';
        document.getElementById('successMsg').textContent   = 'You declined the invitation.';
      }
    } catch (err) {
      if (acceptBtn)  acceptBtn.disabled  = false;
      if (declineBtn) declineBtn.disabled = false;
      if (acceptBtn)  acceptBtn.innerHTML = '<i class="fas fa-check"></i> Accept';

      const statusCode = err.status;
      if (statusCode === 403) {
        showInviteError('This invitation was not sent to your email address.');
      } else if (statusCode === 410) {
        showInviteError('This invitation has expired.');
      } else if (statusCode === 409) {
        showInviteError('This invitation has already been responded to.');
      } else {
        showInviteError(err.message);
      }
    }
  }

  function showInviteError(msg) {
    const el = document.getElementById('inviteError');
    document.getElementById('inviteErrorText').textContent = msg;
    el.style.display = 'flex';
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  /* ── State switcher ─────────────────────────────────────── */

  function showState(state) {
    const states = ['loadingCard', 'loginCard', 'inviteCard', 'invalidCard'];
    states.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
    const target = document.getElementById(state + 'Card');
    if (target) target.style.display = '';
  }

  // Default: show loading while Firebase resolves
  showState('loading');

})();
