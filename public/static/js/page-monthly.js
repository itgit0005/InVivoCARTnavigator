async function renderMonthlyUpdatesPage(container) {
  showSpinner(container);
  try {
    container.innerHTML = '';
    container.appendChild(sectionTitle('fa-clock-rotate-left', 'Historical Monthly Snapshots', 'Compare portfolio KPIs and record counts across two months'));

    const months = STATE.months.length ? STATE.months : (await API.get('/dashboards/months')).months;

    const controls = h('div', { class: 'toolbar-card mb-6' });
    const left = h('div', { class: 'flex items-center gap-3' });
    const selA = h('select', { class: 'text-sm border border-slate-300 rounded-lg px-3 py-2 font-medium' });
    const selB = h('select', { class: 'text-sm border border-slate-300 rounded-lg px-3 py-2 font-medium' });
    months.forEach((m) => { selA.appendChild(h('option', { value: m }, m)); selB.appendChild(h('option', { value: m }, m)); });
    if (months.length > 1) { selA.value = months[1]; selB.value = months[0]; }
    const compareBtn = h('button', { class: 'btn btn-primary' }, [h('i', { class: 'fa-solid fa-code-compare' }), 'Compare']);
    left.appendChild(h('span', { class: 'text-sm font-semibold text-slate-500' }, 'Compare'));
    left.appendChild(selA);
    left.appendChild(h('span', { class: 'text-xs text-slate-400 font-semibold' }, 'VS.'));
    left.appendChild(selB);
    controls.appendChild(left);
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

function renderCompareResult(container, data) {
  container.innerHTML = '';
  const { version_a, version_b, kpis_a, kpis_b, module_counts } = data;

  const kpiCompareGrid = h('div', { class: 'grid grid-cols-2 md:grid-cols-4 gap-4 mb-6' });
  const kpiLabels = [
    ['total_companies', 'Total Companies', 'fa-building', 'blue'],
    ['total_assets', 'Total Assets', 'fa-flask', 'indigo'],
    ['phase1_assets', 'Phase 1 Assets', 'fa-syringe', 'amber'],
    ['bdl_transactions', 'BD&L Deals', 'fa-handshake', 'green'],
  ];
  kpiLabels.forEach(([key, label, icon, tone]) => {
    const a = kpis_a[key], b = kpis_b[key], delta = b - a;
    const deltaColor = delta > 0 ? 'text-green-600' : delta < 0 ? 'text-red-600' : 'text-slate-400';
    kpiCompareGrid.appendChild(h('div', { class: `stat-card tone-${tone}` }, [
      h('div', { class: 'stat-accent' }),
      h('div', { class: 'stat-icon' }, h('i', { class: `fa-solid ${icon}` })),
      h('div', { class: 'stat-value' }, String(b)),
      h('div', { class: 'flex items-center gap-1.5 mt-0.5' }, [
        h('span', { class: 'stat-label' }, label),
      ]),
      h('div', { class: 'text-[11px] font-bold mt-1 ' + deltaColor }, `${delta > 0 ? '+' : ''}${delta} vs ${version_a.month_label}`),
    ]));
  });
  container.appendChild(kpiCompareGrid);

  container.appendChild(sectionTitle('fa-layer-group', 'Module-Level Record Deltas', `${version_a.month_label} → ${version_b.month_label}`));

  const gridCols = 'minmax(220px,1.8fr) minmax(90px,1fr) minmax(90px,1fr) minmax(110px,1fr)';
  const list = h('div', { class: 'record-list' });
  const head = h('div', { class: 'record-list-head', style: `grid-template-columns:${gridCols};` });
  head.appendChild(h('div', {}, 'Module'));
  head.appendChild(h('div', { class: 'text-center' }, version_a.month_label));
  head.appendChild(h('div', { class: 'text-center' }, version_b.month_label));
  head.appendChild(h('div', { class: 'text-center' }, 'Δ Change'));
  list.appendChild(head);

  for (const [mod, counts] of Object.entries(module_counts)) {
    const deltaColor = counts.delta > 0 ? 'text-green-600' : counts.delta < 0 ? 'text-red-600' : 'text-slate-400';
    const deltaIcon = counts.delta > 0 ? 'fa-arrow-trend-up' : counts.delta < 0 ? 'fa-arrow-trend-down' : 'fa-minus';
    const row = h('div', { class: 'record-row', style: `grid-template-columns:${gridCols};cursor:default;` });
    row.appendChild(h('div', { class: 'flex items-center gap-3 min-w-0' }, [
      h('div', { class: 'record-avatar' }, initials(MODULE_LABEL_MAP[mod] || mod)),
      h('div', { class: 'record-title truncate' }, MODULE_LABEL_MAP[mod] || mod),
    ]));
    row.appendChild(h('div', { class: 'text-center record-field-value' }, String(counts.a)));
    row.appendChild(h('div', { class: 'text-center record-field-value font-bold text-slate-800' }, String(counts.b)));
    row.appendChild(h('div', { class: 'text-center font-bold ' + deltaColor }, [
      h('i', { class: 'fa-solid ' + deltaIcon, style: 'font-size:.65rem;margin-right:.3rem;' }),
      (counts.delta > 0 ? '+' : '') + counts.delta,
    ]));
    list.appendChild(row);
  }
  container.appendChild(list);
}
