async function renderDataQualityPage(container) {
  showSpinner(container);
  try {
    const params = STATE.currentMonth ? { month: STATE.currentMonth } : {};
    const data = await API.get('/dashboards/data-quality', params);
    container.innerHTML = '';
    container.appendChild(versionBanner(data.version));

    const t = data.totals;
    container.appendChild(sectionTitle('Validation Status Across All Records'));
    container.appendChild(kpiGrid([
      { label: 'Total Records', value: t.totalRecords, icon: 'fa-database' },
      { label: 'Verified (Source 1 + Source 2)', value: t.verified, icon: 'fa-circle-check' },
      { label: 'Pending Secondary Source', value: t.pendingSecondary, icon: 'fa-hourglass-half' },
      { label: 'Unverified', value: t.unverified, icon: 'fa-circle-question' },
    ]));

    container.appendChild(sectionTitle('Confidence Level Distribution'));
    const chartsRow = h('div', { class: 'grid grid-cols-1 lg:grid-cols-2 gap-5' });
    chartsRow.appendChild(h('div', { class: 'kpi-card' }, [h('canvas', { id: 'chart-confidence', height: '220' })]));
    chartsRow.appendChild(h('div', { class: 'kpi-card' }, [h('canvas', { id: 'chart-validation', height: '220' })]));
    container.appendChild(chartsRow);

    container.appendChild(sectionTitle('Validation by Module'));
    const table = h('table', { class: 'data-table' });
    table.appendChild(h('thead', {}, h('tr', {}, ['Module', 'Total', 'Verified', 'Pending 2nd Source', 'Unverified'].map((c) => h('th', {}, c)))));
    const tbody = h('tbody', {});
    for (const [mod, stats] of Object.entries(data.by_module)) {
      tbody.appendChild(h('tr', {}, [
        h('td', { class: 'font-semibold' }, MODULE_LABEL_MAP[mod] || mod),
        h('td', {}, String(stats.total)),
        h('td', {}, String(stats.verified)),
        h('td', {}, String(stats.pending_secondary)),
        h('td', {}, String(stats.unverified)),
      ]));
    }
    table.appendChild(tbody);
    const wrap = h('div', { class: 'kpi-card overflow-x-auto' }, table);
    container.appendChild(wrap);

    new Chart(document.getElementById('chart-confidence'), {
      type: 'pie',
      data: { labels: ['High', 'Medium', 'Low'], datasets: [{ data: [t.highConf, t.medConf, t.lowConf], backgroundColor: ['#16a34a', '#d97706', '#dc2626'] }] },
      options: { plugins: { legend: { position: 'bottom' } } },
    });
    new Chart(document.getElementById('chart-validation'), {
      type: 'pie',
      data: { labels: ['Verified', 'Pending 2nd Source', 'Unverified'], datasets: [{ data: [t.verified, t.pendingSecondary, t.unverified], backgroundColor: ['#1e40af', '#854d0e', '#64748b'] }] },
      options: { plugins: { legend: { position: 'bottom' } } },
    });
  } catch (e) {
    renderError(container, e.message);
  }
}

const MODULE_LABEL_MAP = {
  company_intelligence: 'Company Intelligence',
  pipeline_dashboard: 'Pipeline Dashboard',
  clinical_intelligence: 'Clinical Intelligence',
  technology_intelligence: 'Technology Intelligence',
  target_landscape: 'Target Landscape',
  clinical_trial_dashboard: 'Clinical Trial Dashboard',
  catalyst_dashboard: 'Catalyst Dashboard',
  bdl_intelligence: 'BD&L Intelligence',
  funding_investment: 'Funding & Investment',
  competitive_intelligence: 'Competitive Intelligence',
  regulatory_dashboard: 'Regulatory Dashboard',
};
