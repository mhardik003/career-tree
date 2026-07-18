"""Resumable, source-backed OpenAI enrichment for every canonical V2 node."""
import argparse
import json
import os
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor

from facts import NodeFacts, allowed_section_keys
from lib import (
    PIPE_DIR,
    Registry,
    atomic_write,
    call_json,
    read_jsonl,
    today,
)

ENRICH_MODEL = "gpt-5.6-terra"
ENRICH_PROMPT_VERSION = "v2-enrichment-1"
FAILURE_FILE = os.path.join(PIPE_DIR, "ledger", "enrichment_failures.jsonl")


def _render_failures(path: str, rows: list[dict]) -> None:
    atomic_write(
        path,
        "".join(json.dumps(row, ensure_ascii=False) + "\n" for row in rows),
    )


def _replace_failure(path: str, node_id: str, error: str | None) -> None:
    rows = [
        row
        for row in read_jsonl(path)
        if not (row.get("stage") == "enrichment" and row.get("node_id") == node_id)
    ]
    if error is not None:
        rows.append(
            {"stage": "enrichment", "node_id": node_id, "error": error}
        )
    _render_failures(path, rows)


def _validate_sections(node_type: str, facts: NodeFacts) -> None:
    allowed = set(allowed_section_keys(node_type))
    invalid = sorted({section.key for section in facts.sections} - allowed)
    if invalid:
        raise ValueError(
            f"unsupported section keys for {node_type}: {', '.join(invalid)}"
        )


def enrich_registry(
    reg: Registry,
    research: Callable,
    failure_path: str,
    limit: int = 0,
    retry_failures: bool = False,
    *,
    node_ids: set[str] | None = None,
    force: bool = False,
    workers: int = 1,
) -> int:
    failed_ids = {
        row["node_id"]
        for row in read_jsonl(failure_path)
        if row.get("stage") == "enrichment" and row.get("node_id")
    }
    completed = 0
    consecutive_failures = 0
    candidates = []
    for node in sorted(reg.nodes.values(), key=lambda item: item.id):
        if node_ids is not None and node.id not in node_ids:
            continue
        if node.facts is not None and not force:
            continue
        if node.id in failed_ids and not retry_failures:
            continue
        candidates.append(node)
        if limit and len(candidates) >= limit:
            break

    worker_count = max(1, workers)
    abort = False
    with ThreadPoolExecutor(max_workers=worker_count) as executor:
        for start in range(0, len(candidates), worker_count):
            batch = candidates[start : start + worker_count]
            futures = [(node, executor.submit(research, node)) for node in batch]
            for node, future in futures:
                try:
                    enriched = NodeFacts.model_validate(future.result())
                    _validate_sections(node.type.value, enriched)
                    node.facts = enriched
                    reg.save()
                    _replace_failure(failure_path, node.id, None)
                except Exception as exc:  # noqa: BLE001 - isolate item failures
                    consecutive_failures += 1
                    _replace_failure(failure_path, node.id, str(exc))
                    if consecutive_failures >= 5:
                        abort = True
                        for _pending_node, pending in futures:
                            pending.cancel()
                        break
                    continue

                consecutive_failures = 0
                completed += 1
            if abort:
                break
    return completed


def enrichment_prompt(reg: Registry, node) -> str:
    parents = [
        reg.nodes[edge.from_id].title
        for edge in reg.incoming(node.id)
        if edge.from_id in reg.nodes
    ]
    children = [
        reg.nodes[edge.to_id].title
        for edge in reg.outgoing(node.id)
        if edge.to_id in reg.nodes
    ]
    section_keys = ", ".join(allowed_section_keys(node.type.value))
    return f"""Research and write a source-backed guide for this canonical node in the
Indian career and education system.

NODE
- id: {node.id}
- type: {node.type.value}
- title: {node.title}
- aliases: {json.dumps(node.aliases, ensure_ascii=False)}
- description: {node.description}
- immediate parents: {json.dumps(parents, ensure_ascii=False)}
- immediate children: {json.dumps(children, ensure_ascii=False)}

REQUIREMENTS
- Current date: {today()}.
- Use web research and prefer official government, regulator, examination,
  university, professional-body, and employer sources.
- Reputable secondary sources may be used only for suitable context.
- Every quick fact and every article section must cite at least one supporting
  HTTP(S) source URL. Do not return a claim without a source.
- Allowed section keys for this node type: {section_keys}.
- Omit unsupported sections instead of inventing content.
- Frame salary, fee, ranking, and deadline claims as dated, variable context.
- Return at least one substantive cited article section.
- Set facts provenance to model={ENRICH_MODEL},
  prompt_version={ENRICH_PROMPT_VERSION}, and generated_at={today()}.
"""


def research_node(reg: Registry, node) -> NodeFacts:
    return call_json(
        ENRICH_MODEL,
        enrichment_prompt(reg, node),
        NodeFacts,
        prompt_version=ENRICH_PROMPT_VERSION,
        web_search=True,
    )


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--node-id")
    parser.add_argument("--retry-failures", action="store_true")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--workers", type=int, default=1)
    args = parser.parse_args(argv)

    registry = Registry()
    selected = {args.node_id} if args.node_id else None
    if args.node_id and args.node_id not in registry.nodes:
        parser.error(f"unknown node id: {args.node_id}")

    if args.dry_run:
        candidates = [
            node
            for node in sorted(registry.nodes.values(), key=lambda item: item.id)
            if selected is None or node.id in selected
        ]
        if not candidates:
            parser.error("no node available for dry run")
        result = research_node(registry, candidates[0])
        _validate_sections(candidates[0].type.value, result)
        print(result.model_dump_json(indent=2))
        return 0

    completed = enrich_registry(
        registry,
        lambda node: research_node(registry, node),
        FAILURE_FILE,
        limit=args.limit,
        retry_failures=args.retry_failures,
        node_ids=selected,
        force=args.force,
        workers=args.workers,
    )
    print(f"enriched {completed} nodes")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
