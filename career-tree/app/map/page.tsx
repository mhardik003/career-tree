import { getGraphData } from '@/lib/treeUtils';
import MapView from './MapView';

// Dagre layout for all nodes runs here at build time; only the laid-out
// positions and labels are sent to the client.
export default function GlobalMap() {
  const { nodes, edges } = getGraphData();
  return <MapView initialNodes={nodes} initialEdges={edges} />;
}
