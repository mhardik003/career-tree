import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function BackHomeLink() {
  return (
    <Link href="/" className="mb-12 inline-flex items-center gap-2 font-mono text-sm text-gray-500 hover:text-black">
      <ArrowLeft size={16} aria-hidden="true" /> Back home
    </Link>
  );
}
