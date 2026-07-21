import "server-only";
import { readFile } from "fs/promises";
import { join } from "path";

// Shared bits for the OG image route handlers (app/og/route.tsx and
// app/og/[...slug]/route.tsx). Route handlers instead of the opengraph-image
// file convention because Turbopack cannot place a metadata file inside a
// catch-all segment ("Invalid segment ... catch all segment must be the last").
// Satori (behind ImageResponse) only understands flexbox, so every multi-child
// div sets display: 'flex'.

export const OG_SIZE = { width: 1200, height: 630 };

// Images only change when the data changes, which only happens on deploy, and
// Vercel purges its edge cache on every deployment — so let the CDN keep them.
export const OG_CACHE_HEADERS = {
  "Cache-Control": "public, max-age=86400, s-maxage=31536000, stale-while-revalidate=604800",
};

// Matches the app's green accent (Tailwind green-600).
export const OG_GREEN = "#16a34a";
export const OG_GRAY = "#6b7280";

type OgFont = {
  name: string;
  data: Buffer;
  weight: 400 | 600;
  style: "normal";
};

// Static TTF instances (Satori can't read variable fonts). The
// join(process.cwd(), '<literal>') shape is statically analyzable, which is
// what makes Vercel's output file tracing bundle the fonts — don't refactor
// the paths into variables.
let fontsPromise: Promise<OgFont[]> | null = null;

export const loadOgFonts = (): Promise<OgFont[]> => {
  fontsPromise ??= Promise.all([
    readFile(join(process.cwd(), "assets/fonts/Inter-Regular.ttf")),
    readFile(join(process.cwd(), "assets/fonts/Inter-SemiBold.ttf")),
  ]).then(([regular, semiBold]) => [
    { name: "Inter", data: regular, weight: 400, style: "normal" },
    { name: "Inter", data: semiBold, weight: 600, style: "normal" },
  ]);
  return fontsPromise;
};

// Site-wide brand card for the root OG endpoint.
export const defaultBrandCard = () => (
  <div
    style={{
      width: "100%",
      height: "100%",
      display: "flex",
      backgroundColor: "#ffffff",
      padding: 40,
      fontFamily: "Inter",
    }}
  >
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        border: "2px solid #000000",
      }}
    >
      <div style={{ width: 24, height: 24, backgroundColor: OG_GREEN, marginBottom: 32 }} />
      <div style={{ fontSize: 96, fontWeight: 600, color: "#000000", lineHeight: 1 }}>
        Career Tree
      </div>
      <div style={{ fontSize: 34, fontWeight: 400, color: OG_GRAY, marginTop: 24 }}>
        Canonical, Source-Backed Career Guides
      </div>
    </div>
  </div>
);
