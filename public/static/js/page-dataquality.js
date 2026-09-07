async function renderDataQualityPage(container) {
  showSpinner(container);
  try {
    const params = STATE.currentMonth ? { month: STATE.currentMonth } : {};
    const data = await API.get('/dashboards/data-quality', params);

    if (data.restricted) {
      return renderDemoRestrictedPlaceholder(container, {
        title: 'Data Quality',
        icon: 'fa-shield-halved',
        message: data.message,
        version: data.version,
      });
    }

    container.innerHTML = '';
    container.appendChild(versionBanner(data.version));

    const t = data.totals;
    container.appendChild(sectionTitle('fa-shield-halved', 'Validation Status Across All Records'));
    container.appendChild(kpiGrid([
      { label: 'Total Records', value: t.totalRecords, icon: 'fa-database', tone: 'blue' },
      { label: 'Verified (Source 1 + Source 2)', value: t.verified, icon: 'fa-circle-check', tone: 'green' },
      { label: 'Pending Secondary Source', value: t.pendingSecondary, icon: 'fa-hourglass-half', tone: 'amber' },
      { label: 'Unverified', value: t.unverified, icon: 'fa-circle-question', tone: 'rose' },
    ]));

    container.appendChild(sectionTitle('fa-chart-pie', 'Confidence Level Distribution'));
    const chartsRow = h('div', { class: 'grid grid-cols-1 lg:grid-cols-2 gap-5' });
    chartsRow.appendChild(h('div', { class: 'surface-card' }, [h('div', { style: 'height:220px;position:relative;' }, h('canvas', { id: 'chart-confidence' }))]));
    chartsRow.appendChild(h('div', { class: 'surface-card' }, [h('div', { style: 'height:220px;position:relative;' }, h('canvas', { id: 'chart-validation' }))]));
    container.appendChild(chartsRow);

    container.appendChild(sectionTitle('fa-table-list', 'Validation by Module', `${Object.keys(data.by_module).length} modules`));
    const gridCols = 'minmax(200px,1.8fr) minmax(70px,1fr) minmax(70px,1fr) minmax(120px,1fr) minmax(90px,1fr)';
    const list = h('div', { class: 'record-list' });
    const head = h('div', { class: 'record-list-head', style: `grid-template-columns:${gridCols};` });
    ['Module', 'Total', 'Verified', 'Pending 2nd Src', 'Unverified'].forEach((label, i) => {
      head.appendChild(h('div', { class: i === 0 ? '' : 'text-center' }, label));
    });
    list.appendChild(head);
    for (const [mod, stats] of Object.entries(data.by_module)) {
      const row = h('div', { class: 'record-row', style: `grid-template-columns:${gridCols};cursor:default;` });
      row.appendChild(h('div', { class: 'flex items-center gap-3 min-w-0' }, [
        h('div', { class: 'record-avatar' }, initials(MODULE_LABEL_MAP[mod] || mod)),
        h('div', { class: 'record-title truncate' }, MODULE_LABEL_MAP[mod] || mod),
      ]));
      row.appendChild(h('div', { class: 'text-center record-field-value' }, String(stats.total)));
      row.appendChild(h('div', { class: 'text-center record-field-value font-bold text-green-600' }, String(stats.verified)));
      row.appendChild(h('div', { class: 'text-center record-field-value font-bold text-amber-600' }, String(stats.pending_secondary)));
      row.appendChild(h('div', { class: 'text-center record-field-value font-bold text-rose-500' }, String(stats.unverified)));
      list.appendChild(row);
    }
    container.appendChild(list);

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
