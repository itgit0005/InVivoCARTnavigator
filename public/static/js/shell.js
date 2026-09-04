const NAV_ITEMS = [
  { id: 'executive', label: 'Executive', icon: 'fa-chart-pie' },
  { id: 'company_intelligence', label: 'Companies', icon: 'fa-building' },
  { id: 'pipeline_dashboard', label: 'Pipeline', icon: 'fa-flask-vial' },
  { id: 'clinical_intelligence', label: 'Clinical', icon: 'fa-stethoscope' },
  { id: 'clinical_trial_dashboard', label: 'Trials', icon: 'fa-notes-medical' },
  { id: 'target_landscape', label: 'Targets', icon: 'fa-bullseye' },
  { id: 'technology_intelligence', label: 'Technology', icon: 'fa-microchip' },
  { id: 'catalyst_dashboard', label: 'Catalysts', icon: 'fa-bolt' },
  { id: 'bdl_intelligence', label: 'BD/M&A', icon: 'fa-handshake' },
  { id: 'funding_investment', label: 'Funding', icon: 'fa-sack-dollar' },
  { id: 'competitive_intelligence', label: 'Competitive Intel', icon: 'fa-chess' },
  { id: 'regulatory_dashboard', label: 'Regulatory', icon: 'fa-gavel' },
  { id: 'monthly_updates', label: 'Monthly Updates', icon: 'fa-calendar-days' },
  { id: 'data_quality', label: 'Data Quality', icon: 'fa-shield-halved' },
  { id: 'ai_analyst', label: 'AI Analyst', icon: 'fa-robot' },
];

const ADMIN_NAV_ITEMS = [
  { id: 'admin_upload', label: 'Upload Monthly Update', icon: 'fa-cloud-arrow-up' },
  { id: 'admin_review', label: 'Review & Approve', icon: 'fa-clipboard-check' },
  { id: 'admin_versions', label: 'Version History', icon: 'fa-code-branch' },
  { id: 'admin_users', label: 'Users & Permissions', icon: 'fa-users-gear' },
  { id: 'admin_sources', label: 'Manage Sources', icon: 'fa-link' },
  { id: 'admin_audit', label: 'Audit Trail', icon: 'fa-file-shield' },
];

function renderApp() {
  const root = document.getElementById('app');
  root.innerHTML = '';

  const shell = h('div', { class: 'flex h-screen overflow-hidden' });

  // ---------- Sidebar ----------
  const sidebar = h('aside', { class: 'w-64 flex-shrink-0 bg-slate-900 text-white flex flex-col' });
  sidebar.appendChild(h('div', { class: 'px-5 py-5 border-b border-white/10' }, [
    h('div', { class: 'flex items-center gap-2.5' }, [
      h('div', { class: 'w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center flex-shrink-0' }, h('i', { class: 'fa-solid fa-dna text-sm' })),
      h('div', {}, [
        h('div', { class: 'text-sm font-bold leading-tight' }, 'In Vivo CAR-T'),
        h('div', { class: 'text-[10px] text-slate-400 leading-tight' }, 'Intelligence Platform'),
      ]),
    ]),
  ]));

  const navScroll = h('div', { class: 'flex-1 overflow-y-auto px-3 py-4 space-y-0.5 scrollbar-thin' });
  NAV_ITEMS.forEach((item) => {
    const link = h('div', { class: 'nav-link' + (STATE.currentPage === item.id ? ' active' : '') }, [
      h('i', { class: 'fa-solid ' + item.icon }),
      item.label,
    ]);
    link.addEventListener('click', () => navigate(item.id));
    navScroll.appendChild(link);
  });

  if (isSuperAdmin()) {
    navScroll.appendChild(h('div', { class: 'pt-4 pb-1 px-3 text-[10px] font-bold uppercase text-slate-500 tracking-wider' }, 'Super Admin'));
    ADMIN_NAV_ITEMS.forEach((item) => {
      const link = h('div', { class: 'nav-link' + (STATE.currentPage === item.id ? ' active' : '') }, [
        h('i', { class: 'fa-solid ' + item.icon }),
        item.label,
      ]);
      link.addEventListener('click', () => navigate(item.id));
      navScroll.appendChild(link);
    });
  }
  sidebar.appendChild(navScroll);

  sidebar.appendChild(h('div', { class: 'px-4 py-4 border-t border-white/10' }, [
    h('div', { class: 'flex items-center gap-2.5 mb-3' }, [
      h('div', { class: 'w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold' }, (STATE.user.display_name || STATE.user.username)[0].toUpperCase()),
      h('div', { class: 'min-w-0' }, [
        h('div', { class: 'text-xs font-semibold truncate' }, STATE.user.display_name || STATE.user.username),
        h('div', { class: 'text-[10px] text-slate-400' }, roleLabel(STATE.user.role)),
      ]),
    ]),
    h('button', { class: 'w-full text-xs bg-white/10 hover:bg-white/20 rounded-lg py-2 font-medium transition', onclick: doLogout }, [h('i', { class: 'fa-solid fa-right-from-bracket mr-1.5' }), 'Sign Out']),
  ]));

  shell.appendChild(sidebar);

  // ---------- Main area ----------
  const main = h('main', { class: 'flex-1 overflow-y-auto bg-slate-50' });
  const topbar = h('div', { class: 'sticky top-0 z-20 bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between' });

  const pageTitle = [...NAV_ITEMS, ...ADMIN_NAV_ITEMS].find((i) => i.id === STATE.currentPage)?.label || 'Dashboard';
  topbar.appendChild(h('h2', { class: 'text-base font-bold text-slate-900' }, pageTitle));

  const monthSelector = h('select', { id: 'global-month-select', class: 'text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium' });
  topbar.appendChild(h('div', { class: 'flex items-center gap-3' }, [
    h('span', { class: 'text-xs text-slate-500' }, 'Viewing:'),
    monthSelector,
  ]));

  main.appendChild(topbar);

  const pageContainer = h('div', { id: 'page-container', class: 'p-6' });
  main.appendChild(pageContainer);

  shell.appendChild(main);
  root.appendChild(shell);

  populateMonthSelector(monthSelector);
  renderCurrentPage();
}

async function populateMonthSelector(selectEl) {
  try {
    const data = await API.get('/dashboards/months');
    STATE.months = data.months;
    STATE.liveMonth = data.live_month;
    selectEl.innerHTML = '';
    data.months.forEach((m) => {
      const label = m === data.live_month ? `${m} (Live)` : m;
      selectEl.appendChild(h('option', { value: m }, label));
    });
    selectEl.value = STATE.currentMonth || data.live_month;
    selectEl.addEventListener('change', () => {
      STATE.currentMonth = selectEl.value === STATE.liveMonth ? null : selectEl.value;
      renderCurrentPage();
    });
  } catch (e) {
    console.error(e);
  }
}

function doLogout() {
  API.post('/auth/logout', {}).catch(() => {});
  localStorage.removeItem('ivct_token');
  setUser(null);
  renderLogin(document.getElementById('app'));
}

function navigate(pageId) {
  STATE.currentPage = pageId;
  renderApp();
}
