"use client";

import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import Link from "next/link";
import { memo, useMemo } from "react";
import type { RouteMapModel } from "@/lib/v2/route-map";

const SELECTED_COLOR = "#171717";
const ALTERNATE_COLOR = "#d4d4d4";
// Nominal article-content width for the server-computed fitted viewport; the
// client re-fits once to the real container after mount.
const INLINE_SSR_WIDTH = 660;
const INLINE_MIN_HEIGHT = 240;
const INLINE_MAX_HEIGHT = 520;

type RouteNodeData = {
  title: string;
  href: string;
  accessibleName: string;
  isSelected: boolean;
  isTarget: boolean;
};
export type RouteFlowNode = Node<RouteNodeData, "route">;

function readableId(id: string): string {
  return id.split(":").at(-1)?.replaceAll("-", " ") ?? id;
}

function RouteNode({ id, data }: NodeProps<RouteFlowNode>) {
  return (
    <>
      <Handle
        type="target"
        position={Position.Top}
        className="opacity-0"
        isConnectable={false}
      />
      <Link
        href={data.href}
        aria-current={data.isTarget ? "location" : undefined}
        aria-label={data.accessibleName}
        data-route-node-id={id}
        data-selected={String(data.isSelected)}
        // With dragging/selection disabled React Flow puts pointer-events:none
        // on the node wrapper; the link must re-enable them to stay clickable.
        className={`pointer-events-auto flex h-[52px] w-[152px] items-center justify-center rounded-xl px-3 text-center font-mono text-[11px] leading-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 motion-reduce:transition-none ${
          data.isTarget
            ? "rounded-full border border-black bg-black font-bold text-white shadow-md hover:bg-neutral-800"
            : data.isSelected
              ? "border-2 border-black bg-white font-bold text-black shadow-sm hover:-translate-y-0.5 hover:shadow-md"
              : "border border-neutral-300 bg-white text-neutral-600 hover:border-neutral-500 hover:text-black"
        }`}
      >
        {data.title}
      </Link>
      <Handle
        type="source"
        position={Position.Bottom}
        className="opacity-0"
        isConnectable={false}
      />
    </>
  );
}

const nodeTypes = { route: memo(RouteNode) };

export function toFlowElements(model: RouteMapModel): {
  nodes: RouteFlowNode[];
  edges: Edge[];
} {
  const titleById = new Map(model.nodes.map((node) => [node.id, node.title]));
  const nodes = model.nodes.map((node): RouteFlowNode => {
    const parentTitle = node.parentId
      ? (titleById.get(node.parentId) ?? readableId(node.parentId))
      : null;
    const relationship = node.incomingEdgeType?.replaceAll("_", " ");
    const accessibleName = parentTitle
      ? `Explore ${node.title} via ${parentTitle}${
          relationship ? `, ${relationship} route` : ""
        }`
      : `Explore ${node.title}`;
    return {
      id: node.id,
      type: "route",
      position: { x: node.x, y: node.y },
      width: node.width,
      height: node.height,
      draggable: false,
      selectable: false,
      connectable: false,
      focusable: false,
      data: {
        title: node.title,
        href: node.href,
        accessibleName,
        isSelected: node.isSelected,
        isTarget: node.isTarget,
      },
    };
  });
  const edges = model.edges.map(
    (edge): Edge => ({
      id: edge.id,
      source: edge.fromId,
      target: edge.toId,
      type: "smoothstep",
      interactionWidth: 0,
      style: {
        stroke: edge.isSelected ? SELECTED_COLOR : ALTERNATE_COLOR,
        strokeWidth: edge.isSelected ? 3 : 2,
        strokeDasharray: edge.edgeType === "lateral" ? "5 5" : undefined,
      },
      markerEnd: {
        type: MarkerType.Arrow,
        color: edge.isSelected ? SELECTED_COLOR : ALTERNATE_COLOR,
        width: 12,
        height: 12,
        strokeWidth: 1.5,
      },
    }),
  );
  return { nodes, edges };
}

export function inlineHeight(model: RouteMapModel): number {
  if (!model.height) return INLINE_MIN_HEIGHT;
  const fittedZoom = Math.min(1, INLINE_SSR_WIDTH / Math.max(model.width, 1));
  return Math.round(
    Math.min(
      INLINE_MAX_HEIGHT,
      Math.max(INLINE_MIN_HEIGHT, model.height * fittedZoom),
    ),
  );
}

export function RouteMapFlow({
  model,
  variant,
}: {
  model: RouteMapModel;
  variant: "inline" | "dialog";
}) {
  const { nodes, edges } = useMemo(() => toFlowElements(model), [model]);
  const isInline = variant === "inline";
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: isInline ? 0.04 : 0.1 }}
      minZoom={0.1}
      maxZoom={isInline ? 1 : 1.5}
      width={isInline ? INLINE_SSR_WIDTH : undefined}
      height={isInline ? inlineHeight(model) : undefined}
      nodesDraggable={false}
      nodesConnectable={false}
      nodesFocusable={false}
      edgesFocusable={false}
      elementsSelectable={false}
      panOnDrag={!isInline}
      panOnScroll={false}
      zoomOnScroll={!isInline}
      zoomOnPinch={!isInline}
      zoomOnDoubleClick={!isInline}
      preventScrolling={!isInline}
      attributionPosition="bottom-right"
    >
      {!isInline && (
        <>
          <Background
            color="#e5e5e5"
            gap={40}
            variant={BackgroundVariant.Lines}
          />
          <Controls showInteractive={false} />
        </>
      )}
    </ReactFlow>
  );
}
