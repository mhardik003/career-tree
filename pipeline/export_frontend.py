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
CORE_OUTPUT_PATH = REPO_ROOT / "career-tree" / "data" / "v2" / "graph.core.json"
FACTS_DIR = REPO_ROOT / "career-tree" / "data" / "v2" / "facts"
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
    *,
    require_facts: bool = True,
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
        if require_facts and item.facts is None:
            raise SnapshotError(f"node {item.id}: missing facts")
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


def core_snapshot(snapshot: dict[str, Any]) -> dict[str, Any]:
    """The same snapshot with every node's heavyweight ``facts`` removed.

    ``facts`` are ~96% of graph.json's bytes but are only needed for the
    focused node of a guide/explorer page; the web app loads this core
    snapshot at module init and reads per-node facts files on demand.
    """
    return {
        **snapshot,
        "nodes": [
            {key: value for key, value in node.items() if key != "facts"}
            for node in snapshot["nodes"]
        ],
    }


def facts_files(snapshot: dict[str, Any]) -> dict[str, Any]:
    """Map facts filename -> that node's facts payload.

    Filenames use ``{type}--{slug}.json`` (``--`` instead of the id's ``:``,
    which is unsafe in filenames on some filesystems).
    """
    return {
        f"{node['type']}--{node['slug']}.json": node["facts"]
        for node in snapshot["nodes"]
        if "facts" in node
    }


# All frontend artifacts are machine-read only (JSON.parse / json.loads), so they
# are rendered compact: indent=2 cost ~35% extra bytes on the 10 MB graph.json.
_COMPACT = {"separators": (",", ":"), "ensure_ascii": False}


def _render_facts(payload: Any) -> str:
    return json.dumps(payload, **_COMPACT) + "\n"


def write_facts_dir(directory: Path, expected: dict[str, Any]) -> bool:
    directory.mkdir(parents=True, exist_ok=True)
    changed = False
    for name, payload in sorted(expected.items()):
        path = directory / name
        rendered = _render_facts(payload)
        if path.exists() and path.read_text(encoding="utf-8") == rendered:
            continue
        atomic_write(str(path), rendered)
        changed = True
    for path in sorted(directory.glob("*.json")):
        if path.name not in expected:
            path.unlink()
            changed = True
    return changed


def stale_facts_reason(directory: Path, expected: dict[str, Any]) -> str | None:
    present = (
        {path.name for path in directory.glob("*.json")}
        if directory.is_dir()
        else set()
    )
    missing = sorted(set(expected) - present)
    if missing:
        return f"missing facts file {missing[0]}"
    extra = sorted(present - set(expected))
    if extra:
        return f"unexpected facts file {extra[0]}"
    for name, payload in sorted(expected.items()):
        try:
            existing = json.loads(
                (directory / name).read_text(encoding="utf-8"),
            )
        except json.JSONDecodeError:
            return f"unreadable facts file {name}"
        if existing != payload:
            return f"facts file does not match registry: {name}"
    return None


def _structural(snapshot: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in snapshot.items() if key != "generated_at"}


def snapshot_matches(
    existing: dict[str, Any],
    expected: dict[str, Any],
) -> bool:
    return _structural(existing) == _structural(expected)


def _render_snapshot(snapshot: dict[str, Any], generated_at: Any) -> str:
    return json.dumps({**snapshot, "generated_at": generated_at}, **_COMPACT) + "\n"


def write_snapshot(path: Path, snapshot: dict[str, Any]) -> bool:
    existing_text = None
    existing = None
    if path.exists():
        existing_text = path.read_text(encoding="utf-8")
        try:
            existing = json.loads(existing_text)
        except json.JSONDecodeError:
            existing = None
    if existing and snapshot_matches(existing, snapshot):
        # Structurally current — rewrite only when the on-disk rendering is
        # stale (e.g. a formatting change); keeping the stored generated_at in
        # the comparison makes an up-to-date export byte-stable across runs.
        if existing_text == _render_snapshot(snapshot, existing.get("generated_at")):
            return False
    rendered = _render_snapshot(
        snapshot,
        datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    )
    atomic_write(str(path), rendered)
    return True


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--allow-incomplete-facts", action="store_true")
    args = parser.parse_args()
    expected = build_snapshot(
        read_jsonl(str(NODES_PATH)),
        read_jsonl(str(EDGES_PATH)),
        source_digest(),
        require_facts=not args.allow_incomplete_facts,
    )
    expected_core = core_snapshot(expected)
    expected_facts = facts_files(expected)
    if args.check:
        for label, path, snapshot in (
            ("full snapshot", OUTPUT_PATH, expected),
            ("core snapshot", CORE_OUTPUT_PATH, expected_core),
        ):
            if not path.exists():
                print(f"stale: missing {path}")
                return 1
            existing = json.loads(path.read_text(encoding="utf-8"))
            if not snapshot_matches(existing, snapshot):
                print(f"stale: frontend v2 {label} does not match registry")
                return 1
        reason = stale_facts_reason(FACTS_DIR, expected_facts)
        if reason:
            print(f"stale: {reason}")
            return 1
        print("frontend v2 snapshot is current")
        return 0
    changed = write_snapshot(OUTPUT_PATH, expected)
    core_changed = write_snapshot(CORE_OUTPUT_PATH, expected_core)
    facts_changed = write_facts_dir(FACTS_DIR, expected_facts)
    print(f"{'wrote' if changed else 'unchanged'} {OUTPUT_PATH}")
    print(f"{'wrote' if core_changed else 'unchanged'} {CORE_OUTPUT_PATH}")
    print(
        f"{'wrote' if facts_changed else 'unchanged'} {FACTS_DIR} "
        f"({len(expected_facts)} files)",
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
