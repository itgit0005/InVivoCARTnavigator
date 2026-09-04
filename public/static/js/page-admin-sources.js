async function renderAdminSourcesPage(container) {
  showSpinner(container);
  try {
    const data = await API.get('/admin/sources');
    container.innerHTML = '';
    container.appendChild(h('p', { class: 'text-sm text-slate-500 mb-4' }, `${data.sources.length} distinct sources referenced across the live dataset. Company sources, FDA/EMA, ClinicalTrials.gov, SEC filings, peer-reviewed publications, and major conferences are prioritized.`));

    const search = h('input', { type: 'text', placeholder: 'Filter sources...', class: 'text-sm border border-slate-300 rounded-lg px-3 py-2 w-72 mb-4' });
    container.appendChild(search);

    const table = h('table', { class: 'data-table' });
    table.appendChild(h('thead', {}, h('tr', {}, ['Source URL', 'Type', 'Referenced In Modules'].map((c) => h('th', {}, c)))));
    const tbody = h('tbody', {});
    data.sources.forEach((s) => {
      tbody.appendChild(h('tr', {}, [
        h('td', {}, h('a', { href: s.url, target: '_blank', class: 'source-link' }, s.url)),
        h('td', {}, h('span', { class: 'badge ' + (s.type === 'primary' ? 'badge-verified' : 'badge-pending') }, s.type)),
        h('td', { class: 'text-xs' }, s.modules.map((m) => MODULE_LABEL_MAP[m] || m).join(', ')),
      ]));
    });
    table.appendChild(tbody);
    const wrap = h('div', { class: 'kpi-card overflow-x-auto' }, table);
    container.appendChild(wrap);

    search.addEventListener('input', () => {
      const q = search.value.toLowerCase();
      wrap.querySelectorAll('tbody tr').forEach((tr) => { tr.style.display = tr.textContent.toLowerCase().includes(q) ? '' : 'none'; });
    });
  } catch (e) {
    renderError(container, e.message);
  }
}
