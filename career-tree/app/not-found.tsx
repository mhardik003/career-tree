import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex h-screen items-center justify-center font-mono flex-col gap-4">
      <h1 className="text-xl font-bold">404: Path Not Found</h1>
      <p className="text-gray-500">This path does not exist in our tree.</p>
      <Link href="/">
        <button className="flex items-center gap-2 text-sm font-mono text-gray-600 hover:text-black mt-4 transition-colors">
          <ArrowLeft size={16} /> BACK HOME
        </button>
      </Link>
    </div>
  );
}
