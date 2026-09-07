// Small reusable DOM/formatting helpers
function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (v !== null && v !== undefined) el.setAttribute(k, v);
  }
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c === null || c === undefined) return;
    if (typeof c === 'string' || typeof c === 'number') el.appendChild(document.createTextNode(String(c)));
    else el.appendChild(c);
  });
  return el;
}

function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtDate(d) {
  if (!d) return '—';
  const parsed = dayjs(d);
  return parsed.isValid() ? parsed.format('MMM D, YYYY') : String(d);
}

function toast(msg, type = 'info') {
  const colors = { info: '#2563eb', success: '#16a34a', error: '#dc2626' };
  const el = h('div', {
    class: 'fixed bottom-5 right-5 z-[100] px-4 py-3 rounded-lg shadow-lg text-white text-sm font-medium',
  }, msg);
  el.style.background = colors[type] || colors.info;
  el.style.transition = 'opacity .3s';
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3200);
}

function confidenceBadge(level) {
  const map = { High: 'badge-high', Medium: 'badge-medium', Low: 'badge-low' };
  return `<span class="badge ${map[level] || 'badge-low'}">${esc(level || 'Unknown')}</span>`;
}

function validationBadge(status) {
  if (!status) return '<span class="badge badge-unverified">Unverified</span>';
  if (status === 'Verified') return '<span class="badge badge-verified">Verified</span>';
  if (status.includes('Pending')) return '<span class="badge badge-pending">Pending 2nd Source</span>';
  return '<span class="badge badge-unverified">Unverified</span>';
}

function changeTypeBadge(t) {
  const map = { new: 'badge-new', updated: 'badge-updated', discontinued: 'badge-discontinued', conflicting: 'badge-conflicting', unchanged: 'badge-unchanged' };
  return `<span class="badge ${map[t] || 'badge-unchanged'}">${esc(t || 'unchanged')}</span>`;
}

function sourceLink(url, label) {
  if (!url) return '<span class="text-slate-400 text-xs">No source</span>';
  return `<a href="${esc(url)}" target="_blank" rel="noopener" class="source-link"><i class="fa-solid fa-arrow-up-right-from-square mr-1"></i>${esc(label || 'Source')}</a>`;
}

function showSpinner(container) {
  container.innerHTML = '';
  container.appendChild(h('div', { class: 'flex items-center justify-center py-20' }, h('div', { class: 'spinner' })));
}

function renderError(container, message) {
  container.innerHTML = '';
  container.appendChild(
    h('div', { class: 'bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 text-sm' }, [
      h('i', { class: 'fa-solid fa-triangle-exclamation mr-2' }),
      message,
    ])
  );
}

function initials(name) {
  if (!name) return '?';
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Opens a detail modal showing every field of a record plus its two sources + confidence.
// fields: array of [label, value] pairs to render in order.
// urlFields: [{ url, label }] to render as source buttons.
function openRecordDetailModal(opts) {
  const { title, subtitle, avatarText, fields, sources, meta } = opts;
  const overlay = h('div', { class: 'detail-modal-overlay' });
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  const modal = h('div', { class: 'detail-modal' });

  const head = h('div', { class: 'detail-modal-head' }, [
    h('div', { class: 'flex items-start gap-3 min-w-0' }, [
      h('div', { class: 'record-avatar', style: 'width:2.75rem;height:2.75rem;font-size:.85rem;flex-shrink:0;' }, initials(avatarText || title)),
      h('div', { class: 'min-w-0' }, [
        h('div', { class: 'text-base font-bold text-slate-900 leading-tight' }, title || 'Record'),
        subtitle ? h('div', { class: 'text-xs text-slate-500 mt-1' }, subtitle) : null,
      ]),
    ]),
    h('button', { class: 'icon-btn', onclick: () => overlay.remove() }, h('i', { class: 'fa-solid fa-xmark' })),
  ]);
  modal.appendChild(head);

  const body = h('div', { class: 'detail-modal-body' });

  if (meta && (meta.confidence_level || meta.validation_status)) {
    const metaRow = h('div', { class: 'flex items-center gap-2 mb-4' });
    if (meta.confidence_level) metaRow.appendChild(h('span', { html: confidenceBadge(meta.confidence_level) }));
    if (meta.validation_status) metaRow.appendChild(h('span', { html: validationBadge(meta.validation_status) }));
    if (meta.verification_date) metaRow.appendChild(h('span', { class: 'text-xs text-slate-400' }, `Verified ${fmtDate(meta.verification_date)}`));
    body.appendChild(metaRow);
  }

  (fields || []).forEach(([label, value]) => {
    if (value === null || value === undefined || value === '') return;
    body.appendChild(h('div', { class: 'detail-field' }, [
      h('div', { class: 'detail-field-label' }, label),
      h('div', { class: 'detail-field-value' }, String(value)),
    ]));
  });

  const srcRow = h('div', { class: 'detail-source-row' });
  (sources || []).forEach((s) => {
    if (s.url) {
      srcRow.appendChild(h('a', { href: s.url, target: '_blank', rel: 'noopener', class: 'detail-source-btn' }, [
        h('i', { class: 'fa-solid fa-arrow-up-right-from-square' }), s.label,
      ]));
    } else {
      srcRow.appendChild(h('span', { class: 'detail-source-btn muted' }, [h('i', { class: 'fa-solid fa-ban' }), `${s.label}: not disclosed`]));
    }
  });
  if ((sources || []).length) body.appendChild(srcRow);

  modal.appendChild(body);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

// Friendly locked/restricted placeholder shown to Demo-role users on sections where the
// menu entry stays visible & clickable, but the underlying data is fully hidden.
function renderDemoRestrictedPlaceholder(container, opts) {
  const { title, icon, message, version } = opts || {};
  container.innerHTML = '';
  if (version) container.appendChild(versionBanner(version));
  container.appendChild(
    h('div', { class: 'surface-card', style: 'text-align:center;padding:3.5rem 2rem;' }, [
      h('div', {
        class: 'mx-auto mb-4 flex items-center justify-center rounded-full',
        style: 'width:4rem;height:4rem;background:#eef2ff;color:#4338ca;',
      }, h('i', { class: 'fa-solid fa-lock', style: 'font-size:1.5rem;' })),
      h('div', { class: 'text-base font-bold text-slate-800 mb-2' }, `${title || 'This section'} is locked on the Demo plan`),
      h('div', { class: 'text-sm text-slate-500 max-w-md mx-auto' },
        message || 'This section is not available on your Demo account. Upgrade to a full account to unlock live data.'),
      h('div', { class: 'mt-5 inline-flex items-center gap-2 text-xs font-semibold text-indigo-600 bg-indigo-50 rounded-full px-4 py-2' }, [
        h('i', { class: (icon || 'fa-shield-halved') + ' fa-solid' }),
        'Contact your administrator to upgrade access',
      ]),
    ])
  );
}

function downloadCsv(module, month) {
  const params = month ? `?month=${encodeURIComponent(month)}` : '';
  const url = `/api/export/${module}.csv${params}`;
  const a = document.createElement('a');
  a.href = url;
  // Need to pass auth header — use fetch + blob since <a> can't add headers
  fetch(url, { headers: API._headers() })
    .then((r) => {
      if (!r.ok) return r.json().then((j) => { throw new Error(j.error || 'Export failed'); });
      return r.blob();
    })
    .then((blob) => {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${module}${month ? '_' + month : ''}.csv`;
      link.click();
    })
    .catch((e) => toast(e.message, 'error'));
}
