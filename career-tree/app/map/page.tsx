import type { Metadata } from "next";
import { v2Graph } from "@/lib/v2/data";
import { buildGlobalMap } from "@/lib/v2/global-map";
import MapView from "./MapView";

export const metadata: Metadata = {
  title: "Career Map – Every Route from Class 10 Onward",
  description:
    "The full Career Tree graph in one view: school stages, streams, exams, degrees, and job roles, with every progression and exam gate between them.",
  alternates: { canonical: "/map" },
};

export default function GlobalMap() {
  return <MapView model={buildGlobalMap(v2Graph)} />;
}
