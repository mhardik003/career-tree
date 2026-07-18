import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from audit_sources import check_url


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


if __name__ == "__main__":
    unittest.main()
