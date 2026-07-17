import Link from "next/link";
import type { V2Route } from "@/lib/v2/types";
import { nodeHref } from "@/lib/v2/urls";

export default function CompleteRoutes({ routes }: { routes: V2Route[] }) {
  return (
    <details className="mt-4 w-full max-w-4xl rounded-lg border bg-white p-4">
      <summary className="cursor-pointer font-mono text-xs font-bold uppercase tracking-wider">
        View complete routes from Class 10 ({routes.length})
      </summary>
      {routes.length ? (
        <ol className="mt-4 space-y-3">
          {routes.map((route) => (
            <li
              key={route.nodeIds.join("->")}
              className="flex flex-wrap items-center gap-2 rounded border-l-2 border-black bg-neutral-50 p-3 text-xs"
            >
              {route.nodeIds.map((id, index) => (
                <span key={id} className="contents">
                  {index > 0 && <span aria-hidden="true">→</span>}
                  <Link
                    href={nodeHref(
                      id,
                      index > 0 ? route.nodeIds[index - 1] : undefined,
                    )}
                    className="underline-offset-2 hover:underline"
                  >
                    {route.titles[index]}
                  </Link>
                </span>
              ))}
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 text-sm text-gray-500">
          No complete route mapped yet.
        </p>
      )}
    </details>
  );
}
