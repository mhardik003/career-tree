import 'server-only';
import treeData from '../data/career_tree_data.json';
import metadataJson from '../data/metadata.json';
import dagre from 'dagre';
import { slugify } from './slugify';
import type { CareerNode, NodeMetadata, GraphNode, GraphEdge, BreadcrumbItem } from './types';

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

// Root→node breadcrumb trail, inclusive of the node itself. `key` and `slugs` must
// describe the same path (as returned by findNodeBySlug), one slug per key segment.
// Every ancestor prefix of a found key is guaranteed present; `?? segment` is defensive only.
export const getBreadcrumbTrail = (key: string, slugs: string[]): BreadcrumbItem[] => {
  const segments = key.split('/');
  return segments.map((segment, i) => ({
    title: getNodeByKey(segments.slice(0, i + 1).join('/'))?.node_title ?? segment,
    href: '/explore/' + slugs.slice(0, i + 1).join('/'),
  }));
};

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

// Canonical index: the same career title appears at many paths (334+ duplicate groups),
// so every key maps to one "primary" key per slugified title — fewest path segments,
// then has rich metadata, then most children, then lexicographic (fully deterministic).
// Assumed data invariants (hold for all 2,703 keys today; data is Gemini-regenerated):
// no two keys share a slug path, and slugify(node_title) === slugify(last path segment),
// so a primary's slug URL is guaranteed to serve the primary node.
const canonicalKeyByKey: Map<string, string> = (() => {
  const groups = new Map<string, string[]>();
  for (const key of Object.keys(fullData)) {
    const titleSlug = slugify(fullData[key].node_title);
    const group = groups.get(titleSlug);
    if (group) group.push(key);
    else groups.set(titleSlug, [key]);
  }
  const canonical = new Map<string, string>();
  for (const keys of groups.values()) {
    let candidates = keys;
    const minSegments = Math.min(...candidates.map(k => k.split('/').length));
    candidates = candidates.filter(k => k.split('/').length === minSegments);
    if (candidates.length > 1) {
      const withMeta = candidates.filter(k => fullMetadata[k]);
      if (withMeta.length > 0) candidates = withMeta;
    }
    if (candidates.length > 1) {
      const maxChildren = Math.max(...candidates.map(k => fullData[k].children.length));
      candidates = candidates.filter(k => fullData[k].children.length === maxChildren);
    }
    const primary = [...candidates].sort()[0];
    for (const key of keys) canonical.set(key, primary);
  }
  return canonical;
})();

export const getCanonicalInfo = (key: string) => {
  const canonicalKey = canonicalKeyByKey.get(key) ?? key;
  return {
    isPrimary: canonicalKey === key,
    canonicalKey,
    canonicalPath: '/explore/' + canonicalKey.split('/').map(slugify).join('/'),
  };
};

// Slug paths of primary/unique nodes only — the sitemap must not advertise URLs whose
// canonical points elsewhere. generateStaticParams keeps using getAllNodeSlugs().
export const getCanonicalNodeSlugs = (): string[][] =>
  Object.keys(fullData)
    .filter(key => canonicalKeyByKey.get(key) === key)
    .map(key => key.split('/').map(slugify));
