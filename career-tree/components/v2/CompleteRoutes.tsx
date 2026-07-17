import { ChevronDown, Network } from "lucide-react";
import Link from "next/link";
import type { V2Route } from "@/lib/v2/types";
import { exploreHref } from "@/lib/v2/urls";

export default function CompleteRoutes({ routes }: { routes: V2Route[] }) {
  return (
    <details className="group border-t border-neutral-200 py-4 text-gray-500">
      <summary className="flex cursor-pointer list-none items-center gap-2 font-mono text-[11px] [&::-webkit-details-marker]:hidden">
        <Network size={14} aria-hidden="true" />
        <span>Routes from Class 10</span>
        <span className="text-gray-400">{routes.length} mapped</span>
        <ChevronDown
          size={14}
          aria-hidden="true"
          className="ml-auto transition-transform group-open:rotate-180 motion-reduce:transition-none"
        />
      </summary>
      {routes.length ? (
        <ol className="mt-4 space-y-3">
          {routes.map((route) => (
            <li
              key={route.nodeIds.join("->")}
              className="flex flex-wrap items-center gap-2 border-l border-neutral-300 pl-3 text-xs text-gray-600"
            >
              {route.nodeIds.map((id, index) => (
                <span key={id} className="contents">
                  {index > 0 && <span aria-hidden="true">→</span>}
                  <Link
                    href={exploreHref(
                      id,
                      index > 0 ? route.nodeIds[index - 1] : undefined,
                    )}
                    className="underline-offset-2 hover:text-black hover:underline"
                  >
                    {route.titles[index]}
                  </Link>
                </span>
              ))}
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 text-sm">No complete route mapped yet.</p>
      )}
    </details>
  );
}
