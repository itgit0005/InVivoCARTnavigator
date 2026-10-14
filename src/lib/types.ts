export type Role = 'super_admin' | 'demo' | 'single_user' | 'multi_user';

export interface Bindings {
  DB: D1Database;
  OPENAI_API_KEY?: string;
  OPENAI_BASE_URL?: string;
}

export interface AuthUser {
  id: number;
  username: string;
  email: string | null;
  role: Role;
  org_id: number | null;
  display_name: string | null;
  can_upload: number;
  can_export: number;
}

export const MODULES = [
  'company_intelligence',
  'pipeline_dashboard',
  'clinical_intelligence',
  'technology_intelligence',
  'target_landscape',
  'clinical_trial_dashboard',
  'catalyst_dashboard',
  'bdl_intelligence',
  'funding_investment',
  'competitive_intelligence',
  'regulatory_dashboard',
] as const;

export type ModuleName = typeof MODULES[number];

export const MODULE_KEY_FIELDS: Record<ModuleName, string[]> = {
  company_intelligence: ['Company'],
  pipeline_dashboard: ['Company', 'Asset Name'],
  clinical_intelligence: ['Company', 'Asset'],
  technology_intelligence: ['Delivery Class'],
  target_landscape: ['Target Antigen'],
  clinical_trial_dashboard: ['Sponsor', 'Trial / Asset'],
  catalyst_dashboard: ['Date', 'Company / Asset', 'Catalyst Type'],
  bdl_intelligence: ['Announcement Date', 'Acquirer / Partner', 'Target Company'],
  funding_investment: ['Company', 'Round', 'Date'],
  competitive_intelligence: ['Company'],
  regulatory_dashboard: ['Company / Asset', 'Designation / Interaction', 'Date'],
};

// Primary/independent source URL field names as they appear in the uploaded sheet columns
// (varies slightly by module — catalyst_dashboard uses "Press Release URL" instead of "Credible Press Release URL").
export const MODULE_URL_FIELDS: Record<ModuleName, [string, string]> = {
  company_intelligence: ['Company Announcement URL', 'Credible Press Release URL'],
  pipeline_dashboard: ['Company Announcement URL', 'Credible Press Release URL'],
  clinical_intelligence: ['Company Announcement URL', 'Credible Press Release URL'],
  technology_intelligence: ['Company Announcement URL', 'Credible Press Release URL'],
  target_landscape: ['Company Announcement URL', 'Credible Press Release URL'],
  clinical_trial_dashboard: ['Company Announcement URL', 'Credible Press Release URL'],
  catalyst_dashboard: ['Company Announcement URL', 'Press Release URL'],
  bdl_intelligence: ['Company Announcement URL', 'Credible Press Release URL'],
  funding_investment: ['Company Announcement URL', 'Credible Press Release URL'],
  competitive_intelligence: ['Company Announcement URL', 'Credible Press Release URL'],
  regulatory_dashboard: ['Company Announcement URL', 'Credible Press Release URL'],
};

// Column used as the source_date for each module (null = no dedicated date column).
export const MODULE_DATE_FIELDS: Record<ModuleName, string | null> = {
  company_intelligence: null,
  pipeline_dashboard: null,
  clinical_intelligence: null,
  technology_intelligence: null,
  target_landscape: null,
  clinical_trial_dashboard: null,
  catalyst_dashboard: 'Date',
  bdl_intelligence: 'Announcement Date',
  funding_investment: 'Date',
  competitive_intelligence: null,
  regulatory_dashboard: 'Date',
};

export const MODULE_LABELS: Record<ModuleName, string> = {
  company_intelligence: 'Company Intelligence',
  pipeline_dashboard: 'Pipeline Dashboard',
  clinical_intelligence: 'Clinical Intelligence',
  technology_intelligence: 'Technology Intelligence',
  target_landscape: 'Target Landscape',
  clinical_trial_dashboard: 'Clinical Trial Dashboard',
  catalyst_dashboard: 'Catalyst Dashboard',
  bdl_intelligence: 'BD&L Intelligence',
  funding_investment: 'Funding & Investment',
  competitive_intelligence: 'Competitive Intelligence',
  regulatory_dashboard: 'Regulatory Dashboard',
};
