const MODULE_PAGES = new Set([
  'company_intelligence', 'pipeline_dashboard', 'technology_intelligence',
  'target_landscape', 'bdl_intelligence', 'funding_investment', 'competitive_intelligence',
]);

function renderCurrentPage() {
  const container = document.getElementById('page-container');
  if (!container) return;
  const page = STATE.currentPage;

  if (page === 'executive') return renderExecutivePage(container);
  if (MODULE_PAGES.has(page)) return renderModuleTablePage(container, page);
  if (page === 'clinical_intelligence') return renderClinicalPage(container);
  if (page === 'clinical_trial_dashboard') return renderModuleTablePage(container, page);
  if (page === 'catalyst_dashboard') return renderCatalystPage(container);
  if (page === 'regulatory_dashboard') return renderModuleTablePage(container, page);
  if (page === 'data_quality') return renderDataQualityPage(container);
  if (page === 'monthly_updates') return renderMonthlyUpdatesPage(container);
  if (page === 'ai_analyst') return renderAiAnalystPage(container);

  if (page === 'admin_upload') return renderAdminUploadPage(container);
  if (page === 'admin_review') return renderAdminReviewPage(container);
  if (page === 'admin_versions') return renderAdminVersionsPage(container);
  if (page === 'admin_users') return renderAdminUsersPage(container);
  if (page === 'admin_audit') return renderAdminAuditPage(container);
  if (page === 'admin_sources') return renderAdminSourcesPage(container);

  container.innerHTML = '<div class="text-slate-500">Page not found.</div>';
}
