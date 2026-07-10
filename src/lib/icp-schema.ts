// Lean, Exa-focused ICP. Produced by generate-icp and edited on the ICP page.
// The star field is `exa_query` — the natural-language query used for discovery.

export const TARGET_ENTITY_TYPES = ["company", "person"] as const;
export type TargetEntityType = (typeof TARGET_ENTITY_TYPES)[number];

export const SENIORITY_LEVELS = [
  "founder",
  "c_level",
  "vp",
  "head",
  "director",
  "manager",
  "individual_contributor",
] as const;

export interface Icp {
  icp_name: string;
  one_line_definition: string;
  target_entity_type: TargetEntityType;
  // The natural-language query sent to Exa for discovery.
  exa_query: string;
  industries: string[];
  geographies: string[];
  company_size: { min_employees: number | null; max_employees: number | null };
  reference_companies: string[];
  must_have_criteria: string[];
  nice_to_have_criteria: string[];
  exclusions: string[];
  search_keywords: string[];
  // Who to target inside matched companies.
  target_titles: string[];
  seniority_levels: string[];
}

export function emptyIcp(): Icp {
  return {
    icp_name: "",
    one_line_definition: "",
    target_entity_type: "company",
    exa_query: "",
    industries: [],
    geographies: [],
    company_size: { min_employees: null, max_employees: null },
    reference_companies: [],
    must_have_criteria: [],
    nice_to_have_criteria: [],
    exclusions: [],
    search_keywords: [],
    target_titles: [],
    seniority_levels: [],
  };
}
