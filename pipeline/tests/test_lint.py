import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from facts import NodeFacts
from lib import Node, NodeType, Provenance, Registry
from lint import release_errors


def registry_with_root() -> Registry:
    registry = Registry.__new__(Registry)
    registry.nodes = {}
    registry.edges = {}
    registry._alias_index = {}
    registry._rebuild_edge_index()
    registry.add_node(
        Node(
            id="school_stage:class-10",
            type=NodeType.school_stage,
            title="Class 10",
            description="Root stage",
            prov=Provenance(model="fixture", generated_at="2026-07-19"),
        )
    )
    return registry


class ReleaseLintTests(unittest.TestCase):
    def test_release_errors_cover_facts_frontier_and_failure_ledger(self):
        errors = release_errors(
            registry_with_root(),
            frontier={
                "queue": [{"id": "school_stage:class-10", "depth": 3}],
                "expanded": [],
            },
            failure_rows=[
                {
                    "stage": "enrichment",
                    "node_id": "school_stage:class-10",
                    "error": "failed",
                }
            ],
        )

        self.assertTrue(any("missing facts" in error for error in errors))
        self.assertTrue(any("frontier" in error for error in errors))
        self.assertTrue(any("failure" in error for error in errors))

    def test_release_rejects_section_keys_not_allowed_for_node_type(self):
        registry = registry_with_root()
        registry.nodes["school_stage:class-10"].facts = NodeFacts.model_validate({
            "schema_version": 1,
            "last_reviewed": "2026-07-19",
            "quick_facts": [],
            "sections": [{
                "key": "compensation_context",
                "heading": "Invalid section",
                "paragraphs": ["This section is not valid for a school stage."],
                "bullets": [],
                "source_urls": ["https://education.gov.in/"],
            }],
            "useful_links": [],
            "prov": {
                "model": "gpt-5.6-terra",
                "prompt_version": "v2-enrichment-1",
                "generated_at": "2026-07-19",
            },
        })

        errors = release_errors(registry, {"queue": []}, [])

        self.assertTrue(any("unsupported section" in error for error in errors))


if __name__ == "__main__":
    unittest.main()
