"use client";
import { Construction } from "lucide-react";

interface PendingNodeProps {
  name: string;
  parentTitle: string;
}

export default function PendingNode({ name, parentTitle }: PendingNodeProps) {
  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white border border-dashed border-gray-400 p-8 rounded-xl text-center">
        <div className="w-16 h-16 bg-yellow-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <Construction className="text-yellow-600" />
        </div>
        <h2 className="text-xl font-bold font-mono mb-2">{name}</h2>
        <p className="text-gray-600 mb-6">
          We know this path exists under <span className="font-semibold">{parentTitle}</span>,
          but our AI hasn&apos;t mapped the details for it yet.
        </p>
        <button onClick={() => history.back()} className="text-sm underline hover:text-black">
          Go Back
        </button>
      </div>
    </div>
  );
}
