import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from cache_keys import call_cache_key, embedding_cache_key


class CacheKeyTests(unittest.TestCase):
    def test_call_key_changes_with_provider_model_schema_and_tools(self):
        base = call_cache_key(
            "openai", "gpt-5.6-terra", "v3", "S", "{}", "hello", ()
        )
        self.assertNotEqual(
            base,
            call_cache_key(
                "legacy-provider", "gpt-5.6-terra", "v3", "S", "{}", "hello", ()
            ),
        )
        self.assertNotEqual(
            base,
            call_cache_key(
                "openai", "gpt-5.6-luna", "v3", "S", "{}", "hello", ()
            ),
        )
        self.assertNotEqual(
            base,
            call_cache_key(
                "openai", "gpt-5.6-terra", "v3", "S", '{"x":1}', "hello", ()
            ),
        )
        self.assertNotEqual(
            base,
            call_cache_key(
                "openai",
                "gpt-5.6-terra",
                "v3",
                "S",
                "{}",
                "hello",
                ("web_search",),
            ),
        )

    def test_embedding_key_changes_with_model_dimensions_and_normalizer(self):
        base = embedding_cache_key(
            "openai", "text-embedding-3-large", 1024, "er-v2", "MBA"
        )
        self.assertNotEqual(
            base,
            embedding_cache_key(
                "openai", "text-embedding-3-large", 768, "er-v2", "MBA"
            ),
        )
        self.assertNotEqual(
            base,
            embedding_cache_key(
                "openai", "text-embedding-3-large", 1024, "er-v3", "MBA"
            ),
        )


if __name__ == "__main__":
    unittest.main()
