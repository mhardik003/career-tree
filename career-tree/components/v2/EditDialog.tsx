"use client";

import { useEffect, useState } from "react";
import type { V2Node } from "@/lib/v2/types";

export default function EditDialog({
  isOpen,
  onClose,
  node,
}: {
  isOpen: boolean;
  onClose: () => void;
  node: V2Node;
}) {
  const [title, setTitle] = useState(node.title);
  const [description, setDescription] = useState(node.description);
  const [aliases, setAliases] = useState(node.aliases.join("\n"));
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setTitle(node.title);
    setDescription(node.description);
    setAliases(node.aliases.join("\n"));
    setError("");
    setSuccess(false);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [isOpen, node, onClose]);

  if (!isOpen) return null;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const proposedData = {
      title,
      description,
      aliases: aliases.split("\n").map((value) => value.trim()).filter(Boolean),
    };
    try {
      const response = await fetch("/api/edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetNodeId: node.id, proposedData }),
      });
      if (response.ok) {
        setSuccess(true);
      } else if (response.status === 429) {
        setError("Too many requests. Please wait a minute and try again.");
      } else if (response.status === 400 || response.status === 409) {
        const body = await response.json().catch(() => ({}));
        setError(body.message || "Please check the edit and try again.");
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
      data-testid="edit-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-dialog-title"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-black bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="edit-dialog-title" className="text-xl font-bold">Suggest an edit to {node.title}</h2>
            <p className="mt-1 text-sm text-gray-500">Edit only the canonical title, description, and aliases.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close edit dialog" className="text-xl">×</button>
        </div>

        {success ? (
          <div className="py-10 text-center">
            <h3 className="text-lg font-bold">Edit received</h3>
            <p className="mt-2 text-sm text-gray-600">Thank you. A moderator will review these changes.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
            <div>
              <label htmlFor="edit-title" className="text-sm font-medium">Title</label>
              <input id="edit-title" required minLength={2} maxLength={150} value={title} onChange={(event) => setTitle(event.target.value)} className="mt-1 w-full rounded-md border px-3 py-2" />
            </div>
            <div>
              <label htmlFor="edit-description" className="text-sm font-medium">Description</label>
              <textarea id="edit-description" required minLength={10} maxLength={4000} value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1 min-h-28 w-full rounded-md border px-3 py-2" />
            </div>
            <div>
              <label htmlFor="edit-aliases" className="text-sm font-medium">Aliases</label>
              <textarea id="edit-aliases" value={aliases} onChange={(event) => setAliases(event.target.value)} aria-describedby="edit-aliases-help" className="mt-1 min-h-24 w-full rounded-md border px-3 py-2" />
              <p id="edit-aliases-help" className="mt-1 text-xs text-gray-500">One alias per line.</p>
            </div>
            <button type="submit" disabled={loading} className="w-full rounded-md bg-black px-4 py-3 font-mono text-sm text-white disabled:opacity-50">
              {loading ? "Submitting…" : "Submit edit"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
