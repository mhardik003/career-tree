import os
import random
import time
from collections.abc import Callable
from typing import TypeVar

from openai import OpenAI
from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


class ProviderCallError(RuntimeError):
    pass


class OpenAIProvider:
    def __init__(
        self,
        client=None,
        sleeper: Callable[[float], None] = time.sleep,
    ):
        self.client = client or OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))
        self.sleeper = sleeper

    def structured(
        self,
        model: str,
        prompt: str,
        schema: type[T],
        web_search: bool,
        retries: int = 5,
    ) -> tuple[T, int]:
        last_error: Exception | None = None
        for attempt in range(retries):
            try:
                response = self.client.responses.parse(
                    model=model,
                    input=[{"role": "user", "content": prompt}],
                    text_format=schema,
                    tools=[{"type": "web_search"}] if web_search else [],
                )
                if response.output_parsed is None:
                    raise ValueError("OpenAI returned no parsed output")
                return response.output_parsed, int(
                    getattr(response.usage, "total_tokens", 0)
                )
            except Exception as exc:  # noqa: BLE001 - normalize provider failures
                last_error = exc
                if attempt + 1 < retries:
                    self.sleeper((2**attempt) + random.random())
        raise ProviderCallError(
            f"OpenAI call failed after {retries} attempts: {last_error}"
        )

    def embeddings(
        self,
        model: str,
        texts: list[str],
        dimensions: int,
    ) -> list[list[float]]:
        response = self.client.embeddings.create(
            model=model,
            input=texts,
            dimensions=dimensions,
            encoding_format="float",
        )
        return [list(item.embedding) for item in response.data]
