import dagre from "dagre";
import type { V2Graph } from "./graph-core";
import type { V2EdgeType, V2NodeType } from "./types";
import { nodeHref } from "./urls";

interface V2MapNode {
  id: string;
  title: string;
  aliases: string[];
  type: V2NodeType;
  href: string;
  isTerminal: boolean;
  rootDistance: number;
  position: { x: number; y: number };
}

interface V2MapEdge {
  id: string;
  source: string;
  target: string;
  edgeType: V2EdgeType;
  isCommonRoute: boolean;
}

export interface V2GlobalMap {
  nodes: V2MapNode[];
  edges: V2MapEdge[];
  types: V2NodeType[];
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 64;

function rootDistances(graph: V2Graph): Map<string, number> {
  const distances = new Map([[graph.rootId, 0]]);
  const queue = [graph.rootId];
  while (queue.length) {
    const current = queue.shift()!;
    const nextDistance = distances.get(current)! + 1;
    for (const edge of graph.outgoing(current)) {
      const known = distances.get(edge.to_id);
      if (known === undefined || nextDistance < known) {
        distances.set(edge.to_id, nextDistance);
        queue.push(edge.to_id);
      }
    }
  }
  return distances;
}

export function buildGlobalMap(graph: V2Graph): V2GlobalMap {
  const distances = rootDistances(graph);
  const unreachableDistance = Math.max(0, ...distances.values()) + 1;
  const layout = new dagre.graphlib.Graph();
  layout.setDefaultEdgeLabel(() => ({}));
  layout.setGraph({
    rankdir: "TB",
    ranksep: 80,
    nodesep: 36,
    marginx: 32,
    marginy: 32,
    acyclicer: "greedy",
  });

  const canonicalNodes = [...new Map(
    graph.nodes.map((node) => [node.id, node] as const),
  ).values()].sort((a, b) => a.id.localeCompare(b.id));
  const canonicalEdges = [...new Map(
    graph.edges.map((edge) => [edge.id, edge] as const),
  ).values()].sort((a, b) => a.id.localeCompare(b.id));

  for (const node of canonicalNodes) {
    layout.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }
  for (const edge of canonicalEdges) {
    layout.setEdge(edge.from_id, edge.to_id);
  }
  dagre.layout(layout);

  return {
    nodes: canonicalNodes.map((node) => {
      const position = layout.node(node.id);
      return {
        id: node.id,
        title: node.title,
        aliases: node.aliases,
        type: node.type,
        href: nodeHref(node.id),
        isTerminal: node.is_terminal,
        rootDistance: distances.get(node.id) ?? unreachableDistance,
        position: {
          x: position.x - NODE_WIDTH / 2,
          y: position.y - NODE_HEIGHT / 2,
        },
      };
    }),
    edges: canonicalEdges.map((edge) => ({
      id: edge.id,
      source: edge.from_id,
      target: edge.to_id,
      edgeType: edge.edge_type,
      isCommonRoute: edge.is_common_route,
    })),
    types: [...new Set(canonicalNodes.map((node) => node.type))].sort(),
  };
}

export function filterGlobalMap(
  model: V2GlobalMap,
  query: string,
  type: V2NodeType | "all",
): V2GlobalMap {
  const normalized = query.trim().toLocaleLowerCase("en-IN");
  const nodes = model.nodes.filter((node) => {
    if (type !== "all" && node.type !== type) return false;
    if (!normalized) return true;
    return [node.id, node.title, ...node.aliases].some((value) =>
      value.toLocaleLowerCase("en-IN").includes(normalized),
    );
  });
  const visible = new Set(nodes.map((node) => node.id));
  return {
    nodes,
    edges: model.edges.filter(
      (edge) => visible.has(edge.source) && visible.has(edge.target),
    ),
    types: model.types,
  };
}
