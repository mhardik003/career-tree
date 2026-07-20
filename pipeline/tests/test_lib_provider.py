import contextlib
import io
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from pydantic import BaseModel

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import lib


class Answer(BaseModel):
    value: str


class FakeProvider:
    def __init__(self):
        self.structured_calls = []
        self.embedding_calls = []

    def structured(self, model, prompt, schema, web_search):
        self.structured_calls.append((model, prompt, schema, web_search))
        return schema(value="ok"), 9

    def embeddings(self, model, texts, dimensions):
        self.embedding_calls.append((model, texts, dimensions))
        return [[float(index), 1.0] for index, _ in enumerate(texts)]


class LibraryProviderTests(unittest.TestCase):
    def test_call_json_uses_openai_provider_and_replays_namespaced_cache(self):
        provider = FakeProvider()
        with tempfile.TemporaryDirectory() as directory:
            cache_path = str(Path(directory) / "calls.jsonl")
            usage_path = str(Path(directory) / "usage.jsonl")
            with (
                patch.object(lib, "_provider", provider, create=True),
                patch.object(lib, "CALL_CACHE_FILE", cache_path),
                patch.object(lib, "USAGE_FILE", usage_path, create=True),
                patch.object(lib, "_call_cache", None),
                patch.object(
                    lib,
                    "legacy_provider",
                    side_effect=AssertionError("legacy provider used"),
                    create=True,
                ),
                patch.object(
                    lib.time,
                    "sleep",
                    side_effect=AssertionError("legacy retry used"),
                ),
            ):
                first = lib.call_json(
                    "gpt-5.6-luna",
                    "prompt",
                    Answer,
                    prompt_version="test-v1",
                    web_search=True,
                )
                second = lib.call_json(
                    "gpt-5.6-luna",
                    "prompt",
                    Answer,
                    prompt_version="test-v1",
                    web_search=True,
                )

            self.assertEqual(first.value, "ok")
            self.assertEqual(second.value, "ok")
            self.assertEqual(len(provider.structured_calls), 1)
            cache_row = lib.read_jsonl(cache_path)[0]
            self.assertEqual(cache_row["provider"], "openai")
            self.assertEqual(cache_row["prompt_version"], "test-v1")
            self.assertEqual(cache_row["tools"], ["web_search"])
            self.assertEqual(lib.read_jsonl(usage_path)[0]["usage_tokens"], 9)

    def test_embed_texts_uses_openai_model_dimensions_and_cache(self):
        provider = FakeProvider()
        with tempfile.TemporaryDirectory() as directory:
            cache_path = str(Path(directory) / "embeddings.jsonl")
            with (
                patch.object(lib, "_provider", provider, create=True),
                patch.object(lib, "EMBED_CACHE_FILE", cache_path),
                patch.object(lib, "_embed_cache", None),
                patch.object(
                    lib,
                    "legacy_provider",
                    side_effect=AssertionError("legacy provider used"),
                    create=True,
                ),
                patch.object(
                    lib.time,
                    "sleep",
                    side_effect=AssertionError("legacy retry used"),
                ),
            ):
                first = lib.embed_texts(["MBA", "BCA"])
                second = lib.embed_texts(["MBA", "BCA"])

            self.assertEqual(first, second)
            self.assertEqual(
                provider.embedding_calls,
                [("text-embedding-3-large", ["MBA", "BCA"], 1024)],
            )
            rows = lib.read_jsonl(cache_path)
            self.assertEqual({row["dimensions"] for row in rows}, {1024})
            self.assertEqual({row["normalizer"] for row in rows}, {"er-v2"})

    def test_warn_if_large_flags_only_oversized_cache_files(self):
        with tempfile.TemporaryDirectory() as directory:
            path = str(Path(directory) / "call_cache.jsonl")
            Path(path).write_text("x" * 64, encoding="utf-8")

            quiet = io.StringIO()
            with contextlib.redirect_stderr(quiet):
                lib._warn_if_large(path, limit=1024)
                lib._warn_if_large(str(Path(directory) / "absent.jsonl"))
            self.assertEqual(quiet.getvalue(), "")

            noisy = io.StringIO()
            with contextlib.redirect_stderr(noisy):
                lib._warn_if_large(path, limit=10)
            self.assertIn("loaded fully into RAM", noisy.getvalue())
            self.assertIn(path, noisy.getvalue())


if __name__ == "__main__":
    unittest.main()
