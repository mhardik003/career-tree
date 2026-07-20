"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import type { V2NodePageView, V2ParentContext } from "@/lib/v2/types";
import V2FocusView from "./V2FocusView";

interface Props {
  canonicalView: V2NodePageView;
  parentContexts: Record<string, V2ParentContext>;
}

export default function V2NodePageClient({
  canonicalView,
  parentContexts,
}: Props) {
  const requestedParentId = useSearchParams().get("from");
  const view = useMemo(() => {
    if (
      !requestedParentId ||
      !Object.hasOwn(parentContexts, requestedParentId)
    ) {
      return canonicalView;
    }
    return { ...canonicalView, ...parentContexts[requestedParentId] };
  }, [canonicalView, parentContexts, requestedParentId]);
  return <V2FocusView view={view} />;
}
