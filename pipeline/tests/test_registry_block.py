"""Registry.registry_block_for: the bounded per-expansion registry slice.

The slice is duplicate-avoidance context for the LLM only (the ER resolver is the
real dedup gate and sees the full registry); these tests pin its contract: caps,
determinism, tier priority (trail + neighbors survive the cap before the same-type
cohort fill), and graceful degradation when no embedding vector is available.
"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib import Node, NodeType, Provenance, Registry


def in_memory_registry(*nodes: Node) -> Registry:
    registry = Registry.__new__(Registry)
    registry.nodes = {}
    registry.edges = {}
    registry._alias_index = {}
    registry._rebuild_edge_index()
    for item in nodes:
        registry.add_node(item)
    return registry


def node(node_id: str, node_type: NodeType, title: str) -> Node:
    return Node(
        id=node_id,
        type=node_type,
        title=title,
        description=title,
        prov=Provenance(model="fixture", generated_at="2026-07-20"),
    )


def fixture_registry() -> Registry:
    items = [
        node("school_stage:class-10", NodeType.school_stage, "Class 10"),
        node("stream:science", NodeType.stream, "Science Stream"),
        node("exam:special", NodeType.exam, "Special Entrance Exam"),
        node("degree:unrelated", NodeType.degree, "Unrelated Degree"),
        node("job_role:target", NodeType.job_role, "Target Role"),
    ]
    items += [
        node(f"job_role:cohort-{index:02d}", NodeType.job_role, f"Cohort Role {index:02d}")
        for index in range(20)
    ]
    return in_memory_registry(*items)


TRAIL = ["school_stage:class-10", "stream:science", "job_role:target"]

# target is nearest to exam:special; the cohort is orthogonal (ties broken by id).
VECS = {
    "job_role:target": [1.0, 0.0],
    "exam:special": [0.9, 0.1],
    **{f"job_role:cohort-{index:02d}": [0.0, 1.0] for index in range(20)},
}


class RegistryBlockForTests(unittest.TestCase):
    def test_same_type_cohort_and_trail_included_under_cap(self):
        reg = fixture_registry()
        block = reg.registry_block_for("job_role:target", trail_ids=TRAIL)
        lines = block.splitlines()
        self.assertIn("job_role:target | Target Role", lines)
        self.assertIn("school_stage:class-10 | Class 10", lines)
        self.assertIn("stream:science | Science Stream", lines)
        for index in range(20):
            self.assertIn(f"job_role:cohort-{index:02d} | Cohort Role {index:02d}", lines)
        # not in the trail, not a neighbor (no vectors), not same-type -> excluded
        self.assertNotIn("degree:unrelated | Unrelated Degree", lines)
        self.assertEqual(lines, sorted(lines))

    def test_embedding_neighbors_included_across_types(self):
        reg = fixture_registry()
        block = reg.registry_block_for("job_role:target", reg_vecs=VECS, k=1)
        self.assertIn("exam:special | Special Entrance Exam", block.splitlines())

    def test_line_cap_prioritizes_trail_and_neighbors_over_cohort(self):
        reg = fixture_registry()
        block = reg.registry_block_for(
            "job_role:target", trail_ids=TRAIL, reg_vecs=VECS, k=1, max_lines=6)
        lines = block.splitlines()
        self.assertEqual(len(lines), 6)
        # tier 1-3 all survive the cap...
        self.assertIn("job_role:target | Target Role", lines)
        self.assertIn("school_stage:class-10 | Class 10", lines)
        self.assertIn("stream:science | Science Stream", lines)
        self.assertIn("exam:special | Special Entrance Exam", lines)
        # ...and the cohort fill is the stable id-sorted prefix
        self.assertIn("job_role:cohort-00 | Cohort Role 00", lines)
        self.assertIn("job_role:cohort-01 | Cohort Role 01", lines)
        self.assertNotIn("job_role:cohort-02 | Cohort Role 02", lines)

    def test_char_cap_bounds_block_size(self):
        reg = fixture_registry()
        block = reg.registry_block_for("job_role:target", trail_ids=TRAIL,
                                       reg_vecs=VECS, max_chars=200)
        self.assertLessEqual(len(block), 200)
        self.assertGreater(len(block.splitlines()), 0)

    def test_deterministic_byte_identical(self):
        reg = fixture_registry()
        first = reg.registry_block_for("job_role:target", trail_ids=TRAIL,
                                       reg_vecs=VECS, max_lines=10)
        second = reg.registry_block_for("job_role:target", trail_ids=TRAIL,
                                        reg_vecs=VECS, max_lines=10)
        self.assertEqual(first.encode("utf-8"), second.encode("utf-8"))

    def test_missing_vector_degrades_to_no_neighbors(self):
        reg = fixture_registry()
        vecs_without_target = {k: v for k, v in VECS.items() if k != "job_role:target"}
        block = reg.registry_block_for("job_role:target", trail_ids=TRAIL,
                                       reg_vecs=vecs_without_target)
        self.assertNotIn("exam:special", block)
        self.assertEqual(
            block,
            reg.registry_block_for("job_role:target", trail_ids=TRAIL, reg_vecs=None),
        )

    def test_unknown_trail_ids_are_skipped(self):
        reg = fixture_registry()
        block = reg.registry_block_for(
            "job_role:target", trail_ids=["degree:ghost", "stream:science"])
        self.assertIn("stream:science | Science Stream", block.splitlines())
        self.assertNotIn("degree:ghost", block)


if __name__ == "__main__":
    unittest.main()
