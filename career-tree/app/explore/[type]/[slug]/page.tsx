import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import V2FocusView from "@/components/v2/V2FocusView";
import V2NodePageClient from "@/components/v2/V2NodePageClient";
import { v2Graph } from "@/lib/v2/data";
import { buildNodePageView } from "@/lib/v2/routes";
import type { V2ParentContext } from "@/lib/v2/types";
import { nodeHref } from "@/lib/v2/urls";

interface Props {
  params: Promise<{ type: string; slug: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return v2Graph.nodes.map((node) => ({ type: node.type, slug: node.slug }));
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
  const node = v2Graph.getNodeByRoute(type, slug);
  if (!node) notFound();
  const canonicalView = buildNodePageView(v2Graph, node.id);
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
