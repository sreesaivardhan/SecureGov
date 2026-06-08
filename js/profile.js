'use strict';
/**
 * js/profile.js — Profile page
 * Depends on: firebase-init.js, config.js, utils.js
 */

document.addEventListener('DOMContentLoaded', async () => {
  const user = await requireAuth('../index.html');

  // Wire up the logout button in danger zone
  const btn2 = document.getElementById('logoutBtn2');
  if (btn2) btn2.addEventListener('click', logout);

  // Show email verified badge
  if (user.emailVerified) {
    document.getElementById('emailVerifiedBadge').style.display   = 'flex';
    document.getElementById('emailUnverifiedBadge').style.display = 'none';
  } else {
    document.getElementById('emailVerifiedBadge').style.display   = 'none';
    document.getElementById('emailUnverifiedBadge').style.display = 'flex';
  }

  // Set email (readonly)
  document.getElementById('profileEmailInput').value = user.email || '';
  document.getElementById('profileEmail').textContent = user.email || '';

  await loadProfile(user);

  document.getElementById('profileForm').addEventListener('submit', saveProfile);
});

/* ── Load profile ─────────────────────────────────────────── */

async function loadProfile(user) {
  const saveBtn = document.getElementById('saveProfileBtn');
  saveBtn.disabled = true;

  try {
    const res     = await apiFetch('/api/profile');
    const profile = res.profile || {};

    // Sidebar + avatar
    setUserDisplay(firebase.auth().currentUser, profile);

    // Header avatar section
    const name    = profile.name || user.displayName || '';
    const initial = (name || user.email || '?')[0].toUpperCase();

    document.getElementById('profileAvatar').textContent = initial;
    document.getElementById('profileName').textContent   = name || user.email.split('@')[0];
    document.getElementById('profileJoined').textContent =
      profile.createdAt ? `Member since ${formatDate(profile.createdAt)}` : '';

    // Form fields
    document.getElementById('profileNameInput').value = name;
    document.getElementById('profilePhone').value     = profile.phone   || '';
    document.getElementById('profileAddress').value   = profile.address || '';
  } catch (err) {
    showToast('Failed to load profile: ' + err.message, 'error');
  } finally {
    saveBtn.disabled = false;
  }
}

/* ── Save profile ─────────────────────────────────────────── */

async function saveProfile(e) {
  e.preventDefault();

  const name    = document.getElementById('profileNameInput').value.trim();
  const phone   = document.getElementById('profilePhone').value.trim();
  const address = document.getElementById('profileAddress').value.trim();

  const btn = document.getElementById('saveProfileBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Saving…';

  try {
    await apiFetch('/api/profile', {
      method: 'PUT',
      body: JSON.stringify({ name, phone, address }),
    });

    // Update Firebase display name if changed
    const fbUser = firebase.auth().currentUser;
    if (fbUser && name && fbUser.displayName !== name) {
      await fbUser.updateProfile({ displayName: name });
    }

    showToast('Profile saved', 'success');

    // Refresh display
    document.getElementById('profileName').textContent  = name || fbUser.email.split('@')[0];
    document.getElementById('profileAvatar').textContent = (name || fbUser.email || '?')[0].toUpperCase();
    document.getElementById('sidebarUserName').textContent = name || fbUser.email.split('@')[0];
    document.getElementById('sidebarUserAvatar').textContent = (name || fbUser.email || '?')[0].toUpperCase();
  } catch (err) {
    showToast('Save failed: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-save"></i> Save Changes';
  }
}
