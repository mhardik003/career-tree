import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Career Tree – Open Source Career Intelligence",
  description:
    "Visualize career paths, prerequisites, and opportunities in the Indian education system using open source career intelligence.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Google Search Console Verification */}
        <meta
          name="google-site-verification"
          content="zesGb3rIFh9nfH700WwJH2Nt-pcRvL1fVc1_W80HoSg"
        />

        {/* WebApplication Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: "Career Tree",
              url: "https://career-tree.vercel.app/",
              description:
                "An open source career intelligence platform that visualizes career paths and educational prerequisites within the Indian education system.",
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
              name: "Career Tree – Career Path Visualization",
              url: "https://career-tree.vercel.app/",
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
