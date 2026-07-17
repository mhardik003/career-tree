import { expect, it } from "vitest";
import snapshotJson from "../../../data/v2/graph.json";
import { V2Graph } from "../graph-core";
import { buildNodePageView } from "../routes";
import type { V2GraphSnapshot } from "../types";

it("builds simple selected-parent routes for the real MBA node", () => {
  const graph = new V2Graph(snapshotJson as unknown as V2GraphSnapshot);
  const view = buildNodePageView(graph, "degree:mba", "degree:bca");

  expect(view.selectedParentId).toBe("degree:bca");
  expect(
    view.routes.every(
      (route) => new Set(route.nodeIds).size === route.nodeIds.length,
    ),
  ).toBe(true);
});
