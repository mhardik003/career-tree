"""Export the v2 JSONL registry into the committed Next.js snapshot."""

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from lib import Edge, Node, atomic_write, read_jsonl

PIPELINE_DIR = Path(__file__).resolve().parent
REPO_ROOT = PIPELINE_DIR.parent
NODES_PATH = PIPELINE_DIR / "registry" / "nodes.jsonl"
EDGES_PATH = PIPELINE_DIR / "registry" / "edges.jsonl"
OUTPUT_PATH = REPO_ROOT / "career-tree" / "data" / "v2" / "graph.json"
ROOT_ID = "school_stage:class-10"


class SnapshotError(ValueError):
    pass


def source_digest(
    nodes_path: Path = NODES_PATH,
    edges_path: Path = EDGES_PATH,
) -> str:
    digest = hashlib.sha256()
    for label, path in ((b"nodes\0", nodes_path), (b"edges\0", edges_path)):
        digest.update(label)
        digest.update(path.read_bytes())
        digest.update(b"\0")
    return digest.hexdigest()


def _unique(records: list[dict[str, Any]], field: str, label: str) -> None:
    seen: set[str] = set()
    for record in records:
        value = record.get(field)
        if value in seen:
            raise SnapshotError(f"duplicate {label} {field}: {value}")
        seen.add(value)


def build_snapshot(
    node_records: list[dict[str, Any]],
    edge_records: list[dict[str, Any]],
    digest: str,
) -> dict[str, Any]:
    _unique(node_records, "id", "node")
    _unique(edge_records, "id", "edge")

    try:
        nodes = [Node.model_validate(record) for record in node_records]
        edges = [Edge.model_validate(record) for record in edge_records]
    except Exception as exc:
        raise SnapshotError(f"invalid registry record: {exc}") from exc

    by_id = {node.id: node for node in nodes}
    if ROOT_ID not in by_id:
        raise SnapshotError(f"configured root does not exist: {ROOT_ID}")

    route_keys: set[tuple[str, str]] = set()
    exported_nodes: list[dict[str, Any]] = []
    for item in nodes:
        prefix, separator, slug = item.id.partition(":")
        if not separator or not slug or prefix != item.type.value:
            raise SnapshotError(
                f"node {item.id}: type prefix does not match {item.type.value}"
            )
        route_key = (item.type.value, slug)
        if route_key in route_keys:
            raise SnapshotError(f"duplicate canonical route: {route_key}")
        route_keys.add(route_key)
        exported = item.model_dump(mode="json", exclude_none=True)
        exported["slug"] = slug
        exported_nodes.append(exported)

    exported_edges: list[dict[str, Any]] = []
    for item in edges:
        if item.from_id not in by_id:
            raise SnapshotError(f"edge {item.id}: unknown from_id {item.from_id}")
        if item.to_id not in by_id:
            raise SnapshotError(f"edge {item.id}: unknown to_id {item.to_id}")
        exported_edges.append(item.model_dump(mode="json", exclude_none=True))

    return {
        "schema_version": 1,
        "root_id": ROOT_ID,
        "source_digest": digest,
        "nodes": sorted(exported_nodes, key=lambda item: item["id"]),
        "edges": sorted(exported_edges, key=lambda item: item["id"]),
    }


def _structural(snapshot: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in snapshot.items() if key != "generated_at"}


def snapshot_matches(
    existing: dict[str, Any],
    expected: dict[str, Any],
) -> bool:
    return _structural(existing) == _structural(expected)


def write_snapshot(path: Path, snapshot: dict[str, Any]) -> bool:
    existing = None
    if path.exists():
        try:
            existing = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            existing = None
    if existing and snapshot_matches(existing, snapshot):
        return False
    rendered = {
        **snapshot,
        "generated_at": datetime.now(timezone.utc)
        .isoformat()
        .replace("+00:00", "Z"),
    }
    atomic_write(
        str(path),
        json.dumps(rendered, indent=2, ensure_ascii=False) + "\n",
    )
    return True


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    expected = build_snapshot(
        read_jsonl(str(NODES_PATH)),
        read_jsonl(str(EDGES_PATH)),
        source_digest(),
    )
    if args.check:
        if not OUTPUT_PATH.exists():
            print(f"stale: missing {OUTPUT_PATH}")
            return 1
        existing = json.loads(OUTPUT_PATH.read_text(encoding="utf-8"))
        if not snapshot_matches(existing, expected):
            print("stale: frontend v2 snapshot does not match registry")
            return 1
        print("frontend v2 snapshot is current")
        return 0
    changed = write_snapshot(OUTPUT_PATH, expected)
    print(f"{'wrote' if changed else 'unchanged'} {OUTPUT_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
