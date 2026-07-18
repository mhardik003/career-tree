"use client";

export default function SearchCareerButton() {
  return (
    <button
      type="button"
      onClick={() => {
        const input = document.getElementById("career-search");
        input?.scrollIntoView({ behavior: "smooth", block: "center" });
        input?.focus({ preventScroll: true });
      }}
      className="rounded-lg border border-black bg-white px-6 py-3 font-mono text-sm transition hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black focus-visible:ring-offset-2"
    >
      Search for a career
    </button>
  );
}
