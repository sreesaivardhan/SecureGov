'use strict';
/**
 * js/dashboard.js — Dashboard page
 * Depends on: firebase-init.js, config.js, utils.js
 */

document.addEventListener('DOMContentLoaded', async () => {
  const user = await requireAuth('../index.html');

  // Load profile then stats concurrently
  let profile = null;
  try {
    const res = await apiFetch('/api/profile');
    profile = res.profile;
  } catch (_) {}

  setUserDisplay(user, profile);

  const name = (profile && profile.name) || user.displayName || user.email.split('@')[0];
  const welcomeEl = document.getElementById('welcomeMsg');
  if (welcomeEl) welcomeEl.textContent = `Welcome back, ${name.split(' ')[0]}`;

  // Parallel data load
  const [statsRes, sharedRes, familyRes] = await Promise.allSettled([
    apiFetch('/api/documents/stats'),
    apiFetch('/api/documents/shared-with-me'),
    apiFetch('/api/family/count'),
  ]);

  if (statsRes.status === 'fulfilled') {
    const s = statsRes.value.stats;
    document.getElementById('statDocs').textContent    = s.totalDocs ?? 0;
    document.getElementById('statStorage').textContent = formatFileSize(s.totalSizeBytes ?? 0);
  } else {
    document.getElementById('statDocs').textContent    = '—';
    document.getElementById('statStorage').textContent = '—';
  }

  document.getElementById('statShared').textContent = sharedRes.status === 'fulfilled'
    ? sharedRes.value.total ?? 0 : '—';

  document.getElementById('statFamily').textContent = familyRes.status === 'fulfilled'
    ? familyRes.value.count ?? 0 : '—';

  // Recent documents (last 5)
  loadRecentDocs();
});

async function loadRecentDocs() {
  const container = document.getElementById('recentDocsList');
  try {
    const res  = await apiFetch('/api/documents');
    const docs = (res.documents || []).slice(0, 5);

    if (docs.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="padding:32px 0;">
          <i class="fas fa-folder-open"></i>
          <h3>No documents yet</h3>
          <p>Upload your first document to get started</p>
          <a href="documents.html" class="btn btn-primary btn-sm mt-4">
            <i class="fas fa-upload"></i> Upload Now
          </a>
        </div>`;
      return;
    }

    container.innerHTML = `<div class="doc-list">${docs.map(docItem).join('')}</div>`;
  } catch (err) {
    container.innerHTML = `
      <div class="alert alert-danger">
        <i class="fas fa-exclamation-circle"></i>
        Failed to load documents: ${escapeHtml(err.message)}
      </div>`;
  }
}

function docItem(doc) {
  const { icon, cls } = getFileIcon(doc.mimeType);
  const meta = getCategoryMeta(doc.category);
  return `
    <div class="doc-item">
      <div class="doc-icon ${cls}"><i class="fas ${icon}"></i></div>
      <div class="doc-info">
        <div class="doc-name">${escapeHtml(doc.title)}</div>
        <div class="doc-meta">
          <span class="badge ${meta.color}"><i class="fas ${meta.icon}"></i> ${meta.label}</span>
          <span class="doc-meta-item"><i class="fas fa-calendar-alt"></i> ${formatDate(doc.uploadDate)}</span>
          <span class="doc-meta-item"><i class="fas fa-file"></i> ${formatFileSize(doc.fileSize)}</span>
        </div>
      </div>
      <div class="doc-actions">
        <a href="documents.html" class="btn btn-ghost btn-sm btn-icon" title="View">
          <i class="fas fa-arrow-right"></i>
        </a>
      </div>
    </div>`;
}
