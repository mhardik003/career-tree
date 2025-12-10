import treeData from '../data/career_tree_data.json';
import metadataJson from '../data/metadata.json'; // Direct import for SSG
import dagre from 'dagre'; 

export type CareerNode = {
  node_title: string;
  is_terminal: boolean;
  description: string;
  // FIX 1: Allow string OR null
  avg_duration_years: string | null; 
  difficulty_rating: number;
  search_keywords: string[];
  children: string[];
};

export type NodeMetadata = {
  exams_to_give: string[] | null;
  certifications: string[] | null;
  qualifications_needed: string[] | null;
  avg_cost_inr: string | null ;
  top_colleges_or_companies: string[] | null;
  tools_and_resources: string[] | null;
  duration_years: string | null;
  real_life_applications:string[] | null;
};

// FIX 2: Double cast to bypass the "overlap" error
// We first cast to 'unknown', then to the specific Record type
const fullData = treeData as unknown as Record<string, CareerNode>;
const fullMetadata = metadataJson as Record<string, NodeMetadata>;


export const slugify = (text: string) => 
  text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

// ... (Rest of the file remains exactly the same) ...


export const findNodeBySlug = (urlSegments: string[]) => {
  
  // 1. Find the Root based on the first slug
  const rootKey = Object.keys(fullData).find(k => slugify(k) === urlSegments[0]);
  
  // If we can't even find the root, return 404 immediately
  if (!rootKey) return { status: '404' };

  let currentKey = rootKey;
  
  // 2. Traverse down the path
  for (let i = 1; i < urlSegments.length; i++) {
    const targetSlug = urlSegments[i];
    
    // Safety check: Does currentKey exist?
    if (!fullData[currentKey]) {
        return { status: '404' };
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
          status: 'pending',
          name: matchingChildName,
          parent: { key: currentKey, data: fullData[currentKey] }, // Safe because we checked fullData[currentKey] above
          slugs: urlSegments
        };
      }
    } else {
      return { status: '404' }; // Child not found in parent's list
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
  if (!fullData[currentKey]) return { status: '404' };

  return {
    status: 'found',
    key: currentKey,
    data: fullData[currentKey],
    parent: parentNode,
    slugs: urlSegments
  };
};

export const getGraphData = () => {
  const nodes: any[] = [];
  const edges: any[] = [];
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  dagreGraph.setGraph({ rankdir: 'LR' });

  Object.entries(fullData).forEach(([key, value]) => {
    dagreGraph.setNode(key, { width: 170, height: 50 });
    nodes.push({
      id: key,
      data: { label: value.node_title, isTerminal: value.is_terminal },
      position: { x: 0, y: 0 },
      type: 'default',
      style: { 
        background: value.is_terminal ? '#f0fdf4' : '#fff', 
        border: value.is_terminal ? '1px solid #22c55e' : '1px solid black',
        borderRadius: '5px',
        fontSize: '10px',
        width: 170
      }
    });

    value.children.forEach(child => {
      const childKey = `${key}/${child}`;
      if (fullData[childKey]) {
        dagreGraph.setEdge(key, childKey);
        edges.push({
          id: `${key}-${childKey}`,
          source: key,
          target: childKey,
          type: 'smoothstep',
          animated: false,
          style: { stroke: '#b1b1b7' }
        });
      }
    });
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.position = {
      x: nodeWithPosition.x - 170 / 2,
      y: nodeWithPosition.y - 50 / 2,
    };
    return node;
  });

  return { nodes: layoutedNodes, edges };
};

export const getMetadataForKey = (key: string): NodeMetadata | null => {
  return fullMetadata[key] || null;
};