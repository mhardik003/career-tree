"""Shared helpers for the v2 registry build (Stage 1). See ../DATA_ARCHITECTURE_V2.md §6, §8.

Determinism rules: sorted iteration everywhere, no RNG, and every LLM decision goes through
DecisionLog (replay-not-redecide) so a crashed or re-run build reproduces the same registry.
"""
import hashlib
import json
import os
import re
import time

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "..", "career-tree", "data")
TREE_FILE = os.path.join(DATA, "career_tree_data.json")
META_FILE = os.path.join(DATA, "metadata.json")
DECISIONS_FILE = os.path.join(HERE, "decisions.jsonl")

NODE_TYPES = ("job", "degree_or_stage", "exam_gateway", "category")


def slug(t: str) -> str:
    t = re.sub(r"[^a-z0-9]+", "-", t.lower())
    return re.sub(r"(^-|-$)+", "", t)


def tight(t: str) -> str:
    return slug(t).replace("-", "")


def toks(t: str) -> frozenset:
    return frozenset(slug(t).split("-"))


def strip_parens(t: str) -> str:
    return re.sub(r"\s*\([^)]*\)", "", t).strip()


def load_tree():
    with open(TREE_FILE, encoding="utf-8") as f:
        return json.load(f)


def load_meta():
    with open(META_FILE, encoding="utf-8") as f:
        return json.load(f)


def canonical_primary(keys, tree, meta):
    """The app's canonical-primary rule (career-tree/lib/treeUtils.ts): fewest path
    segments -> has rich metadata -> most children -> lexicographic. Frozen-slug minting
    depends on this being identical to production behavior."""
    return sorted(
        keys,
        key=lambda k: (
            len(k.split("/")),
            0 if k in meta else 1,
            -len(tree.get(k, {}).get("children") or []),
            k,
        ),
    )[0]


class DecisionLog:
    """Append-only jsonl of LLM decisions keyed by a deterministic payload hash.
    Replays instead of re-asking; this is what makes the build resumable and
    re-runnable without minting a different registry."""

    def __init__(self, path=DECISIONS_FILE):
        self.path = path
        self._cache = {}
        if os.path.exists(path):
            with open(path, encoding="utf-8") as f:
                for line in f:
                    try:
                        rec = json.loads(line)
                        self._cache[rec["key"]] = rec["value"]
                    except (json.JSONDecodeError, KeyError):
                        continue

    @staticmethod
    def key_for(kind: str, payload) -> str:
        blob = json.dumps([kind, payload], sort_keys=True, ensure_ascii=False)
        return hashlib.sha1(blob.encode()).hexdigest()

    def get(self, kind: str, payload):
        return self._cache.get(self.key_for(kind, payload))

    def put(self, kind: str, payload, value):
        key = self.key_for(kind, payload)
        self._cache[key] = value
        with open(self.path, "a", encoding="utf-8") as f:
            f.write(json.dumps({"key": key, "kind": kind, "payload": payload,
                                "value": value}, ensure_ascii=False) + "\n")


def gemini_client():
    """Client from the repo .env (dotenv_values: a stale exported GEMINI_API_KEY in the
    shell must not shadow the file — that bit us once already)."""
    from dotenv import dotenv_values
    from google import genai
    key = dotenv_values(os.path.join(HERE, "..", ".env")).get("GEMINI_API_KEY")
    if not key:
        raise SystemExit("GEMINI_API_KEY missing from repo .env")
    return genai.Client(api_key=key)


def generate_json(client, model, prompt, schema, max_retries=5):
    """Structured-output call with exponential backoff; returns parsed JSON."""
    delay = 2.0
    for attempt in range(max_retries):
        try:
            resp = client.models.generate_content(
                model=model,
                contents=prompt,
                config={
                    "response_mime_type": "application/json",
                    "response_json_schema": schema,
                },
            )
            return json.loads(resp.text)
        except Exception as exc:  # noqa: BLE001 — API surface throws many types
            if attempt == max_retries - 1:
                raise
            print(f"    retry {attempt + 1} after error: {str(exc)[:120]}")
            time.sleep(delay)
            delay = min(delay * 2, 60)
