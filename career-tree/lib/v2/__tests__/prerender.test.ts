import { describe, expect, it } from "vitest";
import { V2Graph } from "../graph-core";
import { prerenderParams } from "../prerender";
import type { V2GraphSnapshot, V2NodeType } from "../types";

const prov = {
  model: "test",
  prompt_version: "v2.0",
  generated_at: "2026-07-17",
  source_urls: [],
};

function node(id: string) {
  const [type, slug] = id.split(":");
  return {
    id,
    type: type as V2NodeType,
    slug,
    title: slug.toUpperCase(),
    aliases: [],
    description: slug,
    is_terminal: false,
    needs_review: false,
    prov,
  };
}

function edge(fromId: string, toId: string) {
  return {
    id: `${fromId}->${toId}`,
    from_id: fromId,
    to_id: toId,
    edge_type: "progression" as const,
    is_common_route: true,
    prov,
  };
}

const snapshot: V2GraphSnapshot = {
  schema_version: 1,
  root_id: "school_stage:class-10",
  source_digest: "test",
  generated_at: "2026-07-17T00:00:00Z",
  // Insertion order is deliberately not the expected output order.
  nodes: [
    node("degree:mba"),
    node("school_stage:class-10"),
    node("degree:bca"),
    node("degree:bba"),
    node("exam:cat"),
  ],
  edges: [
    // exam:cat in-degree 3 — the hub.
    edge("degree:bca", "exam:cat"),
    edge("degree:bba", "exam:cat"),
    edge("degree:mba", "exam:cat"),
    // degree:bba and degree:bca tie at in-degree 1 → id ascending.
    edge("school_stage:class-10", "degree:bca"),
    edge("school_stage:class-10", "degree:bba"),
    edge("exam:cat", "degree:mba"),
  ],
};

describe("prerenderParams", () => {
  const graph = new V2Graph(snapshot);

  it("puts the root first, then in-degree descending with id-ascending tiebreak", () => {
    expect(prerenderParams(graph)).toEqual([
      { type: "school_stage", slug: "class-10" },
      { type: "exam", slug: "cat" },
      { type: "degree", slug: "bba" },
      { type: "degree", slug: "bca" },
      { type: "degree", slug: "mba" },
    ]);
  });

  it("always includes the root beyond the limit, capping the rest", () => {
    // The root has in-degree 0 — the lowest rank — yet must survive any limit.
    expect(prerenderParams(graph, 2)).toEqual([
      { type: "school_stage", slug: "class-10" },
      { type: "exam", slug: "cat" },
      { type: "degree", slug: "bba" },
    ]);
  });

  it("is stable across repeated calls", () => {
    expect(prerenderParams(graph)).toEqual(prerenderParams(graph));
  });
});
