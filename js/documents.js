'use strict';
/**
 * js/documents.js — Documents page
 * Depends on: firebase-init.js, config.js, utils.js
 */

let currentTab = 'mine';
let familyMembers = [];
let shareTargetId = null;
let shareTargetDoc = null; // full doc object for revocation list
let searchDebounce = null;

document.addEventListener('DOMContentLoaded', async () => {
  await requireAuth('../index.html');

  // Load user info for sidebar
  try {
    const res = await apiFetch('/api/profile');
    setUserDisplay(firebase.auth().currentUser, res.profile);
  } catch (_) {
    setUserDisplay(firebase.auth().currentUser, null);
  }

  // Wire confirm modal buttons (uses _resolveConfirm from utils.js)
  document.getElementById('confirmModalOkBtn')    .addEventListener('click', () => _resolveConfirm(true));
  document.getElementById('confirmModalCancelBtn').addEventListener('click', () => _resolveConfirm(false));
  document.getElementById('confirmModalClose')    .addEventListener('click', () => _resolveConfirm(false));

  // Load stats and family concurrently, then docs

  loadStats();
  loadFamilyMembers();
  loadDocs();

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentTab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach(b => {
        const isActive = b === btn;
        b.classList.toggle('active', isActive);
        b.style.borderBottomColor = isActive ? 'var(--accent)' : 'transparent';
      });
      document.getElementById('filterBar').style.display = currentTab === 'mine' ? 'flex' : 'none';
      loadDocs();
    });
  });

  // Search
  document.getElementById('searchInput').addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(loadDocs, 400);
  });

  // Category filter
  document.getElementById('categoryFilter').addEventListener('change', loadDocs);

  // Upload button
  document.getElementById('uploadBtn').addEventListener('click', () => openModal('uploadModal'));

  // Upload form
  document.getElementById('uploadForm').addEventListener('submit', handleUpload);

  // Auto-fill title from filename
  document.getElementById('uploadFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const titleInput = document.getElementById('uploadTitle');
      if (!titleInput.value) {
        titleInput.value = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
      }
    }
  });

  // Close preview modal on overlay click
  document.getElementById('previewModal').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal('previewModal');
  });
});

/* ── Stats ─────────────────────────────────────────────────── */

async function loadStats() {
  try {
    const [statsRes, sharedRes] = await Promise.all([
      apiFetch('/api/documents/stats'),
      apiFetch('/api/documents/shared-with-me'),
    ]);
    const s = statsRes.stats;
    document.getElementById('statTotal').textContent = s.totalDocs ?? 0;
    document.getElementById('statStorage').textContent = formatFileSize(s.totalSizeBytes ?? 0);
    document.getElementById('statShared').textContent = sharedRes.total ?? 0;
    document.getElementById('docSubtitle').textContent =
      `${s.totalDocs ?? 0} documents · ${formatFileSize(s.totalSizeBytes ?? 0)} used`;
  } catch (_) { }
}

/* ── Family members (for share modal) ─────────────────────── */

async function loadFamilyMembers() {
  try {
    const res = await apiFetch('/api/family/members');
    familyMembers = res.members || [];
  } catch (_) {
    familyMembers = [];
  }
}

/* ── Load documents ─────────────────────────────────────────── */

async function loadDocs() {
  const container = document.getElementById('docList');
  container.innerHTML = '<div class="empty-state"><span class="spinner spinner-lg"></span></div>';

  try {
    let res;
    if (currentTab === 'shared') {
      res = await apiFetch('/api/documents/shared-with-me');
    } else {
      const search = document.getElementById('searchInput').value.trim();
      const category = document.getElementById('categoryFilter').value;
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (category) params.set('category', category);
      res = await apiFetch(`/api/documents?${params}`);
    }

    const docs = res.documents || [];
    if (docs.length === 0) {
      container.innerHTML = emptyState();
      return;
    }
    container.innerHTML = `<div class="doc-list">${docs.map(renderDocItem).join('')}</div>`;
  } catch (err) {
    container.innerHTML = `
      <div class="alert alert-danger">
        <i class="fas fa-exclamation-circle"></i>
        ${escapeHtml(err.message)}
      </div>`;
  }
}

function emptyState() {
  if (currentTab === 'shared') {
    return `<div class="empty-state">
      <i class="fas fa-share-alt"></i>
      <h3>Nothing shared with you yet</h3>
      <p>When a family member shares a document, it will appear here.</p>
    </div>`;
  }
  return `<div class="empty-state">
    <i class="fas fa-folder-open"></i>
    <h3>No documents yet</h3>
    <p>Upload your first document to get started.</p>
    <button class="btn btn-primary btn-sm mt-4" onclick="openModal('uploadModal')">
      <i class="fas fa-upload"></i> Upload Document
    </button>
  </div>`;
}

function canPreview(mimeType) {
  return mimeType && (
    mimeType === 'application/pdf' ||
    mimeType.startsWith('image/')
  );
}

function renderDocItem(doc) {
  const { icon, cls } = getFileIcon(doc.mimeType);
  const meta = getCategoryMeta(doc.category);
  const isOwner = currentTab !== 'shared';
  const previewable = canPreview(doc.mimeType);

  return `
    <div class="doc-item" data-id="${doc.id}">
      <div class="doc-icon ${cls}"><i class="fas ${icon}"></i></div>
      <div class="doc-info">
        <div class="doc-name">${escapeHtml(doc.title)}</div>
        <div class="doc-meta">
          <span class="badge ${meta.color}">${meta.label}</span>
          <span class="doc-meta-item"><i class="fas fa-calendar-alt"></i>${formatDate(doc.uploadDate)}</span>
          <span class="doc-meta-item"><i class="fas fa-file"></i>${formatFileSize(doc.fileSize)}</span>
          ${doc.sharedWith && doc.sharedWith.length > 0
      ? `<span class="badge badge-info"><i class="fas fa-share-alt"></i> Shared with ${doc.sharedWith.length}</span>`
      : ''}
        </div>
      </div>
      <div class="doc-actions">
        ${previewable ? `
        <button class="btn btn-ghost btn-sm btn-icon" title="Preview"
                onclick="previewDoc('${doc.id}', '${escapeHtml(doc.title)}', '${doc.mimeType}')">
          <i class="fas fa-eye"></i>
        </button>` : ''}
        <button class="btn btn-ghost btn-sm btn-icon" title="Download"
                onclick="downloadDoc('${doc.id}', '${escapeHtml(doc.title)}')">
          <i class="fas fa-download"></i>
        </button>
        ${isOwner ? `
        <button class="btn btn-ghost btn-sm btn-icon" title="Share / manage access"
                onclick='openShareModal(${JSON.stringify(doc)})'>
          <i class="fas fa-share-alt"></i>
        </button>
        <button class="btn btn-ghost btn-sm btn-icon text-danger" title="Delete"
                onclick="deleteDoc('${doc.id}', '${escapeHtml(doc.title)}')">
          <i class="fas fa-trash"></i>
        </button>` : ''}
      </div>
    </div>`;
}

/* ── Preview ─────────────────────────────────────────────────── */

async function previewDoc(id, title, mimeType) {
  const isPDF = mimeType === 'application/pdf';

  // PDFs: open in new tab — avoids CSP frame-src constraint for storage.googleapis.com
  if (isPDF) {
    try {
      const res = await apiFetch(`/api/documents/${id}/download`);
      window.open(res.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      showToast('Could not open PDF: ' + err.message, 'error');
    }
    return;
  }

  // Images: render inline in preview modal
  const frame   = document.getElementById('previewFrame');
  const img     = document.getElementById('previewImage');
  const spinner = document.getElementById('previewSpinner');
  const label   = document.getElementById('previewTitle');

  // Reset
  frame.style.display   = 'none';
  img.style.display     = 'none';
  spinner.style.display = 'flex';
  frame.src             = '';
  img.src               = '';
  label.textContent     = title;
  document.getElementById('previewError').style.display = 'none';

  openModal('previewModal');

  try {
    const res = await apiFetch(`/api/documents/${id}/download`);
    spinner.style.display = 'none';
    img.src           = res.url;
    img.alt           = title;
    img.style.display = '';
  } catch (err) {
    spinner.style.display = 'none';
    const errEl = document.getElementById('previewError');
    errEl.style.display = '';
    errEl.textContent   = 'Preview failed: ' + err.message;
  }
}

/* ── Upload ─────────────────────────────────────────────────── */

async function handleUpload(e) {
  e.preventDefault();
  const fileInput = document.getElementById('uploadFile');
  const title = document.getElementById('uploadTitle').value.trim();
  const category = document.getElementById('uploadCategory').value;
  const desc = document.getElementById('uploadDesc').value.trim();
  const btn = document.getElementById('uploadSubmitBtn');

  if (!fileInput.files[0]) { showToast('Please select a file', 'warning'); return; }
  if (!title) { showToast('Title is required', 'warning'); return; }
  if (!category) { showToast('Please select a category', 'warning'); return; }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Uploading…';

  try {
    const fd = new FormData();
    fd.append('file', fileInput.files[0]);
    fd.append('title', title);
    fd.append('category', category);
    fd.append('description', desc);

    await apiFetch('/api/documents/upload', { method: 'POST', body: fd });

    showToast('Document uploaded successfully', 'success');
    closeModal('uploadModal');
    document.getElementById('uploadForm').reset();
    loadDocs();
    loadStats();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-upload"></i> Upload';
  }
}

/* ── Download ───────────────────────────────────────────────── */

async function downloadDoc(id, title) {
  try {
    showToast('Starting download...', 'info');
    const res = await apiFetch(`/api/documents/${id}/download`);
    
    // Try to extract original extension from the URL if the title doesn't have one
    let ext = '';
    try {
      const urlObj = new URL(res.url);
      const pathname = decodeURIComponent(urlObj.pathname);
      const match = pathname.match(/\.([a-zA-Z0-9]+)$/);
      if (match) ext = '.' + match[1];
    } catch (_) {}
    
    let downloadName = title;
    if (ext && !downloadName.toLowerCase().endsWith(ext.toLowerCase())) {
      downloadName += ext;
    }

    try {
      // Preferred approach: fetch as Blob to force download and bypass cross-origin restrictions on the `download` attribute
      const fetchRes = await fetch(res.url);
      if (!fetchRes.ok) throw new Error(`Blob fetch failed: ${fetchRes.status}`);
      
      const blob = await fetchRes.blob();
      const objUrl = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      
      // Cleanup
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(objUrl);
      }, 100);
      
    } catch (blobErr) {
      console.warn('[downloadDoc] Blob download failed, using fallback:', blobErr);
      
      // Fallback approach: open cross-origin URL in new tab using a temporary <a>
      const a = document.createElement('a');
      a.href = res.url;
      a.download = downloadName;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      showToast('Download started in a new tab.', 'success');
    }
  } catch (err) {
    showToast('Download failed: ' + err.message, 'error');
  }
}

/* ── Delete ─────────────────────────────────────────────────── */

async function deleteDoc(id, title) {
  const confirmed = await confirmAction(
    'Delete Document',
    `Delete "${title}"? This cannot be undone.`,
    'Delete',
    true
  );
  if (!confirmed) return;

  try {
    await apiFetch(`/api/documents/${id}`, { method: 'DELETE' });
    showToast('Document deleted', 'success');
    loadDocs();
    loadStats();
  } catch (err) {
    showToast('Delete failed: ' + err.message, 'error');
  }
}

/* ── Share + Revoke ─────────────────────────────────────────── */

function openShareModal(doc) {
  // Accept either a doc object (from renderDocItem) or a plain id string (legacy)
  if (typeof doc === 'string') {
    shareTargetId = doc;
    shareTargetDoc = null;
  } else {
    shareTargetId = doc.id;
    shareTargetDoc = doc;
  }

  const container = document.getElementById('shareMemberList');
  let html = '';

  // ── Current access section (revocation) ───────────────────
  const sharedWith = (shareTargetDoc && shareTargetDoc.sharedWith) || [];
  if (sharedWith.length > 0) {
    html += `<div class="section-title mb-4" style="margin-top:0;">Current access</div>
      <div class="member-list" style="margin-bottom:20px;">
        ${sharedWith.map(s => `
          <div class="member-item">
            <div class="member-avatar">${(s.email || '?')[0].toUpperCase()}</div>
            <div class="member-info">
              <div class="member-name">${escapeHtml(s.email)}</div>
              <div class="member-email">Read access</div>
            </div>
            <button class="btn btn-danger-outline btn-sm" title="Revoke access"
                    onclick="revokeShare('${shareTargetId}', '${s.uid}', '${escapeHtml(s.email)}')">
              <i class="fas fa-times"></i> Revoke
            </button>
          </div>`).join('')}
      </div>
      <div class="section-title mb-4">Add access</div>`;
  }

  // ── Add new member section ─────────────────────────────────
  // Filter out already-shared members
  const alreadyShared = new Set(sharedWith.map(s => s.uid));
  const available = familyMembers.filter(m => !alreadyShared.has(m.uid));

  if (available.length === 0 && familyMembers.length === 0) {
    html += `
      <div class="empty-state" style="padding:20px 0;">
        <i class="fas fa-users"></i>
        <h3>No family members</h3>
        <p>Add family members first from the <a href="family.html">Family page</a>.</p>
      </div>`;
  } else if (available.length === 0) {
    html += `<p class="text-sm text-muted">All family members already have access to this document.</p>`;
  } else {
    html += `<div class="member-list">${available.map(m => `
      <div class="member-item">
        <div class="member-avatar">${(m.displayName || m.email)[0].toUpperCase()}</div>
        <div class="member-info">
          <div class="member-name">${escapeHtml(m.displayName || m.email.split('@')[0])}</div>
          <div class="member-email">${escapeHtml(m.email)}</div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="shareWith('${m.uid}', '${escapeHtml(m.email)}')">
          Share
        </button>
      </div>`).join('')}
    </div>`;
  }

  container.innerHTML = html;
  openModal('shareModal');
}

async function shareWith(targetUid, email) {
  try {
    await apiFetch(`/api/documents/${shareTargetId}/share`, {
      method: 'POST',
      body: JSON.stringify({ targetUid }),
    });
    showToast(`Shared with ${email}`, 'success');
    closeModal('shareModal');
    loadDocs();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function revokeShare(docId, targetUid, email) {
  const confirmed = await confirmAction(
    'Revoke Access',
    `Remove access for ${email}? They will no longer be able to view this document.`,
    'Revoke',
    true
  );
  if (!confirmed) return;

  try {
    await apiFetch(`/api/documents/${docId}/share/${targetUid}`, { method: 'DELETE' });
    showToast(`Access revoked for ${email}`, 'success');
    closeModal('shareModal');
    loadDocs();
    loadStats();
  } catch (err) {
    showToast('Revoke failed: ' + err.message, 'error');
  }
}
