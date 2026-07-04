"""Calibrate ER thresholds against the frozen labeled set (pipeline/eval/er_labels.json,
655 pairs, dual-agent consensus, salvaged from v2 Stage 0).

For every labeled pair we compute the resolver's deterministic signals (normalized
exact match, embedding cosine) and report, per candidate threshold pair:
  - auto-merge precision  (of pairs >= AUTO_LINK, how many are truly same_role)
  - judge-band load       (share of pairs falling into the judge band)
  - mint miss rate        (truly same_role pairs that fall below the judge band —
                           duplicates the ladder would silently re-mint)
Embeddings use title + context tail (the labels predate definitions).

Run:  python pipeline/calibrate_er.py
"""
import json
import os

from lib import normalize_title, embed_texts, cosine, PIPE_DIR

LABELS_FILE = os.path.join(PIPE_DIR, "eval", "er_labels.json")

AUTO_CANDIDATES = [0.90, 0.92, 0.93, 0.94, 0.95]
BAND_CANDIDATES = [0.75, 0.78, 0.80, 0.82]


def pair_text(title: str, context: str) -> str:
    tail = " / ".join(context.split("/")[-2:]) if context else ""
    return f"{title} — context: {tail}"


def main():
    data = json.load(open(LABELS_FILE))
    pairs = [p for p in data["labels"] if p["label"] in ("same_role", "distinct")]
    print(f"{len(pairs)} usable labeled pairs "
          f"({sum(p['label'] == 'same_role' for p in pairs)} same_role)")

    texts, seen = [], {}
    for p in pairs:
        for side in ("a", "b"):
            t = pair_text(p[side], p.get(f"{side}_context", ""))
            if t not in seen:
                seen[t] = len(texts)
                texts.append(t)
    print(f"embedding {len(texts)} unique texts ...")
    vecs = embed_texts(texts)

    exact_hits = same_exact = 0
    sims = []
    for p in pairs:
        a = pair_text(p["a"], p.get("a_context", ""))
        b = pair_text(p["b"], p.get("b_context", ""))
        exact = normalize_title(p["a"]) == normalize_title(p["b"])
        if exact:
            exact_hits += 1
            same_exact += p["label"] == "same_role"
        sims.append((cosine(vecs[seen[a]], vecs[seen[b]]), p["label"], exact))

    print(f"\nGate 1 (normalized exact): fires on {exact_hits} pairs, "
          f"{same_exact} correctly same_role, {exact_hits - same_exact} WRONG merges")

    rest = [(s, lbl) for s, lbl, exact in sims if not exact]
    print(f"\n{len(rest)} pairs reach the embedding gate. threshold sweep:")
    print(f"{'auto':>5} {'band':>5} | {'auto-merge P':>12} {'auto hits':>9} | "
          f"{'judge load':>10} | {'missed dupes':>12}")
    for auto in AUTO_CANDIDATES:
        for band in BAND_CANDIDATES:
            auto_pairs = [(s, l) for s, l in rest if s >= auto]
            judge_pairs = [(s, l) for s, l in rest if band <= s < auto]
            below = [(s, l) for s, l in rest if s < band]
            tp = sum(l == "same_role" for _, l in auto_pairs)
            prec = tp / len(auto_pairs) if auto_pairs else 1.0
            missed = sum(l == "same_role" for _, l in below)
            print(f"{auto:>5} {band:>5} | {prec:>12.3f} {len(auto_pairs):>9} | "
                  f"{len(judge_pairs):>10} | {missed:>12}")

    same_sims = sorted(s for s, l in rest if l == "same_role")
    dist_sims = sorted(s for s, l in rest if l == "distinct")
    if same_sims and dist_sims:
        med = lambda xs: xs[len(xs) // 2]
        print(f"\nsame_role cosine: min {same_sims[0]:.3f} med {med(same_sims):.3f}; "
              f"distinct cosine: med {med(dist_sims):.3f} max {dist_sims[-1]:.3f}")


if __name__ == "__main__":
    main()
