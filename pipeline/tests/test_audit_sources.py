import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from audit_sources import check_url, split_incremental


class FakeResponse:
    def __init__(self, status_code, headers=None):
        self.status_code = status_code
        self.headers = headers or {}


class SourceAuditTests(unittest.TestCase):
    def test_success_redirect_and_restricted_statuses_are_plausibly_reachable(self):
        for status in (200, 301, 403, 405):
            with self.subTest(status=status):
                result = check_url(
                    "https://example.gov.in/source",
                    requester=lambda *_args, **_kwargs: FakeResponse(status),
                )
                self.assertTrue(result["reachable"])
                self.assertFalse(result["definitive_failure"])

    def test_malformed_and_missing_urls_fail(self):
        malformed = check_url(
            "not a URL",
            requester=lambda *_args, **_kwargs: self.fail(
                "malformed URL must not be requested"
            ),
        )
        missing = check_url(
            "https://example.gov.in/missing",
            requester=lambda *_args, **_kwargs: FakeResponse(404),
        )

        self.assertTrue(malformed["definitive_failure"])
        self.assertEqual(malformed["error"], "source URLs must use HTTP(S)")
        self.assertTrue(missing["definitive_failure"])
        self.assertEqual(missing["status"], 404)

    def test_redirects_are_followed_only_to_public_http_hosts(self):
        requested = []

        def requester(url, **kwargs):
            requested.append((url, kwargs["allow_redirects"]))
            return FakeResponse(
                302,
                {"Location": "http://169.254.169.254/latest/meta-data/"},
            )

        result = check_url("https://example.gov.in/source", requester=requester)

        self.assertTrue(result["definitive_failure"])
        self.assertIn("public host", result["error"])
        self.assertEqual(requested, [("https://example.gov.in/source", False)])


def row(url: str, status, reachable: bool, definitive: bool = False) -> dict:
    return {
        "url": url,
        "status": status,
        "error": None if reachable else f"HTTP {status}",
        "reachable": reachable,
        "definitive_failure": definitive,
    }


class IncrementalSelectionTests(unittest.TestCase):
    def test_incremental_reaudits_only_urls_without_a_previous_ok(self):
        previous = {
            "checks": [
                row("https://ok.gov.in/page", 200, True),
                row("https://gone.gov.in/page", 404, False, definitive=True),
                row("https://flaky.gov.in/page", None, False),
                row("https://dropped.gov.in/page", 200, True),
            ]
        }
        urls = [
            "https://flaky.gov.in/page",
            "https://gone.gov.in/page",
            "https://new.gov.in/page",
            "https://ok.gov.in/page",
        ]

        to_audit, carried = split_incremental(urls, previous)

        self.assertEqual(
            to_audit,
            [
                "https://flaky.gov.in/page",
                "https://gone.gov.in/page",
                "https://new.gov.in/page",
            ],
        )
        # The OK row is carried over unchanged; the row for the URL no longer
        # collected from the registry is dropped.
        self.assertEqual(carried, [row("https://ok.gov.in/page", 200, True)])

    def test_incremental_matches_previous_rows_by_normalized_url(self):
        previous = {"checks": [row("https://ok.gov.in/", 200, True)]}

        to_audit, carried = split_incremental(["HTTPS://OK.gov.in"], previous)

        self.assertEqual(to_audit, [])
        self.assertEqual(carried, [row("https://ok.gov.in/", 200, True)])

    def test_full_audit_without_previous_report_checks_everything(self):
        urls = ["https://a.gov.in/x", "https://b.gov.in/y"]

        to_audit, carried = split_incremental(urls, None)

        self.assertEqual(to_audit, urls)
        self.assertEqual(carried, [])


if __name__ == "__main__":
    unittest.main()
