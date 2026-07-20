import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import V2FocusView from "@/components/v2/V2FocusView";
import V2NodePageClient from "@/components/v2/V2NodePageClient";
import { v2Graph } from "@/lib/v2/data";
import { getFullNode } from "@/lib/v2/facts";
import { prerenderParams } from "@/lib/v2/prerender";
import { buildNodePageView } from "@/lib/v2/routes";
import type { V2ParentContext } from "@/lib/v2/types";
import { nodeHref } from "@/lib/v2/urls";

interface Props {
  params: Promise<{ type: string; slug: string }>;
}

// Prerender only the high-value hubs; the long tail is rendered on first
// request (dynamicParams) and cached for a day (ISR). Unknown {type,slug}
// still 404s via the notFound() below. Facts are fs-read at request time,
// so this route must stay listed under outputFileTracingIncludes.
export const dynamicParams = true;
export const revalidate = 86400;

export function generateStaticParams() {
  return prerenderParams(v2Graph);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { type, slug } = await params;
  const node = v2Graph.getNodeByRoute(type, slug);
  if (!node) return {};
  return {
    title: `Explore paths around ${node.title} — Career Tree`,
    description: `Explore routes into and career options after ${node.title}.`,
    robots: { index: false, follow: true },
    alternates: { canonical: nodeHref(node.id) },
  };
}

export default async function ExplorePage({ params }: Props) {
  const { type, slug } = await params;
  const core = v2Graph.getNodeByRoute(type, slug);
  if (!core) notFound();
  // The graph holds fact-less core nodes. The focused node stays full
  // (facts re-attached from data/v2/facts/) — the guide CTA and prerendered
  // HTML keep exposing the focused node's facts exactly as before.
  const node = await getFullNode(core.id);
  if (!node) notFound();
  const canonicalView = { ...buildNodePageView(v2Graph, node.id), node };
  // Per-parent views differ from the canonical view only in route order,
  // selected parent, and back link — ship just those fields per parent.
  // Reusing the canonical routes array when the order is unchanged lets
  // React Flight serialize one reference instead of ten.
  const parentContexts = Object.fromEntries(
    canonicalView.parents.map((parent) => {
      const view = buildNodePageView(v2Graph, node.id, parent.node.id);
      const sameRoutes =
        view.routes.length === canonicalView.routes.length &&
        view.routes.every((route, index) => route === canonicalView.routes[index]);
      const context: V2ParentContext = {
        routes: sameRoutes ? canonicalView.routes : view.routes,
        selectedParentId: view.selectedParentId ?? parent.node.id,
        backHref: view.backHref,
      };
      return [parent.node.id, context];
    }),
  );
  return (
    <Suspense fallback={<V2FocusView view={canonicalView} />}>
      <V2NodePageClient
        canonicalView={canonicalView}
        parentContexts={parentContexts}
      />
    </Suspense>
  );
}
