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
