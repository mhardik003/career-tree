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
        self.calls = []

    def parse(self, **kwargs):
        self.calls.append(kwargs)
        outcome = next(self.outcomes)
        if isinstance(outcome, Exception):
            raise outcome
        return SimpleNamespace(
            output_parsed=outcome,
            usage=SimpleNamespace(total_tokens=7),
        )


class FakeEmbeddings:
    def __init__(self, outcomes):
        self.outcomes = iter(outcomes)
        self.calls = []

    def create(self, **kwargs):
        self.calls.append(kwargs)
        outcome = next(self.outcomes)
        if isinstance(outcome, Exception):
            raise outcome
        return SimpleNamespace(
            data=[SimpleNamespace(embedding=vector) for vector in outcome]
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

    def test_validation_failure_is_retried_once_with_feedback(self):
        with self.assertRaises(Exception) as invalid:
            Answer.model_validate({})
        responses = FakeResponses([invalid.exception, Answer(value="fixed")])
        client = SimpleNamespace(responses=responses)

        result, _usage = OpenAIProvider(
            client=client, sleeper=lambda _: None
        ).structured(
            "gpt-5.6-luna", "prompt", Answer, web_search=False, retries=5
        )

        self.assertEqual(result.value, "fixed")
        retry_prompt = responses.calls[1]["input"][0]["content"]
        self.assertIn("validation", retry_prompt.lower())
        self.assertIn("value", retry_prompt)

    def test_embeddings_retry_then_return_vectors(self):
        embeddings = FakeEmbeddings(
            [RuntimeError("temporary"), [[1.0, 0.0], [0.0, 1.0]]]
        )
        client = SimpleNamespace(embeddings=embeddings)

        result = OpenAIProvider(client=client, sleeper=lambda _: None).embeddings(
            "text-embedding-3-large",
            ["MBA", "BCA"],
            dimensions=1024,
            retries=2,
        )

        self.assertEqual(result, [[1.0, 0.0], [0.0, 1.0]])
        self.assertEqual(len(embeddings.calls), 2)


if __name__ == "__main__":
    unittest.main()
