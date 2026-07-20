import type {
  V2DirectoryNode,
  V2Edge,
  V2GraphCoreSnapshot,
  V2NodeCore,
} from "./types";
import { nodeHref } from "./urls";

// The graph holds fact-less core nodes (`V2NodeCore`): nothing in here reads
// `facts`, and typing nodes as core forces every facts access to go through
// lib/v2/facts.ts. A full `V2GraphSnapshot` (e.g. graph.json in tests) is
// structurally assignable, so both snapshots construct the same graph.
export class V2Graph {
  readonly rootId: string;
  readonly nodes: V2NodeCore[];
  readonly edges: V2Edge[];
  readonly nodesById: Map<string, V2NodeCore>;
  private readonly incomingById = new Map<string, V2Edge[]>();
  private readonly outgoingById = new Map<string, V2Edge[]>();

  constructor(snapshot: V2GraphCoreSnapshot) {
    this.rootId = snapshot.root_id;
    this.nodes = snapshot.nodes;
    this.edges = snapshot.edges;
    this.nodesById = new Map(snapshot.nodes.map((node) => [node.id, node]));
    for (const edge of snapshot.edges) {
      this.incomingById.set(edge.to_id, [
        ...(this.incomingById.get(edge.to_id) ?? []),
        edge,
      ]);
      this.outgoingById.set(edge.from_id, [
        ...(this.outgoingById.get(edge.from_id) ?? []),
        edge,
      ]);
    }
  }

  getNode(id: string): V2NodeCore | undefined {
    return this.nodesById.get(id);
  }

  getNodeById(id: string): V2NodeCore | undefined {
    return this.nodesById.get(id);
  }

  hasChildTitle(parentId: string, proposedTitle: string): boolean {
    const normalized = proposedTitle.trim().toLocaleLowerCase("en-IN");
    return this.outgoing(parentId).some((edge) => {
      const child = this.nodesById.get(edge.to_id);
      return child !== undefined && [child.title, ...child.aliases]
        .some(
          (value) => value.trim().toLocaleLowerCase("en-IN") === normalized,
        );
    });
  }

  getNodeByRoute(type: string, slug: string): V2NodeCore | undefined {
    const node = this.nodesById.get(`${type}:${slug}`);
    return node?.type === type && node.slug === slug ? node : undefined;
  }

  incoming(id: string): V2Edge[] {
    return [...(this.incomingById.get(id) ?? [])];
  }

  outgoing(id: string): V2Edge[] {
    return [...(this.outgoingById.get(id) ?? [])];
  }

  directoryNodes(): V2DirectoryNode[] {
    return this.nodes
      .map((node) => ({
        id: node.id,
        type: node.type,
        title: node.title,
        aliases: node.aliases,
        description: node.description,
        href: nodeHref(node.id),
        incomingCount: this.incoming(node.id).length,
        outgoingCount: this.outgoing(node.id).length,
      }))
      .sort(
        (a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id),
      );
  }
}
