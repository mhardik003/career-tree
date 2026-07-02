export type CareerNode = {
  node_title: string;
  is_terminal: boolean;
  description: string;
  // FIX 1: Allow string OR null
  avg_duration_years: string | null;
  difficulty_rating: number;
  search_keywords: string[];
  children: string[];
};

export type NodeMetadata = {
  exams_to_give: string[] | null;
  certifications: string[] | null;
  qualifications_needed: string[] | null;
  avg_cost_inr: string | null ;
  top_colleges_or_companies: string[] | null;
  tools_and_resources: string[] | null;
  duration_years: string | null;
  real_life_applications:string[] | null;
};

// Lean wire format for the global map: computed server-side, rendered client-side.
// Numeric string ids keep the payload small (full path keys average ~190 chars).
export type GraphNode = {
  id: string;
  position: { x: number; y: number };
  data: { label: string; isTerminal: boolean; href: string };
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  data: { depth: number };
};
