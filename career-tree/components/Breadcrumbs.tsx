import Link from "next/link";
import type { BreadcrumbItem } from "@/lib/types";

interface BreadcrumbsProps {
  items: BreadcrumbItem[]; // linked ancestors, root-first (excluding Home and the current node)
  current: string; // current page title, rendered unlinked
}

// Plain presentational breadcrumb trail — no "use client", no hooks, so both server
// pages and client views can render it. Depth can reach 12 (13 crumbs with Home):
// crumbs wrap and truncate (full title on hover) rather than collapsing, so every
// ancestor link stays crawlable.
export default function Breadcrumbs({ items, current }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className="w-full mb-4">
      <ol className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 font-mono text-xs text-gray-400">
        <li className="flex items-center">
          <Link href="/" className="hover:text-black hover:underline">
            Home
          </Link>
        </li>
        {items.map((item) => (
          <li key={item.href} className="flex items-center gap-x-1.5 min-w-0">
            <span aria-hidden="true">/</span>
            <Link
              href={item.href}
              title={item.title}
              className="truncate max-w-[14ch] sm:max-w-[24ch] hover:text-black hover:underline"
            >
              {item.title}
            </Link>
          </li>
        ))}
        <li className="flex items-center gap-x-1.5 min-w-0">
          <span aria-hidden="true">/</span>
          <span
            aria-current="page"
            title={current}
            className="truncate max-w-[14ch] sm:max-w-[24ch] text-gray-600"
          >
            {current}
          </span>
        </li>
      </ol>
    </nav>
  );
}
