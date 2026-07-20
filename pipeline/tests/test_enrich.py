import json
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from enrich import enrich_registry
from facts import NodeFacts
from lib import Node, NodeType, Provenance, Registry


def facts() -> NodeFacts:
    return NodeFacts.model_validate(
        {
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
    )


def write_registry(directory: Path, nodes: list[Node]) -> Registry:
    nodes_path = directory / "nodes.jsonl"
    edges_path = directory / "edges.jsonl"
    nodes_path.write_text(
        "".join(
            json.dumps(node.model_dump(mode="json", exclude_none=True)) + "\n"
            for node in nodes
        ),
        encoding="utf-8",
    )
    edges_path.write_text("", encoding="utf-8")
    return Registry(nodes_file=str(nodes_path), edges_file=str(edges_path))


def node(node_id: str, enriched: bool = False) -> Node:
    return Node(
        id=node_id,
        type=NodeType.degree,
        title=node_id.rsplit(":", 1)[-1].upper(),
        description="A degree description.",
        facts=facts() if enriched else None,
        prov=Provenance(model="legacy-historical", generated_at="2026-07-04"),
    )


class EnrichmentTests(unittest.TestCase):
    def test_resume_researches_only_missing_node_and_preserves_creation_provenance(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            registry = write_registry(
                root,
                [node("degree:mba", enriched=True), node("degree:bca")],
            )
            calls = []

            def research(item):
                calls.append(item.id)
                return facts()

            completed = enrich_registry(
                registry,
                research,
                str(root / "failures.jsonl"),
            )
            reloaded = Registry(
                nodes_file=str(root / "nodes.jsonl"),
                edges_file=str(root / "edges.jsonl"),
            )

        self.assertEqual(completed, 1)
        self.assertEqual(calls, ["degree:bca"])
        self.assertIsNotNone(reloaded.nodes["degree:bca"].facts)
        self.assertEqual(
            reloaded.nodes["degree:bca"].prov.model,
            "legacy-historical",
        )

    def test_provider_failure_writes_exact_failure_row(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            registry = write_registry(root, [node("degree:bca")])

            def unavailable(_item):
                raise RuntimeError("provider unavailable")

            completed = enrich_registry(
                registry,
                unavailable,
                str(root / "failures.jsonl"),
            )
            rows = [
                json.loads(line)
                for line in (root / "failures.jsonl").read_text().splitlines()
            ]

        self.assertEqual(completed, 0)
        self.assertEqual(
            rows,
            [
                {
                    "stage": "enrichment",
                    "node_id": "degree:bca",
                    "error": "provider unavailable",
                }
            ],
        )

    def test_successful_retry_clears_previous_failure(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            registry = write_registry(root, [node("degree:bca")])
            failure_path = root / "failures.jsonl"
            failure_path.write_text(
                json.dumps(
                    {
                        "stage": "enrichment",
                        "node_id": "degree:bca",
                        "error": "old error",
                    }
                )
                + "\n",
                encoding="utf-8",
            )

            skipped = enrich_registry(registry, lambda _item: facts(), str(failure_path))
            completed = enrich_registry(
                registry,
                lambda _item: facts(),
                str(failure_path),
                retry_failures=True,
            )
            remaining_failures = failure_path.read_text()

        self.assertEqual(skipped, 0)
        self.assertEqual(completed, 1)
        self.assertEqual(remaining_failures, "")

    def test_registry_saves_batch_every_25_completions_plus_final_flush(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            registry = write_registry(
                root,
                [node(f"degree:test-{index:02d}") for index in range(26)],
            )
            saves = []
            original_save = registry.save

            def counting_save():
                saves.append(True)
                original_save()

            registry.save = counting_save

            completed = enrich_registry(
                registry,
                lambda _item: facts(),
                str(root / "failures.jsonl"),
            )
            reloaded = Registry(
                nodes_file=str(root / "nodes.jsonl"),
                edges_file=str(root / "edges.jsonl"),
            )

        self.assertEqual(completed, 26)
        self.assertEqual(len(saves), 2)  # one at item 25, one final flush
        self.assertTrue(all(item.facts is not None for item in reloaded.nodes.values()))

    def test_custom_save_every_cadence_flushes_tail_in_finally(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            registry = write_registry(
                root,
                [node(f"degree:test-{index}") for index in range(5)],
            )
            saves = []
            original_save = registry.save

            def counting_save():
                saves.append(True)
                original_save()

            registry.save = counting_save

            completed = enrich_registry(
                registry,
                lambda _item: facts(),
                str(root / "failures.jsonl"),
                save_every=2,
            )
            reloaded = Registry(
                nodes_file=str(root / "nodes.jsonl"),
                edges_file=str(root / "edges.jsonl"),
            )

        self.assertEqual(completed, 5)
        self.assertEqual(len(saves), 3)  # items 2 and 4, then the tail in finally
        self.assertTrue(all(item.facts is not None for item in reloaded.nodes.values()))

    def test_keyboard_interrupt_flushes_completed_items_via_finally(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            registry = write_registry(
                root,
                [node("degree:aa"), node("degree:bb"), node("degree:cc")],
            )

            def research(item):
                if item.id == "degree:bb":
                    raise KeyboardInterrupt
                return facts()

            with self.assertRaises(KeyboardInterrupt):
                enrich_registry(registry, research, str(root / "failures.jsonl"))
            reloaded = Registry(
                nodes_file=str(root / "nodes.jsonl"),
                edges_file=str(root / "edges.jsonl"),
            )

        self.assertIsNotNone(reloaded.nodes["degree:aa"].facts)
        self.assertIsNone(reloaded.nodes["degree:bb"].facts)
        self.assertIsNone(reloaded.nodes["degree:cc"].facts)

    def test_bounded_workers_research_in_parallel_and_serialize_saves(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            registry = write_registry(
                root,
                [node(f"degree:test-{index}") for index in range(4)],
            )
            lock = threading.Lock()
            active = 0
            max_active = 0

            def research(_item):
                nonlocal active, max_active
                with lock:
                    active += 1
                    max_active = max(max_active, active)
                time.sleep(0.03)
                with lock:
                    active -= 1
                return facts()

            completed = enrich_registry(
                registry,
                research,
                str(root / "failures.jsonl"),
                workers=2,
            )
            reloaded = Registry(
                nodes_file=str(root / "nodes.jsonl"),
                edges_file=str(root / "edges.jsonl"),
            )

        self.assertEqual(completed, 4)
        self.assertEqual(max_active, 2)
        self.assertTrue(all(item.facts is not None for item in reloaded.nodes.values()))


if __name__ == "__main__":
    unittest.main()
