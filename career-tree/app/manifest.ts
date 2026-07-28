import type { MetadataRoute } from "next";

// Served at /manifest.webmanifest; Next auto-injects <link rel="manifest">.
// Completes icon coverage for PWA / "Add to Home Screen" surfaces — the
// search-result favicon reads the <link rel="icon"> tags from app/icon.png,
// not this file. Icons point at unambiguous public/ files rather than
// /icon.png, which collides between public/icon.png and the app/icon.png
// metadata route.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Career Tree",
    short_name: "Career Tree",
    description:
      "An open, source-backed map of education and career routes in India.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#173929",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/logo.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
