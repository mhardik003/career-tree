import { describe, expect, it } from "vitest";
import { V2Graph } from "../graph-core";
import { buildGlobalMap, filterGlobalMap } from "../global-map";
import type { V2GraphSnapshot, V2Node, V2NodeType } from "../types";

const prov = { model: "fixture", prompt_version: "v2", generated_at: "2026-07-19", source_urls: [] };

function node(id: string, type: V2NodeType, title: string, aliases: string[] = []): V2Node {
  return {
    id,
    type,
    slug: id.split(":")[1],
    title,
    aliases,
    description: `${title} description`,
    is_terminal: false,
    needs_review: false,
    prov,
  };
}

const snapshot: V2GraphSnapshot = {
  schema_version: 1,
  root_id: "school_stage:class-10",
  source_digest: "fixture",
  generated_at: "2026-07-19T00:00:00Z",
  nodes: [
    node("school_stage:class-10", "school_stage", "Class 10"),
    node("stream:commerce", "stream", "Commerce"),
    node("degree:bca", "degree", "BCA", ["Bachelor of Computer Applications"]),
    node("degree:mba", "degree", "MBA", ["Master of Business Administration"]),
  ],
  edges: [
    { id: "root->commerce", from_id: "school_stage:class-10", to_id: "stream:commerce", edge_type: "progression", is_common_route: true, prov },
    { id: "root->bca", from_id: "school_stage:class-10", to_id: "degree:bca", edge_type: "progression", is_common_route: true, prov },
    { id: "commerce->mba", from_id: "stream:commerce", to_id: "degree:mba", edge_type: "progression", is_common_route: true, prov },
    { id: "bca->mba", from_id: "degree:bca", to_id: "degree:mba", edge_type: "progression", is_common_route: true, prov },
    { id: "mba->bca", from_id: "degree:mba", to_id: "degree:bca", edge_type: "lateral", is_common_route: false, prov },
  ],
};

describe("global V2 map", () => {
  const graph = new V2Graph(snapshot);

  it("deduplicates canonical nodes while retaining reconverging edges", () => {
    const model = buildGlobalMap(graph);

    expect(model.nodes.filter((item) => item.id === "degree:mba")).toHaveLength(1);
    expect(model.edges.filter((edge) => edge.target === "degree:mba")).toHaveLength(2);
    expect(model.nodes.every((item) => item.href === `/careers/${item.type}/${item.id.split(":")[1]}`)).toBe(true);
    expect(model.nodes.find((item) => item.id === graph.rootId)?.rootDistance).toBe(0);
  });

  it("filters aliases and types without leaving dangling edges", () => {
    const model = buildGlobalMap(graph);
    const alias = filterGlobalMap(model, "computer applications", "all");
    expect(alias.nodes.map((item) => item.id)).toEqual(["degree:bca"]);
    expect(alias.edges).toEqual([]);

    const degrees = filterGlobalMap(model, "", "degree");
    expect(degrees.nodes.map((item) => item.id).sort()).toEqual(["degree:bca", "degree:mba"]);
    expect(degrees.edges.every((edge) =>
      degrees.nodes.some((node) => node.id === edge.source)
      && degrees.nodes.some((node) => node.id === edge.target),
    )).toBe(true);
  });

  it("produces deterministic positions even with a lateral cycle", () => {
    expect(buildGlobalMap(graph)).toEqual(buildGlobalMap(graph));
  });
});
