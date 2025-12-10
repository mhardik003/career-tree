"use client";
import { useMemo } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  useNodesState, 
  useEdgesState, 
  MiniMap 
} from 'reactflow';
import 'reactflow/dist/style.css';
import { getGraphData } from '@/lib/treeUtils';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function GlobalMap() {
  // 1. Calculate the graph only once (heavy operation)
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => getGraphData(), []);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div className="w-screen h-screen bg-white">
      {/* HEADER */}
      <div className="absolute top-4 left-4 z-50 flex gap-4">
        <Link href="/">
          <button className="flex items-center gap-2 px-4 py-2 bg-white border border-black shadow-md rounded font-mono text-sm hover:bg-gray-50">
            <ArrowLeft size={16} /> Back Home
          </button>
        </Link>
        <div className="px-4 py-2 bg-black text-white rounded font-mono text-sm shadow-md">
           {nodes.length} Career Nodes Mapped
        </div>
      </div>

      {/* REACT FLOW CANVAS */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        minZoom={0.1}
        attributionPosition="bottom-right"
      >
        <Background color="#ccc" gap={20} />
        <Controls className='border-black shadow-none' />
        <MiniMap 
          nodeColor={(n) => {
             // Green for terminal, Black for paths
             return n.data.isTerminal ? '#22c55e' : '#000';
          }} 
          style={{ border: '1px solid black' }}
        />
      </ReactFlow>
    </div>
  );
}``