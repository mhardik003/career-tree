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


def test_dedup_keys_use_the_canonical_helper_functions():
    """A raw md5(proposed_data::text) is array-order sensitive and a raw
    lower(trim(name)) is a no-op after Zod's own trim; both let trivially
    different payloads occupy separate index slots."""
    sql = _sql()
    assert "create or replace function public.edit_dedup_key" in sql.lower()
    assert "create or replace function public.suggestion_dedup_key" in sql.lower()
    index_lines = [
        line for line in sql.splitlines()
        if "on public.suggestions" in line or "on public.edits" in line
    ]
    assert index_lines, "no index definitions found"
    for line in index_lines:
        assert "dedup_key(" in line, f"index does not use a canonical key: {line}"
    # The file's header comment legitimately quotes the raw expression while
    # explaining the bug it fixes, so check the actual key expression (as it
    # appears in the CTE partition and the index) rather than the bare
    # substring anywhere in the file.
    assert "target_node_id, md5(proposed_data::text)" not in sql, (
        "raw array-order-sensitive md5 is still present as a key expression"
    )


def test_dedup_helper_functions_are_immutable():
    """Postgres rejects a non-IMMUTABLE function in an index expression."""
    sql = _sql().lower()
    for name in ("edit_dedup_key", "suggestion_dedup_key"):
        body_start = sql.index(f"create or replace function public.{name}")
        body = sql[body_start:body_start + 800]
        assert "immutable" in body, f"{name} is not declared IMMUTABLE"


def test_suggestion_dedup_key_strips_the_full_invisible_and_bidi_control_set():
    """The original class (U+200B-U+200F, U+FEFF) missed U+2060 WORD JOINER
    (the Unicode-recommended replacement for using the BOM as a zero-width
    no-break space), soft hyphen, the combining grapheme joiner, the Arabic
    letter mark / Mongolian vowel separator, and the bidi embedding/override/
    isolate controls -- each an invisible, unbounded bypass of the guard.
    This pins that the widened set is present via its \\uXXXX escapes without
    pinning the full bracket expression character-for-character, so a further
    legitimate broadening of the class does not break this test."""
    sql = _sql().lower()
    body_start = sql.index("create or replace function public.suggestion_dedup_key")
    body = sql[body_start:body_start + 1500]
    for codepoint in ("\\u00ad", "\\u034f", "\\u061c", "\\u180e", "\\u2060", "\\ufeff"):
        assert codepoint in body, (
            f"{codepoint} is no longer stripped by suggestion_dedup_key"
        )
    # Escapes, not literal bytes: the whole point of the human ruling was to
    # stop shipping invisible characters in the migration source itself. The
    # forbidden set is built from bare integer code points via chr(), not
    # typed invisible characters or \uXXXX string escapes, so this check
    # carries none of the transcription risk it is guarding against and its
    # code points can be verified by eye against the hex literals alone.
    forbidden_code_points = (
        [0x00AD, 0x034F, 0x061C, 0x180E]
        + list(range(0x200B, 0x200F + 1))
        + list(range(0x202A, 0x202E + 1))
        + list(range(0x2060, 0x2069 + 1))
        + [0xFEFF]
    )
    assert not any(chr(cp) in body for cp in forbidden_code_points), (
        "the strip class contains literal invisible characters instead of "
        "\\uXXXX escapes"
    )


def test_alias_aggregation_is_deduplicated_and_collation_stable():
    """`string_agg(DISTINCT expr COLLATE ..., ... ORDER BY expr COLLATE ...)`
    requires the ORDER BY expression to match the DISTINCT-aggregated
    expression exactly, so both must carry the identical explicit collation
    or Postgres rejects the query. Without DISTINCT, repeated aliases
    (schemas.ts allows up to 25 with no uniqueness check) key differently by
    count; without a pinned collation, a future collation/ICU upgrade could
    silently reorder -- and therefore rehash -- an existing payload."""
    sql = _sql().lower()
    body_start = sql.index("create or replace function public.edit_dedup_key")
    body = sql[body_start:body_start + 1500]
    assert "string_agg(distinct" in body, "alias aggregation is not de-duplicated"
    assert body.count('collate "c"') == 2, (
        "the DISTINCT-aggregated expression and the ORDER BY expression must "
        "both carry the same explicit collation"
    )
