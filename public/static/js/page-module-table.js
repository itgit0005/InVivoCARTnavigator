const MODULE_COLUMN_CONFIG = {
  company_intelligence: ['Company', 'HQ', 'Company Type / Status', 'Core In Vivo Platform', 'Delivery Modality', 'Lead Asset', 'Development Stage', 'Therapeutic Focus', 'Acquirer / Partner', 'Deal Value'],
  pipeline_dashboard: ['Asset Name', 'Company', 'Target Antigen', 'Delivery Technology', 'Vector / Payload', 'Primary Indication', 'Disease Category', 'Development Stage', 'Trial Status / Notes'],
  technology_intelligence: ['Delivery Class', 'Companies', 'Payload Persistence', 'Mechanism Summary', 'Key Advantage(s) Claimed', 'Key Risk(s) Considered', 'Representative Asset'],
  target_landscape: ['Target Antigen', '# Companies Targeting (named)', 'Companies', 'Disease Category', 'Phase (most advanced)', 'White Space Note'],
  bdl_intelligence: ['Announcement Date', 'Acquirer / Partner', 'Target Company', 'Deal Type', 'Asset(s)', 'Upfront', 'Total Deal Value (incl. milestones)', 'Territory / Focus'],
  funding_investment: ['Company', 'Round', 'Date', 'Amount', 'Lead / Notable Investors', 'Status', 'Note'],
  competitive_intelligence: ['Company', 'Parent (if acquired)', 'Delivery Platform', 'Clinical Progress', 'Manufacturing Readiness', 'Strategic Camp', 'Key Differentiator'],
  clinical_trial_dashboard: ['Trial / Asset', 'Sponsor', 'Phase', 'Geography', 'Status', 'Key Milestone Date', 'Est. Enrollment'],
  regulatory_dashboard: ['Company / Asset', 'Agency', 'Designation / Interaction', 'Event Class', 'Date', 'Indication', 'Note'],
};

const MODULE_URL_FIELDS = {
  catalyst_dashboard: ['Company Announcement URL', 'Press Release URL'],
  default: ['Company Announcement URL', 'Credible Press Release URL'],
};

async function renderModuleTablePage(container, module) {
  showSpinner(container);
  try {
    const params = STATE.currentMonth ? { month: STATE.currentMonth } : {};
    const data = await API.get(`/dashboards/module/${module}`, params);
    container.innerHTML = '';

    const v = data.version;
    container.appendChild(versionBanner(v));

    const toolbar = h('div', { class: 'flex items-center justify-between mb-4' }, [
      h('div', { class: 'text-sm text-slate-600' }, `${data.count} records`),
      h('div', { class: 'flex items-center gap-2' }, [
        searchBox((q) => filterTable(module, q)),
        canExportRole() ? h('button', { class: 'btn btn-secondary', onclick: () => downloadCsv(module, STATE.currentMonth) }, [h('i', { class: 'fa-solid fa-download' }), 'Export CSV']) : null,
      ]),
    ]);
    container.appendChild(toolbar);

    const cols = MODULE_COLUMN_CONFIG[module] || Object.keys(data.rows[0] || {}).filter((k) => k !== 'record_key' && k !== '__meta' && !k.includes('URL'));
    const urlFields = MODULE_URL_FIELDS[module] || MODULE_URL_FIELDS.default;

    const wrap = h('div', { class: 'kpi-card overflow-x-auto', id: `table-wrap-${module}` });
    const table = buildDataTable(cols, data.rows, urlFields);
    wrap.appendChild(table);
    container.appendChild(wrap);
  } catch (e) {
    renderError(container, e.message);
  }
}

function versionBanner(v) {
  return h('div', { class: 'mb-5 flex items-center justify-between bg-blue-50 border border-blue-100 rounded-xl px-4 py-3' }, [
    h('div', { class: 'text-sm text-blue-800' }, [
      h('i', { class: 'fa-solid fa-circle-check mr-2 text-blue-600' }),
      `Data version: `, h('strong', {}, `${v.month_label} — ${v.version_label}`),
      `  •  Cutoff: ${fmtDate(v.data_cutoff_date)}`,
    ]),
    h('span', { class: 'badge ' + (v.is_current_live ? 'badge-verified' : 'badge-pending') }, v.is_current_live ? 'LIVE' : v.status.toUpperCase()),
  ]);
}

function searchBox(onInput) {
  const input = h('input', { type: 'text', placeholder: 'Search...', class: 'text-sm border border-slate-300 rounded-lg px-3 py-1.5 w-56' });
  input.addEventListener('input', () => onInput(input.value));
  return input;
}

function buildDataTable(cols, rows, urlFields) {
  const [primField, indField] = urlFields;

  const table = h('table', { class: 'data-table' });
  const thead = h('thead', {}, h('tr', {}, [
    ...cols.map((c) => h('th', {}, c)),
    h('th', {}, 'Source 1'),
    h('th', {}, 'Source 2'),
    h('th', {}, 'Confidence'),
  ]));
  table.appendChild(thead);
  const tbody = h('tbody', { id: 'tbody-search-target' });
  rows.forEach((row) => {
    const meta = row.__meta || {};
    const tr = h('tr', {});
    cols.forEach((c) => tr.appendChild(h('td', {}, truncateCell(row[c]))));
    const primUrl = row[primField] || meta.primary_source_url;
    const indUrl = row[indField] || meta.independent_source_url;
    tr.appendChild(h('td', {}, h('span', { html: sourceLink(primUrl, 'Source 1') })));
    tr.appendChild(h('td', {}, h('span', { html: sourceLink(indUrl, 'Source 2') })));
    tr.appendChild(h('td', {}, h('span', { html: confidenceBadge(meta.confidence_level) })));
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  return table;
}

function truncateCell(v) {
  if (v === null || v === undefined) return '—';
  const s = String(v);
  if (s.length <= 90) return s;
  const span = h('span', { title: s }, s.slice(0, 87) + '...');
  return span;
}

function filterTable(module, query) {
  const wrap = document.getElementById(`table-wrap-${module}`);
  if (!wrap) return;
  const q = query.toLowerCase();
  wrap.querySelectorAll('tbody tr').forEach((tr) => {
    const text = tr.textContent.toLowerCase();
    tr.style.display = text.includes(q) ? '' : 'none';
  });
}
