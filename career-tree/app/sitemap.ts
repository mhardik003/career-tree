import type { MetadataRoute } from "next";
import { BASE_URL } from "@/lib/site";
import { v2Graph } from "@/lib/v2/data";
import { nodeHref } from "@/lib/v2/urls";

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE_URL}/map`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE_URL}/about`, changeFrequency: "monthly", priority: 0.5 },
  ];
  const guideRoutes: MetadataRoute.Sitemap = v2Graph.nodes.map((node) => ({
    url: `${BASE_URL}${nodeHref(node.id)}`,
    changeFrequency: "weekly",
    priority: 0.7,
  }));
  return [...staticRoutes, ...guideRoutes];
}
