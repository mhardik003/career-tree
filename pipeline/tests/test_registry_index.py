"""Registry adjacency index (_out/_in): incoming()/outgoing() must always match a
brute-force scan of reg.edges, across add_edge/remove_edge churn and a disk
round-trip, and must return copies (mutating a result never corrupts the index).
"""
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib import EdgeType, Node, NodeType, Provenance, Registry


def node(node_id: str, node_type: NodeType, title: str) -> Node:
    return Node(
        id=node_id,
        type=node_type,
        title=title,
        description=title,
        prov=Provenance(model="fixture", generated_at="2026-07-20"),
    )


def brute_outgoing(reg: Registry, node_id: str) -> list[str]:
    return [e.id for e in reg.edges.values() if e.from_id == node_id]


def brute_incoming(reg: Registry, node_id: str) -> list[str]:
    return [e.id for e in reg.edges.values() if e.to_id == node_id]


NODES = [
    node("school_stage:class-10", NodeType.school_stage, "Class 10"),
    node("stream:science", NodeType.stream, "Science Stream"),
    node("degree:bca", NodeType.degree, "BCA"),
    node("degree:mca", NodeType.degree, "MCA"),
    node("exam:nimcet", NodeType.exam, "NIMCET"),
    node("job_role:web-developer", NodeType.job_role, "Web Developer"),
]


class RegistryIndexTests(unittest.TestCase):
    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self._tmp.cleanup)
        self.nodes_file = str(Path(self._tmp.name) / "nodes.jsonl")
        self.edges_file = str(Path(self._tmp.name) / "edges.jsonl")

    def fresh_registry(self) -> Registry:
        registry = Registry(nodes_file=self.nodes_file, edges_file=self.edges_file)
        for item in NODES:
            registry.add_node(item)
        return registry

    def assert_index_consistent(self, reg: Registry):
        for node_id in list(reg.nodes) + ["ghost:missing"]:
            self.assertEqual(
                [e.id for e in reg.outgoing(node_id)],
                brute_outgoing(reg, node_id),
                f"outgoing desync for {node_id}",
            )
            self.assertEqual(
                [e.id for e in reg.incoming(node_id)],
                brute_incoming(reg, node_id),
                f"incoming desync for {node_id}",
            )

    def populate(self, reg: Registry):
        reg.add_edge("school_stage:class-10", "stream:science",
                     EdgeType.progression, "fixture")
        reg.add_edge("stream:science", "degree:bca", EdgeType.progression, "fixture")
        reg.add_edge("degree:bca", "exam:nimcet", EdgeType.exam_gate, "fixture")
        reg.add_edge("exam:nimcet", "degree:mca", EdgeType.exam_gate, "fixture")
        reg.add_edge("degree:bca", "job_role:web-developer",
                     EdgeType.progression, "fixture")
        reg.add_edge("job_role:web-developer", "degree:mca",
                     EdgeType.lateral, "fixture")

    def test_index_matches_brute_force_through_add_and_remove(self):
        reg = self.fresh_registry()
        self.assert_index_consistent(reg)

        self.populate(reg)
        self.assert_index_consistent(reg)

        # rejected additions must not touch the index
        self.assertIsNone(reg.add_edge("degree:bca", "exam:nimcet",
                                       EdgeType.exam_gate, "fixture"))  # duplicate
        self.assertIsNone(reg.add_edge("degree:bca", "degree:bca",
                                       EdgeType.progression, "fixture"))  # self-loop
        self.assert_index_consistent(reg)

        removed = reg.remove_edge("degree:bca->exam:nimcet")
        self.assertIsNotNone(removed)
        self.assertEqual(removed.id, "degree:bca->exam:nimcet")
        self.assertIsNone(reg.remove_edge("degree:bca->exam:nimcet"))  # already gone
        self.assertIsNone(reg.remove_edge("ghost:a->ghost:b"))
        self.assert_index_consistent(reg)

        # remove-then-re-add lands back in the index
        reg.add_edge("degree:bca", "exam:nimcet", EdgeType.exam_gate, "fixture")
        self.assert_index_consistent(reg)

    def test_round_trip_from_disk_has_consistent_index(self):
        reg = self.fresh_registry()
        self.populate(reg)
        reg.save()

        loaded = Registry(nodes_file=self.nodes_file, edges_file=self.edges_file)
        self.assertEqual(sorted(loaded.edges), sorted(reg.edges))
        self.assert_index_consistent(loaded)
        # and the loaded index survives further churn
        loaded.remove_edge("stream:science->degree:bca")
        loaded.add_edge("stream:science", "exam:nimcet", EdgeType.exam_gate, "fixture")
        self.assert_index_consistent(loaded)

    def test_incoming_outgoing_return_copies(self):
        reg = self.fresh_registry()
        self.populate(reg)
        reg.outgoing("degree:bca").clear()
        reg.incoming("degree:mca").clear()
        self.assert_index_consistent(reg)
        self.assertEqual(len(reg.outgoing("degree:bca")), 2)
        self.assertEqual(len(reg.incoming("degree:mca")), 2)


if __name__ == "__main__":
    unittest.main()
