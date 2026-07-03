"use client";
import { useState } from "react";
import { slugify } from "@/lib/slugify";
import type { BreadcrumbItem, NodeMetadata } from "@/lib/types";
import NodeCard from "@/components/NodeCard";
import Breadcrumbs from "@/components/Breadcrumbs";
import SuggestionModal from "@/components/SuggestionModal";
import EditModal from "@/components/EditModal";
import { CheckCircle, Edit3, ArrowLeft } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

// Prose list of child names: first 6 joined with ", "/" and ", overflow as ", and N more".
// Plain string join (no Intl.ListFormat) so server and client render identically.
function listChildren(names: string[]): string {
  const shown = names.slice(0, 6);
  const rest = names.length - shown.length;
  if (rest > 0) return `${shown.join(", ")}, and ${rest} more`;
  if (shown.length === 1) return shown[0];
  return `${shown.slice(0, -1).join(", ")} and ${shown[shown.length - 1]}`;
}

// "How to become a/an {title}" for role-like leaves; plural/collective titles
// ("Core Engineering Jobs", "Civil Services (UPSC)") fall back to "How to get into".
function leafHeading(title: string): string {
  const base = title.replace(/\s*\([^)]*\)\s*$/, "").trim();
  const words = base.split(/\s+/);
  const last = (words[words.length - 1] || "").toLowerCase();
  if (last.endsWith("s") && !last.endsWith("ss")) return `How to get into ${title}`;
  const article = /^[aeiou]/i.test(title) ? "an" : "a";
  return `How to become ${article} ${title}`;
}

interface ExploreViewProps {
  nodeKey: string;
  node: {
    node_title: string;
    description: string;
    avg_duration_years: string | null;
    difficulty_rating: number;
    is_terminal: boolean;
    children: string[];
    search_keywords: string[];
  };
  parentTitle: string | null;
  richMetadata: NodeMetadata | null;
  slugs: string[];
  ancestors: BreadcrumbItem[];
}

export default function ExploreView({ nodeKey, node, parentTitle, richMetadata, slugs, ancestors }: ExploreViewProps) {
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

      {/* FULL-ANCESTRY BREADCRUMB */}
      <div className="max-w-4xl mx-auto px-4 flex flex-col items-center mt-8 w-full">
        <Breadcrumbs items={ancestors} current={node.node_title} />
      </div>


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
                <p className="font-mono text-xs uppercase tracking-widest text-green-700 mb-1">Career Destination</p>
                <h2 className="font-bold text-green-900 mb-1">{leafHeading(node.node_title)}</h2>
                <p className="text-green-800 text-sm">
                  {node.node_title} is a specific job role or specialization — a career destination in this tree.
                  {richMetadata && " Typical routes, entrance exams, qualifications, costs, and top colleges or companies are detailed in the card above."}
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
              <h2 className="font-mono text-xs uppercase tracking-widest">Career options after {node.node_title}</h2>
              <div className="h-px w-10 bg-black"></div>
            </div>

            <p className="text-sm text-gray-500 text-center max-w-2xl mx-auto mb-6">
              {node.children.length === 1
                ? `After completing ${node.node_title}, the typical next step is ${node.children[0]}.`
                : `After completing ${node.node_title}, students typically pursue one of ${node.children.length} paths: ${listChildren(node.children)}.`}
            </p>

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

        {/* Related search queries (from the tree data) — kept in the server-rendered HTML for SEO */}
        {node.search_keywords.length > 0 && (
          <section aria-label="People also search for" className="mt-10 w-full max-w-2xl text-center">
            <p className="text-xs text-gray-400 font-mono mb-3 uppercase tracking-widest">People also search for</p>
            <div className="flex flex-wrap justify-center gap-2">
              {node.search_keywords.map((keyword) => (
                <span key={keyword} className="px-3 py-1 bg-gray-100 rounded-full text-xs font-medium border border-gray-200 text-gray-700">
                  {keyword}
                </span>
              ))}
            </div>
          </section>
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
