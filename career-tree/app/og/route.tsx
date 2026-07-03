import { ImageResponse } from 'next/og';
import { OG_SIZE, OG_CACHE_HEADERS, defaultBrandCard, loadOgFonts } from '@/lib/og';

// Site-wide default OG image (/, /about, /map, ...), referenced from the root
// layout's openGraph.images. Node pages point at /og/<slugs> instead.

export async function GET() {
  return new ImageResponse(defaultBrandCard(), {
    ...OG_SIZE,
    fonts: await loadOgFonts(),
    headers: OG_CACHE_HEADERS,
  });
}
