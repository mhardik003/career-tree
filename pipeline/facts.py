"""Strict, source-backed enrichment models shared by the V2 pipeline."""
from datetime import date
from typing import Annotated, Literal
from urllib.parse import urlsplit, urlunsplit

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    StringConstraints,
    field_validator,
    model_validator,
)

NonEmptyText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


def normalize_url(value: str) -> str:
    raw = value.strip()
    parsed = urlsplit(raw)
    scheme = parsed.scheme.lower()
    if scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("source URLs must use HTTP(S)")
    if parsed.username or parsed.password:
        raise ValueError("source URLs must not contain credentials")
    host = parsed.hostname.lower()
    if ":" in host and not host.startswith("["):
        host = f"[{host}]"
    netloc = host
    if parsed.port is not None:
        netloc = f"{netloc}:{parsed.port}"
    return urlunsplit((scheme, netloc, parsed.path or "/", parsed.query, ""))


def _normalize_urls(values: list[str]) -> list[str]:
    normalized: list[str] = []
    seen: set[str] = set()
    for value in values:
        url = normalize_url(value)
        if url not in seen:
            seen.add(url)
            normalized.append(url)
    return normalized


def _validate_date(value: str) -> str:
    date.fromisoformat(value)
    return value


class StrictFactsModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class FactItem(StrictFactsModel):
    label: NonEmptyText
    value: NonEmptyText
    source_urls: list[str] = Field(min_length=1)

    @field_validator("source_urls")
    @classmethod
    def normalize_sources(cls, values: list[str]) -> list[str]:
        return _normalize_urls(values)


class ArticleSection(StrictFactsModel):
    key: NonEmptyText
    heading: NonEmptyText
    paragraphs: list[NonEmptyText]
    bullets: list[NonEmptyText]
    source_urls: list[str] = Field(min_length=1)

    @field_validator("source_urls")
    @classmethod
    def normalize_sources(cls, values: list[str]) -> list[str]:
        return _normalize_urls(values)

    @model_validator(mode="after")
    def require_prose(self):
        if not self.paragraphs and not self.bullets:
            raise ValueError("article sections require at least one paragraph or bullet")
        return self


class UsefulLink(StrictFactsModel):
    label: NonEmptyText
    url: str
    kind: NonEmptyText

    @field_validator("url")
    @classmethod
    def normalize_link(cls, value: str) -> str:
        return normalize_url(value)


class EnrichmentProvenance(StrictFactsModel):
    model: Literal["gpt-5.6-terra"]
    prompt_version: Literal["v2-enrichment-1"]
    generated_at: str

    @field_validator("generated_at")
    @classmethod
    def validate_generated_at(cls, value: str) -> str:
        return _validate_date(value)


class NodeFacts(StrictFactsModel):
    schema_version: Literal[1]
    last_reviewed: str
    quick_facts: list[FactItem]
    sections: list[ArticleSection] = Field(min_length=1)
    useful_links: list[UsefulLink]
    prov: EnrichmentProvenance

    @field_validator("last_reviewed")
    @classmethod
    def validate_last_reviewed(cls, value: str) -> str:
        return _validate_date(value)


_SECTION_KEYS = {
    "degree": (
        "eligibility",
        "duration",
        "curriculum",
        "admission",
        "costs",
        "next_options",
    ),
    "diploma": (
        "eligibility",
        "duration",
        "curriculum",
        "admission",
        "costs",
        "next_options",
    ),
    "certification": (
        "eligibility",
        "duration",
        "curriculum",
        "admission",
        "costs",
        "next_options",
    ),
    "training": (
        "eligibility",
        "duration",
        "curriculum",
        "admission",
        "costs",
        "next_options",
    ),
    "exam": (
        "purpose",
        "eligibility",
        "format",
        "application_process",
        "preparation",
        "outcomes",
    ),
    "job_role": (
        "responsibilities",
        "entry_routes",
        "skills",
        "workplace",
        "progression",
        "compensation_context",
    ),
    "government_service": (
        "responsibilities",
        "entry_routes",
        "skills",
        "workplace",
        "progression",
        "compensation_context",
    ),
    "entrepreneurship": (
        "entry_routes",
        "capabilities",
        "operating_model",
        "compliance",
        "growth_paths",
    ),
    "school_stage": (
        "subjects",
        "selection_considerations",
        "future_routes",
    ),
    "stream": (
        "subjects",
        "selection_considerations",
        "future_routes",
    ),
}


def allowed_section_keys(node_type: str) -> tuple[str, ...]:
    try:
        return _SECTION_KEYS[node_type]
    except KeyError as exc:
        raise ValueError(f"unknown node type: {node_type}") from exc
