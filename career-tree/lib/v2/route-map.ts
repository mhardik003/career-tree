import dagre from "dagre";
import type { V2Edge, V2EdgeSummary, V2Route } from "./types";
import { exploreHref } from "./urls";

export interface RouteMapNode {
  id: string;
  title: string;
  href: string;
  parentId?: string;
  incomingEdgeType?: V2Edge["edge_type"];
  layer: number;
  x: number;
  y: number;
  width: number;
  height: number;
  isSelected: boolean;
  isTarget: boolean;
}

export interface RouteMapEdge {
  id: string;
  fromId: string;
  toId: string;
  isSelected: boolean;
  edgeType: V2Edge["edge_type"];
  isCommonRoute: boolean;
}

export interface RouteMapModel {
  nodes: RouteMapNode[];
  edges: RouteMapEdge[];
  width: number;
  height: number;
  levels: number;
  targetId: string;
}

export type ParentRouteMap = Record<string, V2Route>;

interface AcceptedEdge {
  id: string;
  fromId: string;
  toId: string;
  edge: V2EdgeSummary;
  isSelected: boolean;
}

const NODE_WIDTH = 152;
const NODE_HEIGHT = 52;
const MAX_ROUTES = 10;

function routeKey(route: V2Route): string {
  return route.nodeIds.join("\u0000");
}

export function findRouteThroughParent(
  routes: V2Route[],
  parentId: string,
): V2Route | undefined {
  return routes.find((route) => route.nodeIds.at(-2) === parentId);
}

export function selectRouteSet(
  defaultRoutes: V2Route[],
  parentRoutes: ParentRouteMap,
  requestedParentId: string | null,
): V2Route[] {
  if (!requestedParentId || !Object.hasOwn(parentRoutes, requestedParentId)) {
    return defaultRoutes;
  }
  const selected = parentRoutes[requestedParentId];
  return [selected, ...defaultRoutes]
    .filter(
      (route, index, routes) =>
        routes.findIndex((candidate) => routeKey(candidate) === routeKey(route)) ===
        index,
    )
    .slice(0, MAX_ROUTES);
}

function reaches(
  adjacency: Map<string, Set<string>>,
  start: string,
  target: string,
): boolean {
  const pending = [start];
  const seen = new Set<string>();
  while (pending.length) {
    const current = pending.pop()!;
    if (current === target) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    pending.push(...(adjacency.get(current) ?? []));
  }
  return false;
}

function edgeKey(fromId: string, toId: string): string {
  return `${fromId}->${toId}`;
}

export function buildRouteMap(
  routes: V2Route[],
  targetId: string,
): RouteMapModel {
  if (!routes.length) {
    return {
      nodes: [],
      edges: [],
      width: 0,
      height: 0,
      levels: 0,
      targetId,
    };
  }

  const titles = new Map<string, string>();
  const preferredParents = new Map<string, string>();
  const preferredEdges = new Map<string, V2EdgeSummary>();
  const selectedNodes = new Set(routes[0].nodeIds);
  const selectedEdges = new Set(
    routes[0].nodeIds.slice(1).map((toId, index) =>
      edgeKey(routes[0].nodeIds[index], toId),
    ),
  );

  for (const route of routes) {
    route.nodeIds.forEach((id, index) => {
      if (!titles.has(id)) titles.set(id, route.titles[index] ?? id);
      if (index > 0 && !preferredParents.has(id)) {
        preferredParents.set(id, route.nodeIds[index - 1]);
        const incomingEdge = route.edges[index - 1];
        if (incomingEdge) preferredEdges.set(id, incomingEdge);
      }
    });
  }

  const adjacency = new Map<string, Set<string>>();
  const accepted = new Map<string, AcceptedEdge>();
  routes.forEach((route, routeIndex) => {
    route.edges.forEach((edge, edgeIndex) => {
      const fromId = route.nodeIds[edgeIndex] ?? edge.from_id;
      const toId = route.nodeIds[edgeIndex + 1] ?? edge.to_id;
      const id = edgeKey(fromId, toId);
      if (accepted.has(id)) return;
      if (reaches(adjacency, toId, fromId)) return;
      const next = adjacency.get(fromId) ?? new Set<string>();
      next.add(toId);
      adjacency.set(fromId, next);
      accepted.set(id, {
        id,
        fromId,
        toId,
        edge,
        isSelected: routeIndex === 0 || selectedEdges.has(id),
      });
    });
  });

  const graph = new dagre.graphlib.Graph();
  graph.setDefaultEdgeLabel(() => ({}));
  graph.setGraph({
    rankdir: "TB",
    ranksep: 62,
    nodesep: 28,
    marginx: 28,
    marginy: 28,
  });
  for (const id of titles.keys()) {
    graph.setNode(id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const item of accepted.values()) {
    graph.setEdge(item.fromId, item.toId);
  }
  dagre.layout(graph);

  const layerCenters = [
    ...new Set(
      [...titles.keys()].map((id) => Math.round(graph.node(id).y * 100) / 100),
    ),
  ].sort((a, b) => a - b);

  const nodes = [...titles.entries()]
    .map(([id, title]): RouteMapNode => {
      const position = graph.node(id);
      const parentId = preferredParents.get(id);
      const layerCenter = Math.round(position.y * 100) / 100;
      return {
        id,
        title,
        href: exploreHref(id, parentId),
        parentId,
        incomingEdgeType: preferredEdges.get(id)?.edge_type,
        layer: layerCenters.indexOf(layerCenter),
        x: position.x - NODE_WIDTH / 2,
        y: position.y - NODE_HEIGHT / 2,
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        isSelected: selectedNodes.has(id),
        isTarget: id === targetId,
      };
    })
    .sort(
      (a, b) =>
        a.layer - b.layer || a.x - b.x || a.id.localeCompare(b.id),
    );

  const edges = [...accepted.values()]
    .map((item): RouteMapEdge => ({
      id: item.id,
      fromId: item.fromId,
      toId: item.toId,
      isSelected: item.isSelected,
      edgeType: item.edge.edge_type,
      isCommonRoute: item.edge.is_common_route,
    }))
    .sort(
      (a, b) =>
        Number(a.isSelected) - Number(b.isSelected) || a.id.localeCompare(b.id),
    );

  const dimensions = graph.graph();
  return {
    nodes,
    edges,
    width: dimensions.width ?? 0,
    height: dimensions.height ?? 0,
    levels: layerCenters.length,
    targetId,
  };
}
