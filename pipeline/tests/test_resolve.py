import json
import gc
import random
import sys
import tempfile
import unittest
import warnings
from pathlib import Path
from unittest.mock import patch

from pydantic import ValidationError

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import resolve
from lib import Node, NodeType, Provenance, Registry, cosine
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


class NeighborMatmulTests(unittest.TestCase):
    """The vectorized (matrix @ query) shortlist must reproduce the brute-force
    pure-Python cosine loop it replaced: same neighbors, same order (including
    stable tie-breaks), scores within float tolerance."""

    @staticmethod
    def brute_force_neighbors(resolver, registry, node_type, vec, k=5):
        scored = [(nid, cosine(vec, v)) for nid, v in resolver.reg_vecs.items()
                  if registry.nodes[nid].type == node_type]
        return sorted(scored, key=lambda x: -x[1])[:k]

    def test_matmul_topk_matches_brute_force_cosine(self):
        rng = random.Random(20260720)
        types = [NodeType.job_role, NodeType.degree]
        fixtures, vectors = [], []
        for index in range(40):
            node_type = types[index % 2]
            fixtures.append(node(f"{node_type.value}:synth-{index:02d}", node_type,
                                 f"Synthetic {index:02d}", "synthetic fixture"))
            vectors.append([rng.uniform(-1.0, 1.0) for _ in range(32)])
        registry = in_memory_registry(*fixtures)
        resolver = Resolver(registry,
                            embedder=lambda texts: vectors[:len(texts)],
                            judge_call=None)
        for _ in range(10):
            query = [rng.uniform(-1.0, 1.0) for _ in range(32)]
            for node_type in types:
                expected = self.brute_force_neighbors(
                    resolver, registry, node_type, query)
                got = resolver._neighbors(node_type, query)
                self.assertEqual([nid for nid, _ in got],
                                 [nid for nid, _ in expected])
                for (_, got_score), (_, want_score) in zip(got, expected):
                    self.assertAlmostEqual(got_score, want_score, delta=1e-9)

    def test_minted_node_joins_the_score_matrix(self):
        registry = in_memory_registry(
            node("job_role:base", NodeType.job_role, "Base Role", "base role"))
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(
                resolve, "ER_LEDGER_FILE", str(Path(directory) / "ledger.jsonl")
            ):
                resolver = Resolver(
                    registry,
                    embedder=lambda texts: [[1.0, 0.0] for _ in texts],
                    judge_call=None,
                )
                minted = resolver._mint(
                    NodeType.job_role, "Minted Role", "a minted role",
                    "gpt-5.6-terra", [0.0, 1.0],
                    needs_review=False, reason="matrix sync test",
                )
        self.assertEqual(resolver.reg_vecs[minted.node_id], [0.0, 1.0])
        top_id, top_score = resolver._neighbors(
            NodeType.job_role, [0.0, 1.0], k=1)[0]
        self.assertEqual(top_id, minted.node_id)
        self.assertAlmostEqual(top_score, 1.0, delta=1e-12)


if __name__ == "__main__":
    unittest.main()
