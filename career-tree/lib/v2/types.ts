export type V2NodeType =
  | "school_stage"
  | "stream"
  | "exam"
  | "degree"
  | "diploma"
  | "certification"
  | "training"
  | "job_role"
  | "government_service"
  | "entrepreneurship";

export type V2EdgeType = "progression" | "exam_gate" | "lateral";

export interface V2Provenance {
  model: string;
  prompt_version: string;
  generated_at: string;
  verified_at?: string;
  source_urls: string[];
}

export interface V2Node {
  id: string;
  type: V2NodeType;
  slug: string;
  title: string;
  aliases: string[];
  description: string;
  is_terminal: boolean;
  needs_review: boolean;
  facts?: Record<string, unknown>;
  prov: V2Provenance;
}

export interface V2Edge {
  id: string;
  from_id: string;
  to_id: string;
  edge_type: V2EdgeType;
  is_common_route: boolean;
  facts?: Record<string, unknown>;
  prov: V2Provenance;
}

export interface V2GraphSnapshot {
  schema_version: 1;
  root_id: string;
  source_digest: string;
  generated_at: string;
  nodes: V2Node[];
  edges: V2Edge[];
}

export interface V2DirectoryNode {
  id: string;
  type: V2NodeType;
  title: string;
  aliases: string[];
  description: string;
  href: string;
  incomingCount: number;
  outgoingCount: number;
}

export interface V2Route {
  nodeIds: string[];
  edges: V2Edge[];
  titles: string[];
  nicheEdges: number;
  lateralEdges: number;
}
