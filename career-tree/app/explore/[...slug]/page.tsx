import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { findNodeBySlug, getMetadataForKey, getAllNodeSlugs, getCanonicalInfo } from "@/lib/treeUtils";
import ExploreView from "./ExploreView";
import PendingNode from "./PendingNode";

export async function generateStaticParams() {
  return getAllNodeSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string[] }> }): Promise<Metadata> {
  const { slug } = await params;
  const result = findNodeBySlug(slug);
  // Ghost nodes render a 200 placeholder but shouldn't be indexed until they're mapped.
  if (result.status === 'pending') return { robots: { index: false } };
  if (result.status !== 'found') return {};

  const { key, data, parent } = result;
  const { isPrimary, canonicalPath } = getCanonicalInfo(key);

  // Non-primary duplicates get parent context in the title so the same career at
  // different paths stops competing for one query; the parent's trailing parenthetical
  // is stripped to keep titles near the ~60-char SERP limit.
  const parentTitle = parent?.data.node_title.replace(/\s*\([^)]*\)\s*$/, '').trim();
  const title = isPrimary || !parentTitle
    ? `${data.node_title} — Career Tree`
    : `${data.node_title} after ${parentTitle} — Career Tree`;

  const rawDescription = data.description.trim()
    || `${data.node_title}: career paths, entrance exams, costs and colleges in the Indian education system — explore on Career Tree.`;
  const description = rawDescription.length > 160
    ? rawDescription.slice(0, 157) + '…'
    : rawDescription;

  return {
    title,
    description,
    keywords: data.search_keywords,
    alternates: { canonical: canonicalPath },
    openGraph: { title, description, url: canonicalPath },
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
        search_keywords: data.search_keywords,
      }}
      parentTitle={parent?.data.node_title ?? null}
      richMetadata={getMetadataForKey(key)}
      slugs={slug}
    />
  );
}
