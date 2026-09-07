// ---------- Per-module display configuration for the platform-style record list ----------
// title/subtitle drive the left identity block; badgeField renders a colored status chip;
// keyFields render as compact label/value columns. Everything else is still fully available
// in the detail modal (click a row) — nothing from the underlying data is hidden, just
// de-emphasized from the scan view.
const MODULE_DISPLAY_CONFIG = {
  company_intelligence: {
    title: 'Company', subtitle: 'HQ', badgeField: 'Development Stage',
    keyFields: ['Core In Vivo Platform', 'Lead Asset', 'Delivery Modality'],
  },
  pipeline_dashboard: {
    title: 'Asset Name', subtitle: 'Company', badgeField: 'Development Stage',
    keyFields: ['Target Antigen', 'Delivery Technology', 'Primary Indication'],
  },
  technology_intelligence: {
    title: 'Delivery Class', subtitle: 'Representative Asset', badgeField: null,
    keyFields: ['Companies', 'Payload Persistence', 'Key Advantage(s) Claimed'],
  },
  target_landscape: {
    title: 'Target Antigen', subtitle: 'Disease Category', badgeField: 'Phase (most advanced)',
    keyFields: ['# Companies Targeting (named)', 'Companies', 'White Space Note'],
  },
  bdl_intelligence: {
    title: 'Acquirer / Partner', subtitle: 'Target Company', badgeField: 'Deal Type',
    keyFields: ['Announcement Date', 'Upfront', 'Total Deal Value (incl. milestones)'],
  },
  funding_investment: {
    title: 'Company', subtitle: 'Round', badgeField: 'Status',
    keyFields: ['Date', 'Amount', 'Lead / Notable Investors'],
  },
  competitive_intelligence: {
    title: 'Company', subtitle: 'Strategic Camp', badgeField: null,
    keyFields: ['Delivery Platform', 'Clinical Progress', 'Manufacturing Readiness'],
  },
  clinical_trial_dashboard: {
    title: 'Trial / Asset', subtitle: 'Sponsor', badgeField: 'Status',
    keyFields: ['Phase', 'Geography', 'Key Milestone Date'],
  },
  regulatory_dashboard: {
    title: 'Company / Asset', subtitle: 'Agency', badgeField: 'Event Class',
    keyFields: ['Designation / Interaction', 'Date', 'Indication'],
  },
};

// Full field order shown in the detail modal (all columns from the original config, in order).
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

    if (data.restricted) {
      return renderDemoRestrictedPlaceholder(container, {
        title: MODULE_LABEL_MAP[module] || module,
        message: data.message,
        version: data.version,
      });
    }

    container.innerHTML = '';

    const v = data.version;
    container.appendChild(versionBanner(v));

    const toolbar = h('div', { class: 'toolbar-card' }, [
      h('div', { class: 'flex items-center gap-3' }, [
        h('div', { class: 'w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center' }, h('i', { class: 'fa-solid fa-table-list text-xs' })),
        h('div', {}, [
          h('div', { class: 'text-sm font-bold text-slate-800' }, `${data.count} records`),
          h('div', { class: 'text-[11px] text-slate-400' }, 'Click any row to view full details & sources'),
        ]),
      ]),
      h('div', { class: 'flex items-center gap-2' }, [
        searchBox((q) => filterRecordList(module, q)),
        canExportRole() ? h('button', { class: 'btn btn-secondary', onclick: () => downloadCsv(module, STATE.currentMonth) }, [h('i', { class: 'fa-solid fa-download' }), 'Export CSV']) : null,
      ]),
    ]);
    container.appendChild(toolbar);

    const cfg = MODULE_DISPLAY_CONFIG[module] || {};
    const cols = MODULE_COLUMN_CONFIG[module] || Object.keys(data.rows[0] || {}).filter((k) => k !== 'record_key' && k !== '__meta' && !k.includes('URL'));
    const urlFields = MODULE_URL_FIELDS[module] || MODULE_URL_FIELDS.default;

    const wrap = h('div', { id: `table-wrap-${module}` });
    wrap.appendChild(buildRecordList(module, cfg, cols, data.rows, urlFields));
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
  const wrap = h('div', { class: 'search-input-wrap' });
  wrap.appendChild(h('i', { class: 'fa-solid fa-magnifying-glass' }));
  const input = h('input', { type: 'text', placeholder: 'Search records...', class: 'search-input text-sm border border-slate-300 rounded-lg px-3 py-1.5 w-64' });
  input.addEventListener('input', () => onInput(input.value));
  wrap.appendChild(input);
  return wrap;
}

// Maps free-text stage/status values to a colored chip class family.
function stageChipClass(value) {
  const v = (value || '').toLowerCase();
  if (!v) return 'stage-other';
  if (v.includes('acquired') || v.includes('completed') || v.includes('approved')) return 'stage-acquired';
  if (v.startsWith('phase 1/2') || v.includes('phase 2') || v.includes('phase ii')) return 'stage-phase12plus';
  if (v.startsWith('phase 1') || v.includes('phase i')) return 'stage-phase1';
  if (v.includes('ind') || v.includes('active') || v.includes('ongoing') || v.includes('recruiting')) return 'stage-ind';
  if (v.includes('preclinical') || v.includes('discovery') || v.includes('independent')) return 'stage-preclinical';
  return 'stage-other';
}

function buildRecordList(module, cfg, cols, rows, urlFields) {
  const [primField, indField] = urlFields;
  const titleField = cfg.title || cols[0];
  const subtitleField = cfg.subtitle || cols[1];
  const keyFields = cfg.keyFields || cols.slice(2, 5);
  const gridCols = `minmax(200px,1.5fr) ${keyFields.map(() => 'minmax(110px,1fr)').join(' ')} auto auto 1.25rem`;

  const list = h('div', { class: 'record-list' });

  // Column header row
  const headRow = h('div', { class: 'record-list-head', style: `grid-template-columns:${gridCols};` });
  headRow.appendChild(h('div', {}, titleField || 'Record'));
  keyFields.forEach((f) => headRow.appendChild(h('div', {}, f)));
  headRow.appendChild(h('div', {}, cfg.badgeField ? 'Stage' : ''));
  headRow.appendChild(h('div', {}, 'Confidence'));
  headRow.appendChild(h('div', {}));
  list.appendChild(headRow);

  rows.forEach((row) => {
    const meta = row.__meta || {};
    const title = row[titleField] || '—';
    const subtitle = subtitleField ? row[subtitleField] : null;

    const tr = h('div', { class: 'record-row', style: `grid-template-columns:${gridCols};`, 'data-search': JSON.stringify(row).toLowerCase() });

    tr.appendChild(h('div', { class: 'flex items-center gap-3 min-w-0' }, [
      h('div', { class: 'record-avatar' }, initials(title)),
      h('div', { class: 'min-w-0' }, [
        h('div', { class: 'record-title truncate' }, truncateText(title, 46)),
        subtitle ? h('div', { class: 'record-subtitle truncate' }, truncateText(String(subtitle), 50)) : null,
      ]),
    ]));

    keyFields.forEach((f) => {
      const val = row[f];
      tr.appendChild(h('div', { class: 'min-w-0' }, [
        h('div', { class: 'record-field-value truncate' }, val !== null && val !== undefined && val !== '' ? truncateText(String(val), 34) : '—'),
      ]));
    });

    tr.appendChild(h('div', {}, cfg.badgeField && row[cfg.badgeField] ? h('span', { class: 'stage-chip ' + stageChipClass(row[cfg.badgeField]) }, truncateText(String(row[cfg.badgeField]), 22)) : null));
    tr.appendChild(h('div', {}, h('span', { html: confidenceBadge(meta.confidence_level) })));
    tr.appendChild(h('div', { class: 'text-slate-300 text-center' }, h('i', { class: 'fa-solid fa-chevron-right text-xs' })));

    tr.addEventListener('click', () => {
      const primUrl = row[primField] || meta.primary_source_url;
      const indUrl = row[indField] || meta.independent_source_url;
      openRecordDetailModal({
        title,
        subtitle: subtitle ? String(subtitle) : (MODULE_LABEL_MAP && MODULE_LABEL_MAP[module]) || '',
        avatarText: title,
        fields: cols.map((c) => [c, row[c]]),
        sources: [{ url: primUrl, label: 'Source 1' }, { url: indUrl, label: 'Source 2' }],
        meta,
      });
    });

    list.appendChild(tr);
  });

  return list;
}

function truncateText(s, n) {
  if (s === null || s === undefined) return '—';
  const str = String(s);
  return str.length > n ? str.slice(0, n - 1) + '…' : str;
}

function filterRecordList(module, query) {
  const wrap = document.getElementById(`table-wrap-${module}`);
  if (!wrap) return;
  const q = query.toLowerCase();
  wrap.querySelectorAll('.record-row').forEach((row) => {
    const text = row.getAttribute('data-search') || '';
    row.style.display = text.includes(q) ? '' : 'none';
  });
}
