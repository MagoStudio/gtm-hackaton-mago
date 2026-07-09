// Shared ICP schema: the structured object produced by generate-icp and edited
// on the ICP edit page. Keep this in sync with the edge function's system prompt.

export const SILLAGE_SIGNAL_TYPES = [
  "hiring_signal",
  "funding_signal",
  "product_launch_signal",
  "partnership_signal",
  "expansion_signal",
  "competitor_engagement_signal",
  "content_engagement_signal",
  "community_engagement_signal",
  "job_change_signal",
  "technology_adoption_signal",
  "pain_keyword_signal",
  "event_participation_signal",
  "executive_post_signal",
  "website_change_signal",
  "open_source_activity_signal",
  "marketplace_activity_signal",
] as const;
export type SillageSignalType = (typeof SILLAGE_SIGNAL_TYPES)[number];

export const ENRICHMENT_FORMATS = ["text", "number", "date", "email", "phone", "url", "options"] as const;
export type EnrichmentFormat = (typeof ENRICHMENT_FORMATS)[number];

export const REJECTION_REASONS = [
  "wrong_industry",
  "wrong_company_size",
  "wrong_geography",
  "wrong_persona",
  "too_small",
  "too_enterprise",
  "no_relevant_signal",
  "bad_timing",
  "not_enough_evidence",
  "other",
] as const;

export const SENIORITY_LEVELS = ["founder", "c_level", "vp", "head", "director", "manager", "individual_contributor"] as const;
export const TARGET_ENTITY_TYPES = ["company", "person", "both"] as const;
export const CONFIDENCE_LEVELS = ["low", "medium", "high"] as const;
export const MATURITY_LEVELS = ["early", "scaling", "mature", "unknown"] as const;
export const EXA_ENTITY_TYPES = ["company", "person", "custom"] as const;
export const EXA_SEARCH_MODES = ["websets", "search"] as const;
export const EXA_FRESHNESS = ["any_time", "last_30_days", "last_90_days", "last_year"] as const;
export const SIGNAL_PRIORITIES = ["low", "medium", "high"] as const;

export interface ExaEnrichment {
  name: string;
  format: EnrichmentFormat;
  prompt: string;
  options: string[] | null;
}

export interface SillageSelectedSignal {
  signal_type: SillageSignalType;
  enabled: boolean;
  priority: (typeof SIGNAL_PRIORITIES)[number];
  keywords: string[];
  example_matches: string[];
  reason_for_relevance: string;
}

export interface Icp {
  icp_summary: {
    icp_name: string;
    one_line_definition: string;
    target_entity_type: (typeof TARGET_ENTITY_TYPES)[number];
    primary_goal: string;
    offer_summary: string;
    confidence_level: (typeof CONFIDENCE_LEVELS)[number];
    assumptions_to_validate: string[];
  };
  target_account_criteria: {
    company_types: string[];
    industries: string[];
    business_models: string[];
    company_size: { min_employees: number | null; max_employees: number | null };
    geographies: string[];
    reference_companies: string[];
    similar_to_reference_companies: boolean;
    funding_stage: string[];
    technology_keywords: string[];
    must_have_criteria: string[];
    nice_to_have_criteria: string[];
  };
  operational_criteria: {
    what_they_do: string[];
    workflows: string[];
    volume_or_scale_signals: string[];
    use_cases: string[];
    current_tools_or_alternatives: string[];
    maturity_level: (typeof MATURITY_LEVELS)[number];
  };
  pain_hypotheses: {
    known_pains: string[];
    pain_hypotheses: string[];
    pain_confidence: (typeof CONFIDENCE_LEVELS)[number];
    pain_validation_questions: string[];
    trigger_events: string[];
  };
  buyer_personas: {
    target_titles: string[];
    target_departments: string[];
    seniority_levels: string[];
    persona_priority: string[];
    excluded_titles: string[];
  };
  exclusions: {
    excluded_company_types: string[];
    excluded_industries: string[];
    excluded_keywords: string[];
    excluded_titles: string[];
    bad_fit_examples: string[];
    disqualification_rules: string[];
  };
  search_keywords: {
    must_include_keywords: string[];
    semantic_keywords: string[];
    related_terms: string[];
    competitor_or_alternative_keywords: string[];
    exclude_keywords: string[];
  };
  exa_config: {
    exa_entity_type: (typeof EXA_ENTITY_TYPES)[number];
    exa_search_mode: (typeof EXA_SEARCH_MODES)[number];
    exa_criteria: string[];
    exa_enrichments: ExaEnrichment[];
    exa_result_count: number;
    exa_freshness: (typeof EXA_FRESHNESS)[number];
    exa_output_fields: string[];
  };
  sillage_signal_config: {
    selected_signals: SillageSelectedSignal[];
  };
  learning_loop: {
    accepted_leads: unknown[];
    rejected_leads: unknown[];
    rejection_reasons: string[];
    positive_patterns_to_learn: string[];
    negative_patterns_to_avoid: string[];
    updated_criteria_suggestions: string[];
    next_questions_to_improve_icp: string[];
  };
}

export function emptyIcp(): Icp {
  return {
    icp_summary: {
      icp_name: "",
      one_line_definition: "",
      target_entity_type: "company",
      primary_goal: "",
      offer_summary: "",
      confidence_level: "medium",
      assumptions_to_validate: [],
    },
    target_account_criteria: {
      company_types: [],
      industries: [],
      business_models: [],
      company_size: { min_employees: null, max_employees: null },
      geographies: [],
      reference_companies: [],
      similar_to_reference_companies: true,
      funding_stage: [],
      technology_keywords: [],
      must_have_criteria: [],
      nice_to_have_criteria: [],
    },
    operational_criteria: {
      what_they_do: [],
      workflows: [],
      volume_or_scale_signals: [],
      use_cases: [],
      current_tools_or_alternatives: [],
      maturity_level: "unknown",
    },
    pain_hypotheses: {
      known_pains: [],
      pain_hypotheses: [],
      pain_confidence: "low",
      pain_validation_questions: [],
      trigger_events: [],
    },
    buyer_personas: {
      target_titles: [],
      target_departments: [],
      seniority_levels: [],
      persona_priority: [],
      excluded_titles: [],
    },
    exclusions: {
      excluded_company_types: [],
      excluded_industries: [],
      excluded_keywords: [],
      excluded_titles: [],
      bad_fit_examples: [],
      disqualification_rules: [],
    },
    search_keywords: {
      must_include_keywords: [],
      semantic_keywords: [],
      related_terms: [],
      competitor_or_alternative_keywords: [],
      exclude_keywords: [],
    },
    exa_config: {
      exa_entity_type: "company",
      exa_search_mode: "websets",
      exa_criteria: [],
      exa_enrichments: [],
      exa_result_count: 50,
      exa_freshness: "any_time",
      exa_output_fields: [],
    },
    sillage_signal_config: { selected_signals: [] },
    learning_loop: {
      accepted_leads: [],
      rejected_leads: [],
      rejection_reasons: [],
      positive_patterns_to_learn: [],
      negative_patterns_to_avoid: [],
      updated_criteria_suggestions: [],
      next_questions_to_improve_icp: [],
    },
  };
}
