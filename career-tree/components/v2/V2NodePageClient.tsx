"use client";

import { useSearchParams } from "next/navigation";
import type { V2NodePageView } from "@/lib/v2/types";
import V2FocusView from "./V2FocusView";

interface Props {
  canonicalView: V2NodePageView;
  parentViews: Record<string, V2NodePageView>;
}

export default function V2NodePageClient({
  canonicalView,
  parentViews,
}: Props) {
  const requestedParentId = useSearchParams().get("from");
  const view =
    requestedParentId && Object.hasOwn(parentViews, requestedParentId)
      ? parentViews[requestedParentId]
      : canonicalView;
  return <V2FocusView view={view} />;
}
