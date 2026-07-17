import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import V2FocusView from "@/components/v2/V2FocusView";
import V2NodePageClient from "@/components/v2/V2NodePageClient";
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
    title: `Explore paths around ${node.title} — V2 Career Tree`,
    description: `Explore routes into and career options after ${node.title}.`,
  };
}

export default async function V2ExplorePage({ params }: Props) {
  const { type, slug } = await params;
  const node = v2Graph.getNodeByRoute(type, slug);
  if (!node) notFound();
  const canonicalView = buildNodePageView(v2Graph, node.id);
  const parentViews = Object.fromEntries(
    canonicalView.parents.map((parent) => [
      parent.node.id,
      buildNodePageView(v2Graph, node.id, parent.node.id),
    ]),
  );
  return (
    <Suspense fallback={<V2FocusView view={canonicalView} />}>
      <V2NodePageClient
        canonicalView={canonicalView}
        parentViews={parentViews}
      />
    </Suspense>
  );
}
