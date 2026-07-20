import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import CareerDirectory from "@/components/v2/CareerDirectory";
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
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.03]"
        style={{
          backgroundImage: "linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <div className="relative mx-auto max-w-6xl px-6 pt-12">
        <Link href="/" className="mb-12 inline-flex items-center gap-2 font-mono text-sm text-gray-500 hover:text-black">
          <ArrowLeft size={16} aria-hidden="true" /> Back home
        </Link>
        <CareerDirectory nodes={v2Graph.directoryNodes()} />
      </div>
    </main>
  );
}
