import sys
import unittest
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from expand import ChildRef, ExpansionResult, _process_successors, should_expand
from lib import EdgeType, Node, NodeType, Provenance, Registry


def in_memory_registry(*nodes: Node) -> Registry:
    registry = Registry.__new__(Registry)
    registry.nodes = {}
    registry.edges = {}
    registry._alias_index = {}
    for item in nodes:
        registry.add_node(item)
    return registry


def node(node_id: str, node_type: NodeType, title: str) -> Node:
    return Node(
        id=node_id,
        type=node_type,
        title=title,
        description=title,
        prov=Provenance(model="fixture", generated_at="2026-07-19"),
    )


class ExpandBoundaryTests(unittest.TestCase):
    def test_depths_below_four_expand(self):
        self.assertTrue(should_expand(3, 4))

    def test_depth_four_is_retained_but_not_expanded(self):
        self.assertFalse(should_expand(4, 4))

    def test_processing_same_successor_twice_keeps_one_edge(self):
        parent = node("degree:bca", NodeType.degree, "BCA")
        child = node("degree:mca", NodeType.degree, "MCA")
        registry = in_memory_registry(parent, child)
        result = ExpansionResult(
            is_terminal=False,
            successors=[
                ChildRef(
                    existing_id=child.id,
                    edge_type="progression",
                    confidence="core",
                )
            ],
        )
        queue = []
        expanded = {parent.id}

        for _ in range(2):
            _process_successors(
                registry,
                resolver=SimpleNamespace(),
                node=parent,
                nid=parent.id,
                depth=3,
                result=result,
                queue=queue,
                expanded=expanded,
                args=SimpleNamespace(),
            )

        self.assertEqual(list(registry.edges), ["degree:bca->degree:mca"])
        self.assertEqual(queue, [{"id": "degree:mca", "depth": 4}])

    def test_reverse_progression_route_is_typed_lateral_to_avoid_cycle(self):
        bed = node("degree:b-ed", NodeType.degree, "B.Ed")
        ma = node("degree:ma", NodeType.degree, "MA")
        registry = in_memory_registry(bed, ma)
        registry.add_edge(bed.id, ma.id, EdgeType.progression, "fixture")
        result = ExpansionResult(
            is_terminal=False,
            successors=[
                ChildRef(
                    existing_id=bed.id,
                    edge_type="progression",
                    confidence="core",
                )
            ],
        )

        _process_successors(
            registry,
            resolver=SimpleNamespace(),
            node=ma,
            nid=ma.id,
            depth=3,
            result=result,
            queue=[],
            expanded={ma.id},
            args=SimpleNamespace(),
        )

        self.assertEqual(
            registry.edges["degree:ma->degree:b-ed"].edge_type,
            EdgeType.lateral,
        )


if __name__ == "__main__":
    unittest.main()
