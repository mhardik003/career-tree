import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { BASE_URL } from "@/lib/site";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" });

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: "Career Tree – Open Source Career Intelligence",
  description:
    "Explore canonical career nodes, reconverging routes, and source-backed guides for the Indian education and career context.",
  openGraph: {
    siteName: "Career Tree",
    type: "website",
    url: "/",
    title: "Career Tree – Open Source Career Intelligence",
    description:
      "Explore canonical career nodes, reconverging routes, and source-backed guides for the Indian education and career context.",
    // Rendered by app/og/route.tsx; node pages override with /og/<slugs>.
    images: [
      {
        url: "/og",
        width: 1200,
        height: 630,
        alt: "Career Tree – Open Source Career Intelligence",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Google Search Console Verification — careerstree.in */}
        <meta
          name="google-site-verification"
          content="tgfTJEDCWbKv0qGT4zNNn8MQ_VcqvZ7eGAMLfeiYtS8"
        />

        {/* WebApplication Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "Career Tree",
              url: `${BASE_URL}/`,
              description:
                "An open source platform for canonical career routes and source-backed educational guidance in the Indian context.",
              applicationCategory: "EducationalApplication",
              operatingSystem: "All",
              browserRequirements: "Requires JavaScript",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "INR",
              },
            }),
          }}
        />

        {/* Learning Resource Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "LearningResource",
              name: "Career Tree – Canonical Career Guides",
              url: `${BASE_URL}/`,
              learningResourceType: "Career Exploration Tool",
              educationalLevel: [
                "High School",
                "Undergraduate",
                "Graduate",
                "Professional",
              ],
              audience: {
                "@type": "Audience",
                audienceType:
                  "Students, job seekers, and career switchers",
              },
              isAccessibleForFree: true,
              inLanguage: "en-IN",
            }),
          }}
        />
      </head>

      <body
        suppressHydrationWarning={true}
        className={`${inter.variable} ${mono.variable} font-sans bg-white text-black antialiased`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
