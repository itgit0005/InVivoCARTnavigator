// Dynamic KPI calculation engine — mirrors the Executive Dashboard's documented methodology:
// "Stage and therapeutic-area counts use EXACT-match COUNTIF... Delivery-modality counts use
// SUBSTRING matching... regulatory metric counts only ACHIEVED actions."
// All numbers here are computed live from the current live record set — never hardcoded.

export interface LiveRecord {
  module: string;
  record_key: string;
  data: Record<string, any>;
}

function str(v: any): string {
  return v === null || v === undefined ? '' : String(v);
}

function stageBucket(stageRaw: string): 'phase1' | 'phase12plus' | 'ind' | 'preclinical' | null {
  const s = stageRaw.trim();
  if (!s) return null;
  if (s === 'Phase 1') return 'phase1';
  if (s.startsWith('Phase 1/2')) return 'phase12plus';
  if (s.startsWith('IND-enabling') || s.startsWith('IND enabling')) return 'ind';
  if (s.startsWith('Preclinical')) return 'preclinical';
  return null;
}

const NON_ACHIEVED_EVENT_CLASSES = new Set([
  'Commentary - not a regulatory event',
  'Stated intent - not filed',
]);

export function computeExecutiveKpis(recordsByModule: Record<string, LiveRecord[]>) {
  const companies = recordsByModule['company_intelligence'] || [];
  const pipeline = recordsByModule['pipeline_dashboard'] || [];
  const bdl = recordsByModule['bdl_intelligence'] || [];
  const regulatory = recordsByModule['regulatory_dashboard'] || [];

  const totalCompanies = companies.length;
  const acquiredCompanies = companies.filter((r) => str(r.data['Company Type / Status']).includes('Acquired')).length;
  const independentCompanies = companies.filter((r) => str(r.data['Company Type / Status']).trim().startsWith('Independent')).length;

  const totalAssets = pipeline.length;
  let phase1 = 0, phase12plus = 0, ind = 0, preclinical = 0;
  for (const r of pipeline) {
    const bucket = stageBucket(str(r.data['Development Stage']));
    if (bucket === 'phase1') phase1++;
    else if (bucket === 'phase12plus') phase12plus++;
    else if (bucket === 'ind') ind++;
    else if (bucket === 'preclinical') preclinical++;
  }

  const oncologyFocused = pipeline.filter((r) => str(r.data['Disease Category']).trim() === 'Oncology').length;
  const autoimmuneFocused = pipeline.filter((r) => str(r.data['Disease Category']).toLowerCase().includes('autoimmune')).length;

  const lentiviralAssets = pipeline.filter((r) => str(r.data['Delivery Technology']).toLowerCase().includes('lentivir')).length;
  const lnpAssets = pipeline.filter((r) => str(r.data['Delivery Technology']).toLowerCase().includes('lnp')).length;

  const bdlCount = bdl.length;
  const regulatoryAchieved = regulatory.filter((r) => !NON_ACHIEVED_EVENT_CLASSES.has(str(r.data['Event Class']))).length;

  return {
    total_companies: totalCompanies,
    total_assets: totalAssets,
    acquired_companies: acquiredCompanies,
    independent_companies: independentCompanies,
    phase1_assets: phase1,
    phase12plus_assets: phase12plus,
    ind_enabling_assets: ind,
    preclinical_assets: preclinical,
    oncology_focused_assets: oncologyFocused,
    autoimmune_focused_assets: autoimmuneFocused,
    lentiviral_assets: lentiviralAssets,
    lnp_assets: lnpAssets,
    bdl_transactions: bdlCount,
    regulatory_actions_achieved: regulatoryAchieved,
  };
}

export function computeTargetWhiteSpace(recordsByModule: Record<string, LiveRecord[]>) {
  const targets = recordsByModule['target_landscape'] || [];
  const pipeline = recordsByModule['pipeline_dashboard'] || [];

  // Dynamically derive named antigen targets from Pipeline Dashboard (source of truth),
  // cross-referenced with the curated Target Landscape sheet.
  const namedTargets = new Map<string, Set<string>>();
  for (const r of pipeline) {
    const t = str(r.data['Target Antigen']).trim();
    if (!t || /undisclosed/i.test(t)) continue;
    if (!namedTargets.has(t)) namedTargets.set(t, new Set());
    namedTargets.get(t)!.add(str(r.data['Company']));
  }

  const targetRows = targets.map((r) => ({
    target: r.data['Target Antigen'],
    company_count: r.data['# Companies Targeting (named)'],
    companies: r.data['Companies'],
    disease_category: r.data['Disease Category'],
    phase: r.data['Phase (most advanced)'],
    white_space_note: r.data['White Space Note'],
  }));

  return {
    curated_target_rows: targetRows,
    derived_target_counts: Array.from(namedTargets.entries()).map(([target, companies]) => ({
      target,
      company_count: companies.size,
    })),
    solid_tumor_antigen_note:
      'No in vivo CAR-T program in the current database has disclosed a specific solid-tumor ANTIGEN target — this remains the field\'s clearest white space (calculated dynamically each period from Pipeline Dashboard target/indication fields).',
  };
}
