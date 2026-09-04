async function renderAdminAuditPage(container) {
  showSpinner(container);
  try {
    const data = await API.get('/admin/audit-log', { limit: 300 });
    container.innerHTML = '';
    container.appendChild(h('p', { class: 'text-sm text-slate-500 mb-4' }, `Complete audit trail — ${data.entries.length} most recent events.`));

    const table = h('table', { class: 'data-table' });
    table.appendChild(h('thead', {}, h('tr', {}, ['Time', 'User', 'Role', 'Action', 'Entity', 'Details'].map((c) => h('th', {}, c)))));
    const tbody = h('tbody', {});
    data.entries.forEach((e) => {
      tbody.appendChild(h('tr', {}, [
        h('td', { class: 'text-xs whitespace-nowrap' }, fmtDate(e.created_at)),
        h('td', {}, e.username || 'system'),
        h('td', {}, e.role ? h('span', { class: 'badge badge-verified' }, roleLabel(e.role)) : '—'),
        h('td', { class: 'font-semibold text-xs' }, e.action),
        h('td', { class: 'text-xs' }, e.entity_type ? `${e.entity_type}#${e.entity_id}` : '—'),
        h('td', { class: 'text-xs max-w-md truncate', title: e.details ? JSON.stringify(e.details) : '' }, e.details ? JSON.stringify(e.details).slice(0, 80) : '—'),
      ]));
    });
    table.appendChild(tbody);
    container.appendChild(h('div', { class: 'kpi-card overflow-x-auto' }, table));
  } catch (e) {
    renderError(container, e.message);
  }
}
