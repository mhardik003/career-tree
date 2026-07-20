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

export interface V2FactItem {
  label: string;
  value: string;
  source_urls: string[];
}

export interface V2ArticleSection {
  key: string;
  heading: string;
  paragraphs: string[];
  bullets: string[];
  source_urls: string[];
}

export interface V2NodeFacts {
  schema_version: 1;
  last_reviewed: string;
  quick_facts: V2FactItem[];
  sections: V2ArticleSection[];
  useful_links: { label: string; url: string; kind: string }[];
  prov: { model: string; prompt_version: string; generated_at: string };
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
  facts?: V2NodeFacts;
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

/**
 * A canonical node as it appears in graph.core.json: every field except the
 * heavyweight `facts` blob (96% of graph.json's bytes), which lives in
 * data/v2/facts/{type}--{slug}.json and is loaded on demand via
 * lib/v2/facts.ts. A full `V2Node` is assignable wherever a core node is
 * expected because `facts` is optional.
 */
export type V2NodeCore = Omit<V2Node, "facts">;

export interface V2GraphSnapshot {
  schema_version: 1;
  root_id: string;
  source_digest: string;
  generated_at: string;
  nodes: V2Node[];
  edges: V2Edge[];
}

/** graph.core.json — same shape as `V2GraphSnapshot` with fact-less nodes. */
export interface V2GraphCoreSnapshot {
  schema_version: 1;
  root_id: string;
  source_digest: string;
  generated_at: string;
  nodes: V2NodeCore[];
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

/**
 * Slim edge payload for client-bound views and routes. Never carries `prov`
 * or `facts` — no client component renders them.
 */
export interface V2EdgeSummary {
  id: string;
  from_id: string;
  to_id: string;
  edge_type: V2EdgeType;
  is_common_route: boolean;
}

export interface V2Route {
  nodeIds: string[];
  edges: V2EdgeSummary[];
  titles: string[];
  nicheEdges: number;
  lateralEdges: number;
}

/**
 * Slim node payload for non-focused nodes (parents/children) crossing the
 * server->client boundary. Never carries `facts`. Add a field ONLY if a
 * client component provably renders it.
 */
export interface V2NodeSummary {
  id: string;
  type: V2NodeType;
  title: string;
  slug: string;
}

export interface V2ParentView {
  node: V2NodeSummary;
  edge: V2EdgeSummary;
  contextHref: string;
}

export interface V2ChildView {
  node: V2NodeSummary;
  edge: V2EdgeSummary;
  href: string;
}

export interface V2NodePageView {
  node: V2Node;
  parents: V2ParentView[];
  selectedParentId: string | null;
  children: V2ChildView[];
  routes: V2Route[];
  backHref: string;
}

/**
 * The only fields of a node page view that vary with the selected parent.
 * Shipped per parent instead of a full `V2NodePageView`; the client overlays
 * one of these on the canonical view.
 */
export interface V2ParentContext {
  routes: V2Route[];
  selectedParentId: string;
  backHref: string;
}
