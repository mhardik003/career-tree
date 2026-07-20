"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { exploreHref } from "@/lib/v2/urls";

function BackLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      aria-label="Back to career tree"
      className="rounded-full border bg-white p-2"
    >
      <ArrowLeft size={18} aria-hidden="true" />
    </Link>
  );
}

export function GuideBackLinkFallback({ nodeId }: { nodeId: string }) {
  return <BackLink href={exploreHref(nodeId)} />;
}

export default function GuideBackLink({
  nodeId,
  validParentIds,
}: {
  nodeId: string;
  validParentIds: string[];
}) {
  const requestedParentId = useSearchParams().get("from");
  const selectedParentId =
    requestedParentId && validParentIds.includes(requestedParentId)
      ? requestedParentId
      : undefined;

  return <BackLink href={exploreHref(nodeId, selectedParentId)} />;
}
