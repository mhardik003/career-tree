"""Text-level guards for SQL we cannot execute in CI.

There is no test database in this project, so these assert on the migration
source. That is weaker than running it, but it does pin the two predicates a
future edit is most likely to drop.
"""

from pathlib import Path
import re

MIGRATION = (
    Path(__file__).resolve().parents[2]
    / "career-tree"
    / "supabase"
    / "migrations"
    / "20260806_pending_dedup_fixes.sql"
)


def _sql() -> str:
    return MIGRATION.read_text(encoding="utf-8")


def _update_statements(sql: str) -> list[str]:
    """Every `update ... ;` statement in the file, whitespace-collapsed."""
    return [
        re.sub(r"\s+", " ", match.group(0)).strip()
        for match in re.finditer(r"update\s+public\.\w+.*?;", sql, re.S | re.I)
    ]


def test_migration_file_exists():
    assert MIGRATION.is_file(), f"missing migration: {MIGRATION}"


def test_every_supersede_update_rechecks_pending_status():
    """A row approved between the CTE snapshot and the UPDATE must not be
    overwritten: the predicate references only the frozen CTE, so without an
    explicit status re-check the UPDATE clobbers a concurrent approval."""
    statements = _update_statements(_sql())
    assert len(statements) == 2, f"expected 2 supersede UPDATEs, found {len(statements)}"
    for statement in statements:
        assert re.search(r"\.status\s*=\s*'pending_review'", statement), (
            "supersede UPDATE does not re-check status against the live row:\n"
            f"{statement}"
        )


def test_migration_sets_a_lock_timeout():
    """Without lock_timeout, one idle-in-transaction session blocks every
    suggest/edit INSERT until the operator notices."""
    assert re.search(r"set\s+local\s+lock_timeout", _sql(), re.I), (
        "migration does not set a lock_timeout"
    )


def test_migration_takes_its_strongest_lock_before_mutating():
    """The UPDATEs take ROW EXCLUSIVE and CREATE INDEX needs SHARE; upgrading
    between them is deadlock-prone and leaves a window in which a concurrent
    INSERT can add a duplicate that makes the index uncreatable."""
    sql = _sql()
    lock_positions = [
        match.start()
        for match in re.finditer(
            r"lock\s+table\s+public\.(suggestions|edits)\s+in\s+share\s+row\s+exclusive",
            sql,
            re.I,
        )
    ]
    assert len(lock_positions) == 2, (
        f"expected an explicit up-front lock on both tables, found {len(lock_positions)}"
    )
    first_update = re.search(r"update\s+public\.", sql, re.I)
    assert first_update, "no UPDATE found"
    assert max(lock_positions) < first_update.start(), (
        "table locks must be taken before the first UPDATE, not after"
    )
