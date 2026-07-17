"use client";

import {
  ArrowDown,
  ArrowUp,
  Maximize2,
  Network,
  X,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type RefObject,
} from "react";
import {
  buildRouteMap,
  selectRouteSet,
  type ParentRouteMap,
  type RouteMapModel,
} from "@/lib/v2/route-map";
import type { V2Route } from "@/lib/v2/types";

interface Props {
  defaultRoutes: V2Route[];
  parentRoutes: ParentRouteMap;
  targetId: string;
  targetTitle: string;
  requestedParentId: string | null;
}

type QueryProps = Omit<Props, "requestedParentId">;

const LONG_MAP_HEIGHT = 640;

function pointsToPath(points: Array<{ x: number; y: number }>): string {
  return points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
}

function readableId(id: string): string {
  return id.split(":").at(-1)?.replaceAll("-", " ") ?? id;
}

function MapCanvas({
  model,
  markerScope,
}: {
  model: RouteMapModel;
  markerScope: string;
}) {
  const titleById = new Map(model.nodes.map((node) => [node.id, node.title]));
  const selectedMarkerId = `${markerScope}-selected-arrow`;
  const alternateMarkerId = `${markerScope}-alternate-arrow`;

  return (
    <div
      className="relative mx-auto"
      style={{ width: model.width, height: model.height }}
    >
      <svg
        aria-hidden="true"
        className="absolute inset-0"
        width={model.width}
        height={model.height}
      >
        <defs>
          <marker
            id={selectedMarkerId}
            markerHeight="8"
            markerWidth="8"
            orient="auto"
            refX="7"
            refY="4"
          >
            <path d="M0 0 L8 4 L0 8" fill="none" stroke="#171717" />
          </marker>
          <marker
            id={alternateMarkerId}
            markerHeight="8"
            markerWidth="8"
            orient="auto"
            refX="7"
            refY="4"
          >
            <path d="M0 0 L8 4 L0 8" fill="none" stroke="#d4d4d4" />
          </marker>
        </defs>
        {model.edges.map((edge) => (
          <path
            key={edge.id}
            d={pointsToPath(edge.points)}
            fill="none"
            markerEnd={`url(#${
              edge.isSelected ? selectedMarkerId : alternateMarkerId
            })`}
            stroke={edge.isSelected ? "#171717" : "#d4d4d4"}
            strokeDasharray={edge.edgeType === "lateral" ? "5 5" : undefined}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={edge.isSelected ? 3 : 2}
          />
        ))}
      </svg>

      {model.nodes.map((node) => {
        const parentTitle = node.parentId
          ? (titleById.get(node.parentId) ?? readableId(node.parentId))
          : null;
        const accessibleName = parentTitle
          ? `Explore ${node.title} via ${parentTitle}`
          : `Explore ${node.title}`;
        return (
          <Link
            key={node.id}
            href={node.href}
            aria-current={node.isTarget ? "location" : undefined}
            aria-label={accessibleName}
            data-route-node-id={node.id}
            data-selected={String(node.isSelected)}
            className={`absolute z-10 flex items-center justify-center rounded-xl px-3 text-center font-mono text-[11px] leading-tight transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 motion-reduce:transition-none ${
              node.isTarget
                ? "rounded-full border border-black bg-black font-bold text-white shadow-md hover:bg-neutral-800"
                : node.isSelected
                  ? "border-2 border-black bg-white font-bold text-black shadow-sm hover:-translate-y-0.5 hover:shadow-md"
                  : "border border-neutral-300 bg-white text-neutral-600 hover:border-neutral-500 hover:text-black"
            }`}
            style={{
              left: node.x,
              top: node.y,
              width: node.width,
              height: node.height,
            }}
          >
            {node.title}
          </Link>
        );
      })}
    </div>
  );
}

function scrollToNode(
  viewport: RefObject<HTMLDivElement | null>,
  model: RouteMapModel,
  nodeId: string,
) {
  const container = viewport.current;
  const node = model.nodes.find((item) => item.id === nodeId);
  if (!container || !node) return;
  const reduceMotion = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  container.scrollTo({
    left: Math.max(
      0,
      node.x + node.width / 2 - container.clientWidth / 2,
    ),
    top: Math.max(
      0,
      node.y + node.height / 2 - container.clientHeight / 2,
    ),
    behavior: reduceMotion ? "auto" : "smooth",
  });
}

function MapLegend() {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[9px] text-neutral-500">
      <span className="inline-flex items-center gap-2">
        <span className="h-[3px] w-5 bg-neutral-900" aria-hidden="true" />
        selected route
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="h-0.5 w-5 bg-neutral-300" aria-hidden="true" />
        other mapped routes
      </span>
      <span className="sm:ml-auto">Click any node to explore</span>
    </div>
  );
}

export function RouteMap({
  defaultRoutes,
  parentRoutes,
  targetId,
  targetTitle,
  requestedParentId,
}: Props) {
  const routes = useMemo(
    () => selectRouteSet(defaultRoutes, parentRoutes, requestedParentId),
    [defaultRoutes, parentRoutes, requestedParentId],
  );
  const model = useMemo(
    () => buildRouteMap(routes, targetId),
    [routes, targetId],
  );
  const [expanded, setExpanded] = useState(false);
  const inlineViewport = useRef<HTMLDivElement>(null);
  const dialogViewport = useRef<HTMLDivElement>(null);
  const expandButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const componentId = useId().replaceAll(":", "");
  const dialogTitleId = `${componentId}-route-map-dialog-title`;
  const rootId = routes[0]?.nodeIds[0];
  const isLong = model.height > LONG_MAP_HEIGHT;

  useEffect(() => {
    if (!expanded) return;
    const expandTrigger = expandButton.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setExpanded(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      expandTrigger?.focus();
    };
  }, [expanded]);

  return (
    <div className="border-t border-neutral-200 pt-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Network size={15} aria-hidden="true" />
            <h2 className="font-mono text-sm font-bold">
              Routes from Class 10
            </h2>
          </div>
          <p className="mt-1 font-mono text-[10px] text-neutral-400">
            {routes.length} {routes.length === 1 ? "route" : "routes"}
            {model.levels ? ` · ${model.levels} levels` : ""}
          </p>
        </div>

        {model.nodes.length > 0 && rootId && (
          <div className="ml-auto flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => scrollToNode(inlineViewport, model, rootId)}
              aria-label="Jump to Class 10"
              className="inline-flex items-center gap-1 rounded-full border border-neutral-200 px-2.5 py-1.5 font-mono text-[9px] text-neutral-600 hover:border-neutral-400 hover:text-black"
            >
              <ArrowUp size={12} aria-hidden="true" />
              Class 10
            </button>
            <button
              type="button"
              onClick={() => scrollToNode(inlineViewport, model, targetId)}
              aria-label={`Jump to ${targetTitle}`}
              className="inline-flex items-center gap-1 rounded-full border border-neutral-200 px-2.5 py-1.5 font-mono text-[9px] text-neutral-600 hover:border-neutral-400 hover:text-black"
            >
              <ArrowDown size={12} aria-hidden="true" />
              {targetTitle}
            </button>
            <button
              ref={expandButton}
              type="button"
              onClick={() => setExpanded(true)}
              aria-label="Expand route map"
              className="inline-flex items-center gap-1 rounded-full border border-neutral-200 px-2.5 py-1.5 font-mono text-[9px] text-neutral-600 hover:border-neutral-400 hover:text-black"
            >
              <Maximize2 size={12} aria-hidden="true" />
              Expand
            </button>
          </div>
        )}
      </div>

      {model.nodes.length > 0 ? (
        <>
          <div className="relative mt-4 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50">
            <div
              ref={inlineViewport}
              role="region"
              aria-label="Career routes from Class 10"
              tabIndex={0}
              className="overflow-auto p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black sm:p-5"
              style={isLong ? { maxHeight: "65vh" } : undefined}
            >
              <MapCanvas model={model} markerScope={`${componentId}-inline`} />
            </div>
            {isLong && (
              <div className="pointer-events-none absolute inset-x-0 bottom-0 flex h-14 items-end justify-center bg-gradient-to-b from-transparent to-neutral-50 pb-2 font-mono text-[9px] text-neutral-500">
                Scroll to continue ↓
              </div>
            )}
          </div>
          <MapLegend />
        </>
      ) : (
        <p className="mt-3 text-sm text-neutral-500">
          No complete route mapped yet.
        </p>
      )}

      {expanded && rootId && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={dialogTitleId}
          className="fixed inset-0 z-50 flex flex-col bg-neutral-50 p-4 sm:p-6"
        >
          <div className="mx-auto flex w-full max-w-7xl items-center gap-3">
            <div>
              <h2 id={dialogTitleId} className="font-mono text-sm font-bold">
                Routes from Class 10
              </h2>
              <p className="mt-1 font-mono text-[10px] text-neutral-500">
                {routes.length} {routes.length === 1 ? "route" : "routes"} ·{" "}
                {model.levels} levels
              </p>
            </div>
            <div className="ml-auto flex gap-2">
              <button
                type="button"
                onClick={() => scrollToNode(dialogViewport, model, rootId)}
                aria-label="Jump to Class 10 in expanded map"
                className="rounded-full border bg-white p-2 text-neutral-600 hover:text-black"
              >
                <ArrowUp size={16} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => scrollToNode(dialogViewport, model, targetId)}
                aria-label={`Jump to ${targetTitle} in expanded map`}
                className="rounded-full border bg-white p-2 text-neutral-600 hover:text-black"
              >
                <ArrowDown size={16} aria-hidden="true" />
              </button>
              <button
                ref={closeButton}
                type="button"
                onClick={() => setExpanded(false)}
                aria-label="Close route map"
                className="rounded-full border bg-white p-2 text-neutral-600 hover:text-black"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
          <div
            ref={dialogViewport}
            role="region"
            aria-label="Expanded career routes from Class 10"
            tabIndex={0}
            className="mx-auto mt-4 min-h-0 w-full max-w-7xl flex-1 overflow-auto rounded-2xl border border-neutral-200 bg-white p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-black"
          >
            <MapCanvas model={model} markerScope={`${componentId}-dialog`} />
          </div>
          <div className="mx-auto w-full max-w-7xl">
            <MapLegend />
          </div>
        </div>
      )}
    </div>
  );
}

export default function RouteMapFromQuery(props: QueryProps) {
  const requestedParentId = useSearchParams().get("from");
  return <RouteMap {...props} requestedParentId={requestedParentId} />;
}
