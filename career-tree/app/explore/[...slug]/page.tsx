import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { findNodeBySlug, getMetadataForKey, getAllNodeSlugs } from "@/lib/treeUtils";
import ExploreView from "./ExploreView";
import PendingNode from "./PendingNode";

export async function generateStaticParams() {
  return getAllNodeSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
  const { slug } = await params;
  const result = findNodeBySlug(slug);
  if (result.status !== 'found') return {};

  const title = `${result.data.node_title} — Career Tree`;
  const description = result.data.description.length > 160
    ? result.data.description.slice(0, 157) + '…'
    : result.data.description;

  return {
    title,
    description,
    openGraph: { title, description },
  };
}

export default async function ExplorePage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;

  const result = findNodeBySlug(slug);

  if (result.status === '404') notFound();

  if (result.status === 'pending') {
    return <PendingNode name={result.name} parentTitle={result.parent.data.node_title} />;
  }

  const { key, data, parent } = result;

  return (
    <ExploreView
      nodeKey={key}
      node={{
        node_title: data.node_title,
        description: data.description,
        avg_duration_years: data.avg_duration_years,
        difficulty_rating: data.difficulty_rating,
        is_terminal: data.is_terminal,
        children: data.children,
      }}
      parentTitle={parent?.data.node_title ?? null}
      richMetadata={getMetadataForKey(key)}
      slugs={slug}
    />
  );
}
