async function renderExecutivePage(container) {
  showSpinner(container);
  try {
    const params = STATE.currentMonth ? { month: STATE.currentMonth } : {};
    const data = await API.get('/dashboards/executive', params);
    container.innerHTML = '';

    const v = data.version;
    const k = data.kpis;

    // Version banner
    container.appendChild(h('div', { class: 'mb-5 flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-4 py-3' }, [
      h('div', { class: 'text-sm text-blue-800' }, [
        h('i', { class: 'fa-solid fa-circle-check mr-2 text-blue-600' }),
        `Data version: `, h('strong', {}, `${v.month_label} — ${v.version_label}`),
        `  •  Cutoff: ${fmtDate(v.data_cutoff_date)}`,
      ]),
      h('span', { class: 'badge ' + (v.is_current_live ? 'badge-verified' : 'badge-pending') }, v.is_current_live ? 'LIVE' : v.status.toUpperCase()),
    ]));

    // KPI grid — Portfolio Overview
    container.appendChild(sectionTitle('Portfolio Overview'));
    container.appendChild(kpiGrid([
      { label: 'Total Companies Tracked', value: k.total_companies, icon: 'fa-building' },
      { label: 'Total Named Assets', value: k.total_assets, icon: 'fa-flask-vial' },
      { label: 'Acquired by Big Pharma', value: k.acquired_companies, icon: 'fa-money-bill-trend-up' },
      { label: 'Independent Companies', value: k.independent_companies, icon: 'fa-seedling' },
    ]));

    container.appendChild(sectionTitle('Pipeline by Stage & Indication'));
    container.appendChild(kpiGrid([
      { label: 'Phase 1 Clinical Assets', value: k.phase1_assets, icon: 'fa-vial-circle-check' },
      { label: 'Phase 1/2+ Clinical Assets', value: k.phase12plus_assets, icon: 'fa-vials' },
      { label: 'IND-Enabling Assets', value: k.ind_enabling_assets, icon: 'fa-file-circle-check' },
      { label: 'Preclinical / Discovery Assets', value: k.preclinical_assets, icon: 'fa-microscope' },
      { label: 'Oncology-Focused Assets', value: k.oncology_focused_assets, icon: 'fa-ribbon' },
      { label: 'Autoimmune-Focused Assets', value: k.autoimmune_focused_assets, icon: 'fa-shield-virus' },
    ]));

    container.appendChild(sectionTitle('Delivery Modality & Deal Activity'));
    container.appendChild(kpiGrid([
      { label: 'Lentiviral Delivery Assets', value: k.lentiviral_assets, icon: 'fa-syringe' },
      { label: 'LNP-Family Delivery Assets', value: k.lnp_assets, icon: 'fa-atom' },
      { label: 'BD&L Transactions Logged', value: k.bdl_transactions, icon: 'fa-handshake' },
      { label: 'Regulatory Actions Achieved', value: k.regulatory_actions_achieved, icon: 'fa-gavel' },
    ]));

    // Charts row
    const chartsRow = h('div', { class: 'grid grid-cols-1 lg:grid-cols-2 gap-5 mt-6' });
    const stageCard = h('div', { class: 'kpi-card' }, [h('div', { class: 'kpi-label mb-3' }, 'Assets by Development Stage'), h('canvas', { id: 'chart-stage', height: '220' })]);
    const modalityCard = h('div', { class: 'kpi-card' }, [h('div', { class: 'kpi-label mb-3' }, 'Assets by Delivery Modality (substring match)'), h('canvas', { id: 'chart-modality', height: '220' })]);
    chartsRow.appendChild(stageCard);
    chartsRow.appendChild(modalityCard);
    container.appendChild(chartsRow);

    // Target white space
    container.appendChild(sectionTitle('Target White Space (Dynamically Calculated)'));
    const wsCard = h('div', { class: 'kpi-card' });
    const ws = data.white_space;
    const wsTable = h('table', { class: 'data-table' });
    wsTable.appendChild(h('thead', {}, h('tr', {}, [h('th', {}, 'Target Antigen'), h('th', {}, '# Companies (derived from Pipeline)')])));
    const tbody = h('tbody', {});
    ws.derived_target_counts.sort((a, b) => b.company_count - a.company_count).forEach((row) => {
      tbody.appendChild(h('tr', {}, [h('td', { class: 'font-semibold' }, row.target), h('td', {}, String(row.company_count))]));
    });
    wsTable.appendChild(tbody);
    wsCard.appendChild(wsTable);
    wsCard.appendChild(h('p', { class: 'text-xs text-slate-500 mt-3 italic' }, ws.solid_tumor_antigen_note));
    container.appendChild(wsCard);

    // Charts render
    new Chart(document.getElementById('chart-stage'), {
      type: 'doughnut',
      data: {
        labels: ['Phase 1', 'Phase 1/2+', 'IND-Enabling', 'Preclinical'],
        datasets: [{ data: [k.phase1_assets, k.phase12plus_assets, k.ind_enabling_assets, k.preclinical_assets], backgroundColor: ['#2563eb', '#7c3aed', '#0891b2', '#94a3b8'] }],
      },
      options: { plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } } },
    });
    new Chart(document.getElementById('chart-modality'), {
      type: 'bar',
      data: {
        labels: ['Lentiviral', 'LNP-family'],
        datasets: [{ data: [k.lentiviral_assets, k.lnp_assets], backgroundColor: ['#d97706', '#0891b2'] }],
      },
      options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 2 } } } },
    });
  } catch (e) {
    renderError(container, e.message);
  }
}

function sectionTitle(text) {
  return h('h3', { class: 'text-sm font-bold text-slate-700 uppercase tracking-wide mt-6 mb-3' }, text);
}

function kpiGrid(items) {
  const grid = h('div', { class: 'grid grid-cols-2 md:grid-cols-4 gap-4' });
  items.forEach((item) => {
    grid.appendChild(h('div', { class: 'kpi-card' }, [
      h('div', { class: 'flex items-center justify-between mb-2' }, [
        h('div', { class: 'kpi-label' }, item.label),
        h('i', { class: `fa-solid ${item.icon} text-blue-400` }),
      ]),
      h('div', { class: 'kpi-value' }, String(item.value)),
    ]));
  });
  return grid;
}
