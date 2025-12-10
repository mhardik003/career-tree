"use client";
import { X, CheckCircle, Loader2 } from "lucide-react";
import { useState } from "react";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  parentNodeTitle: string; // Display name (e.g. "Science Stream")
  parentKey: string;       // Database key (e.g. "10th/Science")
}

export default function SuggestionModal({ isOpen, onClose, parentNodeTitle, parentKey }: ModalProps) {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    title: "",
    description: ""
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentPath: parentKey,
          title: formData.title,
          description: formData.description
        })
      });

      if (response.ok) {
        setSuccess(true);
        setFormData({ title: "", description: "" }); // Reset form
      }
    } catch (error) {
      alert("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 border border-black relative">
        
        {/* Close Button */}
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-black">
          <X size={20} />
        </button>

        <div className="mb-6">
          <h2 className="text-xl font-bold font-mono">Suggest a Path</h2>
          <p className="text-xs text-gray-500 mt-1">Help us map the unmapped.</p>
        </div>

        {success ? (
          <div className="flex flex-col items-center justify-center py-8 text-center animate-in zoom-in">
            <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
            <h3 className="font-bold text-lg">Thank You!</h3>
            <p className="text-gray-600 text-sm mb-6">Your suggestion has been recorded for review.</p>
            <button 
              onClick={() => { setSuccess(false); onClose(); }} 
              className="px-6 py-2 bg-black text-white rounded font-mono text-xs"
            >
              CLOSE
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Read-Only Parent Field */}
            <div>
              <label className="block text-xs font-mono mb-1 text-gray-500 uppercase">Parent Node (Fixed)</label>
              <input 
                disabled 
                value={parentNodeTitle} 
                className="w-full bg-gray-100 p-2 text-sm border border-gray-200 rounded font-mono text-gray-600 cursor-not-allowed" 
              />
            </div>

            <div>
              <label className="block text-xs font-mono mb-1 uppercase">New Path Title <span className="text-red-500">*</span></label>
              <input 
                required
                placeholder="e.g. Robotics Engineering" 
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded focus:border-black outline-none transition-all" 
              />
            </div>

            <div>
              <label className="block text-xs font-mono mb-1 uppercase">Description / Reason</label>
              <textarea 
                required
                placeholder="Briefly explain what this path is..." 
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded focus:border-black outline-none h-24 resize-none transition-all" 
              />
            </div>

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-black text-white py-3 font-mono text-sm hover:bg-neutral-800 transition-colors rounded flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="animate-spin w-4 h-4" />}
              {loading ? "SUBMITTING..." : "SUBMIT PROPOSAL"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}