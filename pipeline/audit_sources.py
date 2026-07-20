"""Audit unique V2 enrichment source URLs without storing response bodies."""
import argparse
import json
import os
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from typing import Callable
from urllib.parse import urljoin

import requests

from facts import normalize_url
from lib import PIPE_DIR, Registry, atomic_write

REPORT_FILE = os.path.join(PIPE_DIR, "ledger", "source_audit.json")
USER_AGENT = (
    "Mozilla/5.0 (compatible; CareerTreeSourceAudit/2.0; "
    "+https://careerstree.in/about)"
)


def check_url(url: str, requester: Callable = requests.get) -> dict:
    try:
        normalized = normalize_url(url)
    except (TypeError, ValueError) as exc:
        return {
            "url": url,
            "status": None,
            "error": str(exc),
            "reachable": False,
            "definitive_failure": True,
        }

    current = normalized
    status = None
    for redirect_count in range(6):
        try:
            response = requester(
                current,
                headers={"User-Agent": USER_AGENT},
                timeout=10,
                allow_redirects=False,
                stream=True,
            )
            status = int(response.status_code)
            location = getattr(response, "headers", {}).get("Location")
            close = getattr(response, "close", None)
            if close is not None:
                close()
        except requests.RequestException as exc:
            return {
                "url": normalized,
                "status": None,
                "error": str(exc),
                "reachable": False,
                "definitive_failure": False,
            }

        if 300 <= status < 400 and location and redirect_count < 5:
            try:
                current = normalize_url(urljoin(current, location))
            except (TypeError, ValueError) as exc:
                return {
                    "url": normalized,
                    "status": status,
                    "error": str(exc),
                    "reachable": False,
                    "definitive_failure": True,
                }
            continue
        if 300 <= status < 400 and location:
            return {
                "url": normalized,
                "status": status,
                "error": "too many redirects",
                "reachable": False,
                "definitive_failure": False,
            }
        break

    assert status is not None
    reachable = 200 <= status < 400 or status in {401, 403, 405}
    definitive_failure = status in {404, 410}
    return {
        "url": normalized,
        "status": status,
        "error": None if reachable else f"HTTP {status}",
        "reachable": reachable,
        "definitive_failure": definitive_failure,
    }


def collect_urls(registry: Registry, enriched_since: str | None = None) -> list[str]:
    urls: set[str] = set()
    for node in registry.nodes.values():
        facts = node.facts
        if facts is None:
            continue
        if enriched_since is not None and facts.last_reviewed < enriched_since:
            continue
        for item in facts.quick_facts:
            urls.update(item.source_urls)
        for section in facts.sections:
            urls.update(section.source_urls)
        urls.update(link.url for link in facts.useful_links)
        urls.update(node.prov.source_urls)
    for edge in registry.edges.values():
        urls.update(edge.prov.source_urls)
    return sorted(urls)


def audit_urls(urls: list[str], workers: int = 8) -> list[dict]:
    with ThreadPoolExecutor(max_workers=workers) as executor:
        return sorted(executor.map(check_url, urls), key=lambda row: row["url"])


def load_previous_report(report_file: str = REPORT_FILE) -> dict | None:
    try:
        with open(report_file, encoding="utf-8") as handle:
            report = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return None
    return report if isinstance(report, dict) else None


def _audit_key(url: str) -> str:
    """Match key against previous report rows (check_url stores normalized URLs)."""
    try:
        return normalize_url(url)
    except (TypeError, ValueError):
        return url


def split_incremental(
    urls: list[str],
    previous_report: dict | None,
) -> tuple[list[str], list[dict]]:
    """Partition URLs into (to_audit, carried-over OK rows).

    A URL is skipped only when the previous report proved it reachable; its old
    row is carried into the new report unchanged, so later incremental runs
    still skip it. New, previously failing, and ambiguous URLs are re-audited;
    rows for URLs no longer collected are dropped. With no previous report,
    everything is audited (the full-audit release default).
    """
    ok_rows: dict[str, dict] = {}
    for row in (previous_report or {}).get("checks", []):
        if row.get("reachable") and row.get("url"):
            ok_rows[row["url"]] = row
    to_audit: list[str] = []
    carried: dict[str, dict] = {}
    for url in urls:
        row = ok_rows.get(_audit_key(url))
        if row is None:
            to_audit.append(url)
        else:
            carried[row["url"]] = row
    return to_audit, sorted(carried.values(), key=lambda row: row["url"])


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--only-enriched-since")
    parser.add_argument(
        "--incremental",
        action="store_true",
        help="re-audit only URLs lacking a reachable result in the previous "
        "report; the full audit stays the default for releases",
    )
    parser.add_argument("--workers", type=int, default=8)
    args = parser.parse_args(argv)
    if args.only_enriched_since:
        date.fromisoformat(args.only_enriched_since)

    urls = collect_urls(Registry(), args.only_enriched_since)
    previous = load_previous_report() if args.incremental else None
    to_audit, carried = split_incremental(urls, previous)
    checks = sorted(
        audit_urls(to_audit, max(1, args.workers)) + carried,
        key=lambda row: row["url"],
    )
    report = {
        "audited_on": date.today().isoformat(),
        "incremental": args.incremental,
        "url_count": len(urls),
        "definitive_failures": sum(
            row["definitive_failure"] for row in checks
        ),
        "checks": checks,
    }
    atomic_write(
        REPORT_FILE,
        json.dumps(report, indent=2, sort_keys=True, ensure_ascii=False) + "\n",
    )
    print(
        f"source audit: {len(urls)} URLs "
        f"({len(to_audit)} checked, {len(carried)} carried over), "
        f"{report['definitive_failures']} definitive failures"
    )
    return 1 if report["definitive_failures"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
