import type { Metadata } from "next";
import { notFound } from "next/navigation";
import V2FocusView from "@/components/v2/V2FocusView";
import { v2Graph } from "@/lib/v2/data";
import { buildNodePageView } from "@/lib/v2/routes";

interface Props {
  params: Promise<{ type: string; slug: string }>;
  searchParams: Promise<{ from?: string | string[] }>;
}

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
    title: `${node.title} — V2 Career Tree Preview`,
    description: node.description,
  };
}

export default async function V2NodePage({ params, searchParams }: Props) {
  const { type, slug } = await params;
  const query = await searchParams;
  const node = v2Graph.getNodeByRoute(type, slug);
  if (!node) notFound();
  const requestedFrom = Array.isArray(query.from) ? query.from[0] : query.from;
  return (
    <V2FocusView
      view={buildNodePageView(v2Graph, node.id, requestedFrom)}
    />
  );
}
