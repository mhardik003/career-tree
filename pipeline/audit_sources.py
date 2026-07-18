"""Audit unique V2 enrichment source URLs without storing response bodies."""
import argparse
import json
import os
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from typing import Callable

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

    try:
        response = requester(
            normalized,
            headers={"User-Agent": USER_AGENT},
            timeout=10,
            allow_redirects=True,
            stream=True,
        )
        status = int(response.status_code)
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


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--only-enriched-since")
    parser.add_argument("--workers", type=int, default=8)
    args = parser.parse_args(argv)
    if args.only_enriched_since:
        date.fromisoformat(args.only_enriched_since)

    urls = collect_urls(Registry(), args.only_enriched_since)
    checks = audit_urls(urls, max(1, args.workers))
    report = {
        "audited_on": date.today().isoformat(),
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
        f"source audit: {len(urls)} URLs, "
        f"{report['definitive_failures']} definitive failures"
    )
    return 1 if report["definitive_failures"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
