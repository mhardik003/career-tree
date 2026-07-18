import sys
import unittest
from copy import deepcopy
from pathlib import Path

from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from facts import NodeFacts, allowed_section_keys


VALID = {
    "schema_version": 1,
    "last_reviewed": "2026-07-19",
    "quick_facts": [
        {
            "label": "Duration",
            "value": "Three years",
            "source_urls": ["https://ugc.gov.in/"],
        }
    ],
    "sections": [
        {
            "key": "eligibility",
            "heading": "Eligibility",
            "paragraphs": ["Applicants complete Class 12."],
            "bullets": [],
            "source_urls": ["https://ugc.gov.in/"],
        }
    ],
    "useful_links": [
        {
            "label": "UGC",
            "url": "https://ugc.gov.in/",
            "kind": "official",
        }
    ],
    "prov": {
        "model": "gpt-5.6-terra",
        "prompt_version": "v2-enrichment-1",
        "generated_at": "2026-07-19",
    },
}


class FactsTests(unittest.TestCase):
    def test_valid_facts_use_schema_version_one(self):
        self.assertEqual(NodeFacts.model_validate(VALID).schema_version, 1)

    def test_sections_and_quick_facts_require_sources(self):
        without_section_sources = deepcopy(VALID)
        without_section_sources["sections"][0]["source_urls"] = []
        with self.assertRaises(ValidationError):
            NodeFacts.model_validate(without_section_sources)

        without_fact_sources = deepcopy(VALID)
        without_fact_sources["quick_facts"][0]["source_urls"] = []
        with self.assertRaises(ValidationError):
            NodeFacts.model_validate(without_fact_sources)

    def test_urls_are_http_only_normalized_and_deduplicated(self):
        payload = deepcopy(VALID)
        payload["sections"][0]["source_urls"] = [
            " HTTPS://UGC.GOV.IN/path#details ",
            "https://ugc.gov.in/path",
        ]
        facts = NodeFacts.model_validate(payload)
        self.assertEqual(
            facts.sections[0].source_urls,
            ["https://ugc.gov.in/path"],
        )

        payload["sections"][0]["source_urls"] = ["ftp://ugc.gov.in/path"]
        with self.assertRaises(ValidationError):
            NodeFacts.model_validate(payload)

    def test_sections_require_prose_and_extra_fields_are_forbidden(self):
        without_prose = deepcopy(VALID)
        without_prose["sections"][0]["paragraphs"] = []
        with self.assertRaises(ValidationError):
            NodeFacts.model_validate(without_prose)

        with_extra = deepcopy(VALID)
        with_extra["summary"] = "not in schema"
        with self.assertRaises(ValidationError):
            NodeFacts.model_validate(with_extra)

    def test_type_aware_section_keys_match_the_approved_contract(self):
        self.assertEqual(
            allowed_section_keys("degree"),
            (
                "eligibility",
                "duration",
                "curriculum",
                "admission",
                "costs",
                "next_options",
            ),
        )
        self.assertEqual(
            allowed_section_keys("job_role"),
            (
                "responsibilities",
                "entry_routes",
                "skills",
                "workplace",
                "progression",
                "compensation_context",
            ),
        )


if __name__ == "__main__":
    unittest.main()
