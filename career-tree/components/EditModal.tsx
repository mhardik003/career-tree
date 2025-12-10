"use client";
import { X, CheckCircle, Loader2, Save } from "lucide-react";
import { useState, useEffect } from "react";

interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodeKey: string;
  currentData: {
    title: string;
    description: string;
    duration: string | null;
    difficulty: number;
  };
}

export default function EditModal({ isOpen, onClose, nodeKey, currentData }: EditModalProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  // FIX 1: Explicitly type the state so difficulty can be a number OR an empty string
  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    duration: string;
    difficulty: number | string; // <--- Allow string for empty input handling
  }>({
    title: "",
    description: "",
    duration: "",
    difficulty: 5
  });

  useEffect(() => {
    if (isOpen && currentData) {
      setFormData({
        title: currentData.title || "",
        description: currentData.description || "",
        duration: currentData.duration || "",
        difficulty: currentData.difficulty || 5
      });
      setSuccess(false);
    }
  }, [isOpen, currentData]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeKey: nodeKey,
          originalData: currentData,
          newData: formData
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 border border-black relative">
        
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-black">
          <X size={20} />
        </button>

        <div className="mb-6 border-b pb-4">
          <h2 className="text-xl font-bold font-mono flex items-center gap-2">
            <Save size={18} /> Edit Node Details
          </h2>
          <p className="text-xs text-gray-500 mt-1">Found a mistake? Suggest a fix for the community.</p>
        </div>

        {success ? (
          <div className="flex flex-col items-center justify-center py-8 text-center animate-in zoom-in">
            <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
            <h3 className="font-bold text-lg">Change Requested!</h3>
            <p className="text-gray-600 text-sm mb-6">Your edits have been submitted for moderation.</p>
            <button onClick={onClose} className="px-6 py-2 bg-black text-white rounded font-mono text-xs">
              CLOSE
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            
            <div>
              <label className="block text-xs font-mono mb-1 uppercase font-bold">Node Title</label>
              <input 
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded focus:border-black outline-none font-bold" 
              />
            </div>

            <div>
              <label className="block text-xs font-mono mb-1 uppercase">Description</label>
              <textarea 
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded focus:border-black outline-none h-32 resize-none leading-relaxed text-sm" 
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-mono mb-1 uppercase">Duration</label>
                <input 
                  value={formData.duration}
                  onChange={(e) => setFormData({...formData, duration: e.target.value})}
                  placeholder="e.g. 4 Years"
                  className="w-full p-2 border border-gray-300 rounded focus:border-black outline-none text-sm" 
                />
              </div>
              <div>
                <label className="block text-xs font-mono mb-1 uppercase">Difficulty (1-10)</label>
                
                {/* FIX 2: Updated Input Logic */}
                <input 
                  type="number" min="1" max="10"
                  value={formData.difficulty} // Can now be "" or number
                  onChange={(e) => {
                    const val = e.target.value;
                    // FIX 3: If empty string, set to empty string. If number, parse it.
                    setFormData({
                      ...formData, 
                      difficulty: val === "" ? "" : parseInt(val)
                    });
                  }}
                  className="w-full p-2 border border-gray-300 rounded focus:border-black outline-none text-sm" 
                />
              </div>
            </div>

            <div className="pt-2">
                <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-black text-white py-3 font-mono text-sm hover:bg-neutral-800 transition-colors rounded flex items-center justify-center gap-2"
                >
                {loading && <Loader2 className="animate-spin w-4 h-4" />}
                {loading ? "SAVING..." : "SUBMIT CHANGES"}
                </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}