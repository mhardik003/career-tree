import type { Metadata } from "next";
import { v2Graph } from "@/lib/v2/data";
import V2Directory from "./V2Directory";

export const metadata: Metadata = {
  title: "Career Graph V2 Preview — Career Tree",
  description: "Browse the canonical Career Tree v2 graph preview.",
};

export default function V2DirectoryPage() {
  return <V2Directory nodes={v2Graph.directoryNodes()} />;
}
