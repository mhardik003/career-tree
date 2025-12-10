"use client";
import { X, CheckCircle, Loader2, Save, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { NodeMetadata } from "@/lib/treeUtils";

interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodeKey: string;
  // Basic Data (From CareerTree)
  basicData: {
    title: string;
    description: string;
    difficulty: number;
  };
  // Rich Data (From Metadata.json)
  richData: NodeMetadata | null;
}

export default function EditModal({ isOpen, onClose, nodeKey, basicData, richData }: EditModalProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  // State for all form fields
  const [formData, setFormData] = useState({
    // Basic
    title: "",
    description: "",
    difficulty: 5 as number | string,
    
    // Rich (Strings)
    avg_cost_inr: "",
    duration_years: "",
    
    // Rich (Lists - stored as comma-separated strings for editing)
    exams_str: "",
    certifications_str: "",
    qualifications_str: "",
    colleges_str: "",
    tools_str: "",
    applications_str: ""
  });

  // Helper: Convert Array to CSV String
  const listToStr = (list: string[] | null | undefined) => list ? list.join(", ") : "";

  // Populate form on open
  useEffect(() => {
    if (isOpen) {
      setFormData({
        title: basicData.title || "",
        description: basicData.description || "",
        difficulty: basicData.difficulty || 5,
        
        avg_cost_inr: richData?.avg_cost_inr || "",
        duration_years: richData?.duration_years || "",
        
        exams_str: listToStr(richData?.exams_to_give),
        certifications_str: listToStr(richData?.certifications),
        qualifications_str: listToStr(richData?.qualifications_needed),
        colleges_str: listToStr(richData?.top_colleges_or_companies),
        tools_str: listToStr(richData?.tools_and_resources),
        applications_str: listToStr(richData?.real_life_applications)
      });
      setSuccess(false);
    }
  }, [isOpen, basicData, richData]);

  if (!isOpen) return null;

  // Helper: Convert CSV String back to Array
  const strToList = (str: string) => str.split(",").map(s => s.trim()).filter(s => s.length > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // reconstruct the payload
    const submissionData = {
      // Basic Nodes
      node_title: formData.title,
      description: formData.description,
      difficulty_rating: Number(formData.difficulty),
      
      // Rich Metadata
      avg_cost_inr: formData.avg_cost_inr,
      duration_years: formData.duration_years,
      exams_to_give: strToList(formData.exams_str),
      certifications: strToList(formData.certifications_str),
      qualifications_needed: strToList(formData.qualifications_str),
      top_colleges_or_companies: strToList(formData.colleges_str),
      tools_and_resources: strToList(formData.tools_str),
      real_life_applications: strToList(formData.applications_str)
    };

    try {
      const response = await fetch('/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeKey: nodeKey,
          originalData: { basic: basicData, rich: richData }, // Snapshot for comparison
          newData: submissionData
        })
      });

      if (response.ok) setSuccess(true);
    } catch (error) {
      alert("Failed to submit edit.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-black relative">
        
        {/* HEADER */}
        <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-xl">
          <div>
            <h2 className="text-xl font-bold font-mono flex items-center gap-2">
              <Save size={18} /> Suggest Edits
            </h2>
            <p className="text-xs text-gray-500 mt-1">Help improve the data for everyone.</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-black">
            <X size={24} />
          </button>
        </div>

        {/* CONTENT (Scrollable) */}
        <div className="p-6 overflow-y-auto custom-scrollbar">
          {success ? (
            <div className="flex flex-col items-center justify-center py-12 text-center animate-in zoom-in">
              <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
              <h3 className="font-bold text-lg">Submission Received!</h3>
              <p className="text-gray-600 text-sm mb-6 max-w-xs mx-auto">
                Your edits have been recorded. Our moderators will review and apply them shortly.
              </p>
              <button onClick={onClose} className="px-6 py-2 bg-black text-white rounded font-mono text-xs hover:bg-neutral-800">
                CLOSE WINDOW
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              
              {/* SECTION 1: CORE INFO */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b pb-1">Core Information</h3>
                
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="label">Node Title</label>
                    <input 
                      required
                      value={formData.title}
                      onChange={e => setFormData({...formData, title: e.target.value})}
                      className="input-field font-bold" 
                    />
                  </div>
                  <div>
                    <label className="label">Difficulty (1-10)</label>
                    <input 
                      type="number" min="1" max="10"
                      value={formData.difficulty}
                      onChange={e => setFormData({...formData, difficulty: e.target.value === "" ? "" : parseInt(e.target.value)})}
                      className="input-field" 
                    />
                  </div>
                </div>

                <div>
                  <label className="label">Description</label>
                  <textarea 
                    required
                    value={formData.description}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    className="input-field h-24 resize-none leading-relaxed" 
                  />
                </div>
              </div>

              {/* SECTION 2: KEY STATS */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b pb-1">Key Stats</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Avg Cost (INR)</label>
                    <input 
                      placeholder="e.g. 2-4 Lakhs"
                      value={formData.avg_cost_inr}
                      onChange={e => setFormData({...formData, avg_cost_inr: e.target.value})}
                      className="input-field" 
                    />
                  </div>
                  <div>
                    <label className="label">Duration</label>
                    <input 
                      placeholder="e.g. 4 Years"
                      value={formData.duration_years}
                      onChange={e => setFormData({...formData, duration_years: e.target.value})}
                      className="input-field" 
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 3: LISTS */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b pb-1">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Details (Comma Separated)</h3>
                  <span className="text-[10px] text-gray-400 flex items-center gap-1">
                    <AlertCircle size={10} /> Separate items with commas
                  </span>
                </div>

                <div>
                  <label className="label">Entrance Exams</label>
                  <input 
                    placeholder="JEE, BITSAT, VITEEE"
                    value={formData.exams_str}
                    onChange={e => setFormData({...formData, exams_str: e.target.value})}
                    className="input-field" 
                  />
                </div>

                <div>
                  <label className="label">Qualifications Needed</label>
                  <input 
                    placeholder="Class 12th Science, 50% Aggregate"
                    value={formData.qualifications_str}
                    onChange={e => setFormData({...formData, qualifications_str: e.target.value})}
                    className="input-field" 
                  />
                </div>

                <div>
                  <label className="label">Top Colleges / Companies</label>
                  <textarea 
                    placeholder="IIT Bombay, NIT Trichy, Google, Microsoft"
                    value={formData.colleges_str}
                    onChange={e => setFormData({...formData, colleges_str: e.target.value})}
                    className="input-field h-16" 
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div>
                    <label className="label">Certifications</label>
                    <textarea 
                      placeholder="AWS, CFA Level 1"
                      value={formData.certifications_str}
                      onChange={e => setFormData({...formData, certifications_str: e.target.value})}
                      className="input-field h-20" 
                    />
                  </div>
                   <div>
                    <label className="label">Tools & Resources</label>
                    <textarea 
                      placeholder="VS Code, Coursera, Khan Academy"
                      value={formData.tools_str}
                      onChange={e => setFormData({...formData, tools_str: e.target.value})}
                      className="input-field h-20" 
                    />
                  </div>
                </div>
                
                 <div>
                    <label className="label">Real Life Applications</label>
                    <input 
                      placeholder="Building bridges, Developing apps"
                      value={formData.applications_str}
                      onChange={e => setFormData({...formData, applications_str: e.target.value})}
                      className="input-field" 
                    />
                  </div>

              </div>

              {/* FOOTER ACTION */}
              <div className="pt-4 border-t sticky bottom-0 bg-white pb-2">
                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-black text-white py-4 font-mono text-sm hover:bg-neutral-800 transition-colors rounded-lg flex items-center justify-center gap-2 shadow-lg"
                >
                  {loading && <Loader2 className="animate-spin w-4 h-4" />}
                  {loading ? "SAVING..." : "SUBMIT CHANGES"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
      
      {/* Quick CSS for inputs in this component */}
      <style jsx>{`
        .label { display: block; font-size: 0.75rem; font-family: var(--font-mono); margin-bottom: 0.25rem; text-transform: uppercase; color: #666; }
        .input-field { width: 100%; padding: 0.5rem; border: 1px solid #e5e5e5; border-radius: 0.375rem; font-size: 0.875rem; outline: none; transition: border-color 0.2s; }
        .input-field:focus { border-color: #000; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #e5e5e5; border-radius: 4px; }
      `}</style>
    </div>
  );
}