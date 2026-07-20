import contextlib
import io
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import expand
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


class ExpandCheckpointTests(unittest.TestCase):
    """Registry+frontier checkpoints every SAVE_EVERY nodes and on every exit path."""

    def _seeds(self, count: int) -> list[Node]:
        return [
            node(f"degree:seed-{index:02d}", NodeType.degree, f"Seed {index:02d}")
            for index in range(count)
        ]

    @contextlib.contextmanager
    def _patched_main(self, registry, frontier, call_json_stub, frontier_snapshots):
        with mock.patch.object(expand, "Registry", lambda: registry), \
                mock.patch.object(expand, "Resolver", lambda _reg: SimpleNamespace()), \
                mock.patch.object(expand, "load_frontier", lambda: frontier), \
                mock.patch.object(
                    expand,
                    "save_frontier",
                    lambda fr: frontier_snapshots.append(len(fr["expanded"])),
                ), \
                mock.patch.object(expand, "call_json", call_json_stub), \
                mock.patch.object(sys, "argv", ["expand.py"]), \
                contextlib.redirect_stdout(io.StringIO()):
            yield

    def test_checkpoints_every_25_nodes_and_flushes_tail_on_exit(self):
        seeds = self._seeds(26)
        registry = in_memory_registry(*seeds)
        saves = []
        registry.save = lambda: saves.append(True)
        frontier = {
            "expanded": [],
            "queue": [{"id": item.id, "depth": 0} for item in seeds],
        }
        frontier_snapshots = []
        terminal = ExpansionResult(is_terminal=True, successors=[])

        with self._patched_main(
            registry,
            frontier,
            lambda *_args, **_kwargs: terminal,
            frontier_snapshots,
        ):
            expand.main()

        self.assertEqual(len(saves), 2)  # node 25, then the tail in finally
        self.assertEqual(frontier_snapshots, [25, 26])

    def test_interrupt_mid_run_still_checkpoints_via_finally(self):
        seeds = self._seeds(5)
        registry = in_memory_registry(*seeds)
        saves = []
        registry.save = lambda: saves.append(True)
        frontier = {
            "expanded": [],
            "queue": [{"id": item.id, "depth": 0} for item in seeds],
        }
        frontier_snapshots = []
        calls = []

        def interrupting_call(*_args, **_kwargs):
            calls.append(True)
            if len(calls) == 4:
                raise KeyboardInterrupt
            return ExpansionResult(is_terminal=True, successors=[])

        with self._patched_main(
            registry, frontier, interrupting_call, frontier_snapshots
        ):
            with self.assertRaises(KeyboardInterrupt):
                expand.main()

        self.assertEqual(len(saves), 1)  # the finally checkpoint only
        self.assertEqual(frontier_snapshots, [3])  # the 3 completed nodes survived


if __name__ == "__main__":
    unittest.main()
