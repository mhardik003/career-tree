"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { cn } from "../lib/utils"; // standard tailwind merge helper
import { ArrowRight, Clock, BarChart } from "lucide-react";

interface NodeCardProps {
  title: string;
  description?: string;
  href: string;
  type: "parent" | "current" | "child" | "suggestion";
  metadata?: {
    duration: string;
    difficulty: number;
  };
  onClick?: () => void;
}


export default function NodeCard({ title, description, href, type, metadata, onClick }: NodeCardProps) {
  const isCurrent = type === "current";
  const isSuggestion = type === "suggestion";

  // Common styles
  const cardStyles = cn(
    "relative border transition-all duration-300 group cursor-pointer block",
    "rounded-lg border-black/10 bg-white hover:border-black",
    type === "parent" && "opacity-50 scale-90 hover:opacity-100 hover:scale-95",
    isCurrent && "border-black shadow-xl scale-100 py-8 px-6 my-8 border-[2px]",
    type === "child" && "hover:shadow-md hover:-translate-y-1",
    isSuggestion && "border-dashed border-gray-400 text-gray-500 hover:text-black hover:border-black bg-gray-50 flex items-center justify-center min-h-[100px]",
    !isCurrent ? "p-4 w-64 mx-auto" : "w-full max-w-2xl mx-auto"
  );

  const content = (
    <div className="flex flex-col gap-2 w-full">
      {type === "child" && (
        <div className="absolute -top-6 left-1/2 w-px h-6 bg-black/20 group-hover:bg-black transition-colors" />
      )}

      <h3 className={cn("font-bold font-mono", isCurrent ? "text-2xl" : "text-sm", isSuggestion && "text-center")}>
        {isSuggestion ? "+ Suggest a Path" : title}
      </h3>
      
      {isCurrent && (
        <>
          <p className="text-gray-600 leading-relaxed font-sans">{description}</p>
          <div className="flex gap-4 mt-4 text-xs font-mono text-gray-500 border-t pt-4">
            <div className="flex items-center gap-1">
              <Clock size={14} />
              <span>{metadata?.duration || "N/A"}</span>
            </div>
            <div className="flex items-center gap-1">
              <BarChart size={14} />
              <span>Diff: {metadata?.difficulty}/10</span>
            </div>
          </div>
        </>
      )}
    </div>
  );

  // LOGIC FIX: If it's a suggestion, render a DIV (button), not a Link.
  if (isSuggestion) {
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

  // Otherwise render a Link
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


// export default function NodeCard({ title, description, href, type, metadata, onClick }: NodeCardProps) {
//   const isCurrent = type === "current";
//   const isSuggestion = type === "suggestion";

//   return (
//     <Link href={href} onClick={onClick}>
//       <motion.div
//         layout
//         initial={{ opacity: 0, y: 10 }}
//         animate={{ opacity: 1, y: 0 }}
//         className={cn(
//           "relative border transition-all duration-300 group cursor-pointer",
//           // Base Styles
//           "rounded-lg border-black/10 bg-white hover:border-black",
//           // Specific Styles
//           type === "parent" && "opacity-50 scale-90 hover:opacity-100 hover:scale-95",
//           isCurrent && "border-black shadow-xl scale-100 py-8 px-6 my-8 border-[2px]",
//           type === "child" && "hover:shadow-md hover:-translate-y-1",
//           isSuggestion && "border-dashed border-gray-400 text-gray-500 hover:text-black hover:border-black bg-gray-50",
//           // Dimensions
//           !isCurrent ? "p-4 w-64 mx-auto" : "w-full max-w-2xl mx-auto"
//         )}
//       >
//         {/* Connector Line Logic (Visual only) */}
//         {type === "child" && (
//           <div className="absolute -top-6 left-1/2 w-px h-6 bg-black/20 group-hover:bg-black transition-colors" />
//         )}

//         <div className="flex flex-col gap-2">
//           <h3 className={cn("font-bold font-mono", isCurrent ? "text-2xl" : "text-sm")}>
//             {title}
//           </h3>
          
//           {isCurrent && (
//             <>
//               <p className="text-gray-600 leading-relaxed font-sans">{description}</p>
              
//               <div className="flex gap-4 mt-4 text-xs font-mono text-gray-500 border-t pt-4">
//                 <div className="flex items-center gap-1">
//                   <Clock size={14} />
//                   <span>{metadata?.duration || "N/A"}</span>
//                 </div>
//                 <div className="flex items-center gap-1">
//                   <BarChart size={14} />
//                   <span>Diff: {metadata?.difficulty}/10</span>
//                 </div>
//               </div>
//             </>
//           )}

//           {isSuggestion && (
//             <div className="flex items-center justify-center gap-2 text-sm">
//               <span>+ Suggest a path</span>
//             </div>
//           )}
//         </div>
//       </motion.div>
//     </Link>
//   );
// }