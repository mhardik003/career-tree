import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";


const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Career Tree",
  description: "Democratizing Career Counseling",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body 
      suppressHydrationWarning={true}
      className={`${inter.variable} ${mono.variable} font-sans bg-white text-black antialiased` 
      }>
        {children}
      </body>
    </html>
  );
}