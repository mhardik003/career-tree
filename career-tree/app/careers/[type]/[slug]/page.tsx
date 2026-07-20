import type { Metadata } from "next";
import { notFound } from "next/navigation";
import V2BlogView from "@/components/v2/V2BlogView";
import { v2Graph } from "@/lib/v2/data";
import { getFullNode } from "@/lib/v2/facts";
import { prerenderParams } from "@/lib/v2/prerender";
import { findRouteThroughParent } from "@/lib/v2/route-map";
import { buildNodePageView } from "@/lib/v2/routes";
import type { V2Node } from "@/lib/v2/types";
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
  const canonical = nodeHref(node.id);
  return {
    title: `${node.title} — Career Guide`,
    description: node.description,
    keywords: [node.title, ...node.aliases, node.type.replaceAll("_", " ")],
    alternates: { canonical },
    openGraph: {
      type: "article",
      title: `${node.title} — Career Guide`,
      description: node.description,
      url: canonical,
      images: [{ url: `/og/${node.type}/${node.slug}` }],
    },
  };
}

function citations(node: V2Node): string[] {
  return [...new Set([
    ...node.prov.source_urls,
    ...(node.facts?.quick_facts.flatMap((fact) => fact.source_urls) ?? []),
    ...(node.facts?.sections.flatMap((section) => section.source_urls) ?? []),
    ...(node.facts?.useful_links.map((link) => link.url) ?? []),
  ])];
}

export default async function CareerGuidePage({ params }: Props) {
  const { type, slug } = await params;
  const core = v2Graph.getNodeByRoute(type, slug);
  if (!core) notFound();
  // The graph holds fact-less core nodes; the guide is the one place on this
  // route that renders facts, so re-attach them to the focused node only.
  const node = await getFullNode(core.id);
  if (!node) notFound();
  const canonicalView = { ...buildNodePageView(v2Graph, node.id), node };
  const parentRoutes = Object.fromEntries(
    canonicalView.parents.flatMap((parent) => {
      const routes = buildNodePageView(v2Graph, node.id, parent.node.id).routes;
      const route = findRouteThroughParent(routes, parent.node.id);
      return route ? [[parent.node.id, route] as const] : [];
    }),
  );
  const article = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: node.title,
    description: node.description,
    dateModified: node.facts?.last_reviewed ?? node.prov.generated_at,
    url: nodeHref(node.id),
    about: {
      "@type": "Thing",
      name: node.title,
      additionalType: node.type,
    },
    citation: citations(node),
  };
  const jsonLd = JSON.stringify(article).replace(/</g, "\\u003c");

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />
      <V2BlogView view={canonicalView} parentRoutes={parentRoutes} />
    </>
  );
}
