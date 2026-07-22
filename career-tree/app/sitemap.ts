import type { MetadataRoute } from "next";
import { BASE_URL } from "@/lib/site";
import { v2Graph } from "@/lib/v2/data";
import { nodeHref } from "@/lib/v2/urls";

export default function sitemap(): MetadataRoute.Sitemap {
  // Google uses <lastmod> to prioritise recrawls, so every entry carries one.
  // The export stamps the graph build time; per-node dates come from the
  // pipeline's provenance so an unchanged node keeps a stable date.
  // An unparseable date must drop <lastmod> rather than emit "Invalid Date".
  const asDate = (value: string | undefined): Date | undefined => {
    const date = new Date(value ?? "");
    return Number.isNaN(date.valueOf()) ? undefined : date;
  };
  const built = asDate(v2Graph.generatedAt);
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, lastModified: built, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE_URL}/map`, lastModified: built, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE_URL}/search`, lastModified: built, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE_URL}/about`, lastModified: built, changeFrequency: "monthly", priority: 0.5 },
  ];
  const guideRoutes: MetadataRoute.Sitemap = v2Graph.nodes.map((node) => ({
    url: `${BASE_URL}${nodeHref(node.id)}`,
    lastModified: asDate(node.prov?.generated_at) ?? built,
    changeFrequency: "weekly",
    priority: 0.7,
  }));
  return [...staticRoutes, ...guideRoutes];
}
