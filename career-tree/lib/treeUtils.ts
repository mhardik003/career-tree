import 'server-only';
import treeData from '../data/career_tree_data.json';
import metadataJson from '../data/metadata.json';
import dagre from 'dagre';
import { slugify } from './slugify';
import type { CareerNode, NodeMetadata, GraphNode, GraphEdge } from './types';

export type { CareerNode, NodeMetadata } from './types';

// FIX 2: Double cast to bypass the "overlap" error
// We first cast to 'unknown', then to the specific Record type
const fullData = treeData as unknown as Record<string, CareerNode>;
const fullMetadata = metadataJson as unknown as Record<string, NodeMetadata>;


export const findNodeBySlug = (urlSegments: string[]) => {

  // 1. Find the Root based on the first slug
  const rootKey = Object.keys(fullData).find(k => slugify(k) === urlSegments[0]);

  // If we can't even find the root, return 404 immediately
  if (!rootKey) return { status: '404' as const };

  let currentKey = rootKey;

  // 2. Traverse down the path
  for (let i = 1; i < urlSegments.length; i++) {
    const targetSlug = urlSegments[i];

    // Safety check: Does currentKey exist?
    if (!fullData[currentKey]) {
        return { status: '404' as const };
    }

    const node = fullData[currentKey];

    // Find matching child name from the children array
    const matchingChildName = node.children.find(child => slugify(child) === targetSlug);

    if (matchingChildName) {
      const nextKey = `${currentKey}/${matchingChildName}`;

      // CRITICAL CHECK: Does the child actually have data in the JSON?
      if (fullData[nextKey]) {
        currentKey = nextKey;
      } else {
        // CASE: PENDING (Ghost Node)
        return {
          status: 'pending' as const,
          name: matchingChildName,
          parent: { key: currentKey, data: fullData[currentKey] }, // Safe because we checked fullData[currentKey] above
          slugs: urlSegments
        };
      }
    } else {
      return { status: '404' as const }; // Child not found in parent's list
    }
  }

  // 3. Get Parent Data (The Fix)
  const parentKey = currentKey.includes('/')
    ? currentKey.substring(0, currentKey.lastIndexOf('/'))
    : null;

  // SAFETY FIX: We strictly check if fullData[parentKey] exists.
  // If parentKey is string but data is missing, we treat parent as null.
  const parentNode = (parentKey && fullData[parentKey])
    ? { key: parentKey, data: fullData[parentKey] }
    : null;

  // Final check to ensure current node data exists
  if (!fullData[currentKey]) return { status: '404' as const };

  return {
    status: 'found' as const,
    key: currentKey,
    data: fullData[currentKey],
    parent: parentNode,
    slugs: urlSegments
  };
};

export const getGraphData = (): { nodes: GraphNode[]; edges: GraphEdge[] } => {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: 'TB' });

  // Numeric ids keep the serialized payload small; dagre stays keyed by full paths.
  const keys = Object.keys(fullData);
  const indexOf = new Map(keys.map((key, i) => [key, String(i)]));

  keys.forEach((key) => {
    const value = fullData[key];
    dagreGraph.setNode(key, { width: 170, height: 50 });
    nodes.push({
      id: indexOf.get(key)!,
      position: { x: 0, y: 0 },
      data: {
        label: value.node_title,
        isTerminal: value.is_terminal,
        href: '/explore/' + key.split('/').map(slugify).join('/')
      }
    });

    const depth = (key.match(/\//g) || []).length;
    value.children.forEach(child => {
      const childKey = `${key}/${child}`;
      if (fullData[childKey]) {
        dagreGraph.setEdge(key, childKey);
        const source = indexOf.get(key)!;
        const target = indexOf.get(childKey)!;
        edges.push({
          id: `${source}-${target}`,
          source,
          target,
          data: { depth }
        });
      }
    });
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node, i) => {
    const nodeWithPosition = dagreGraph.node(keys[i]);
    node.position = {
      x: nodeWithPosition.x - 170 / 2,
      y: nodeWithPosition.y - 50 / 2,
    };
    return node;
  });

  return { nodes: layoutedNodes, edges };
};

export const getNodeByKey = (key: string): CareerNode | undefined => fullData[key];

export const getMetadataForKey = (key: string): NodeMetadata | null => {
  return fullMetadata[key] || null;
};

// Every node's URL as slug segments, for generateStaticParams / the sitemap.
// Deduped on the joined slug path: if two keys ever slugify identically, the first
// wins — matching findNodeBySlug's Object.keys().find() behavior at runtime.
export const getAllNodeSlugs = (): string[][] => {
  const seen = new Set<string>();
  const out: string[][] = [];
  for (const key of Object.keys(fullData)) {
    const slugs = key.split('/').map(slugify);
    const joined = slugs.join('/');
    if (!seen.has(joined)) {
      seen.add(joined);
      out.push(slugs);
    }
  }
  return out;
};
