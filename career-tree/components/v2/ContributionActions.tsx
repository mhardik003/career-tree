"use client";

import { useState } from "react";
import type { V2Node } from "@/lib/v2/types";
import EditDialog from "./EditDialog";
import SuggestionDialog from "./SuggestionDialog";

export default function ContributionActions({ node }: { node: V2Node }) {
  const [open, setOpen] = useState<"suggestion" | "edit" | null>(null);

  return (
    <section className="mt-10 rounded-xl border bg-neutral-50 p-5" aria-labelledby="contribution-title">
      <h2 id="contribution-title" className="font-mono text-sm font-bold">Help improve this guide</h2>
      <p className="mt-2 text-sm text-gray-600">Community submissions are reviewed before they change the canonical graph.</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <button type="button" onClick={() => setOpen("suggestion")} className="rounded-md bg-black px-4 py-2 font-mono text-xs text-white">
          Suggest a next option
        </button>
        <button type="button" onClick={() => setOpen("edit")} className="rounded-md border border-black bg-white px-4 py-2 font-mono text-xs">
          Suggest an edit
        </button>
      </div>
      <SuggestionDialog
        isOpen={open === "suggestion"}
        onClose={() => setOpen(null)}
        parentNodeId={node.id}
        parentTitle={node.title}
      />
      <EditDialog isOpen={open === "edit"} onClose={() => setOpen(null)} node={node} />
    </section>
  );
}
