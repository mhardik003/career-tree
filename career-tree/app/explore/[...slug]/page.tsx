import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { findNodeBySlug, getMetadataForKey, getAllNodeSlugs, getCanonicalInfo, getBreadcrumbTrail } from "@/lib/treeUtils";
import { BASE_URL } from "@/lib/site";
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
    // Page-level openGraph replaces the root layout's object wholesale (no deep
    // merge), so siteName/type must be repeated here.
    openGraph: {
      title,
      description,
      url: canonicalPath,
      siteName: 'Career Tree',
      type: 'website',
      // Per-node card rendered on demand by app/og/[...slug]/route.tsx.
      images: [{ url: `/og/${slug.join('/')}`, width: 1200, height: 630, alt: title }],
    },
  };
}

export default async function ExplorePage({ params }: { params: Promise<{ slug: string[] }> }) {
  const { slug } = await params;

  const result = findNodeBySlug(slug);

  if (result.status === '404') notFound();

  if (result.status === 'pending') {
    // No JSON-LD here: pending pages are noindexed, the breadcrumb is UX only.
    return (
      <PendingNode
        name={result.name}
        parentTitle={result.parent.data.node_title}
        ancestors={getBreadcrumbTrail(result.parent.key, slug.slice(0, -1))}
      />
    );
  }

  const { key, data, parent } = result;

  // Root→current trail; the last crumb is the current page itself.
  const trail = getBreadcrumbTrail(key, slug);

  // BreadcrumbList JSON-LD for SERP breadcrumb display. Absolute URLs are required:
  // JSON-LD lives outside the Metadata API, so metadataBase does not apply here.
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${BASE_URL}/` },
      ...trail.map((crumb, i) => ({
        "@type": "ListItem",
        position: i + 2,
        name: crumb.title,
        item: `${BASE_URL}${crumb.href}`,
      })),
    ],
  };

  return (
    <>
      {/* Escaped `<` guards against </script> breakout, since names come from data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbLd).replace(/</g, "\\u003c"),
        }}
      />
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
        ancestors={trail.slice(0, -1)}
      />
    </>
  );
}
