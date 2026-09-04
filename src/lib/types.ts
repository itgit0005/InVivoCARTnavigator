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
