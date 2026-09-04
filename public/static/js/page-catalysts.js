async function renderCatalystPage(container) {
  showSpinner(container);
  try {
    const params = STATE.currentMonth ? { month: STATE.currentMonth } : {};
    const data = await API.get('/dashboards/module/catalyst_dashboard', params);
    container.innerHTML = '';
    container.appendChild(versionBanner(data.version));

    const toolbar = h('div', { class: 'flex items-center justify-between mb-4' }, [
      h('div', { class: 'text-sm text-slate-600' }, `${data.count} catalysts`),
      canExportRole() ? h('button', { class: 'btn btn-secondary', onclick: () => downloadCsv('catalyst_dashboard', STATE.currentMonth) }, [h('i', { class: 'fa-solid fa-download' }), 'Export CSV']) : null,
    ]);
    container.appendChild(toolbar);

    const sorted = [...data.rows].sort((a, b) => new Date(b['Date']) - new Date(a['Date']));

    const timeline = h('div', { class: 'relative border-l-2 border-slate-200 ml-3 space-y-6' });
    sorted.forEach((row) => {
      const item = h('div', { class: 'relative pl-6' });
      item.appendChild(h('div', { class: 'absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-blue-600 border-2 border-white' }));
      const card = h('div', { class: 'kpi-card' });
      card.appendChild(h('div', { class: 'flex items-center justify-between mb-1' }, [
        h('div', { class: 'text-xs font-bold text-blue-700' }, fmtDate(row['Date'])),
        h('span', { class: 'badge badge-updated' }, row['Catalyst Type'] || ''),
      ]));
      card.appendChild(h('div', { class: 'font-semibold text-slate-900 text-sm mb-1' }, row['Company / Asset']));
      card.appendChild(h('div', { class: 'text-sm text-slate-700 mb-2' }, row['Catalyst']));
      card.appendChild(h('div', { class: 'text-xs text-slate-500 mb-2' }, [h('strong', {}, 'Impact: '), row['Impact'] || '—']));
      card.appendChild(h('div', { class: 'flex items-center gap-3' }, [
        h('span', { html: sourceLink(row['Company Announcement URL'], 'Source 1') }),
        h('span', { html: sourceLink(row['Press Release URL'], 'Source 2') }),
      ]));
      item.appendChild(card);
      timeline.appendChild(item);
    });
    container.appendChild(timeline);
  } catch (e) {
    renderError(container, e.message);
  }
}
