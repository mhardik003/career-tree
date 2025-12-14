"use client";
import Link from "next/link";
import { ArrowLeft, GitBranch, Map, Heart, Edit3, PlusCircle } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white text-black selection:bg-black selection:text-white pb-20">
      
      {/* --- BACKGROUND GRID --- */}
      <div className="fixed inset-0 z-0 opacity-[0.03] pointer-events-none"
           style={{
             backgroundImage: `linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)`,
             backgroundSize: '40px 40px'
           }}
      ></div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 pt-12">
        
        {/* NAV HEADER */}
        <Link href="/">
          <button className="flex items-center gap-2 text-sm font-mono text-gray-500 hover:text-black mb-12 transition-colors">
            <ArrowLeft size={16} /> BACK HOME
          </button>
        </Link>

        {/* --- HERO SECTION --- */}
        <div className="mb-20 border-b border-black/10 pb-12">
          <h1 className="text-5xl md:text-6xl font-bold tracking-tighter mb-6">
            The Open Source <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-500 to-black">
              Career Map.
            </span>
          </h1>
          <p className="text-xl text-gray-600 leading-relaxed max-w-2xl font-light">
            We are democratizing career counseling by replacing &quot;gut feelings&quot; with data. 
            No gatekeepers, no expensive fees—just a map of what is possible.
          </p>
        </div>

        {/* --- SECTION 1: THE PHILOSOPHY --- */}
        <div className="grid md:grid-cols-12 gap-8 mb-24">
          <div className="md:col-span-4">
            <span className="font-mono text-xs font-bold uppercase tracking-widest border-b border-black pb-1">01. The Problem</span>
          </div>
          <div className="md:col-span-8 flex flex-col gap-6">
            <p className="text-lg leading-relaxed">
              Most people treat their career like a <strong>Ladder</strong>—a single, rigid path upwards. 
              If you miss a step, you fall.
            </p>
            <p className="text-lg leading-relaxed text-gray-600">
              The reality is that life is a <strong>Tree</strong>. It branches, twists, and reconnects. 
              There isn&apos;t &quot;one right way&quot; to become an engineer, a designer, or a founder. 
              But until now, that map has been hidden inside the heads of expensive counselors.
            </p>
            <div className="flex gap-4 mt-2">
              <div className="flex items-center gap-2 text-sm font-mono bg-gray-50 px-3 py-1 rounded border border-gray-200">
                <GitBranch size={14} /> Nonlinear Paths
              </div>
              <div className="flex items-center gap-2 text-sm font-mono bg-gray-50 px-3 py-1 rounded border border-gray-200">
                <Map size={14} /> Visual Discovery
              </div>
            </div>
          </div>
        </div>

        {/* --- SECTION 2: HOW TO USE --- */}
        <div className="grid md:grid-cols-12 gap-8 mb-24">
          <div className="md:col-span-4">
             <span className="font-mono text-xs font-bold uppercase tracking-widest border-b border-black pb-1">02. For Students</span>
          </div>
          <div className="md:col-span-8">
            <h3 className="text-2xl font-bold mb-4">Don&apos;t search. Explore.</h3>
            <p className="text-gray-600 mb-8">
              Start at your current stage (e.g., 10th Class). Click on a path to &quot;simulate&quot; that future.
              See what opportunities open up—and more importantly, see where they lead 5 years down the line.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-black/10 p-6 rounded-lg hover:border-black transition-colors">
                <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center mb-4 font-mono text-sm">A</div>
                <h4 className="font-bold mb-2">Check Prerequisites</h4>
                <p className="text-sm text-gray-500">Know exactly what exams or degrees you need before you commit.</p>
              </div>
              <div className="border border-black/10 p-6 rounded-lg hover:border-black transition-colors">
                <div className="w-8 h-8 bg-black text-white rounded-full flex items-center justify-center mb-4 font-mono text-sm">B</div>
                <h4 className="font-bold mb-2">Spot Dead Ends</h4>
                <p className="text-sm text-gray-500">Identify which degrees are &quot;Terminal&quot; (job-ready) and which require further study.</p>
              </div>
            </div>
          </div>
        </div>

        {/* --- SECTION 3: HOW TO CONTRIBUTE --- */}
        <div className="grid md:grid-cols-12 gap-8 mb-24">
           <div className="md:col-span-4">
             <span className="font-mono text-xs font-bold uppercase tracking-widest border-b border-black pb-1">03. For Professionals</span>
          </div>
          <div className="md:col-span-8">
            <div className="bg-neutral-900 text-white p-8 rounded-xl relative overflow-hidden">
               {/* Decorative background element */}
               <GitBranch className="absolute -right-4 -bottom-4 text-neutral-800 w-48 h-48 opacity-50" />
               
               <h3 className="text-2xl font-bold mb-4 relative z-10">We need your brain.</h3>
               <p className="text-gray-300 mb-6 relative z-10 leading-relaxed">
                 The job market moves faster than any textbook. If you are working in a field, <strong>you are the expert</strong>.
                 Help the next generation by verifying the data.
               </p>

               <ul className="space-y-4 mb-8 relative z-10">
                 <li className="flex items-start gap-3">
                   <div className="mt-1 p-1 bg-white/10 rounded">
                     <Edit3 size={14} className="text-white" />
                   </div>
                   <div className="text-sm">
                     <strong className="block text-white">See a mistake?</strong>
                     <span className="text-gray-400">Click the &quot;Edit Page&quot; button on any node to fix durations, difficulty, or descriptions.</span>
                   </div>
                 </li>
                 <li className="flex items-start gap-3">
                   <div className="mt-1 p-1 bg-white/10 rounded">
                     <PlusCircle size={14} className="text-white" />
                   </div>
                   <div className="text-sm">
                     <strong className="block text-white">Missing a niche?</strong>
                     <span className="text-gray-400">Click &quot;Add New Path&quot; to branch out the tree further.</span>
                   </div>
                 </li>
               </ul>
            </div>
          </div>
        </div>

        {/* --- FOOTER CTA --- */}
        <div className="flex flex-col items-center justify-center text-center pt-12 border-t border-black/10">
          <Heart className="text-red-500 mb-4 animate-pulse" />
          <h2 className="text-3xl font-bold mb-4">Ready to find your path?</h2>
          <div className="flex gap-4">
            <Link href="/explore/10th-class">
              <button className="px-8 py-3 bg-black text-white rounded font-mono text-sm hover:bg-neutral-800 transition-all shadow-lg">
                START EXPLORING
              </button>
            </Link>
            {/* <Link href="https://github.com/your-username/career-tree">
              <button className="px-8 py-3 bg-white border border-black text-black rounded font-mono text-sm hover:bg-gray-50 transition-all">
                GITHUB REPO
              </button>
            </Link> */}
          </div>
          <p className="mt-8 text-xs font-mono text-gray-400">
            Built with Next.js, React Flow & Community Love.
          </p>
        </div>

      </div>
    </div>
  );
}