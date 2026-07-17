import { describe, expect, it } from "vitest";
import { V2Graph } from "../graph-core";
import { buildNodePageView, findCompleteRoutes, rankParents } from "../routes";
import type {
  V2Edge,
  V2GraphSnapshot,
  V2Node,
  V2NodeType,
} from "../types";

const prov = {
  model: "test",
  prompt_version: "v2.0",
  generated_at: "2026-07-17",
  source_urls: [],
};

function node(id: string, type: V2NodeType, title: string): V2Node {
  return {
    id,
    type,
    slug: id.split(":")[1],
    title,
    aliases: [],
    description: title,
    is_terminal: false,
    needs_review: false,
    prov,
  };
}

function edge(
  from: string,
  to: string,
  edgeType: V2Edge["edge_type"] = "progression",
  common = true,
): V2Edge {
  return {
    id: `${from}->${to}`,
    from_id: from,
    to_id: to,
    edge_type: edgeType,
    is_common_route: common,
    prov,
  };
}

const snapshot: V2GraphSnapshot = {
  schema_version: 1,
  root_id: "school_stage:class-10",
  source_digest: "test",
  generated_at: "2026-07-17T00:00:00Z",
  nodes: [
    node("school_stage:class-10", "school_stage", "Class 10"),
    node("stream:commerce", "stream", "Commerce"),
    node("stream:science-pcm", "stream", "Science PCM"),
    node("degree:bca", "degree", "BCA"),
    node("job_role:developer", "job_role", "Developer"),
    node("job_role:cycle-only", "job_role", "Cycle-only role"),
    node("degree:b-arch", "degree", "B.Arch"),
    node("degree:mba", "degree", "MBA"),
  ],
  edges: [
    edge("school_stage:class-10", "stream:commerce"),
    edge("stream:commerce", "degree:bca"),
    edge("degree:bca", "degree:mba"),
    edge("school_stage:class-10", "stream:science-pcm"),
    edge("stream:science-pcm", "job_role:developer"),
    edge("job_role:developer", "degree:mba", "lateral"),
    edge("school_stage:class-10", "degree:b-arch", "progression", false),
    edge("degree:b-arch", "degree:mba", "lateral", false),
    edge("degree:mba", "job_role:developer", "lateral"),
    edge("degree:mba", "job_role:cycle-only", "lateral"),
    edge("job_role:cycle-only", "degree:mba", "lateral"),
  ],
};

describe("v2 route discovery", () => {
  const graph = new V2Graph(snapshot);

  it("ranks common non-lateral paths before lateral and niche paths", () => {
    const routes = findCompleteRoutes(graph, "degree:mba");
    expect(routes[0].nodeIds).toEqual([
      "school_stage:class-10",
      "stream:commerce",
      "degree:bca",
      "degree:mba",
    ]);
    expect(routes[1].nodeIds.at(-2)).toBe("job_role:developer");
    expect(routes[2].nodeIds.at(-2)).toBe("degree:b-arch");
  });

  it("moves the selected-parent route to the first position", () => {
    expect(
      findCompleteRoutes(graph, "degree:mba", "job_role:developer")[0].nodeIds.at(
        -2,
      ),
    ).toBe("job_role:developer");
  });

  it("never repeats a node when lateral edges create a cycle", () => {
    expect(
      findCompleteRoutes(graph, "degree:mba").every(
        (route) => new Set(route.nodeIds).size === route.nodeIds.length,
      ),
    ).toBe(true);
  });

  it("does not manufacture a repeated route for a cycle-only parent", () => {
    expect(
      findCompleteRoutes(graph, "degree:mba", "job_role:cycle-only").every(
        (route) => new Set(route.nodeIds).size === route.nodeIds.length,
      ),
    ).toBe(true);
  });

  it("honors a valid requested parent and falls back for an invalid parent", () => {
    expect(rankParents(graph, "degree:mba", "degree:bca").selectedId).toBe(
      "degree:bca",
    );
    expect(rankParents(graph, "degree:mba", "degree:missing").selectedId).toBe(
      "degree:bca",
    );
  });

  it("keeps children global when parent context changes", () => {
    const viaBca = buildNodePageView(graph, "degree:mba", "degree:bca");
    const viaDeveloper = buildNodePageView(
      graph,
      "degree:mba",
      "job_role:developer",
    );
    expect(viaBca.children.map((child) => child.node.id)).toEqual(
      viaDeveloper.children.map((child) => child.node.id),
    );
  });
});
