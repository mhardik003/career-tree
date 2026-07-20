import type { V2Graph } from "./graph-core";

// How many nodes each node route prerenders at build time. The long tail
// renders on first request via ISR (dynamicParams=true + revalidate) — this
// keeps the build's page-file count bounded as the graph grows.
export const PRERENDER_LIMIT = 200;

/**
 * The high-value prerender set for /explore and /careers: the top `limit`
 * nodes by in-degree (most-referenced hubs get static HTML; everything else
 * is rendered on demand and cached). Deterministic so builds are
 * reproducible: in-degree descending, then id ascending as the tiebreaker
 * (plain code-unit compare — ids are lowercase ASCII, no locale dependence).
 */
export function prerenderParams(
  graph: V2Graph,
  limit: number = PRERENDER_LIMIT,
): { type: string; slug: string }[] {
  return graph.nodes
    .map((node) => ({ node, inDegree: graph.incoming(node.id).length }))
    .sort(
      (a, b) =>
        b.inDegree - a.inDegree || (a.node.id < b.node.id ? -1 : 1),
    )
    .slice(0, limit)
    .map(({ node }) => ({ type: node.type, slug: node.slug }));
}
