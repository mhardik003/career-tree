"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MiniMap,
  Position,
  type Node,
  type NodeProps,
} from "reactflow";
import "reactflow/dist/style.css";
import type { V2GlobalMap } from "@/lib/v2/global-map";
import { filterGlobalMap } from "@/lib/v2/global-map";
import type { V2NodeType } from "@/lib/v2/types";
import { useDebouncedValue } from "@/lib/v2/use-debounced-value";

const DISTANCE_COLORS = ["#111827", "#2563eb", "#7c3aed", "#db2777", "#ea580c", "#16a34a"];

function MapNode({ data, selected }: NodeProps) {
  return (
    <div className={`min-w-40 rounded-lg border bg-white px-4 py-3 text-center shadow-sm ${selected ? "border-black ring-2 ring-black" : "border-gray-300"}`}>
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <p className="font-mono text-[10px] font-bold">{data.label}</p>
      <p className="mt-1 font-mono text-[8px] uppercase text-gray-500">{data.nodeType.replaceAll("_", " ")}</p>
      <Handle type="source" position={Position.Bottom} className="opacity-0" />
    </div>
  );
}

const nodeTypes = { canonical: MapNode };

export default function MapView({ model }: { model: V2GlobalMap }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [type, setType] = useState<V2NodeType | "all">("all");
  // ISSUE-11a: the input stays controlled by `query`; the O(N+E) refilter runs
  // on the debounced copy so a typing burst costs one pass. No result cap here
  // (ISSUE-11b): the filtered graph IS the map — React Flow mounts the
  // surviving nodes and `onlyRenderVisibleElements` already culls DOM
  // rendering to the viewport, so there is no unbounded match list to cap.
  const filterQuery = useDebouncedValue(query);
  const visible = useMemo(
    () => filterGlobalMap(model, filterQuery, type),
    [model, filterQuery, type],
  );
  const distances = useMemo(
    () => new Map(visible.nodes.map((node) => [node.id, node.rootDistance])),
    [visible.nodes],
  );
  const nodes = useMemo(() => visible.nodes.map((node) => ({
    id: node.id,
    type: "canonical",
    position: node.position,
    data: {
      label: node.title,
      nodeType: node.type,
      href: node.href,
      isTerminal: node.isTerminal,
      rootDistance: node.rootDistance,
    },
  })), [visible.nodes]);
  const edges = useMemo(() => visible.edges.map((edge) => {
    const distance = distances.get(edge.target) ?? 0;
    const color = DISTANCE_COLORS[Math.min(distance, DISTANCE_COLORS.length - 1)];
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: "smoothstep",
      style: {
        stroke: color,
        strokeWidth: edge.isCommonRoute ? 2 : 1.5,
        opacity: edge.edgeType === "lateral" ? 0.55 : 0.8,
      },
    };
  }), [distances, visible.edges]);
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    router.push(node.data.href);
  }, [router]);

  return (
    <main className="h-screen w-screen bg-[#fafafa]">
      <div className="absolute left-4 top-4 z-50 flex max-w-[calc(100vw-2rem)] flex-col gap-2 rounded-xl border bg-white/95 p-3 shadow-md backdrop-blur">
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/" className="rounded-md border px-3 py-2 font-mono text-xs">← Back home</Link>
          <span className="rounded-md bg-black px-3 py-2 font-mono text-xs text-white">
            {visible.nodes.length} canonical nodes
          </span>
        </div>
        <label className="sr-only" htmlFor="map-search">Search map nodes</label>
        <input
          id="map-search"
          type="search"
          aria-label="Search map nodes"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search titles or aliases"
          className="rounded-md border px-3 py-2 text-sm"
        />
        <label className="sr-only" htmlFor="map-type">Filter map by node type</label>
        <select
          id="map-type"
          aria-label="Filter map by node type"
          value={type}
          onChange={(event) => setType(event.target.value as V2NodeType | "all")}
          className="rounded-md border px-3 py-2 text-sm"
        >
          <option value="all">All node types</option>
          {model.types.map((nodeType) => (
            <option key={nodeType} value={nodeType}>{nodeType.replaceAll("_", " ")}</option>
          ))}
        </select>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        onlyRenderVisibleElements
        fitView
        minZoom={0.05}
        maxZoom={1.5}
        attributionPosition="bottom-right"
      >
        <Background color="#e5e5e5" gap={40} variant={BackgroundVariant.Lines} />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(node) => {
            const distance = node.data.rootDistance ?? 0;
            return DISTANCE_COLORS[Math.min(distance, DISTANCE_COLORS.length - 1)];
          }}
          maskColor="rgba(250, 250, 250, 0.8)"
        />
      </ReactFlow>
    </main>
  );
}
