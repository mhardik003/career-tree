import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from calibrate_er import build_report, recommended_judge_band, write_report


class CalibrationTests(unittest.TestCase):
    def test_recommended_band_is_highest_threshold_with_no_missed_duplicate(self):
        similarities = [
            (0.70, "same_role", False),
            (0.95, "distinct", False),
        ]

        self.assertEqual(
            recommended_judge_band(similarities, [0.0, 0.60, 0.75]),
            0.60,
        )

    def test_recommended_band_fails_when_every_threshold_misses_duplicate(self):
        similarities = [(0.70, "same_role", False)]

        with self.assertRaisesRegex(ValueError, "every tested threshold"):
            recommended_judge_band(similarities, [0.75, 0.80])

    def test_report_counts_all_labels_and_writes_deterministically(self):
        report = build_report(
            similarities=[
                (1.0, "same_role", True),
                (0.70, "same_role", False),
                (0.90, "distinct", False),
                (0.85, "specializes", False),
            ],
            labeled_pairs=4,
            candidates=[0.0, 0.60, 0.75],
        )

        self.assertEqual(report["labeled_pairs"], 4)
        self.assertEqual(report["recommended_judge_band"], 0.60)
        self.assertEqual(report["missed_duplicates"], 0)

        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "report.json"
            write_report(report, path)
            first = path.read_text()
            write_report(report, path)
            self.assertEqual(path.read_text(), first)
            self.assertEqual(json.loads(first), report)


if __name__ == "__main__":
    unittest.main()
