"""One-off repair (2026-07-21): replace dead citation URLs found by the release
source audit (7 definitive 404s plus their unreachable www. host variants).

Root cause: the regional RRB sites (rrbcdg.gov.in) were consolidated behind
rrb.indianrailways.gov.in and dropped their old /uploads/ paths; Goa University
moved /uploads/ to the webassets.unigoa.ac.in host. Every replacement below is
the same official document on a live government host, verified
200 application/pdf on 2026-07-21. The Indicative Notice for CEN 04/2024 is
replaced by the Detailed CEN 04/2024 (its superset document); source lists are
deduped when a replacement collides with an existing citation.

Idempotent. Run:  python pipeline/repair_20260721.py
"""
from facts import NodeFacts
from lib import Registry

CEN_01_2019 = "https://rrbsecunderabad.gov.in/wp-content/uploads/2023/08/Detailed-CEN-01-2019.pdf"
CEN_04_2024 = "https://rrbsecunderabad.gov.in/wp-content/uploads/2024/08/Detailed-CEN-04-2024-Paramedical-English.pdf"
CEN_05_2024 = "https://rrbahmedabad.gov.in/wp-content/uploads/2024/09/CEN-05-2024-NTPC-Graduate_a11y.pdf"
CEN_06_2024 = "https://rrbsecunderabad.gov.in/wp-content/uploads/2024/09/Final-CEN-06-2024-Undergraduate-English-V2.pdf"
GOA_MSW = "https://webassets.unigoa.ac.in/uploads/syllabus/master-of-social-work-msw_syllabus_22920190624.112834.pdf"

URL_MAP = {
    "https://rrbcdg.gov.in/uploads/2019/01-NTPC/cen_01_2019_eng.pdf": CEN_01_2019,
    "https://rrbcdg.gov.in/uploads/2024/04-PMED/Detailed%20CEN%2004-2024%20Paramedical.pdf": CEN_04_2024,
    "https://www.rrbcdg.gov.in/uploads/2024/04-PMED/Detailed%20CEN%2004-2024%20Paramedical.pdf": CEN_04_2024,
    "https://rrbcdg.gov.in/uploads/2024/04-PMED/Indicative%20Notice%20CEN-04-2024.pdf": CEN_04_2024,
    "https://www.rrbcdg.gov.in/uploads/2024/04-PMED/Indicative%20Notice%20CEN-04-2024.pdf": CEN_04_2024,
    "https://rrbcdg.gov.in/uploads/202404/Detailed%20CEN%2004-2024%20Paramedical.pdf": CEN_04_2024,
    "https://www.rrbcdg.gov.in/uploads/202404/Detailed%20CEN%2004-2024%20Paramedical.pdf": CEN_04_2024,
    "https://rrbcdg.gov.in/uploads/202405/Detailed%20CEN%2005-2024%20NTPC.pdf": CEN_05_2024,
    "https://www.rrbcdg.gov.in/uploads/202405/Detailed%20CEN%2005-2024%20NTPC.pdf": CEN_05_2024,
    "https://rrbcdg.gov.in/uploads/202406/Detailed%20CEN%2006-2024%20NTPC.pdf": CEN_06_2024,
    "https://www.unigoa.ac.in/uploads/syllabus/master-of-social-work-msw_syllabus_22920190624.112834.pdf": GOA_MSW,
}


def _fix(value):
    """Recursively replace mapped URLs; returns (new_value, replacements)."""
    if isinstance(value, str):
        new = URL_MAP.get(value, value)
        return new, int(new != value)
    if isinstance(value, list):
        out, hits = [], 0
        for item in value:
            fixed, h = _fix(item)
            hits += h
            out.append(fixed)
        if hits and all(isinstance(x, str) for x in out):
            seen, deduped = set(), []
            for x in out:
                if x not in seen:
                    seen.add(x)
                    deduped.append(x)
            out = deduped
        return out, hits
    if isinstance(value, dict):
        out, hits = {}, 0
        for k, v in value.items():
            fixed, h = _fix(v)
            hits += h
            out[k] = fixed
        return out, hits
    return value, 0


def main():
    reg = Registry()
    replaced = touched = 0
    for n in reg.nodes.values():
        if not n.facts:
            continue
        fixed, hits = _fix(n.facts.model_dump(mode="json"))
        if hits:
            n.facts = NodeFacts.model_validate(fixed)
            replaced += hits
            touched += 1
            print(f"  {n.id}: {hits} citation(s) updated")
    if replaced:
        reg.save()
    print(f"repair_20260721: {replaced} URL replacement(s) across {touched} node(s)")


if __name__ == "__main__":
    main()
