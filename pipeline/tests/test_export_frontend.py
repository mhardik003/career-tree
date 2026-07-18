import json
import sys
import tempfile
import unittest
from pathlib import Path

PIPELINE_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(PIPELINE_DIR))

from export_frontend import (  # noqa: E402
    SnapshotError,
    build_snapshot,
    snapshot_matches,
    write_snapshot,
)


def node(node_id: str, node_type: str, title: str) -> dict:
    return {
        "id": node_id,
        "type": node_type,
        "title": title,
        "aliases": [],
        "description": f"Description for {title}",
        "is_terminal": False,
        "needs_review": False,
        "prov": {
            "model": "test",
            "prompt_version": "v2.0",
            "generated_at": "2026-07-17",
            "source_urls": [],
        },
    }


def edge(from_id: str, to_id: str, edge_type: str = "progression") -> dict:
    return {
        "id": f"{from_id}->{to_id}",
        "from_id": from_id,
        "to_id": to_id,
        "edge_type": edge_type,
        "is_common_route": True,
        "prov": {
            "model": "test",
            "prompt_version": "v2.0",
            "generated_at": "2026-07-17",
            "source_urls": [],
        },
    }


def facts() -> dict:
    return {
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
        "useful_links": [],
        "prov": {
            "model": "gpt-5.6-terra",
            "prompt_version": "v2-enrichment-1",
            "generated_at": "2026-07-19",
        },
    }


class ExportFrontendTests(unittest.TestCase):
    def setUp(self):
        self.nodes = [
            node("degree:mba", "degree", "MBA"),
            node("school_stage:class-10", "school_stage", "Class 10"),
        ]
        self.edges = [edge("school_stage:class-10", "degree:mba")]

    def test_build_snapshot_sorts_records_and_derives_stable_slug(self):
        result = build_snapshot(
            self.nodes, self.edges, "digest", require_facts=False
        )
        self.assertEqual(result["schema_version"], 1)
        self.assertEqual(result["root_id"], "school_stage:class-10")
        self.assertEqual(
            [n["id"] for n in result["nodes"]],
            ["degree:mba", "school_stage:class-10"],
        )
        self.assertEqual(result["nodes"][0]["slug"], "mba")
        self.assertEqual(result["source_digest"], "digest")

    def test_duplicate_node_id_is_rejected(self):
        with self.assertRaisesRegex(SnapshotError, "duplicate node id"):
            build_snapshot(
                self.nodes + [self.nodes[0]],
                self.edges,
                "digest",
                require_facts=False,
            )

    def test_missing_edge_endpoint_is_rejected(self):
        bad = [edge("school_stage:class-10", "degree:missing")]
        with self.assertRaisesRegex(SnapshotError, "unknown to_id"):
            build_snapshot(self.nodes, bad, "digest", require_facts=False)

    def test_type_prefix_must_match_declared_type(self):
        bad_nodes = [node("degree:mba", "job_role", "MBA"), self.nodes[1]]
        with self.assertRaisesRegex(SnapshotError, "type prefix"):
            build_snapshot(bad_nodes, [], "digest", require_facts=False)

    def test_snapshot_check_ignores_generated_at_but_detects_structural_change(self):
        expected = build_snapshot(
            self.nodes, self.edges, "digest", require_facts=False
        )
        existing = {**expected, "generated_at": "2026-01-01T00:00:00Z"}
        self.assertTrue(snapshot_matches(existing, expected))
        existing["edges"] = []
        self.assertFalse(snapshot_matches(existing, expected))

    def test_validation_failure_does_not_replace_existing_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / "graph.json"
            target.write_text('{"sentinel": true}\n', encoding="utf-8")
            with self.assertRaises(SnapshotError):
                invalid = build_snapshot(
                    self.nodes,
                    [edge("degree:missing", "degree:mba")],
                    "digest",
                    require_facts=False,
                )
                write_snapshot(target, invalid)
            self.assertEqual(json.loads(target.read_text()), {"sentinel": True})

    def test_production_snapshot_rejects_missing_facts(self):
        with self.assertRaisesRegex(SnapshotError, "missing facts"):
            build_snapshot(self.nodes, self.edges, "digest")

    def test_production_snapshot_accepts_validated_facts(self):
        complete_nodes = [{**record, "facts": facts()} for record in self.nodes]
        result = build_snapshot(complete_nodes, self.edges, "digest")
        self.assertEqual(result["nodes"][0]["facts"]["schema_version"], 1)


if __name__ == "__main__":
    unittest.main()
