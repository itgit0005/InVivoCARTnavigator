async function renderAdminVersionsPage(container) {
  showSpinner(container);
  try {
    const data = await API.get('/admin/versions');
    container.innerHTML = '';
    container.appendChild(h('p', { class: 'text-sm text-slate-500 mb-4' }, 'Complete version history across all months. Only Super Admin can see unpublished/revised versions and restore previous approved versions.'));

    const table = h('table', { class: 'data-table' });
    table.appendChild(h('thead', {}, h('tr', {}, ['Month', 'Version', 'Status', 'Uploaded', 'Cutoff', 'Filename', 'Actions'].map((c) => h('th', {}, c)))));
    const tbody = h('tbody', {});

    data.versions.forEach((v) => {
      const statusBadge = { approved: 'badge-verified', pending_review: 'badge-pending', rejected: 'badge-discontinued', superseded: 'badge-unchanged', draft: 'badge-unchanged' }[v.status] || 'badge-unchanged';
      const tr = h('tr', {});
      tr.appendChild(h('td', { class: 'font-semibold' }, v.month_label));
      tr.appendChild(h('td', {}, v.version_label || `V${v.version_number}`));
      tr.appendChild(h('td', {}, [
        h('span', { class: `badge ${statusBadge}` }, v.status.toUpperCase()),
        v.is_current_live ? h('span', { class: 'badge badge-new ml-1' }, 'LIVE') : null,
      ]));
      tr.appendChild(h('td', {}, fmtDate(v.uploaded_at)));
      tr.appendChild(h('td', {}, fmtDate(v.data_cutoff_date)));
      tr.appendChild(h('td', { class: 'text-xs' }, v.source_filename || '—'));

      const actions = h('td', {}, []);
      if (v.status === 'pending_review') {
        actions.appendChild(h('button', { class: 'btn btn-secondary text-xs py-1', onclick: () => navigate('admin_review') }, 'Review'));
      } else if (v.status === 'superseded' && !v.is_current_live) {
        const restoreBtn = h('button', { class: 'btn btn-secondary text-xs py-1', onclick: async () => {
          if (!confirm(`Restore ${v.month_label} ${v.version_label} as the live dataset?`)) return;
          try { await API.post(`/admin/versions/${v.id}/restore`, {}); toast('Version restored as live.', 'success'); renderAdminVersionsPage(container); populateMonthSelector(document.getElementById('global-month-select')); }
          catch (e) { toast(e.message, 'error'); }
        }}, 'Restore');
        actions.appendChild(restoreBtn);
      } else {
        actions.appendChild(h('span', { class: 'text-slate-300 text-xs' }, '—'));
      }
      tr.appendChild(actions);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    container.appendChild(h('div', { class: 'kpi-card overflow-x-auto' }, table));
  } catch (e) {
    renderError(container, e.message);
  }
}
