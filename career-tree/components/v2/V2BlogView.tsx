import { ArrowLeft, Compass } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import type { ParentRouteMap } from "@/lib/v2/route-map";
import type { V2NodePageView } from "@/lib/v2/types";
import { exploreHref, nodeHref } from "@/lib/v2/urls";
import ContributionActions from "./ContributionActions";
import NodeFacts from "./NodeFacts";
import RouteMapFromQuery, { RouteMap } from "./RouteMap";

function sourceIndex(view: V2NodePageView): string[] {
  const facts = view.node.facts;
  return [...new Set([
    ...view.node.prov.source_urls,
    ...(facts?.quick_facts.flatMap((fact) => fact.source_urls) ?? []),
    ...(facts?.sections.flatMap((section) => section.source_urls) ?? []),
    ...(facts?.useful_links.map((link) => link.url) ?? []),
  ])];
}

export default function V2BlogView({
  view,
  parentRoutes,
}: {
  view: V2NodePageView;
  parentRoutes: ParentRouteMap;
}) {
  const sources = sourceIndex(view);

  return (
    <main className="min-h-screen bg-neutral-50 px-4 pb-20 pt-8">
      <nav className="mx-auto flex max-w-3xl items-center gap-3">
        <Link
          href="/"
          aria-label="Back to career directory"
          className="rounded-full border bg-white p-2"
        >
          <ArrowLeft size={18} />
        </Link>
      </nav>

      <article className="mx-auto mt-12 max-w-3xl rounded-2xl border bg-white px-6 py-10 shadow-sm sm:px-10">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-gray-500">
          {view.node.type.replaceAll("_", " ")} · canonical guide
        </p>
        <h1 className="mt-3 text-4xl font-bold tracking-tight">
          {view.node.title}
        </h1>
        <p className="mt-5 text-lg leading-8 text-gray-600">
          {view.node.description}
        </p>
        <Link
          href={exploreHref(view.node.id)}
          className="mt-7 inline-flex items-center gap-2 rounded-full bg-black px-4 py-2 font-mono text-[10px] font-bold uppercase tracking-wider text-white"
        >
          <Compass size={14} aria-hidden="true" />
          Explore paths from here
        </Link>

        {view.node.aliases.length > 0 && (
          <section className="mt-10 border-t pt-6">
            <h2 className="font-mono text-sm font-bold">Aliases</h2>
            <p className="mt-2 text-sm text-gray-600">
              {view.node.aliases.join(", ")}
            </p>
          </section>
        )}

        <section className="mt-10" aria-label="Route reference">
          <Suspense
            fallback={
              <RouteMap
                defaultRoutes={view.routes}
                parentRoutes={{}}
                targetId={view.node.id}
                targetTitle={view.node.title}
                requestedParentId={null}
              />
            }
          >
            <RouteMapFromQuery
              defaultRoutes={view.routes}
              parentRoutes={parentRoutes}
              targetId={view.node.id}
              targetTitle={view.node.title}
            />
          </Suspense>
        </section>

        {view.node.facts && <NodeFacts facts={view.node.facts} />}

        <section className="mt-10">
          <h2 className="font-mono text-sm font-bold">What can come next</h2>
          {view.children.length ? (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {view.children.map(({ node }) => (
                <li key={node.id}>
                  <Link
                    href={nodeHref(node.id)}
                    className="text-sm underline-offset-2 hover:underline"
                  >
                    {node.title}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-gray-500">
              No next options are mapped yet.
            </p>
          )}
        </section>

        <ContributionActions node={view.node} />

        {sources.length > 0 && (
          <section className="mt-10 border-t pt-6">
            <h2 className="font-mono text-sm font-bold">Sources</h2>
            <ul className="mt-3 space-y-2">
              {sources.map((source) => (
                <li key={source}>
                  <a
                    href={source}
                    rel="noreferrer noopener"
                    target="_blank"
                    className="break-all text-sm underline"
                  >
                    {source}
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="mt-10 border-t pt-5 font-mono text-[10px] text-gray-400">
          <p>{view.node.id}</p>
          <p className="mt-1">
            Generated {view.node.prov.generated_at} · {view.node.prov.model}
          </p>
        </footer>
      </article>
    </main>
  );
}
