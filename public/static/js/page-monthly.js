async function renderMonthlyUpdatesPage(container) {
  showSpinner(container);
  try {
    container.innerHTML = '';
    container.appendChild(sectionTitleTop('Historical Monthly Snapshots'));
    container.appendChild(h('p', { class: 'text-sm text-slate-500 mb-4' }, 'Approved monthly versions are preserved permanently. Select two months to compare portfolio KPIs and record counts across modules.'));

    const months = STATE.months.length ? STATE.months : (await API.get('/dashboards/months')).months;

    const controls = h('div', { class: 'kpi-card flex items-center gap-3 mb-6' });
    const selA = h('select', { class: 'text-sm border border-slate-300 rounded-lg px-3 py-2' });
    const selB = h('select', { class: 'text-sm border border-slate-300 rounded-lg px-3 py-2' });
    months.forEach((m) => { selA.appendChild(h('option', { value: m }, m)); selB.appendChild(h('option', { value: m }, m)); });
    if (months.length > 1) { selA.value = months[1]; selB.value = months[0]; }
    const compareBtn = h('button', { class: 'btn btn-primary' }, [h('i', { class: 'fa-solid fa-code-compare' }), 'Compare']);
    controls.appendChild(h('span', { class: 'text-sm text-slate-600' }, 'Compare'));
    controls.appendChild(selA);
    controls.appendChild(h('span', { class: 'text-sm text-slate-400' }, 'vs.'));
    controls.appendChild(selB);
    controls.appendChild(compareBtn);
    container.appendChild(controls);

    const resultBox = h('div', { id: 'compare-result' });
    container.appendChild(resultBox);

    compareBtn.addEventListener('click', async () => {
      showSpinner(resultBox);
      try {
        const data = await API.get('/dashboards/compare', { month_a: selA.value, month_b: selB.value });
        renderCompareResult(resultBox, data);
      } catch (e) {
        renderError(resultBox, e.message);
      }
    });

    if (months.length > 1) compareBtn.click();
  } catch (e) {
    renderError(container, e.message);
  }
}

function sectionTitleTop(text) { return h('h3', { class: 'text-sm font-bold text-slate-700 uppercase tracking-wide mb-1' }, text); }

function renderCompareResult(container, data) {
  container.innerHTML = '';
  const { version_a, version_b, kpis_a, kpis_b, module_counts } = data;

  const table = h('table', { class: 'data-table' });
  table.appendChild(h('thead', {}, h('tr', {}, ['Module', version_a.month_label, version_b.month_label, 'Δ Change'].map((c) => h('th', {}, c)))));
  const tbody = h('tbody', {});
  for (const [mod, counts] of Object.entries(module_counts)) {
    const deltaColor = counts.delta > 0 ? 'text-green-600' : counts.delta < 0 ? 'text-red-600' : 'text-slate-400';
    tbody.appendChild(h('tr', {}, [
      h('td', { class: 'font-semibold' }, MODULE_LABEL_MAP[mod] || mod),
      h('td', {}, String(counts.a)),
      h('td', {}, String(counts.b)),
      h('td', { class: 'font-bold ' + deltaColor }, (counts.delta > 0 ? '+' : '') + counts.delta),
    ]));
  }
  table.appendChild(tbody);
  container.appendChild(h('div', { class: 'kpi-card overflow-x-auto mb-5' }, table));

  const kpiCompareGrid = h('div', { class: 'grid grid-cols-2 md:grid-cols-4 gap-4' });
  const kpiLabels = [
    ['total_companies', 'Total Companies'], ['total_assets', 'Total Assets'],
    ['phase1_assets', 'Phase 1 Assets'], ['bdl_transactions', 'BD&L Deals'],
  ];
  kpiLabels.forEach(([key, label]) => {
    const a = kpis_a[key], b = kpis_b[key], delta = b - a;
    kpiCompareGrid.appendChild(h('div', { class: 'kpi-card' }, [
      h('div', { class: 'kpi-label mb-1' }, label),
      h('div', { class: 'flex items-baseline gap-2' }, [
        h('span', { class: 'kpi-value' }, String(b)),
        h('span', { class: 'text-xs font-semibold ' + (delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : 'text-slate-400') }, `${delta > 0 ? '+' : ''}${delta} vs ${version_a.month_label}`),
      ]),
    ]));
  });
  container.appendChild(kpiCompareGrid);
}
