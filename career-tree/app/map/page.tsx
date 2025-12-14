"use client";
import { useMemo, useCallback } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  useNodesState, 
  useEdgesState, 
  MiniMap,
  BackgroundVariant,
  Handle,
  Position,
  NodeProps,
  Edge
} from 'reactflow';
import 'reactflow/dist/style.css';
import { getGraphData, slugify } from '@/lib/treeUtils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

// --- CONFIGURATION: DEPTH COLORS ---
const DEPTH_COLORS = [
  '#111827', // Depth 0 (Root) - Black/Dark Gray
  '#2563eb', // Depth 1 (Streams) - Blue
  '#7c3aed', // Depth 2 (Degrees) - Violet
  '#db2777', // Depth 3 (Specializations) - Pink
  '#ea580c', // Depth 4 (Further Studies) - Orange
  '#16a34a', // Depth 5+ (Deep Niche) - Green
];

// --- CUSTOM NODE COMPONENT (Vertical Support) ---
const CustomNode = ({ data, selected }: NodeProps) => {
  return (
    <div 
      className={`
        px-4 py-2 rounded-full border shadow-sm transition-all duration-200 min-w-[150px] text-center
        ${selected ? 'border-black ring-1 ring-black shadow-md scale-105' : 'border-gray-300'}
        ${data.isTerminal ? 'bg-green-50 border-green-200' : 'bg-white'}
      `}
    >
      {/* 
         Change Handle Position for Vertical Layout:
         Target (Input) -> Top
         Source (Output) -> Bottom 
      */}
      <Handle type="target" position={Position.Top} className="!bg-black !w-1 !h-1 opacity-0" />
      
      <div className="flex flex-col items-center">
        <span className={`font-mono text-[10px] font-bold tracking-tight ${data.isTerminal ? 'text-green-800' : 'text-gray-900'}`}>
          {data.label}
        </span>
        {data.isTerminal && (
           <span className="text-[8px] uppercase tracking-widest text-green-600 font-bold mt-1">
             Goal
           </span>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-black !w-1 !h-1 opacity-0" />
    </div>
  );
};

const nodeTypes = {
  default: CustomNode, 
};

export default function GlobalMap() {
  const router = useRouter();

  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const data = getGraphData();
    
    // --- COLOR LOGIC ---
    const styledEdges = data.edges.map((edge: Edge) => {
      // Calculate depth based on the number of slashes in the path ID
      // e.g., "10th" (0 slashes) -> Depth 0
      // "10th/Science" (1 slash) -> Depth 1
      const sourceDepth = (edge.source.match(/\//g) || []).length;
      
      // Pick color from array, or use the last color if we go deeper
      const color = DEPTH_COLORS[sourceDepth] || DEPTH_COLORS[DEPTH_COLORS.length - 1];

      return {
        ...edge,
        type: 'smoothstep',
        animated: false,
        style: { stroke: color, strokeWidth: 2, opacity: 0.8 }, 
      };
    });
    
    return { nodes: data.nodes, edges: styledEdges };
  }, []);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const onNodeClick = useCallback((event: React.MouseEvent, node: any) => {
    const pathSegments = node.id.split('/');
    const urlSlugs = pathSegments.map((segment: string) => slugify(segment));
    const url = `/explore/${urlSlugs.join('/')}`;
    router.push(url);
  }, [router]);

  return (
    <div className="w-screen h-screen bg-[#fafafa]">
      
      {/* HEADER */}
      <div className="absolute top-4 left-4 z-50 flex flex-col gap-2">
        <Link href="/">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 shadow-sm rounded-lg font-mono text-xs hover:border-black transition-colors">
            <ArrowLeft size={14} /> Back Home
          </button>
        </Link>
        <div className="px-4 py-2 bg-black text-white rounded-lg font-mono text-xs shadow-md">
           <strong>{nodes.length}</strong> Nodes Mapped
        </div>
      </div>

      {/* --- COLOR LEGEND --- */}
      <div className="absolute bottom-4 left-4 z-50 bg-white/90 backdrop-blur p-4 rounded-lg border border-gray-200 shadow-sm flex flex-col gap-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 border-b pb-1">Hierarchy Levels</span>
        
        {/* Generate Legend Items */}
        <div className="flex flex-col gap-2">
          {['Root / Entry', 'Streams', 'Degrees', 'Specializations', 'Sub-Spec', 'Deep Niche'].map((label, idx) => (
            <div key={label} className="flex items-center gap-2 text-xs font-mono">
              <div 
                className="w-8 h-1 rounded" 
                style={{ backgroundColor: DEPTH_COLORS[idx] || DEPTH_COLORS[DEPTH_COLORS.length - 1] }}
              ></div>
              <span className="text-gray-600">{label}</span>
            </div>
          ))}
        </div>

        {/* Node Type Legend */}
        <div className="mt-2 pt-2 border-t flex flex-col gap-2">
           <div className="flex items-center gap-2 text-xs font-mono">
              <div className="w-3 h-3 rounded-full border border-gray-300 bg-white"></div>
              <span>Study Path</span>
           </div>
           <div className="flex items-center gap-2 text-xs font-mono">
              <div className="w-3 h-3 rounded-full border border-green-300 bg-green-50"></div>
              <span>Job Goal</span>
           </div>
        </div>
      </div>

      {/* REACT FLOW */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.05}
        maxZoom={1.5}
        attributionPosition="bottom-right"
      >
        <Background 
          color="#e5e5e5" 
          gap={40} 
          variant={BackgroundVariant.Lines} 
        />
        <Controls 
          className="!bg-white !border-gray-200 !shadow-sm !m-4" 
          showInteractive={false} 
        />
        <MiniMap 
          className='!border-gray-200 !shadow-sm !rounded-lg'
          nodeColor={(n) => n.data.isTerminal ? '#86efac' : '#e5e5e5'} 
          maskColor="rgba(250, 250, 250, 0.8)"
        />
      </ReactFlow>
    </div>
  );
}