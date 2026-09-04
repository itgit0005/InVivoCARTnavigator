async function renderClinicalPage(container) {
  showSpinner(container);
  try {
    const params = STATE.currentMonth ? { month: STATE.currentMonth } : {};
    const data = await API.get('/dashboards/module/clinical_intelligence', params);
    container.innerHTML = '';
    container.appendChild(versionBanner(data.version));

    container.appendChild(h('div', { class: 'bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-5 text-sm text-amber-800' }, [
      h('i', { class: 'fa-solid fa-triangle-exclamation mr-2' }),
      'Reported early clinical signals; sample sizes are very small (n=1–18) — directional only, not powered for conclusions. Preliminary Phase 1 data is never presented as definitive efficacy.',
    ]));

    const toolbar = h('div', { class: 'flex items-center justify-between mb-4' }, [
      h('div', { class: 'text-sm text-slate-600' }, `${data.count} clinical records`),
      canExportRole() ? h('button', { class: 'btn btn-secondary', onclick: () => downloadCsv('clinical_intelligence', STATE.currentMonth) }, [h('i', { class: 'fa-solid fa-download' }), 'Export CSV']) : null,
    ]);
    container.appendChild(toolbar);

    const grid = h('div', { class: 'grid grid-cols-1 lg:grid-cols-2 gap-4' });
    data.rows.forEach((row) => {
      const meta = row.__meta || {};
      const card = h('div', { class: 'kpi-card' });
      card.appendChild(h('div', { class: 'flex items-start justify-between mb-2' }, [
        h('div', {}, [
          h('div', { class: 'font-bold text-slate-900' }, row['Asset']),
          h('div', { class: 'text-xs text-slate-500' }, row['Company'] + ' • ' + (row['Indication'] || '')),
        ]),
        confidenceBadge(meta.confidence_level) ? h('span', { html: confidenceBadge(meta.confidence_level) }) : null,
      ]));

      const statRow = h('div', { class: 'grid grid-cols-4 gap-2 text-center my-3' });
      [
        ['n', row['n (reported)']],
        ['CRS', row['CRS']],
        ['ICANS', row['ICANS']],
        ['Deaths', row['Deaths']],
      ].forEach(([label, val]) => {
        statRow.appendChild(h('div', { class: 'bg-slate-50 rounded-lg py-2' }, [
          h('div', { class: 'text-[10px] text-slate-500 uppercase font-semibold' }, label),
          h('div', { class: 'text-xs font-bold text-slate-800 mt-0.5' }, val ? String(val).slice(0, 20) : '—'),
        ]));
      });
      card.appendChild(statRow);

      card.appendChild(h('div', { class: 'text-xs text-slate-600 mb-2' }, [h('strong', {}, 'ORR/Response: '), row['ORR / Response'] || '—']));
      card.appendChild(h('div', { class: 'text-xs text-slate-600 mb-3' }, [h('strong', {}, 'Note: '), row['Notable Efficacy/Safety Note'] || '—']));

      card.appendChild(h('div', { class: 'flex items-center justify-between pt-2 border-t border-slate-100' }, [
        h('span', { html: sourceLink(row['Company Announcement URL'], 'Announcement') }),
        h('span', { html: sourceLink(row['Credible Press Release URL'], 'Press') }),
      ]));

      grid.appendChild(card);
    });
    container.appendChild(grid);
  } catch (e) {
    renderError(container, e.message);
  }
}
