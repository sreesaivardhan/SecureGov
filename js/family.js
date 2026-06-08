'use strict';
/**
 * js/family.js — Family groups, invitations, and member management
 * Depends on: firebase-init.js, config.js, utils.js
 */

let inviteGroupId = null; // which group the invite modal is for
let currentUid    = null;

document.addEventListener('DOMContentLoaded', async () => {
  const user = await requireAuth('../index.html');
  currentUid = user.uid;

  try {
    const res = await apiFetch('/api/profile');
    setUserDisplay(user, res.profile);
  } catch (_) {
    setUserDisplay(user, null);
  }

  // Wire up confirm modal buttons (uses _resolveConfirm from utils.js)
  document.getElementById('confirmModalOkBtn')    .addEventListener('click', () => _resolveConfirm(true));
  document.getElementById('confirmModalCancelBtn').addEventListener('click', () => _resolveConfirm(false));
  document.getElementById('confirmModalClose')    .addEventListener('click', () => _resolveConfirm(false));

  // Create group
  document.getElementById('createGroupBtn').addEventListener('click', () => openModal('createGroupModal'));
  document.getElementById('createGroupForm').addEventListener('submit', handleCreateGroup);

  // Invite member
  document.getElementById('inviteForm').addEventListener('submit', handleInvite);

  await Promise.all([loadGroups(), loadInvitations()]);
});

/* ── Groups ─────────────────────────────────────────────────── */

async function loadGroups() {
  const container = document.getElementById('groupsList');
  try {
    const res    = await apiFetch('/api/family/groups');
    const groups = res.groups || [];

    if (groups.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-users"></i>
          <h3>No family groups yet</h3>
          <p>Create a group to start inviting family members and sharing documents.</p>
          <button class="btn btn-primary btn-sm mt-4" onclick="openModal('createGroupModal')">
            <i class="fas fa-plus"></i> Create Group
          </button>
        </div>`;
      return;
    }

    container.innerHTML = groups.map(g => renderGroup(g)).join('');
  } catch (err) {
    container.innerHTML = `
      <div class="alert alert-danger">
        <i class="fas fa-exclamation-circle"></i>
        ${escapeHtml(err.message)}
      </div>`;
  }
}

function renderGroup(group) {
  const isAdmin = group.myRole === 'admin';
  const roleBadge = {
    admin:  'badge-accent',
    member: 'badge-info',
    viewer: 'badge-muted',
  }[group.myRole] || 'badge-muted';

  const membersHtml = (group.members || []).map(m => {
    const initial = (m.displayName || m.email || '?')[0].toUpperCase();
    const isMe    = m.uid === currentUid;
    const mRole   = { admin: 'badge-accent', member: 'badge-info', viewer: 'badge-muted' }[m.role] || 'badge-muted';

    return `
      <div class="member-item">
        <div class="member-avatar">${escapeHtml(initial)}</div>
        <div class="member-info">
          <div class="member-name">
            ${escapeHtml(m.displayName || m.email.split('@')[0])}
            ${isMe ? '<span class="badge badge-muted" style="font-size:10px;">You</span>' : ''}
          </div>
          <div class="member-email">${escapeHtml(m.email)}</div>
        </div>
        <div class="flex items-center gap-2">
          <span class="badge ${mRole}">${m.role}</span>
          ${isAdmin && !isMe
            ? `<button class="btn btn-ghost btn-sm btn-icon text-danger"
                       title="Remove member"
                       onclick="removeMember('${group.id}','${m.uid}','${escapeHtml(m.displayName || m.email)}')">
                 <i class="fas fa-times"></i>
               </button>`
            : ''}
        </div>
      </div>`;
  }).join('');

  return `
    <div class="group-card" id="group-${group.id}">
      <div class="group-header">
        <div>
          <div class="group-name">${escapeHtml(group.name)}</div>
          <div class="group-meta">
            ${group.members.length} member${group.members.length !== 1 ? 's' : ''}
            · Created ${formatDate(group.createdAt)}
          </div>
        </div>
        <div class="flex items-center gap-2">
          <span class="badge ${roleBadge}">${group.myRole}</span>
          ${isAdmin
            ? `<button class="btn btn-primary btn-sm"
                       onclick="openInviteModal('${group.id}')">
                 <i class="fas fa-user-plus"></i> Invite
               </button>
               <button class="btn btn-ghost btn-sm btn-icon text-danger"
                       title="Delete group"
                       onclick="deleteGroup('${group.id}','${escapeHtml(group.name)}')">
                 <i class="fas fa-trash"></i>
               </button>`
            : ''}
        </div>
      </div>
      <div class="group-body">
        ${group.members.length > 0
          ? `<div class="member-list">${membersHtml}</div>`
          : `<p class="text-sm text-muted">No members yet.</p>`}
      </div>
    </div>`;
}

/* ── Invitations ────────────────────────────────────────────── */

async function loadInvitations() {
  const container = document.getElementById('invitationsList');
  try {
    const res         = await apiFetch('/api/family/invitations');
    const invitations = res.invitations || [];

    const received = invitations.filter(i => i.direction === 'received' && i.status === 'pending');
    const sent     = invitations.filter(i => i.direction === 'sent');

    // Show banner if there are received invites
    if (received.length > 0) {
      const banner = document.getElementById('receivedBanner');
      document.getElementById('receivedBannerText').textContent =
        `You have ${received.length} pending invitation${received.length > 1 ? 's' : ''}.`;
      banner.style.display = 'flex';
    }

    if (invitations.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding:24px 0;">
          <i class="fas fa-envelope-open"></i>
          <h3>No invitations</h3>
          <p>Sent and received invitations will appear here.</p>
        </div>`;
      return;
    }

    let html = '';
    if (received.length > 0) {
      html += `<div class="section-title mb-4" style="margin-top:0;">Received</div>`;
      html += received.map(renderReceivedInvite).join('');
    }
    if (sent.length > 0) {
      html += `<div class="section-title mb-4" style="margin-top:${received.length ? '24px' : '0'};">Sent</div>`;
      html += sent.map(renderSentInvite).join('');
    }

    container.innerHTML = html;
  } catch (err) {
    container.innerHTML = `
      <div class="alert alert-danger">
        <i class="fas fa-exclamation-circle"></i>
        ${escapeHtml(err.message)}
      </div>`;
  }
}

function renderReceivedInvite(inv) {
  return `
    <div class="invite-item received" id="inv-${inv.token.slice(0, 8)}">
      <div class="invite-info">
        <div class="invite-from">
          <i class="fas fa-user" style="color:var(--accent);margin-right:6px;"></i>
          ${escapeHtml(inv.invitedByName || 'Someone')} invited you to
          <strong>${escapeHtml(inv.groupName)}</strong>
        </div>
        <div class="invite-detail">
          Role: <span class="badge badge-info">${inv.role}</span>
          &nbsp;·&nbsp; Expires ${formatDate(inv.expiresAt)}
        </div>
      </div>
      <div class="invite-actions">
        <button class="btn btn-primary btn-sm" onclick="acceptInvite('${inv.token}')">
          <i class="fas fa-check"></i> Accept
        </button>
        <button class="btn btn-danger-outline btn-sm" onclick="rejectInvite('${inv.token}')">
          Decline
        </button>
      </div>
    </div>`;
}

function renderSentInvite(inv) {
  const statusBadge = {
    pending:  'badge-warning',
    accepted: 'badge-success',
    rejected: 'badge-danger',
    expired:  'badge-muted',
  }[inv.status] || 'badge-muted';

  return `
    <div class="invite-item">
      <div class="invite-info">
        <div class="invite-from">Invited <strong>${escapeHtml(inv.email)}</strong> to ${escapeHtml(inv.groupName)}</div>
        <div class="invite-detail">
          Role: ${inv.role} &nbsp;·&nbsp; Sent ${formatDate(inv.createdAt)}
        </div>
      </div>
      <span class="badge ${statusBadge}">${inv.status}</span>
    </div>`;
}

/* ── Create Group ───────────────────────────────────────────── */

async function handleCreateGroup(e) {
  e.preventDefault();
  const name = document.getElementById('groupName').value.trim();
  if (!name) { showToast('Group name is required', 'warning'); return; }

  const btn = document.getElementById('createGroupBtn2');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Creating…';

  try {
    await apiFetch('/api/family/groups', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
    showToast(`Group "${name}" created`, 'success');
    closeModal('createGroupModal');
    document.getElementById('createGroupForm').reset();
    await loadGroups();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-plus"></i> Create';
  }
}

/* ── Delete Group ───────────────────────────────────────────── */

async function deleteGroup(groupId, name) {
  const confirmed = await confirmAction(
    'Delete Group',
    `Delete "${name}"? This cannot be undone. Remove all members first if you have any.`,
    'Delete Group',
    true
  );
  if (!confirmed) return;

  try {
    const res = await apiFetch(`/api/family/groups/${groupId}`, { method: 'DELETE' });
    showToast(res.message || `Group "${name}" deleted`, 'success');
    await loadGroups();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ── Invite Member ──────────────────────────────────────────── */

function openInviteModal(groupId) {
  inviteGroupId = groupId;
  document.getElementById('inviteForm').reset();
  openModal('inviteModal');
}

async function handleInvite(e) {
  e.preventDefault();
  if (!inviteGroupId) { showToast('No group selected', 'error'); return; }

  const email = document.getElementById('inviteEmail').value.trim();
  const role  = document.getElementById('inviteRole').value;
  const btn   = document.getElementById('inviteSubmitBtn');

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Sending…';

  try {
    const res = await apiFetch('/api/family/invite', {
      method: 'POST',
      body: JSON.stringify({ email, groupId: inviteGroupId, role }),
    });

    // Reset button and close modal BEFORE any async work
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Invitation';
    closeModal('inviteModal');

    showToast(res.message || `Invitation sent to ${email}`, 'success');

    // If email not configured, show the token for testing
    if (res.invitation && res.invitation.emailSent === false) {
      showToast(`Dev: check server console for invitation link`, 'info');
    }

    // Reload in background — don't await so UI isn't blocked
    loadInvitations();
  } catch (err) {
    showToast(err.message, 'error');
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane"></i> Send Invitation';
  }
}

/* ── Accept / Reject ────────────────────────────────────────── */

async function acceptInvite(token) {
  try {
    const res = await apiFetch(`/api/family/accept/${token}`, { method: 'POST' });
    showToast(res.message || 'Invitation accepted', 'success');
    await Promise.all([loadGroups(), loadInvitations()]);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function rejectInvite(token) {
  try {
    const res = await apiFetch(`/api/family/reject/${token}`, { method: 'POST' });
    showToast(res.message || 'Invitation declined', 'success');
    await loadInvitations();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ── Remove Member ──────────────────────────────────────────── */

async function removeMember(groupId, memberUid, name) {
  const confirmed = await confirmAction(
    'Remove Member',
    `Remove ${name} from this group? They will lose access to any documents shared with the group.`,
    'Remove',
    true
  );
  if (!confirmed) return;

  try {
    await apiFetch(`/api/family/groups/${groupId}/members/${memberUid}`, { method: 'DELETE' });
    showToast(`${name} removed from group`, 'success');
    await loadGroups();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

/* ── Scroll to invitations ──────────────────────────────────── */

function scrollToInvitations() {
  document.getElementById('invitationsSection').scrollIntoView({ behavior: 'smooth' });
}
