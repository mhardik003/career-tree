import { describe, expect, it } from "vitest";
import type { V2Edge, V2Route } from "../types";
import { buildRouteMap, selectRouteSet } from "../route-map";

const prov = {
  model: "test",
  prompt_version: "v2.0",
  generated_at: "2026-07-17",
  source_urls: [],
};

function edge(fromId: string, toId: string): V2Edge {
  return {
    id: `${fromId}->${toId}`,
    from_id: fromId,
    to_id: toId,
    edge_type: "progression",
    is_common_route: true,
    prov,
  };
}

function route(nodeIds: string[], titles?: string[]): V2Route {
  return {
    nodeIds,
    titles: titles ?? nodeIds.map((id) => id.split(":")[1]),
    edges: nodeIds.slice(1).map((toId, index) => edge(nodeIds[index], toId)),
    nicheEdges: 0,
    lateralEdges: 0,
  };
}

const viaBca = route(
  [
    "school_stage:class-10",
    "stream:commerce",
    "degree:bca",
    "degree:mba",
  ],
  ["Class 10", "Commerce", "BCA", "MBA"],
);

const viaBtech = route(
  [
    "school_stage:class-10",
    "stream:science-pcm",
    "degree:b-tech",
    "degree:mba",
  ],
  ["Class 10", "Science PCM", "B.Tech", "MBA"],
);

describe("route map model", () => {
  it("merges shared nodes into deterministic top-to-bottom layers", () => {
    const model = buildRouteMap([viaBca, viaBtech], "degree:mba");

    expect(model.nodes).toHaveLength(6);
    expect(model.nodes.filter((node) => node.id === "degree:mba")).toHaveLength(
      1,
    );
    expect(model.edges).toHaveLength(6);
    expect(
      model.nodes.find((node) => node.id === "school_stage:class-10")
        ?.layer,
    ).toBe(0);
    expect(model.nodes.find((node) => node.id === "degree:mba")?.isTarget).toBe(
      true,
    );
    expect(model.nodes.find((node) => node.id === "degree:bca")?.href).toBe(
      "/v2/explore/degree/bca?from=stream%3Acommerce",
    );
    expect(model.edges.filter((item) => item.isSelected)).toHaveLength(3);
    expect(model.width).toBeGreaterThan(0);
    expect(model.height).toBeGreaterThan(0);
    expect(model.levels).toBe(4);
  });

  it("puts a valid requested parent route first and falls back safely", () => {
    const defaultRoutes = [viaBca];
    const parentRoutes = { "degree:b-tech": viaBtech };

    expect(selectRouteSet(defaultRoutes, parentRoutes, "degree:b-tech")).toEqual(
      [viaBtech, viaBca],
    );
    expect(selectRouteSet(defaultRoutes, parentRoutes, "degree:missing")).toBe(
      defaultRoutes,
    );
    expect(selectRouteSet(defaultRoutes, parentRoutes, "__proto__")).toBe(
      defaultRoutes,
    );
    expect(selectRouteSet(defaultRoutes, parentRoutes, "constructor")).toBe(
      defaultRoutes,
    );
    expect(selectRouteSet(defaultRoutes, { "degree:bca": viaBca }, "degree:bca"))
      .toEqual([viaBca]);
  });

  it("keeps the selected path and removes a cycle-forming alternative edge", () => {
    const selected = route([
      "school_stage:class-10",
      "training:b",
      "training:a",
      "degree:mba",
    ]);
    const conflicting = route([
      "school_stage:class-10",
      "training:a",
      "training:b",
      "degree:mba",
    ]);

    const model = buildRouteMap([selected, conflicting], "degree:mba");

    expect(model.edges.some((item) => item.id === "training:b->training:a")).toBe(
      true,
    );
    expect(model.edges.some((item) => item.id === "training:a->training:b")).toBe(
      false,
    );
    expect(model.edges.filter((item) => item.isSelected)).toHaveLength(3);
  });

  it("returns an empty stable model when no complete routes exist", () => {
    expect(buildRouteMap([], "degree:mba")).toEqual({
      nodes: [],
      edges: [],
      width: 0,
      height: 0,
      levels: 0,
      targetId: "degree:mba",
    });
  });
});
