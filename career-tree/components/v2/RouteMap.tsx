"use client";

import { ReactFlowProvider, useReactFlow } from "@xyflow/react";
import { ArrowDown, ArrowUp, Maximize2, Network, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  buildRouteMap,
  selectRouteSet,
  type ParentRouteMap,
} from "@/lib/v2/route-map";
import type { V2Route } from "@/lib/v2/types";
import { inlineHeight, RouteMapFlow } from "./RouteMapFlow";

interface Props {
  defaultRoutes: V2Route[];
  parentRoutes: ParentRouteMap;
  targetId: string;
  targetTitle: string;
  requestedParentId: string | null;
}

type QueryProps = Omit<Props, "requestedParentId">;

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

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

function useJumpToNode() {
  const { fitView } = useReactFlow();
  return useCallback(
    (nodeId: string) => {
      const reduceMotion =
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ??
        false;
      void fitView({
        nodes: [{ id: nodeId }],
        maxZoom: 1,
        duration: reduceMotion ? 0 : 400,
      });
    },
    [fitView],
  );
}

function DialogJumpButtons({
  rootId,
  targetId,
  targetTitle,
}: {
  rootId: string;
  targetId: string;
  targetTitle: string;
}) {
  const jump = useJumpToNode();
  return (
    <>
      <button
        type="button"
        onClick={() => jump(rootId)}
        aria-label="Jump to Class 10 in expanded map"
        className="rounded-full border bg-white p-2 text-neutral-600 hover:text-black"
      >
        <ArrowUp size={16} aria-hidden="true" />
      </button>
      <button
        type="button"
        onClick={() => jump(targetId)}
        aria-label={`Jump to ${targetTitle} in expanded map`}
        className="rounded-full border bg-white p-2 text-neutral-600 hover:text-black"
      >
        <ArrowDown size={16} aria-hidden="true" />
      </button>
    </>
  );
}

// React Flow's wrapper undoes the browser's native scroll-into-view on focus,
// so tabbing to an off-viewport node link would strand focus invisibly; pan
// the viewport to the focused node instead.
function DialogFocusRegion({ children }: { children: ReactNode }) {
  const jump = useJumpToNode();
  return (
    <div
      className="h-full w-full"
      onFocusCapture={(event) => {
        const id = (event.target as HTMLElement)
          .closest("[data-route-node-id]")
          ?.getAttribute("data-route-node-id");
        if (id) jump(id);
      }}
    >
      {children}
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
  const dialogRoot = useRef<HTMLDivElement>(null);
  const expandButton = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const componentId = useId().replaceAll(":", "");
  const dialogTitleId = `${componentId}-route-map-dialog-title`;
  const rootId = routes[0]?.nodeIds[0];
  // Remount the flow when the selected route set changes so the queued
  // fitView re-runs for the new layout.
  const flowKey = `${model.targetId}:${routes[0]?.nodeIds.join(">") ?? "none"}`;

  useEffect(() => {
    if (!expanded) return;
    const expandTrigger = expandButton.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setExpanded(false);
        return;
      }
      if (event.key !== "Tab" || !dialogRoot.current) return;
      const focusable = Array.from(
        dialogRoot.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!dialogRoot.current.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
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
              role="region"
              aria-label="Career routes from Class 10"
              style={{ height: inlineHeight(model) }}
            >
              <RouteMapFlow key={flowKey} model={model} variant="inline" />
            </div>
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
          ref={dialogRoot}
          role="dialog"
          aria-modal="true"
          aria-labelledby={dialogTitleId}
          className="fixed inset-0 z-50 flex flex-col bg-neutral-50 p-4 sm:p-6"
        >
          <ReactFlowProvider>
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
                <DialogJumpButtons
                  rootId={rootId}
                  targetId={targetId}
                  targetTitle={targetTitle}
                />
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
              role="region"
              aria-label="Expanded career routes from Class 10"
              className="mx-auto mt-4 min-h-0 w-full max-w-7xl flex-1 overflow-hidden rounded-2xl border border-neutral-200 bg-white"
            >
              <DialogFocusRegion>
                <RouteMapFlow key={flowKey} model={model} variant="dialog" />
              </DialogFocusRegion>
            </div>
            <div className="mx-auto w-full max-w-7xl">
              <MapLegend />
            </div>
          </ReactFlowProvider>
        </div>
      )}
    </div>
  );
}

export default function RouteMapFromQuery(props: QueryProps) {
  const requestedParentId = useSearchParams().get("from");
  return <RouteMap {...props} requestedParentId={requestedParentId} />;
}
