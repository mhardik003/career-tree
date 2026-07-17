"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { carouselWindow, moveSelection } from "@/lib/v2/carousel";
import type { V2ParentView } from "@/lib/v2/types";
import { cn } from "@/lib/utils";

interface Props {
  currentTitle?: string;
  parents: V2ParentView[];
  selectedId: string;
  selectedParentHref: string;
  onSelect(parent: V2ParentView): void;
}

const POSITION_CLASS: Record<number, string> = {
  [-2]: "hidden lg:col-start-1 lg:block",
  [-1]: "col-start-1 lg:col-start-2",
  0: "col-start-2 lg:col-start-3",
  1: "col-start-3 lg:col-start-4",
  2: "hidden lg:col-start-5 lg:block",
};

export default function ParentCarousel(props: Props) {
  return <ParentCarouselContent key={props.selectedId} {...props} />;
}

function ParentCarouselContent({
  currentTitle = "current node",
  parents,
  selectedId,
  selectedParentHref,
  onSelect,
}: Props) {
  const [activeId, setActiveId] = useState(selectedId);
  const ids = useMemo(
    () => parents.map((parent) => parent.node.id),
    [parents],
  );
  const byId = useMemo(
    () => new Map(parents.map((parent) => [parent.node.id, parent])),
    [parents],
  );
  const items = carouselWindow(ids, activeId, 5);
  const activeIndex = Math.max(0, ids.indexOf(activeId));
  const activeParent = byId.get(activeId);

  function select(id: string | null) {
    if (!id) return;
    const parent = byId.get(id);
    if (!parent) return;
    setActiveId(id);
    onSelect(parent);
  }

  if (!parents.length) return null;

  return (
    <section
      className="mx-auto w-full max-w-6xl"
      aria-label={`Ways to reach ${currentTitle}`}
    >
      <p role="status" aria-live="polite" className="sr-only">
        Selected parent {activeParent?.node.title ?? activeId}, {activeIndex + 1} of{" "}
        {parents.length}
      </p>
      <div
        role="group"
        aria-label={`Ways to reach ${currentTitle}`}
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault();
            select(moveSelection(ids, activeId, -1));
          }
          if (event.key === "ArrowRight") {
            event.preventDefault();
            select(moveSelection(ids, activeId, 1));
          }
        }}
        className="mt-4 flex items-center justify-center gap-1 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2 sm:gap-2"
      >
        {parents.length > 1 && (
          <button
            type="button"
            aria-label="Previous parent"
            onClick={() => select(moveSelection(ids, activeId, -1))}
            className="shrink-0 rounded-full border bg-white p-2"
          >
            <ChevronLeft size={18} />
          </button>
        )}
        <div
          data-testid="parent-carousel-track"
          className="grid max-w-5xl flex-1 grid-cols-3 items-center gap-1 lg:grid-cols-5 lg:gap-2"
        >
          {items.map(({ id, offset }) => {
            const parent = byId.get(id)!;
            const cardClassName = cn(
              "row-start-1 min-w-0 overflow-hidden rounded-lg border bg-white p-2 text-center transition-all motion-reduce:transition-none sm:p-3",
              POSITION_CLASS[offset],
              offset === 0 &&
                "z-10 scale-100 border-2 border-black opacity-100 shadow-lg",
              Math.abs(offset) === 1 && "scale-90 opacity-50",
              Math.abs(offset) === 2 &&
                "hidden scale-75 opacity-20 lg:block",
            );
            const cardContent = (
              <>
                <span className="block font-mono text-xs font-bold">
                  {parent.node.title}
                </span>
                <span className="mt-1 block text-[9px] uppercase text-gray-500">
                  {parent.edge.edge_type.replace("_", " ")}
                </span>
              </>
            );
            if (offset === 0 && id === selectedId) {
              return (
                <Link
                  key={id}
                  href={selectedParentHref}
                  aria-label={`Open parent ${parent.node.title}`}
                  aria-current="step"
                  className={cardClassName}
                >
                  {cardContent}
                </Link>
              );
            }
            return (
              <button
                type="button"
                key={id}
                aria-label={`Select parent ${parent.node.title}`}
                onClick={() => select(id)}
                className={cardClassName}
              >
                {cardContent}
              </button>
            );
          })}
        </div>
        {parents.length > 1 && (
          <button
            type="button"
            aria-label="Next parent"
            onClick={() => select(moveSelection(ids, activeId, 1))}
            className="shrink-0 rounded-full border bg-white p-2"
          >
            <ChevronRight size={18} />
          </button>
        )}
      </div>
      <div className="mx-auto h-8 w-px bg-black/20" />
    </section>
  );
}
