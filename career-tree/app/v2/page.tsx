import type { Metadata } from "next";
import CareerDirectory from "@/components/v2/CareerDirectory";
import { v2Graph } from "@/lib/v2/data";

export const metadata: Metadata = {
  title: "Career Graph V2 Preview — Career Tree",
  description: "Browse the canonical Career Tree v2 graph preview.",
};

export default function V2DirectoryPage() {
  return <CareerDirectory nodes={v2Graph.directoryNodes()} />;
}
