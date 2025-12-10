import Link from "next/link";
import { ArrowRight, GitFork, Users, Database, Globe } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-white text-black font-sans selection:bg-black selection:text-white">
      
      {/* BACKGROUND GRID PATTERN (Subtle Engineering Paper look) */}
      <div className="fixed inset-0 z-0 opacity-[0.03] pointer-events-none"
           style={{
             backgroundImage: `linear-gradient(#000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)`,
             backgroundSize: '40px 40px'
           }}
      ></div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-24 pb-12">
        
        {/* --- HERO SECTION --- */}
        <div className="flex flex-col items-center text-center gap-8 mb-24">
          
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-black/10 bg-gray-50 text-xs font-mono uppercase tracking-widest text-gray-500">
            <Globe size={12} />
            <span>Open Source Career Intelligence</span>
          </div>

          {/* Main Title */}
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight max-w-4xl">
            Stop guessing. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-500 to-black">
              Start mapping.
            </span>
          </h1>

          {/* Tagline / Mission */}
          <p className="text-xl md:text-2xl text-gray-600 max-w-2xl font-light leading-relaxed">
            We are <span className="font-semibold text-black">democratizing career counseling</span> by building the world's first open-access, community-verified map of opportunities.
          </p>

          {/* CTA BUTTON */}
          <div className="mt-4">
            <Link href="/explore/10th-class">
              <button className="group relative px-8 py-4 bg-black text-white rounded-lg font-mono text-lg hover:bg-neutral-800 transition-all flex items-center gap-3 shadow-xl hover:shadow-2xl hover:-translate-y-1">
                Start at 10th Class
                <ArrowRight className="group-hover:translate-x-1 transition-transform" />
              </button>
            </Link>
            <p className="mt-4 text-xs font-mono text-gray-400">
              *Currently mapped for the Indian Education System
            </p>
          </div>
        </div>


        {/* --- VISUAL TEASER (Abstract Tree) --- */}
        <div className="flex flex-col items-center justify-center opacity-20 mb-32 select-none pointer-events-none">
           <div className="w-px h-12 bg-black"></div>
           <div className="w-32 h-10 border border-black rounded-full"></div>
           <div className="w-px h-12 bg-black"></div>
           <div className="flex gap-16">
              <div className="flex flex-col items-center">
                <div className="w-px h-8 bg-black"></div>
                <div className="w-24 h-8 border border-black rounded opacity-50"></div>
              </div>
              <div className="flex flex-col items-center">
                <div className="w-px h-8 bg-black"></div>
                <div className="w-24 h-8 border border-black rounded opacity-50"></div>
              </div>
           </div>
        </div>


        {/* --- VALUE PROPS --- */}
        <div className="grid md:grid-cols-3 gap-12 border-t border-gray-100 pt-16">
          
          {/* Feature 1 */}
          <div className="flex flex-col gap-4">
            <div className="w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center border border-gray-200">
              <GitFork className="text-black" />
            </div>
            <h3 className="text-xl font-bold">Visual Pathways</h3>
            <p className="text-gray-600 leading-relaxed">
              Careers aren't lists; they are branching trees. Navigate from broad streams to niche specializations with a clear view of prerequisites.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="flex flex-col gap-4">
            <div className="w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center border border-gray-200">
              <Database className="text-black" />
            </div>
            <h3 className="text-xl font-bold">Real Metadata</h3>
            <p className="text-gray-600 leading-relaxed">
              Don't just see titles. See difficulty ratings, average duration, and sanitized insights from in that field.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="flex flex-col gap-4">
            <div className="w-12 h-12 bg-gray-50 rounded-lg flex items-center justify-center border border-gray-200">
              <Users className="text-black" />
            </div>
            <h3 className="text-xl font-bold">Community Built</h3>
            <p className="text-gray-600 leading-relaxed">
              The job market evolves faster than textbooks. Our tree is open for contributions. Find a missing path? Suggest it instantly.
            </p>
          </div>
        </div>

        {/* --- FOOTER --- */}
        <div className="mt-32 pt-8 border-t border-black/10 flex justify-between items-center text-sm text-gray-500 font-mono">
          <div>© 2025 Career Tree Project</div>
          <div className="flex gap-4">
            <a href="/about" className="hover:text-black hover:underline">About</a>
            <a href="https://github.com/mhardik003/career-tree" className="hover:text-black hover:underline">Contribute</a>
          </div>
        </div>

      </div>
    </div>
  );
}