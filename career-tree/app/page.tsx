import Link from "next/link";
import { ArrowRight, Database, GitFork, Globe, Users } from "lucide-react";
import CareerDirectory from "@/components/v2/CareerDirectory";
import SearchCareerButton from "@/components/v2/SearchCareerButton";
import { getSupabase } from "@/lib/supabase";
import { v2Graph } from "@/lib/v2/data";
import { exploreHref } from "@/lib/v2/urls";

export const revalidate = 300;

async function getStats() {
  try {
    const supabase = getSupabase();
    const [suggestions, edits] = await Promise.all([
      supabase.from("suggestions").select("*", { count: "exact", head: true }),
      supabase.from("edits").select("*", { count: "exact", head: true }),
    ]);
    if (suggestions.error) throw suggestions.error;
    if (edits.error) throw edits.error;
    return { suggestions: suggestions.count ?? 0, edits: edits.count ?? 0 };
  } catch (error) {
    console.error("Failed to fetch stats from Supabase:", error);
    return { suggestions: 0, edits: 0 };
  }
}

export default async function Home() {
  const stats = await getStats();

  return (
    <div className="min-h-screen bg-white font-sans text-black selection:bg-black selection:text-white">
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.03]"
        style={{
          backgroundImage: "linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />
      <main className="relative z-10 mx-auto max-w-6xl px-6 pb-12 pt-24">
        <section className="flex flex-col items-center gap-8 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-gray-50 px-3 py-1 font-mono text-xs uppercase tracking-widest text-gray-500">
            <Globe size={12} aria-hidden="true" />
            Open source career intelligence
          </div>
          <h1 className="max-w-4xl text-5xl font-bold tracking-tight md:text-7xl">
            Don&apos;t just follow a path. <br />
            <span className="bg-gradient-to-r from-gray-500 to-black bg-clip-text text-transparent">
              Understand it.
            </span>
          </h1>
          <p className="max-w-2xl text-xl font-light leading-relaxed text-gray-600 md:text-2xl">
            Explore canonical routes through education, exams, and careers, then read
            source-backed guides for every option you consider.
          </p>
          <div className="mt-4 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href={exploreHref(v2Graph.rootId)}
              className="group inline-flex items-center justify-center gap-3 rounded-lg bg-black px-6 py-3 font-mono text-sm text-white shadow-xl transition hover:-translate-y-0.5 hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
            >
              Start exploring from Class 10
              <ArrowRight aria-hidden="true" className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <SearchCareerButton />
          </div>
          <div className="flex items-center gap-6 rounded-full border border-gray-200 bg-white/70 px-6 py-2 font-mono text-xs text-gray-500 backdrop-blur-sm">
            <span><strong className="text-black">{stats.suggestions}</strong> paths proposed</span>
            <span className="h-4 w-px bg-gray-300" aria-hidden="true" />
            <span><strong className="text-black">{stats.edits}</strong> community edits</span>
          </div>
          <p className="font-mono text-xs text-gray-400">
            Currently mapped for the Indian education system
          </p>
        </section>

        <CareerDirectory nodes={v2Graph.directoryNodes()} />

        <section className="mt-24 grid gap-12 border-t border-gray-100 pt-16 md:grid-cols-3">
          <Value icon={<GitFork aria-hidden="true" />} title="Canonical pathways">
            Follow stable routes across shared degrees, exams, specializations, and roles without duplicated path identities.
          </Value>
          <Value icon={<Database aria-hidden="true" />} title="Source-backed guides">
            Compare eligibility, admissions, responsibilities, and next options with citations beside the claims they support.
          </Value>
          <Value icon={<Users aria-hidden="true" />} title="Reviewed by community">
            Suggest missing options or improve a guide through a stable-ID review workflow before the graph changes.
          </Value>
        </section>

        <footer className="mt-32 flex items-center justify-between border-t border-black/10 pt-8 font-mono text-sm text-gray-500">
          <span>© 2026 Career Tree Project</span>
          <div className="flex gap-4">
            <Link href="/about" className="hover:text-black hover:underline">About</Link>
            <a href="https://github.com/mhardik003/career-tree" className="hover:text-black hover:underline">Contribute</a>
          </div>
        </footer>
      </main>
    </div>
  );
}

function Value({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
        {icon}
      </div>
      <h2 className="text-xl font-bold">{title}</h2>
      <p className="leading-relaxed text-gray-600">{children}</p>
    </div>
  );
}
