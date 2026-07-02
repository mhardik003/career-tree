import type { MetadataRoute } from 'next';
import { getCanonicalNodeSlugs } from '@/lib/treeUtils';
import { BASE_URL } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${BASE_URL}/map`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/about`, changeFrequency: 'monthly', priority: 0.5 },
  ];

  const nodeRoutes: MetadataRoute.Sitemap = getCanonicalNodeSlugs().map((slugs) => ({
    url: `${BASE_URL}/explore/${slugs.join('/')}`,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  return [...staticRoutes, ...nodeRoutes];
}
