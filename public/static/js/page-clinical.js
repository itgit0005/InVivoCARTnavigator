async function renderClinicalPage(container) {
  showSpinner(container);
  try {
    const params = STATE.currentMonth ? { month: STATE.currentMonth } : {};
    const data = await API.get('/dashboards/module/clinical_intelligence', params);

    if (data.restricted) {
      return renderDemoRestrictedPlaceholder(container, {
        title: 'Clinical Intelligence',
        icon: 'fa-stethoscope',
        message: data.message,
        version: data.version,
      });
    }

    container.innerHTML = '';
    container.appendChild(versionBanner(data.version));

    container.appendChild(h('div', { class: 'bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-5 text-sm text-amber-800' }, [
      h('i', { class: 'fa-solid fa-triangle-exclamation mr-2' }),
      'Reported early clinical signals; sample sizes are very small (n=1–18) — directional only, not powered for conclusions. Preliminary Phase 1 data is never presented as definitive efficacy.',
    ]));

    container.appendChild(sectionTitle('fa-flask-vial', 'Clinical Intelligence', `${data.count} records`));

    const toolbar = h('div', { class: 'toolbar-card mb-5' }, [
      h('div', { class: 'flex items-center gap-2 text-sm text-slate-500' }, [
        h('i', { class: 'fa-solid fa-vial-circle-check text-blue-500' }),
        `${data.count} clinical records`,
      ]),
      canExportRole() ? h('button', { class: 'btn btn-secondary', onclick: () => downloadCsv('clinical_intelligence', STATE.currentMonth) }, [h('i', { class: 'fa-solid fa-download' }), 'Export CSV']) : null,
    ]);
    container.appendChild(toolbar);

    const grid = h('div', { class: 'grid grid-cols-1 lg:grid-cols-2 gap-4' });
    data.rows.forEach((row) => {
      const meta = row.__meta || {};
      const asset = row['Asset'] || '—';
      const stageVal = row['Phase'] || row['Development Stage'] || '';
      const card = h('div', { class: 'surface-card', style: 'cursor:pointer;transition:box-shadow .15s ease,transform .15s ease;' });
      card.addEventListener('mouseenter', () => { card.style.boxShadow = '0 10px 24px -14px rgba(15,23,42,.22)'; card.style.transform = 'translateY(-2px)'; });
      card.addEventListener('mouseleave', () => { card.style.boxShadow = ''; card.style.transform = ''; });

      card.appendChild(h('div', { class: 'flex items-start justify-between mb-3' }, [
        h('div', { class: 'flex items-center gap-3 min-w-0' }, [
          h('div', { class: 'record-avatar' }, initials(asset)),
          h('div', { class: 'min-w-0' }, [
            h('div', { class: 'font-bold text-slate-900 text-sm truncate' }, asset),
            h('div', { class: 'text-xs text-slate-500 truncate' }, (row['Company'] || '') + (row['Indication'] ? ' • ' + row['Indication'] : '')),
          ]),
        ]),
        h('div', { class: 'flex flex-col items-end gap-1 flex-shrink-0' }, [
          stageVal ? h('span', { class: 'stage-chip ' + stageChipClass(stageVal) }, truncateText(String(stageVal), 22)) : null,
          h('span', { html: confidenceBadge(meta.confidence_level) }),
        ]),
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

      const srcRow = h('div', { class: 'flex items-center gap-2 pt-3 border-t border-slate-100' });
      const primUrl = row['Company Announcement URL'] || meta.primary_source_url;
      const indUrl = row['Credible Press Release URL'] || meta.independent_source_url;
      [{ url: primUrl, label: 'Source 1' }, { url: indUrl, label: 'Source 2' }].forEach((s) => {
        if (s.url) {
          srcRow.appendChild(h('a', { href: s.url, target: '_blank', rel: 'noopener', class: 'detail-source-btn' }, [h('i', { class: 'fa-solid fa-arrow-up-right-from-square' }), s.label]));
        } else {
          srcRow.appendChild(h('span', { class: 'detail-source-btn muted' }, [h('i', { class: 'fa-solid fa-ban' }), `${s.label}: not disclosed`]));
        }
      });
      card.appendChild(srcRow);

      grid.appendChild(card);
    });
    container.appendChild(grid);
  } catch (e) {
    renderError(container, e.message);
  }
}
