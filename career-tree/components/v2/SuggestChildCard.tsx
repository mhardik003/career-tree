"use client";

import { Plus } from "lucide-react";
import { useRef, useState } from "react";
import SuggestionDialog from "./SuggestionDialog";

export default function SuggestChildCard({
  parentNodeId,
  parentTitle,
}: {
  parentNodeId: string;
  parentTitle: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);

  // The dialog only handles Escape; without this the closing node would strand
  // focus on <body> mid-grid.
  function close() {
    setIsOpen(false);
    trigger.current?.focus();
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label={`Suggest a further option after ${parentTitle}`}
        className="mx-auto flex w-64 flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-black/20 p-4 text-gray-500 transition hover:-translate-y-1 hover:border-black hover:text-black"
      >
        <Plus size={18} aria-hidden="true" />
        <span className="font-mono text-sm font-bold">
          Suggest a further option
        </span>
      </button>
      <SuggestionDialog
        isOpen={isOpen}
        onClose={close}
        parentNodeId={parentNodeId}
        parentTitle={parentTitle}
      />
    </>
  );
}
