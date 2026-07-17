import { V2Graph } from "./graph-core";
import type {
  V2Edge,
  V2NodePageView,
  V2ParentView,
  V2Route,
} from "./types";
import { nodeHref } from "./urls";

const EDGE_ORDER = { progression: 0, exam_gate: 1, lateral: 2 } as const;
const DEFAULT_LIMITS = { maxRoutes: 10, maxDepth: 20, maxStates: 10_000 };
const ROUTE_CACHE = new WeakMap<V2Graph, Map<string, V2Route[]>>();

type RouteState = { nodeIds: string[]; edges: V2Edge[] };

function routeScore(state: RouteState): [number, number, number, string] {
  return [
    state.edges.filter((edge) => !edge.is_common_route).length,
    state.edges.filter((edge) => edge.edge_type === "lateral").length,
    state.edges.length,
    state.nodeIds.join("\u0000"),
  ];
}

function compareTuple(
  a: ReturnType<typeof routeScore>,
  b: ReturnType<typeof routeScore>,
): number {
  for (let index = 0; index < 3; index += 1) {
    const difference = (a[index] as number) - (b[index] as number);
    if (difference) return difference;
  }
  return (a[3] as string).localeCompare(b[3] as string);
}

class MinHeap<T> {
  private readonly items: T[] = [];

  constructor(private readonly compare: (a: T, b: T) => number) {}

  get size(): number {
    return this.items.length;
  }

  push(item: T): void {
    this.items.push(item);
    let index = this.items.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (this.compare(this.items[parent], item) <= 0) break;
      this.items[index] = this.items[parent];
      index = parent;
    }
    this.items[index] = item;
  }

  pop(): T | undefined {
    const root = this.items[0];
    const last = this.items.pop();
    if (!this.items.length || last === undefined) return root;

    let index = 0;
    while (true) {
      const left = index * 2 + 1;
      const right = left + 1;
      if (left >= this.items.length) break;
      const child =
        right < this.items.length &&
        this.compare(this.items[right], this.items[left]) < 0
          ? right
          : left;
      if (this.compare(last, this.items[child]) <= 0) break;
      this.items[index] = this.items[child];
      index = child;
    }
    this.items[index] = last;
    return root;
  }
}

function compareOptionalRoutes(a?: V2Route, b?: V2Route): number {
  if (a && !b) return -1;
  if (!a && b) return 1;
  if (!a || !b) return 0;
  return compareTuple(
    routeScore({ nodeIds: a.nodeIds, edges: a.edges }),
    routeScore({ nodeIds: b.nodeIds, edges: b.edges }),
  );
}

function searchRoutes(
  graph: V2Graph,
  targetId: string,
  maxRoutes: number,
): V2Route[] {
  let cache = ROUTE_CACHE.get(graph);
  if (!cache) {
    cache = new Map();
    ROUTE_CACHE.set(graph, cache);
  }
  const cacheKey = `${targetId}\u0000${maxRoutes}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const queue = new MinHeap<RouteState>((a, b) =>
    compareTuple(routeScore(a), routeScore(b)),
  );
  queue.push({ nodeIds: [graph.rootId], edges: [] });
  const results: V2Route[] = [];
  let expanded = 0;
  while (
    queue.size &&
    results.length < maxRoutes &&
    expanded < DEFAULT_LIMITS.maxStates
  ) {
    const state = queue.pop()!;
    const current = state.nodeIds.at(-1)!;
    if (current === targetId) {
      results.push({
        nodeIds: state.nodeIds,
        edges: state.edges,
        titles: state.nodeIds.map((id) => graph.getNode(id)?.title ?? id),
        nicheEdges: state.edges.filter((edge) => !edge.is_common_route).length,
        lateralEdges: state.edges.filter(
          (edge) => edge.edge_type === "lateral",
        ).length,
      });
      continue;
    }
    if (state.edges.length >= DEFAULT_LIMITS.maxDepth) continue;
    expanded += 1;
    for (const edge of graph
      .outgoing(current)
      .sort((a, b) => a.id.localeCompare(b.id))) {
      if (state.nodeIds.includes(edge.to_id)) continue;
      queue.push({
        nodeIds: [...state.nodeIds, edge.to_id],
        edges: [...state.edges, edge],
      });
    }
  }
  cache.set(cacheKey, results);
  return results;
}

export function findCompleteRoutes(
  graph: V2Graph,
  targetId: string,
  selectedParentId?: string,
): V2Route[] {
  const global = searchRoutes(graph, targetId, DEFAULT_LIMITS.maxRoutes);
  if (!selectedParentId) return global;
  const selected = global.find(
    (route) => route.nodeIds.at(-2) === selectedParentId,
  );
  if (selected) return [selected, ...global.filter((route) => route !== selected)];
  const edge = graph
    .incoming(targetId)
    .find((item) => item.from_id === selectedParentId);
  if (!edge) return global;
  const parentRoute = searchRoutes(
    graph,
    selectedParentId,
    DEFAULT_LIMITS.maxRoutes,
  ).find((route) => !route.nodeIds.includes(targetId));
  if (!parentRoute) return global;
  const combined: V2Route = {
    nodeIds: [...parentRoute.nodeIds, targetId],
    edges: [...parentRoute.edges, edge],
    titles: [
      ...parentRoute.titles,
      graph.getNode(targetId)?.title ?? targetId,
    ],
    nicheEdges: parentRoute.nicheEdges + Number(!edge.is_common_route),
    lateralEdges:
      parentRoute.lateralEdges + Number(edge.edge_type === "lateral"),
  };
  return [combined, ...global]
    .filter(
      (route, index, all) =>
        all.findIndex(
          (other) =>
            other.nodeIds.join("\u0000") === route.nodeIds.join("\u0000"),
        ) === index,
    )
    .slice(0, DEFAULT_LIMITS.maxRoutes);
}

export function rankParents(
  graph: V2Graph,
  nodeId: string,
  requestedParentId?: string,
): { parents: V2ParentView[]; selectedId: string | null } {
  const ranked = graph
    .incoming(nodeId)
    .map((edge) => ({
      edge,
      node: graph.getNode(edge.from_id)!,
      bestRootRoute: searchRoutes(graph, edge.from_id, 1)[0],
    }))
    .sort(
      (a, b) =>
        Number(b.edge.is_common_route) - Number(a.edge.is_common_route) ||
        EDGE_ORDER[a.edge.edge_type] - EDGE_ORDER[b.edge.edge_type] ||
        compareOptionalRoutes(a.bestRootRoute, b.bestRootRoute) ||
        a.node.title.localeCompare(b.node.title) ||
        a.node.id.localeCompare(b.node.id),
    );
  const selectedId = ranked.some(
    (item) => item.node.id === requestedParentId,
  )
    ? requestedParentId!
    : (ranked[0]?.node.id ?? null);
  return {
    selectedId,
    parents: ranked.map(({ edge, node }) => ({
      node,
      edge,
      contextHref: nodeHref(nodeId, node.id),
    })),
  };
}

export function buildNodePageView(
  graph: V2Graph,
  nodeId: string,
  requestedParentId?: string,
): V2NodePageView {
  const node = graph.getNode(nodeId);
  if (!node) throw new Error(`Unknown v2 node: ${nodeId}`);
  const { parents, selectedId } = rankParents(
    graph,
    nodeId,
    requestedParentId,
  );
  const routes = findCompleteRoutes(graph, nodeId, selectedId ?? undefined);
  const active = routes[0];
  const selectedIndex = active?.nodeIds.lastIndexOf(selectedId ?? "") ?? -1;
  const selectedParentFrom =
    selectedIndex > 0 ? active.nodeIds[selectedIndex - 1] : undefined;
  return {
    node,
    parents,
    selectedParentId: selectedId,
    routes,
    backHref: selectedId
      ? nodeHref(selectedId, selectedParentFrom)
      : "/v2",
    children: graph
      .outgoing(nodeId)
      .map((edge) => ({
        edge,
        node: graph.getNode(edge.to_id)!,
        href: nodeHref(edge.to_id, nodeId),
      }))
      .sort(
        (a, b) =>
          a.node.title.localeCompare(b.node.title) ||
          a.node.id.localeCompare(b.node.id),
      ),
  };
}
