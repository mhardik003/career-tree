"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle } from "lucide-react";
import type { V2NodePageView, V2ParentView } from "@/lib/v2/types";
import CompleteRoutes from "./CompleteRoutes";
import ParentCarousel from "./ParentCarousel";

export default function V2FocusView({
  view,
}: {
  view: V2NodePageView;
}) {
  const router = useRouter();
  const selectedId = view.selectedParentId ?? "";

  function selectParent(parent: V2ParentView) {
    router.replace(parent.contextHref, { scroll: false });
  }

  return (
    <main className="min-h-screen bg-neutral-50 pb-20 pt-10">
      <nav className="absolute left-4 right-4 top-4 mx-auto flex max-w-6xl items-center gap-3">
        <Link href="/v2">
          <Image
            src="/icon.png"
            width={32}
            height={32}
            alt="V2 directory"
          />
        </Link>
        <Link
          href={view.backHref}
          aria-label="Back along selected route"
          className="rounded-full border bg-white p-2"
        >
          <ArrowLeft size={20} />
        </Link>
        <span className="ml-auto rounded-full border px-3 py-1 font-mono text-[10px]">
          V2 PREVIEW
        </span>
      </nav>

      <div className="mx-auto mt-14 flex max-w-6xl flex-col items-center px-4">
        {view.parents.length > 0 && (
          <ParentCarousel
            currentTitle={view.node.title}
            parents={view.parents}
            selectedId={selectedId}
            onSelect={selectParent}
          />
        )}

        <article className="my-8 w-full max-w-2xl rounded-lg border-2 border-black bg-white p-6 shadow-xl">
          <p className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
            {view.node.type.replace("_", " ")} · canonical node
          </p>
          <h1 className="mt-2 font-mono text-2xl font-bold">
            {view.node.title}
          </h1>
          <p className="mt-3 leading-relaxed text-gray-600">
            {view.node.description}
          </p>
          <div className="mt-4 flex flex-wrap gap-4 border-t pt-4 font-mono text-[10px] text-gray-500">
            <span>{view.parents.length} incoming</span>
            <span>{view.children.length} next options</span>
            <span>{view.node.id}</span>
          </div>
        </article>

        <CompleteRoutes routes={view.routes} />

        {view.children.length ? (
          <section className="mt-8 w-full">
            <div className="mb-6 flex items-center justify-center gap-2 opacity-50">
              <div className="h-px w-10 bg-black" />
              <h2 className="font-mono text-xs uppercase tracking-widest">
                Career options after {view.node.title}
              </h2>
              <div className="h-px w-10 bg-black" />
            </div>
            <div className="relative grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {view.children.map(({ node, edge, href }) => (
                <Link
                  key={node.id}
                  href={href}
                  className="relative mx-auto block w-64 rounded-lg border border-black/10 bg-white p-4 transition hover:-translate-y-1 hover:border-black hover:shadow-md"
                >
                  <h3 className="font-mono text-sm font-bold">{node.title}</h3>
                  <p className="mt-2 text-[10px] uppercase text-gray-500">
                    {edge.edge_type.replace("_", " ")}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        ) : (
          <section className="mt-8 max-w-sm rounded-xl border border-green-200 bg-green-50 p-6 text-center">
            <CheckCircle className="mx-auto text-green-600" />
            <h2 className="mt-2 font-bold text-green-900">Career destination</h2>
            <p className="mt-1 text-sm text-green-800">
              No further options are mapped from this canonical node yet.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
