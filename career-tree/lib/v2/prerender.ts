import type { V2Graph } from "./graph-core";

// How many nodes each node route prerenders at build time. The long tail
// renders on first request via ISR (dynamicParams=true + revalidate) — this
// keeps the build's page-file count bounded as the graph grows.
const PRERENDER_LIMIT = 200;

/**
 * The high-value prerender set for /explore and /careers: the graph root
 * (always — it has in-degree 0 but is the homepage entry point, so its pages
 * must never pay a first-request render) plus the top `limit` other nodes by
 * in-degree (most-referenced hubs get static HTML; everything else is
 * rendered on demand and cached). Deterministic so builds are reproducible:
 * root first, then in-degree descending with id ascending as the tiebreaker
 * (plain code-unit compare — ids are lowercase ASCII, no locale dependence).
 */
export function prerenderParams(
  graph: V2Graph,
  limit: number = PRERENDER_LIMIT,
): { type: string; slug: string }[] {
  const root = graph.getNode(graph.rootId);
  const ranked = graph.nodes
    .filter((node) => node.id !== graph.rootId)
    .map((node) => ({ node, inDegree: graph.incoming(node.id).length }))
    .sort(
      (a, b) =>
        b.inDegree - a.inDegree || (a.node.id < b.node.id ? -1 : 1),
    )
    .slice(0, limit)
    .map(({ node }) => ({ type: node.type, slug: node.slug }));
  return root ? [{ type: root.type, slug: root.slug }, ...ranked] : ranked;
}
