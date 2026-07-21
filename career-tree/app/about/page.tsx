import Link from "next/link";
import { BookOpen, GitBranch, Heart, Map, Users } from "lucide-react";
import BackHomeLink from "@/components/v2/BackHomeLink";
import GridBackground from "@/components/v2/GridBackground";

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-white pb-20 text-black selection:bg-black selection:text-white">
      <GridBackground />
      <div className="relative mx-auto max-w-4xl px-6 pt-12">
        <BackHomeLink />

        <header className="mb-20 border-b border-black/10 pb-12">
          <h1 className="mb-6 text-5xl font-bold tracking-tighter md:text-6xl">
            The open career <span className="bg-gradient-to-r from-gray-500 to-black bg-clip-text text-transparent">graph.</span>
          </h1>
          <p className="max-w-2xl text-xl font-light leading-relaxed text-gray-600">
            Career Tree maps stable education and career options, the many routes that reach them, and evidence that helps people evaluate each choice.
          </p>
        </header>

        <section className="mb-20 grid gap-8 md:grid-cols-3">
          <Principle icon={<GitBranch />} title="Routes reconnect">
            A degree or role can have several valid entry routes. The graph represents one canonical node and preserves every useful relationship.
          </Principle>
          <Principle icon={<BookOpen />} title="Claims have sources">
            Guides place citations beside eligibility, admissions, responsibilities, and other claims, with a deduplicated source index for reference.
          </Principle>
          <Principle icon={<Users />} title="Changes are reviewed">
            Suggestions use stable IDs and enter a moderation workflow. Community input never mutates the public graph immediately.
          </Principle>
        </section>

        <section className="rounded-2xl bg-neutral-900 p-8 text-white">
          <Map className="mb-4" aria-hidden="true" />
          <h2 className="text-2xl font-bold">Built for the Indian context</h2>
          <p className="mt-3 max-w-2xl leading-relaxed text-gray-300">
            Start at Class 10, explore streams, exams, qualifications, jobs, government service, and entrepreneurship, then open a canonical guide whenever you need detail.
          </p>
          <Link href="/explore/school_stage/class-10" className="mt-6 inline-flex rounded-md bg-white px-5 py-3 font-mono text-sm text-black">
            Start exploring from Class 10
          </Link>
        </section>

        <footer className="mt-16 flex flex-col items-center border-t border-black/10 pt-12 text-center">
          <Heart className="mb-4 text-red-500" aria-hidden="true" />
          <h2 className="text-3xl font-bold">Open data, careful review.</h2>
          <a href="https://github.com/mhardik003/career-tree" target="_blank" rel="noreferrer noopener" className="mt-5 rounded-md border border-black px-5 py-3 font-mono text-sm">
            View the public repository
          </a>
        </footer>
      </div>
    </main>
  );
}

function Principle({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg border bg-gray-50">{icon}</div>
      <h2 className="font-bold">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-gray-600">{children}</p>
    </div>
  );
}
