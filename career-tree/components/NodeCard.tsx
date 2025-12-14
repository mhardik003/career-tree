"use client";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { cn } from "../lib/utils"; 
import { 
  Clock, BarChart, ChevronDown, 
  BookOpen, Award, IndianRupee, Wrench, BadgeCheck, Building2, Lightbulb, 
} from "lucide-react";
import { useState } from "react";
// Import the type we defined in treeUtils
import { NodeMetadata } from "../lib/treeUtils"; 

interface NodeCardProps {
  title: string;
  description?: string;
  href: string;
  type: "parent" | "current" | "child" | "suggestion";
  metadata?: {
    duration: string | null;
    difficulty: number;
  };
  // NEW: Rich metadata prop
  richMetadata?: NodeMetadata | null;
  onClick?: () => void;
}

export default function NodeCard({ title, description, href, type, metadata, richMetadata, onClick }: NodeCardProps) {
  const isCurrent = type === "current";
  const isSuggestion = type === "suggestion";
  
  // State for the dropdown
  const [isExpanded, setIsExpanded] = useState(false);

  const toggleExpand = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  // Common styles
  const cardStyles = cn(
    "relative border transition-all duration-300 group cursor-pointer block bg-white",
    "rounded-lg border-black/10 hover:border-black",
    type === "parent" && "opacity-50 scale-90 hover:opacity-100 hover:scale-95",
    isCurrent && "border-black shadow-xl scale-100 my-8 border-[2px]",
    type === "child" && "hover:shadow-md hover:-translate-y-1",
    isSuggestion && "border-dashed border-gray-400 text-gray-500 hover:text-black hover:border-black bg-gray-50 flex items-center justify-center min-h-[100px]",
    !isCurrent ? "p-4 w-64 mx-auto" : "w-full max-w-2xl mx-auto p-6"
  );

  const content = (
    <div className="flex flex-col gap-2 w-full">
      {type === "child" && (
        <div className="absolute -top-6 left-1/2 w-px h-6 bg-black/20 group-hover:bg-black transition-colors" />
      )}

      {/* HEADER ROW */}
      <div className={cn("flex justify-between items-start", isSuggestion && "justify-center w-full")}>
        <h3 className={cn("font-bold font-mono", isCurrent ? "text-2xl" : "text-sm", isSuggestion && "text-center")}>
          {isSuggestion ? "+ Suggest a Path" : title}
        </h3>

        {/* EXPAND BUTTON (Only visible on Current Node) */}
        {isCurrent && (
          <button 
            onClick={toggleExpand}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors focus:outline-none"
            title="View Details"
          >
            <ChevronDown 
              className={cn("transition-transform duration-300", isExpanded ? "rotate-180" : "")} 
            />
          </button>
        )}
      </div>
      
      {/* DESCRIPTION & STATS (Current Node Only) */}
      {isCurrent && (
        <>
          <p className="text-gray-600 leading-relaxed font-sans mt-2">{description}</p>
          
          <div className="flex gap-4 mt-4 text-xs font-mono text-gray-500 border-t pt-4">
            <div className="flex items-center gap-1">
              <Clock size={14} />
              <span>{metadata?.duration || "Variable"}</span>
            </div>
            <div className="flex items-center gap-1">
              <BarChart size={14} />
              <span>Diff: {metadata?.difficulty}/10</span>
            </div>
          </div>
          
          {/* EXPANDABLE RICH METADATA SECTION */}
          <AnimatePresence>
            {isExpanded && richMetadata && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="pt-6 mt-6 border-t border-dashed border-gray-300 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 text-sm">
                  
                  {/* 1. HIGHLIGHTS ROW (Cost & Duration) */}
                  <div className="col-span-full flex flex-wrap gap-4 bg-gray-50 p-3 rounded border border-gray-100">
                    <div className="flex items-center gap-2">
                      <IndianRupee size={16} className="text-blue-600" />
                      <span className="font-bold">Avg Cost:</span> 
                      {richMetadata.avg_cost_inr || "Variable"}
                    </div>
                    {/* {richMetadata.duration_years && (
                      <>
                        <div className="hidden md:block w-px bg-gray-300 h-full mx-2"></div>
                        <div className="flex items-center gap-2">
                          <Clock size={16} className="text-orange-600" />
                          <span className="font-bold">Duration:</span> 
                          {richMetadata.duration_years}
                        </div>
                      </>
                    )} */}
                  </div>

                  {/* 2. EXAMS */}
                  {richMetadata.exams_to_give && richMetadata.exams_to_give.length > 0 && (
                    <div>
                      <h4 className="font-mono font-bold flex items-center gap-2 mb-2 text-gray-800">
                        <BookOpen size={14} className="text-purple-600"/> Entrance Exams
                      </h4>
                      <ul className="list-disc list-inside text-gray-600 space-y-1 pl-1">
                        {richMetadata.exams_to_give.map((ex) => (
                          <li key={ex}>{ex}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 3. QUALIFICATIONS */}
                  {richMetadata.qualifications_needed && richMetadata.qualifications_needed.length > 0 && (
                    <div>
                      <h4 className="font-mono font-bold flex items-center gap-2 mb-2 text-gray-800">
                        <Award size={14} className="text-red-600"/> Qualifications
                      </h4>
                      <ul className="list-disc list-inside text-gray-600 space-y-1 pl-1">
                        {richMetadata.qualifications_needed.map((q) => (
                          <li key={q}>{q}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 4. CERTIFICATIONS */}
                  {richMetadata.certifications && richMetadata.certifications.length > 0 && (
                    <div>
                      <h4 className="font-mono font-bold flex items-center gap-2 mb-2 text-gray-800">
                        <BadgeCheck size={14} className="text-green-600"/> Key Certifications
                      </h4>
                      <ul className="list-disc list-inside text-gray-600 space-y-1 pl-1">
                        {richMetadata.certifications.map((c) => (
                          <li key={c}>{c}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 5. TOP COLLEGES / COMPANIES */}
                  {richMetadata.top_colleges_or_companies && richMetadata.top_colleges_or_companies.length > 0 && (
                    <div>
                      <h4 className="font-mono font-bold flex items-center gap-2 mb-2 text-gray-800">
                        <Building2 size={14} className="text-indigo-600"/> Top Institutes/Firms
                      </h4>
                      <ul className="list-disc list-inside text-gray-600 space-y-1 pl-1">
                        {richMetadata.top_colleges_or_companies.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 6. REAL LIFE APPLICATIONS (Full Width) */}
                  {richMetadata.real_life_applications && richMetadata.real_life_applications.length > 0 && (
                    <div className="col-span-full">
                      <h4 className="font-mono font-bold flex items-center gap-2 mb-2 text-gray-800">
                        <Lightbulb size={14} className="text-yellow-600"/> Real Life Applications
                      </h4>
                      <div className="bg-yellow-50/50 p-4 rounded-lg border border-yellow-100">
                        <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-gray-700">
                          {richMetadata.real_life_applications.map((app) => (
                            <li key={app} className="flex items-start gap-2">
                              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0"></span>
                              <span>{app}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* 7. TOOLS & RESOURCES (Full Width) */}
                  {richMetadata.tools_and_resources && richMetadata.tools_and_resources.length > 0 && (
                    <div className="col-span-full">
                      <h4 className="font-mono font-bold flex items-center gap-2 mb-2 text-gray-800">
                        <Wrench size={14} className="text-gray-600"/> Tools & Resources
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {richMetadata.tools_and_resources.map((t) => (
                          <span key={t} className="px-3 py-1 bg-gray-100 rounded-full text-xs font-medium border border-gray-200 text-gray-700">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );

  // LOGIC BRANCHING:

  // 1. If Suggestion or Current, use a DIV (Don't use Link).
  // Why? For 'Current', we are already on the page, and we need the Expand button to work without navigation conflicts.
  if (isSuggestion || isCurrent) {
    return (
      <motion.div 
        layout 
        className={cardStyles} 
        onClick={onClick}
      >
        {content}
      </motion.div>
    );
  }

  // 2. If Child or Parent, wrap in Link for navigation.
  return (
    <Link href={href} onClick={onClick} className="block">
      <motion.div 
        layout 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cardStyles}
      >
        {content}
      </motion.div>
    </Link>
  );
}