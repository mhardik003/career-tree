import { ImageResponse } from "next/og";
import { OG_CACHE_HEADERS, OG_GRAY, OG_GREEN, OG_SIZE, loadOgFonts } from "@/lib/og";
import { v2Graph } from "@/lib/v2/data";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string[] }> },
) {
  const { slug } = await params;
  if (slug.length !== 2) return new Response(null, { status: 404 });
  const [type, nodeSlug] = slug;
  const node = v2Graph.getNodeByRoute(type, nodeSlug);
  if (!node) return new Response(null, { status: 404 });
  const fonts = await loadOgFonts();
  const titleFontSize = node.title.length > 80 ? 48 : node.title.length > 40 ? 56 : 68;

  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", backgroundColor: "#fff", padding: 40, fontFamily: "Inter" }}>
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", border: "2px solid #000", padding: "48px 56px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 18, height: 18, backgroundColor: OG_GREEN }} />
            <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: 6 }}>CAREER TREE</div>
          </div>
          <div style={{ display: "flex", border: `2px solid ${OG_GREEN}`, color: OG_GREEN, padding: "9px 18px", fontSize: 18, fontWeight: 600, letterSpacing: 3 }}>
            CANONICAL NODE
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, justifyContent: "center", overflow: "hidden" }}>
          <div style={{ display: "flex", fontSize: titleFontSize, fontWeight: 600, lineHeight: 1.1, maxHeight: Math.round(titleFontSize * 3.3), overflow: "hidden" }}>
            {node.title}
          </div>
          <div style={{ display: "flex", marginTop: 18, fontSize: 22, fontWeight: 600, textTransform: "uppercase", letterSpacing: 4, color: OG_GREEN }}>
            {node.type.replaceAll("_", " ")}
          </div>
          <div style={{ display: "flex", marginTop: 18, fontSize: 26, lineHeight: 1.35, color: OG_GRAY, maxHeight: 105, overflow: "hidden" }}>
            {node.description}
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 20, color: OG_GRAY }}>
          Source-backed career guide · Indian education and career context
        </div>
      </div>
    </div>,
    { ...OG_SIZE, fonts, headers: OG_CACHE_HEADERS },
  );
}
