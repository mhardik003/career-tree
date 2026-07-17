"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  filterDirectory,
  type DirectoryTypeFilter,
} from "@/lib/v2/search";
import type { V2DirectoryNode, V2NodeType } from "@/lib/v2/types";

function label(value: string): string {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function V2Directory({
  nodes,
}: {
  nodes: V2DirectoryNode[];
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState<DirectoryTypeFilter>("all");
  const types = useMemo(
    () => [...new Set(nodes.map((node) => node.type))].sort() as V2NodeType[],
    [nodes],
  );
  const results = useMemo(
    () => filterDirectory(nodes, query, type),
    [nodes, query, type],
  );

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-16">
      <div className="mx-auto max-w-5xl">
        <header className="text-center">
          <Link
            href="/"
            className="font-mono text-xs text-gray-500 hover:text-black"
          >
            ← Current site
          </Link>
          <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.16em] text-gray-500">
            Canonical career graph · V2 preview
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            Find a stage, degree, exam or career
          </h1>
          <p className="mt-3 text-sm text-gray-500">
            {nodes.length} unique canonical nodes
          </p>
          <input
            type="search"
            aria-label="Search canonical career nodes"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search titles and aliases…"
            className="mx-auto mt-6 block w-full max-w-2xl rounded-lg border bg-white px-4 py-3 outline-none focus:border-black focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
          />
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {(["all", ...types] as DirectoryTypeFilter[]).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={type === value}
                onClick={() => setType(value)}
                className={`rounded-full border px-3 py-1.5 font-mono text-[10px] uppercase ${
                  type === value
                    ? "border-black bg-black text-white"
                    : "bg-white text-gray-600"
                }`}
              >
                {label(value)}
              </button>
            ))}
          </div>
        </header>

        <p className="mt-10 font-mono text-xs text-gray-500">
          {results.length} matching nodes
        </p>
        <section className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          {results.length ? (
            results.map((node) => (
              <Link
                key={node.id}
                href={node.href}
                className="rounded-xl border bg-white p-5 transition hover:-translate-y-0.5 hover:border-black hover:shadow-md"
              >
                <p className="font-mono text-[9px] uppercase tracking-widest text-gray-500">
                  {label(node.type)}
                </p>
                <h2 className="mt-2 font-mono text-base font-bold">
                  {node.title}
                </h2>
                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-gray-600">
                  {node.description}
                </p>
                <p className="mt-4 font-mono text-[10px] uppercase text-gray-500">
                  {node.incomingCount} ways in · {node.outgoingCount} next
                </p>
              </Link>
            ))
          ) : (
            <p className="col-span-full rounded-lg border border-dashed bg-white p-8 text-center text-gray-500">
              No canonical nodes match this search.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
