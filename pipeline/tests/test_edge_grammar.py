"""The edge grammar has exactly one implementation.

It was previously restated in the private moderation tool and drifted on two
rules lint.py enforces, so every affected suggestion was minted, enriched at
cost, rejected and retried forever.
"""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from lib import EdgeType, NodeType, edge_type_for, would_create_progression_cycle


def _node(reg, node_id, node_type):
    from lib import Node, Provenance
    reg.nodes[node_id] = Node(
        id=node_id, type=node_type, title=node_id.split(":")[1],
        aliases=[], description="fixture", is_terminal=False, needs_review=False,
        prov=Provenance(model="fixture", generated_at="2026-08-06"),
    )


@pytest.fixture
def reg(tmp_path):
    from lib import Registry
    registry = Registry(str(tmp_path / "nodes.jsonl"), str(tmp_path / "edges.jsonl"))
    _node(registry, "exam:cat", NodeType.exam)
    _node(registry, "exam:mat", NodeType.exam)
    _node(registry, "degree:mba", NodeType.degree)
    _node(registry, "job_role:analyst", NodeType.job_role)
    return registry


def test_exam_to_exam_is_forbidden(reg):
    """lint.py:116-120 errors on exam->exam; expand.py drops it. The moderation
    copy created it as exam_gate."""
    assert edge_type_for(reg, "exam:cat", "exam:mat", EdgeType.progression) is None


def test_an_exam_endpoint_forces_exam_gate(reg):
    assert edge_type_for(reg, "exam:cat", "degree:mba", EdgeType.progression) is EdgeType.exam_gate
    assert edge_type_for(reg, "degree:mba", "exam:cat", EdgeType.progression) is EdgeType.exam_gate


def test_exam_gate_without_an_exam_endpoint_is_demoted(reg):
    assert edge_type_for(reg, "degree:mba", "job_role:analyst", EdgeType.exam_gate) is EdgeType.progression


def test_working_role_back_to_education_is_lateral(reg):
    assert edge_type_for(reg, "job_role:analyst", "degree:mba", EdgeType.progression) is EdgeType.lateral


def test_a_progression_cycle_is_demoted_to_lateral(reg):
    """lint.py:126-131 errors on a progression cycle. The moderation copy had no
    equivalent of expand.py's demotion."""
    reg.add_edge("degree:mba", "job_role:analyst", EdgeType.progression, "fixture")
    assert would_create_progression_cycle(reg, "job_role:analyst", "degree:mba")
    assert edge_type_for(reg, "job_role:analyst", "degree:mba", EdgeType.progression) is EdgeType.lateral
