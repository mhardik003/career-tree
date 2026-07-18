"use client";

import { useEffect, useState } from "react";

export default function SuggestionDialog({
  isOpen,
  onClose,
  parentNodeId,
  parentTitle,
}: {
  isOpen: boolean;
  onClose: () => void;
  parentNodeId: string;
  parentTitle: string;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentNodeId, title, description }),
      });
      if (response.ok) {
        setSuccess(true);
      } else if (response.status === 429) {
        setError("Too many requests. Please wait a minute and try again.");
      } else if (response.status === 400 || response.status === 409) {
        const body = await response.json().catch(() => ({}));
        setError(body.message || "Please check the suggestion and try again.");
      } else {
        setError("Something went wrong. Please try again later.");
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      data-testid="suggestion-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="suggestion-dialog-title"
        className="w-full max-w-lg rounded-xl border border-black bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="suggestion-dialog-title" className="text-xl font-bold">
              Suggest a next option after {parentTitle}
            </h2>
            <p className="mt-1 text-sm text-gray-500">Submissions are reviewed before the graph changes.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close suggestion dialog" className="text-xl">×</button>
        </div>

        {success ? (
          <div className="py-10 text-center">
            <h3 className="text-lg font-bold">Suggestion received</h3>
            <p className="mt-2 text-sm text-gray-600">Thank you. A moderator will review this option.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <div>
              <label htmlFor="suggestion-title" className="text-sm font-medium">Option title</label>
              <input
                id="suggestion-title"
                required
                minLength={5}
                maxLength={100}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-1 w-full rounded-md border px-3 py-2"
              />
            </div>
            <div>
              <label htmlFor="suggestion-description" className="text-sm font-medium">Option description</label>
              <textarea
                id="suggestion-description"
                required
                minLength={10}
                maxLength={1000}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="mt-1 min-h-28 w-full rounded-md border px-3 py-2"
              />
            </div>
            <button type="submit" disabled={loading} className="w-full rounded-md bg-black px-4 py-3 font-mono text-sm text-white disabled:opacity-50">
              {loading ? "Submitting…" : "Submit suggestion"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
