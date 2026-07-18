import hashlib
import json
from collections.abc import Sequence


def _digest(payload: dict) -> str:
    encoded = json.dumps(
        payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    )
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def call_cache_key(
    provider: str,
    model: str,
    prompt_version: str,
    schema_name: str,
    schema_json: str,
    prompt: str,
    tools: Sequence[str],
) -> str:
    return _digest(
        {
            "kind": "structured_call",
            "provider": provider,
            "model": model,
            "prompt_version": prompt_version,
            "schema_name": schema_name,
            "schema_json": schema_json,
            "prompt": prompt,
            "tools": list(tools),
        }
    )


def embedding_cache_key(
    provider: str,
    model: str,
    dimensions: int,
    normalizer: str,
    text: str,
) -> str:
    return _digest(
        {
            "kind": "embedding",
            "provider": provider,
            "model": model,
            "dimensions": dimensions,
            "normalizer": normalizer,
            "text": text,
        }
    )
