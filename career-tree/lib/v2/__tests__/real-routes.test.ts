import { expect, it } from "vitest";
// Decision: these tests load graph.core.json — the exact snapshot the app's
// v2Graph singleton is built from — not the full graph.json. Route building
// never reads `facts`, and parsing ~1 MB instead of ~10.6 MB keeps the suite
// fast. The full graph.json and the per-node facts files are covered by the
// pipeline export tests plus `python pipeline/export_frontend.py --check`.
import snapshotJson from "../../../data/v2/graph.core.json";
import { V2Graph } from "../graph-core";
import { findRouteThroughParent } from "../route-map";
import { buildNodePageView } from "../routes";
import type { V2GraphCoreSnapshot } from "../types";

it("builds simple selected-parent routes for the real MBA node", () => {
  const graph = new V2Graph(snapshotJson as unknown as V2GraphCoreSnapshot);
  const view = buildNodePageView(graph, "degree:mba", "degree:bca");

  expect(view.selectedParentId).toBe("degree:bca");
  expect(
    view.routes.every(
      (route) => new Set(route.nodeIds).size === route.nodeIds.length,
    ),
  ).toBe(true);
});

it("does not label a fallback route as an unreachable selected parent", () => {
  const graph = new V2Graph(snapshotJson as unknown as V2GraphCoreSnapshot);
  const view = buildNodePageView(
    graph,
    "exam:nift-entrance",
    "degree:b-f-tech-bachelor-of-fashion-technology",
  );

  expect(view.selectedParentId).toBe(
    "degree:b-f-tech-bachelor-of-fashion-technology",
  );
  expect(
    findRouteThroughParent(
      view.routes,
      "degree:b-f-tech-bachelor-of-fashion-technology",
    ),
  ).toBeUndefined();
});
