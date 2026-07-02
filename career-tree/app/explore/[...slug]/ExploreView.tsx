"use client";
import { useState } from "react";
import { slugify } from "@/lib/slugify";
import type { NodeMetadata } from "@/lib/types";
import NodeCard from "@/components/NodeCard";
import SuggestionModal from "@/components/SuggestionModal";
import EditModal from "@/components/EditModal";
import { CheckCircle, Edit3, ArrowLeft } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface ExploreViewProps {
  nodeKey: string;
  node: {
    node_title: string;
    description: string;
    avg_duration_years: string | null;
    difficulty_rating: number;
    is_terminal: boolean;
    children: string[];
  };
  parentTitle: string | null;
  richMetadata: NodeMetadata | null;
  slugs: string[];
}

export default function ExploreView({ nodeKey, node, parentTitle, richMetadata, slugs }: ExploreViewProps) {
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);

  const isLeaf = node.is_terminal || node.children.length === 0;
  const parentHref = parentTitle ? `/explore/${slugs.slice(0, -1).join('/')}` : '/';
  const isRootExplorePage = slugs.length === 1 && slugs[0] === '10th-class';

  return (
    <div className="min-h-screen bg-neutral-50 pb-20 pt-10">
      <div className="max-w-4xl mx-auto px-4 flex flex-col items-center">



     {/* --- TOP HEADER NAVIGATION --- */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start max-w-6xl mx-auto z-10">

        <div className="flex items-center gap-3">
        {/* LOGO */}
        <Link href="/">
          <Image
            src="/icon.png"
            width={32}
            height={32}
            alt="Home"
            className="cursor-pointer hover:opacity-80 transition"
          />
        </Link>


        {/* Back Button */}
        {!isRootExplorePage && (

        <Link href={parentHref}>
          <button className="p-2 bg-white border border-gray-200 rounded-full hover:bg-gray-50 hover:border-black transition-colors">
            <ArrowLeft size={20} />
          </button>
        </Link>

        )}
        </div>


        {/* EDIT BUTTON (Top Right) */}
        <button
          onClick={() => setShowEditModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-full shadow-sm hover:shadow-md hover:border-black transition-all group"
        >
          <span className="text-xs font-mono font-bold text-gray-600 group-hover:text-black hidden sm:block">EDIT PAGE</span>
          <Edit3 size={16} className="text-gray-600 group-hover:text-black" />
        </button>

      </div>

      <div className="max-w-4xl mx-auto px-4 flex flex-col items-center mt-8"></div>


        {/* PARENT NODE */}
        {parentTitle && (
          <div className="flex flex-col items-center mb-4 animate-in fade-in slide-in-from-top-4 duration-700">
            <div className="h-10 w-px bg-black/20 mb-2"></div>
            <NodeCard title={parentTitle} href={parentHref} type="parent" />
            <div className="h-8 w-px bg-black/20 mt-2"></div>
          </div>
        )}

        {/* CURRENT NODE */}
        <NodeCard
          title={node.node_title}
          description={node.description}
          href="#"
          type="current"
          metadata={{
            duration: node.avg_duration_years,
            difficulty: node.difficulty_rating
          }}
          richMetadata={richMetadata}
        />

        {/* LEAF NODE HANDLING */}
        {isLeaf ? (
          <div className="mt-8 flex flex-col items-center text-center animate-in fade-in zoom-in duration-500">
             <div className="h-8 w-px bg-green-500 mb-4"></div>
             <div className="bg-green-50 border border-green-200 p-6 rounded-xl max-w-sm">
                <CheckCircle className="w-8 h-8 text-green-600 mx-auto mb-3" />
                <h3 className="font-bold text-green-900 mb-1">Career Destination</h3>
                <p className="text-green-800 text-sm">
                  This is a leaf. You have reached a specific job role or specialization. Maybe time to relax a little bit in life :D
                </p>
             </div>
             <div className="mt-6">
                <p className="text-xs text-gray-400 font-mono mb-2">THINK SOMETHING IS MISSING?</p>
                <button onClick={() => setShowModal(true)} className="px-4 py-2 border border-black text-xs font-mono hover:bg-black hover:text-white transition">
                  SUGGEST FURTHER OPTIONS AFTER THIS
                </button>
             </div>
          </div>
        ) : (
          /* SHOW CHILDREN GRID */
          <div className="w-full mt-8">
            <div className="flex items-center justify-center gap-2 mb-6 opacity-50">
              <div className="h-px w-10 bg-black"></div>
              <span className="font-mono text-xs uppercase tracking-widest">Opportunities</span>
              <div className="h-px w-10 bg-black"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative">
              <div className="absolute -top-6 left-1/2 w-px h-6 bg-black/20 -translate-x-1/2 hidden md:block"></div>
              {node.children.map((childName: string) => {
                const childSlug = slugify(childName);
                const childHref = `/explore/${slugs.join('/')}/${childSlug}`;
                return (
                  <NodeCard key={childName} title={childName} href={childHref} type="child" />
                );
              })}
              <NodeCard title="Add New Path" href="#" type="suggestion" onClick={() => setShowModal(true)} />
            </div>
          </div>
        )}
      </div>


      <SuggestionModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        parentNodeTitle={node.node_title}  // Visual Name
        parentKey={nodeKey}                // Database ID/Key
      />

   <EditModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        nodeKey={nodeKey}
        // Core Data
        basicData={{
            node_title: node.node_title,
            description: node.description,
            difficulty_rating: node.difficulty_rating
        }}
        // Rich Data
        richData={richMetadata}
      />



    </div>
  );
}
