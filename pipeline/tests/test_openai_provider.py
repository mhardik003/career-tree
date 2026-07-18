import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

from pydantic import BaseModel

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from openai_provider import OpenAIProvider, ProviderCallError


class Answer(BaseModel):
    value: str


class FakeResponses:
    def __init__(self, outcomes):
        self.outcomes = iter(outcomes)

    def parse(self, **kwargs):
        outcome = next(self.outcomes)
        if isinstance(outcome, Exception):
            raise outcome
        return SimpleNamespace(
            output_parsed=outcome,
            usage=SimpleNamespace(total_tokens=7),
        )


class ProviderTests(unittest.TestCase):
    def test_structured_call_returns_parsed_model(self):
        client = SimpleNamespace(responses=FakeResponses([Answer(value="ok")]))
        result, usage = OpenAIProvider(
            client=client, sleeper=lambda _: None
        ).structured(
            "gpt-5.6-luna", "prompt", Answer, web_search=False, retries=1
        )
        self.assertEqual(result.value, "ok")
        self.assertEqual(usage, 7)

    def test_persistent_failure_raises_provider_error(self):
        client = SimpleNamespace(responses=FakeResponses([RuntimeError("down")]))
        with self.assertRaisesRegex(ProviderCallError, "down"):
            OpenAIProvider(client=client, sleeper=lambda _: None).structured(
                "gpt-5.6-luna",
                "prompt",
                Answer,
                web_search=False,
                retries=1,
            )


if __name__ == "__main__":
    unittest.main()
