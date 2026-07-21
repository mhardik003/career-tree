import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { V2Edge, V2Route } from "@/lib/v2/types";
import { RouteMap } from "../RouteMap";

// No @xyflow/react mock here on purpose: this renders the real React Flow on
// the server to guard the SEO contract — the prerendered HTML must contain
// the node links even before hydration.

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

function route(nodeIds: string[], titles: string[]): V2Route {
  return {
    nodeIds,
    titles,
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

describe("RouteMap server rendering", () => {
  it("server-renders route node links for crawlers", () => {
    const html = renderToString(
      <RouteMap
        defaultRoutes={[viaBca, viaBtech]}
        parentRoutes={{ "degree:b-tech": viaBtech }}
        targetId="degree:mba"
        targetTitle="MBA"
        requestedParentId={null}
      />,
    );

    expect(html).toContain(
      'href="/explore/degree/bca?from=stream%3Acommerce"',
    );
    expect(html).toContain("Explore MBA via BCA, progression route");
    expect(html).toContain('data-route-node-id="degree:mba"');
  });
});
