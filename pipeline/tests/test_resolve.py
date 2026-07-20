import json
import gc
import sys
import tempfile
import unittest
import warnings
from pathlib import Path
from unittest.mock import patch

from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import resolve
from lib import Node, NodeType, Provenance, Registry
from resolve import JUDGE_MODEL, JudgeVerdict, Resolver


def in_memory_registry(*nodes: Node) -> Registry:
    registry = Registry.__new__(Registry)
    registry.nodes = {}
    registry.edges = {}
    registry._alias_index = {}
    registry._rebuild_edge_index()
    for node in nodes:
        registry.add_node(node)
    return registry


def node(node_id: str, node_type: NodeType, title: str, description: str) -> Node:
    return Node(
        id=node_id,
        type=node_type,
        title=title,
        description=description,
        prov=Provenance(model="fixture", generated_at="2026-07-19"),
    )


class ResolverTests(unittest.TestCase):
    def test_judge_verdict_rejects_unknown_decisions_and_missing_matches(self):
        with self.assertRaises(ValidationError):
            JudgeVerdict(
                decision="merge",
                matched_id=None,
                rule=1,
                rationale="not an allowed decision",
            )
        with self.assertRaises(ValidationError):
            JudgeVerdict(
                decision="same_role",
                matched_id=None,
                rule=1,
                rationale="missing the selected candidate",
            )

    def test_rubric_table_does_not_leak_an_open_file(self):
        with patch.object(resolve, "_RUBRIC_TABLE", None):
            with warnings.catch_warnings(record=True) as caught:
                warnings.simplefilter("always", ResourceWarning)
                resolve.rubric_table()
                gc.collect()

        self.assertFalse(
            [warning for warning in caught if warning.category is ResourceWarning]
        )

    def test_exact_alias_match_links_without_calling_judge(self):
        registry = in_memory_registry(
            node("degree:mba", NodeType.degree, "Master of Business Administration", "degree")
        )
        registry.add_alias("degree:mba", "MBA")

        def judge_call(*_args, **_kwargs):
            self.fail("exact matches must not call the judge")

        with tempfile.TemporaryDirectory() as directory:
            with patch.object(
                resolve, "ER_LEDGER_FILE", str(Path(directory) / "ledger.jsonl")
            ):
                resolver = Resolver(
                    registry,
                    embedder=lambda texts: [[1.0, 0.0] for _ in texts],
                    judge_call=judge_call,
                )
                result = resolver.resolve(
                    NodeType.degree,
                    "MBA",
                    "degree",
                    None,
                    "gpt-5.6-terra",
                )

        self.assertEqual(result.action, "linked")
        self.assertEqual(result.node_id, "degree:mba")

    def test_unsure_judgment_mints_and_flags_for_review(self):
        parent = node(
            "school_stage:class-10",
            NodeType.school_stage,
            "Class 10",
            "root",
        )
        registry = in_memory_registry(
            parent,
            node(
                "job_role:business-analyst",
                NodeType.job_role,
                "Business Analyst",
                "Analyzes business processes.",
            ),
        )
        judge_models = []

        def judge_call(model, _prompt, _schema):
            judge_models.append(model)
            return JudgeVerdict(
                decision="unsure",
                matched_id=None,
                rule=12,
                rationale="qualifier is ambiguous",
            )

        with tempfile.TemporaryDirectory() as directory:
            ledger_path = Path(directory) / "ledger.jsonl"
            with patch.object(resolve, "ER_LEDGER_FILE", str(ledger_path)):
                resolver = Resolver(
                    registry,
                    embedder=lambda texts: [[1.0, 0.0] for _ in texts],
                    judge_call=judge_call,
                )
                result = resolver.resolve(
                    NodeType.job_role,
                    "Senior Analyst",
                    "senior role",
                    parent,
                    "gpt-5.6-terra",
                )

            ledger_row = json.loads(ledger_path.read_text().splitlines()[-1])

        self.assertEqual(result.action, "minted")
        self.assertTrue(registry.nodes[result.node_id].needs_review)
        self.assertEqual(judge_models, [JUDGE_MODEL])
        self.assertEqual(ledger_row["judge_model"], JUDGE_MODEL)
        self.assertEqual(
            ledger_row["candidates"][0]["id"], "job_role:business-analyst"
        )

    def test_same_role_outside_supplied_shortlist_mints_for_review(self):
        registry = in_memory_registry(
            *[
                node(
                    f"job_role:analyst-{index}",
                    NodeType.job_role,
                    f"Analyst {index}",
                    f"Analysis role {index}.",
                )
                for index in range(1, 5)
            ]
        )

        def judge_call(_model, _prompt, _schema):
            return JudgeVerdict(
                decision="same_role",
                matched_id="job_role:analyst-4",
                rule=1,
                rationale="selected a node that was not supplied",
            )

        with tempfile.TemporaryDirectory() as directory:
            with patch.object(
                resolve, "ER_LEDGER_FILE", str(Path(directory) / "ledger.jsonl")
            ):
                resolver = Resolver(
                    registry,
                    embedder=lambda texts: [[1.0, 0.0] for _ in texts],
                    judge_call=judge_call,
                )
                result = resolver.resolve(
                    NodeType.job_role,
                    "Analyst Candidate",
                    "A candidate analysis role.",
                    None,
                    "gpt-5.6-terra",
                )

        self.assertEqual(result.action, "minted")
        self.assertNotEqual(result.node_id, "job_role:analyst-4")
        self.assertTrue(registry.nodes[result.node_id].needs_review)


if __name__ == "__main__":
    unittest.main()
