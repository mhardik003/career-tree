"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { exploreHref } from "@/lib/v2/urls";

export default function GuideBackLink({ nodeId }: { nodeId: string }) {
  const router = useRouter();

  function handleBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push(exploreHref(nodeId));
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label="Back to previous page"
      className="rounded-full border bg-white p-2"
    >
      <ArrowLeft size={18} aria-hidden="true" />
    </button>
  );
}
