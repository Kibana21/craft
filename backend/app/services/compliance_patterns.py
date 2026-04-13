"""Static pattern library for per-field compliance checking.

Each entry is (regex_pattern, mas_basis, suggestion | None).
Patterns are case-insensitive; applied after text normalisation.
"""

from typing import NamedTuple


class PatternEntry(NamedTuple):
    pattern: str           # Python regex (re.IGNORECASE applied)
    mas_basis: str         # MAS document reference
    suggestion: str | None = None


# ── Pattern library ────────────────────────────────────────────────────────────

PATTERNS: dict[str, list[PatternEntry]] = {
    "ABSOLUTE_CLAIM": [
        PatternEntry(
            r"\bguaranteed?\s+(returns?|payout|outcome|benefit|profit|income)\b",
            "FAA-N16",
            '"projected" / "potential" / "illustrated"',
        ),
        PatternEntry(r"\bno[\s-]risk\b", "FAA-N16", '"low-risk" / "capital-stable"'),
        PatternEntry(r"\bzero[\s-]risk\b", "FAA-N16", '"low-risk" / "capital-stable"'),
        PatternEntry(r"\b100\s*%\s*(safe|secure|certain|guaranteed)\b", "FAA-N16", None),
        PatternEntry(
            r"\bfully?\s+guaranteed\b",
            "FAA-N16",
            '"potential returns" / "illustrated benefits"',
        ),
        PatternEntry(
            r"\bguaranteed?\s+growth\b",
            "FAA-N16",
            '"potential growth" / "illustrated growth"',
        ),
    ],
    "UNQUALIFIED_SUPERLATIVE": [
        PatternEntry(
            r"\bthe\s+cheapest\b",
            "FAA-N16",
            '"competitive premiums" / "affordable protection"',
        ),
        PatternEntry(r"\bthe\s+only\b", "FAA-N16", '"one of the leading"'),
        PatternEntry(
            r"\bnumber\s+one\b",
            "FAA-N16",
            '"a leading" / "one of Singapore\'s top"',
        ),
        PatternEntry(
            r"\b#\s*1\s+insurance\b",
            "FAA-N16",
            '"a leading insurance provider"',
        ),
        PatternEntry(
            r"\bbest\s+(insurance|coverage|plan|policy)\b",
            "FAA-N16",
            '"comprehensive" / "trusted" / "award-winning"',
        ),
        PatternEntry(
            r"\blowest\s+(premium|price|cost)\b",
            "FAA-N16",
            '"competitive premium"',
        ),
    ],
    "MISLEADING_CERTAINTY": [
        PatternEntry(
            r"\byou\s+will\s+receive\b",
            "Insurance Act advertising provisions",
            '"you may receive" / "illustrated benefit"',
        ),
        PatternEntry(
            r"\bdefinitely\s+pays?\b",
            "Insurance Act advertising provisions",
            '"subject to policy terms"',
        ),
        PatternEntry(
            r"\bcertain(ly)?\s+get\b",
            "Insurance Act advertising provisions",
            '"may receive" / "upon qualifying event"',
        ),
        PatternEntry(
            r"\byou\s+are\s+guaranteed\b",
            "Insurance Act advertising provisions",
            '"you may be eligible"',
        ),
        PatternEntry(
            r"\b(always|absolutely|definitely)\s+(pays?|covers?|protects?)\b",
            "Insurance Act advertising provisions",
            '"subject to policy terms and conditions"',
        ),
    ],
    "MISSING_PRODUCT_QUALIFIER": [
        # Detected via LLM layer — no static regex entries
    ],
}

# Severity mapping: most absolute/misleading claims are ERRORs, superlatives are WARNINGs
PATTERN_SEVERITY: dict[str, str] = {
    "ABSOLUTE_CLAIM": "ERROR",
    "UNQUALIFIED_SUPERLATIVE": "WARNING",
    "MISLEADING_CERTAINTY": "ERROR",
    "MISSING_PRODUCT_QUALIFIER": "WARNING",
    "CUSTOM_RULE": "WARNING",  # overridden by the rule's own severity field
}
