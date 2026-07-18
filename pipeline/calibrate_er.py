"""Calibrate the OpenAI embedding shortlist against all 655 frozen ER labels.

Cosine similarity is retrieval-only: it decides which candidates reach the OpenAI
judge and never auto-merges a node.
"""
import argparse
import json
import os
from pathlib import Path
from typing import Iterable

from lib import (
    EMBED_DIMENSIONS,
    EMBED_MODEL,
    EMBED_NORMALIZER,
    PIPE_DIR,
    PROVIDER,
    atomic_write,
    cosine,
    embed_texts,
    normalize_title,
)

LABELS_FILE = os.path.join(PIPE_DIR, "eval", "er_labels.json")
REPORT_FILE = os.path.join(PIPE_DIR, "eval", "er_openai_report.json")
BAND_CANDIDATES = [0.0, 0.25, 0.50, 0.60, 0.65, 0.70, 0.75, 0.78, 0.80, 0.82, 0.85, 0.88, 0.90]


def pair_text(title: str, context: str) -> str:
    tail = " / ".join(context.split("/")[-2:]) if context else ""
    return f"{title} — context: {tail}"


def recommended_judge_band(
    similarities: Iterable[tuple[float, str, bool]],
    candidates: Iterable[float],
) -> float:
    non_exact_duplicates = [
        score
        for score, label, exact in similarities
        if label == "same_role" and not exact
    ]
    safe = [
        threshold
        for threshold in candidates
        if not any(score < threshold for score in non_exact_duplicates)
    ]
    if not safe:
        raise ValueError("every tested threshold misses at least one duplicate")
    return max(safe)


def build_report(
    similarities: list[tuple[float, str, bool]],
    labeled_pairs: int,
    candidates: Iterable[float] = BAND_CANDIDATES,
) -> dict:
    band = recommended_judge_band(similarities, candidates)
    missed = sum(
        label == "same_role" and not exact and score < band
        for score, label, exact in similarities
    )
    return {
        "provider": PROVIDER,
        "embedding_model": EMBED_MODEL,
        "dimensions": EMBED_DIMENSIONS,
        "normalizer": EMBED_NORMALIZER,
        "labeled_pairs": labeled_pairs,
        "recommended_judge_band": band,
        "missed_duplicates": missed,
    }


def write_report(report: dict, path: str | Path = REPORT_FILE) -> None:
    atomic_write(
        str(path),
        json.dumps(report, indent=2, sort_keys=True, ensure_ascii=False) + "\n",
    )


def similarity_rows(labels: list[dict]) -> list[tuple[float, str, bool]]:
    texts: list[str] = []
    seen: dict[str, int] = {}
    for pair in labels:
        for side in ("a", "b"):
            text = pair_text(pair[side], pair.get(f"{side}_context", ""))
            if text not in seen:
                seen[text] = len(texts)
                texts.append(text)

    print(f"embedding {len(texts)} unique texts ...")
    vectors = embed_texts(texts)
    rows: list[tuple[float, str, bool]] = []
    for pair in labels:
        a_text = pair_text(pair["a"], pair.get("a_context", ""))
        b_text = pair_text(pair["b"], pair.get("b_context", ""))
        exact = normalize_title(pair["a"]) == normalize_title(pair["b"])
        rows.append(
            (
                cosine(vectors[seen[a_text]], vectors[seen[b_text]]),
                pair["label"],
                exact,
            )
        )
    return rows


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args(argv)

    with open(LABELS_FILE, encoding="utf-8") as labels_file:
        labels = json.load(labels_file)["labels"]
    print(
        f"{len(labels)} usable labeled pairs "
        f"({sum(pair['label'] == 'same_role' for pair in labels)} same_role)"
    )

    similarities = similarity_rows(labels)
    report = build_report(similarities, len(labels))
    print(json.dumps(report, indent=2, sort_keys=True))
    if args.write:
        write_report(report)
        print(f"wrote {REPORT_FILE}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
