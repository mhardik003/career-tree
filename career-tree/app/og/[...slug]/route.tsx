import { ImageResponse } from 'next/og';
import { findNodeBySlug } from '@/lib/treeUtils';
import { OG_SIZE, OG_GREEN, OG_GRAY, OG_CACHE_HEADERS, defaultBrandCard, loadOgFonts } from '@/lib/og';

// Per-node OG image, rendered on demand (no generateStaticParams: opting the
// ~2,700 node paths into build-time renders would balloon build time/output).
// Referenced from generateMetadata's openGraph.images on node pages.

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await params;
  const fonts = await loadOgFonts();
  const result = findNodeBySlug(slug);

  // Pending/404 paths still get a valid image — never a 500.
  if (result.status !== 'found') {
    return new ImageResponse(defaultBrandCard(), {
      ...OG_SIZE,
      fonts,
      headers: OG_CACHE_HEADERS,
    });
  }

  const node = result.data;
  const title = node.node_title;
  // Step the size down for long titles; the container below clamps to ~3 lines.
  const titleFontSize = title.length > 80 ? 48 : title.length > 40 ? 56 : 68;
  const titleLineHeight = 1.15;
  const duration = node.avg_duration_years ?? 'Variable';

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          backgroundColor: '#ffffff',
          padding: 40,
          fontFamily: 'Inter',
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            border: '2px solid #000000',
            padding: '48px 56px',
          }}
        >
          {/* Brand mark + terminal badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 18, height: 18, backgroundColor: OG_GREEN }} />
              <div
                style={{
                  fontSize: 26,
                  fontWeight: 600,
                  letterSpacing: 6,
                  color: '#000000',
                }}
              >
                CAREER TREE
              </div>
            </div>
            {node.is_terminal && (
              <div
                style={{
                  display: 'flex',
                  fontSize: 20,
                  fontWeight: 600,
                  letterSpacing: 3,
                  color: '#ffffff',
                  backgroundColor: OG_GREEN,
                  padding: '10px 20px',
                }}
              >
                CAREER DESTINATION
              </div>
            )}
          </div>

          {/* Title + context line */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              flexGrow: 1,
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                maxHeight: Math.round(titleFontSize * titleLineHeight * 3),
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  fontSize: titleFontSize,
                  fontWeight: 600,
                  lineHeight: titleLineHeight,
                  color: '#000000',
                }}
              >
                {title}
              </div>
            </div>
            {result.parent && (
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 400,
                  color: OG_GRAY,
                  marginTop: 20,
                }}
              >
                {`after ${result.parent.data.node_title}`}
              </div>
            )}
          </div>

          {/* Stat pills */}
          <div style={{ display: 'flex', gap: 20 }}>
            <div
              style={{
                display: 'flex',
                border: '2px solid #000000',
                borderRadius: 9999,
                padding: '12px 28px',
                fontSize: 26,
                fontWeight: 400,
                color: '#000000',
              }}
            >
              {`Difficulty ${node.difficulty_rating}/10`}
            </div>
            <div
              style={{
                display: 'flex',
                border: '2px solid #000000',
                borderRadius: 9999,
                padding: '12px 28px',
                fontSize: 26,
                fontWeight: 400,
                color: '#000000',
              }}
            >
              {`Duration: ${duration}`}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts,
      headers: OG_CACHE_HEADERS,
    }
  );
}
