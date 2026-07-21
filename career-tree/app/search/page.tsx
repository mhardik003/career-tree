import type { Metadata } from "next";
import BackHomeLink from "@/components/v2/BackHomeLink";
import CareerDirectory from "@/components/v2/CareerDirectory";
import GridBackground from "@/components/v2/GridBackground";
import { v2Graph } from "@/lib/v2/data";

export const metadata: Metadata = {
  title: "Search Careers – Career Tree",
  description:
    "Search every canonical career node — school stages, degrees, exams, and roles — with type filters and alias matching.",
  alternates: { canonical: "/search" },
};

export default function SearchPage() {
  return (
    <main className="min-h-screen bg-white pb-20 text-black selection:bg-black selection:text-white">
      <GridBackground />
      <div className="relative mx-auto max-w-6xl px-6 pt-12">
        <BackHomeLink />
        <CareerDirectory nodes={v2Graph.directoryNodes()} />
      </div>
    </main>
  );
}
