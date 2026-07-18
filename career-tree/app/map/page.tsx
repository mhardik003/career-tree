import { v2Graph } from "@/lib/v2/data";
import { buildGlobalMap } from "@/lib/v2/global-map";
import MapView from "./MapView";

export default function GlobalMap() {
  return <MapView model={buildGlobalMap(v2Graph)} />;
}
