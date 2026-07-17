import type { Metadata } from "next";
import { notFound } from "next/navigation";
import V2BlogView from "@/components/v2/V2BlogView";
import { v2Graph } from "@/lib/v2/data";
import { buildNodePageView } from "@/lib/v2/routes";

interface Props {
  params: Promise<{ type: string; slug: string }>;
}

export const dynamicParams = false;

export function generateStaticParams() {
  return v2Graph.nodes.map((node) => ({
    type: node.type,
    slug: node.slug,
  }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { type, slug } = await params;
  const node = v2Graph.getNodeByRoute(type, slug);
  if (!node) return {};
  return {
    title: `${node.title} — V2 Career Guide`,
    description: node.description,
  };
}

export default async function V2BlogPage({ params }: Props) {
  const { type, slug } = await params;
  const node = v2Graph.getNodeByRoute(type, slug);
  if (!node) notFound();
  const canonicalView = buildNodePageView(v2Graph, node.id);
  const parentRoutes = Object.fromEntries(
    canonicalView.parents.flatMap((parent) => {
      const route = buildNodePageView(
        v2Graph,
        node.id,
        parent.node.id,
      ).routes[0];
      return route ? [[parent.node.id, route] as const] : [];
    }),
  );
  return <V2BlogView view={canonicalView} parentRoutes={parentRoutes} />;
}
