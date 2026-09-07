async function renderExecutivePage(container) {
  showSpinner(container);
  try {
    const params = STATE.currentMonth ? { month: STATE.currentMonth } : {};
    const data = await API.get('/dashboards/executive', params);
    container.innerHTML = '';

    const v = data.version;
    const k = data.kpis;

    // ---------- Hero banner ----------
    const hero = h('div', { class: 'hero-banner' });
    const heroContent = h('div', { class: 'hero-content flex items-start justify-between flex-wrap gap-4' });
    heroContent.appendChild(h('div', {}, [
      h('div', { class: 'hero-eyebrow' }, 'In Vivo CAR-T Navigator'),
      h('div', { class: 'hero-title' }, 'Executive Overview'),
      h('div', { class: 'hero-sub' }, [
        h('i', { class: 'fa-regular fa-calendar mr-1.5' }),
        `${v.month_label} snapshot`, h('span', { class: 'mx-1.5 text-slate-500' }, '•'),
        `Cutoff ${fmtDate(v.data_cutoff_date)}`, h('span', { class: 'mx-1.5 text-slate-500' }, '•'),
        `${v.version_label}`,
      ]),
    ]));
    heroContent.appendChild(
      h('span', { class: 'hero-pill' + (v.is_current_live ? ' live' : '') }, [
        v.is_current_live ? h('span', { class: 'dot' }) : h('i', { class: 'fa-solid fa-clock-rotate-left' }),
        v.is_current_live ? 'LIVE DATASET' : v.status.toUpperCase(),
      ])
    );
    hero.appendChild(heroContent);

    // Strip of headline metrics inside the hero
    const heroStats = h('div', { class: 'hero-content flex items-center gap-8 mt-5 flex-wrap' });
    [
      ['Companies Tracked', k.total_companies],
      ['Named Assets', k.total_assets],
      ['BD&L Deals', k.bdl_transactions],
      ['Regulatory Wins', k.regulatory_actions_achieved],
    ].forEach(([label, value], i) => {
      heroStats.appendChild(h('div', { class: 'flex items-center gap-3' }, [
        i > 0 ? h('div', { style: 'width:1px;height:2rem;background:rgba(255,255,255,.15);' }) : null,
        h('div', {}, [
          h('div', { class: 'text-2xl font-extrabold text-white leading-none' }, String(value)),
          h('div', { class: 'text-[11px] text-slate-300 mt-1 font-medium' }, label),
        ]),
      ]));
    });
    hero.appendChild(heroStats);
    container.appendChild(hero);

    // ---------- Portfolio Overview ----------
    container.appendChild(sectionTitle('fa-building', 'Portfolio Overview'));
    container.appendChild(kpiGrid([
      { label: 'Total Companies Tracked', value: k.total_companies, icon: 'fa-building', tone: 'blue' },
      { label: 'Total Named Assets', value: k.total_assets, icon: 'fa-flask-vial', tone: 'indigo' },
      { label: 'Acquired by Big Pharma', value: k.acquired_companies, icon: 'fa-money-bill-trend-up', tone: 'amber' },
      { label: 'Independent Companies', value: k.independent_companies, icon: 'fa-seedling', tone: 'green' },
    ]));

    // ---------- Pipeline by Stage & Indication ----------
    container.appendChild(sectionTitle('fa-flask-vial', 'Pipeline by Stage & Indication', 'Exact-match methodology'));
    container.appendChild(kpiGrid([
      { label: 'Phase 1 Clinical Assets', value: k.phase1_assets, icon: 'fa-vial-circle-check', tone: 'blue' },
      { label: 'Phase 1/2+ Clinical Assets', value: k.phase12plus_assets, icon: 'fa-vials', tone: 'indigo' },
      { label: 'IND-Enabling Assets', value: k.ind_enabling_assets, icon: 'fa-file-circle-check', tone: 'teal' },
      { label: 'Preclinical / Discovery Assets', value: k.preclinical_assets, icon: 'fa-microscope', tone: 'slate' },
      { label: 'Oncology-Focused Assets', value: k.oncology_focused_assets, icon: 'fa-ribbon', tone: 'rose' },
      { label: 'Autoimmune-Focused Assets', value: k.autoimmune_focused_assets, icon: 'fa-shield-virus', tone: 'green' },
    ]));

    // ---------- Delivery Modality & Deal Activity ----------
    container.appendChild(sectionTitle('fa-syringe', 'Delivery Modality & Deal Activity', 'Substring-match methodology'));
    container.appendChild(kpiGrid([
      { label: 'Lentiviral Delivery Assets', value: k.lentiviral_assets, icon: 'fa-syringe', tone: 'amber' },
      { label: 'LNP-Family Delivery Assets', value: k.lnp_assets, icon: 'fa-atom', tone: 'teal' },
      { label: 'BD&L Transactions Logged', value: k.bdl_transactions, icon: 'fa-handshake', tone: 'indigo' },
      { label: 'Regulatory Actions Achieved', value: k.regulatory_actions_achieved, icon: 'fa-gavel', tone: 'blue' },
    ]));

    // ---------- Charts ----------
    container.appendChild(sectionTitle('fa-chart-pie', 'Visual Breakdown'));
    const chartsRow = h('div', { class: 'grid grid-cols-1 lg:grid-cols-2 gap-5' });
    const stageCard = h('div', { class: 'surface-card' }, [
      h('div', { class: 'surface-card-title' }, [h('i', { class: 'fa-solid fa-layer-group' }), 'Assets by Development Stage']),
      h('div', { style: 'height:240px;position:relative;' }, h('canvas', { id: 'chart-stage' })),
    ]);
    const modalityCard = h('div', { class: 'surface-card' }, [
      h('div', { class: 'surface-card-title' }, [h('i', { class: 'fa-solid fa-vial' }), 'Assets by Delivery Modality (substring match)']),
      h('div', { style: 'height:240px;position:relative;' }, h('canvas', { id: 'chart-modality' })),
    ]);
    chartsRow.appendChild(stageCard);
    chartsRow.appendChild(modalityCard);
    container.appendChild(chartsRow);

    // ---------- Target white space ----------
    container.appendChild(sectionTitle('fa-bullseye', 'Target White Space', 'Dynamically calculated from live records'));
    const wsCard = h('div', { class: 'surface-card' });
    const ws = data.white_space;
    const sortedTargets = [...ws.derived_target_counts].sort((a, b) => b.company_count - a.company_count);
    const maxCount = Math.max(1, ...sortedTargets.map((t) => t.company_count));

    const wsList = h('div', { class: 'space-y-2.5' });
    sortedTargets.forEach((row) => {
      const pct = Math.round((row.company_count / maxCount) * 100);
      wsList.appendChild(h('div', { class: 'flex items-center gap-3' }, [
        h('div', { class: 'w-32 flex-shrink-0 text-xs font-bold text-slate-700 truncate' }, row.target),
        h('div', { class: 'flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden' },
          h('div', { class: 'h-full rounded-full', style: `width:${pct}%;background:linear-gradient(90deg,#2563eb,#4338ca);` })
        ),
        h('div', { class: 'w-8 flex-shrink-0 text-xs font-bold text-slate-500 text-right' }, String(row.company_count)),
      ]));
    });
    wsCard.appendChild(wsList);
    wsCard.appendChild(h('div', { class: 'flex items-start gap-2 mt-4 pt-4 border-t border-slate-100 text-xs text-slate-500 italic' }, [
      h('i', { class: 'fa-solid fa-circle-info mt-0.5 text-blue-400' }),
      ws.solid_tumor_antigen_note,
    ]));
    container.appendChild(wsCard);

    // ---------- Charts render ----------
    new Chart(document.getElementById('chart-stage'), {
      type: 'doughnut',
      data: {
        labels: ['Phase 1', 'Phase 1/2+', 'IND-Enabling', 'Preclinical'],
        datasets: [{
          data: [k.phase1_assets, k.phase12plus_assets, k.ind_enabling_assets, k.preclinical_assets],
          backgroundColor: ['#2563eb', '#4338ca', '#0891b2', '#cbd5e1'],
          borderWidth: 0, hoverOffset: 6,
        }],
      },
      options: {
        maintainAspectRatio: false, cutout: '68%',
        plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 10, padding: 14, usePointStyle: true, pointStyle: 'circle' } } },
      },
    });
    new Chart(document.getElementById('chart-modality'), {
      type: 'bar',
      data: {
        labels: ['Lentiviral', 'LNP-family'],
        datasets: [{ data: [k.lentiviral_assets, k.lnp_assets], backgroundColor: ['#d97706', '#0891b2'], borderRadius: 8, maxBarThickness: 56 }],
      },
      options: {
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 2, font: { size: 11 } }, grid: { color: '#f1f5f9' } },
          x: { ticks: { font: { size: 12, weight: '600' } }, grid: { display: false } },
        },
      },
    });
  } catch (e) {
    renderError(container, e.message);
  }
}

function sectionTitle(icon, text, hint) {
  return h('div', { class: 'section-head' }, [
    h('div', { class: 'section-title' }, [h('i', { class: `fa-solid ${icon}` }), text]),
    hint ? h('div', { class: 'section-hint' }, hint) : null,
  ]);
}

function kpiGrid(items) {
  const grid = h('div', { class: 'grid grid-cols-2 md:grid-cols-4 gap-4' });
  items.forEach((item) => {
    const tone = item.tone || 'blue';
    grid.appendChild(h('div', { class: `stat-card tone-${tone}` }, [
      h('div', { class: 'stat-accent' }),
      h('div', { class: 'stat-icon' }, h('i', { class: `fa-solid ${item.icon}` })),
      h('div', { class: 'stat-value' }, String(item.value)),
      h('div', { class: 'stat-label' }, item.label),
    ]));
  });
  return grid;
}
