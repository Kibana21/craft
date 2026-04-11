PRODUCT_DISCLAIMERS: dict[str, list[str]] = {
    "PAA": [
        "This is not a contract of insurance. The precise terms and conditions are specified in the policy contract.",
        "Benefits are subject to the terms and conditions of the policy.",
    ],
    "HealthShield": [
        "Pre-existing conditions may not be covered. Please refer to the policy contract for details.",
        "Subject to policy terms and conditions. Coverage may vary.",
    ],
    "AIA Vitality": [
        "Rewards are subject to availability and partner terms and conditions.",
    ],
    "PRUWealth": [
        "Past performance is not indicative of future results.",
        "Investment risks apply. You may receive less than your initial investment.",
    ],
    "AIA Family Protect": [
        "Benefits are subject to the terms and conditions of the policy.",
    ],
    "SG60 Special": [
        "This is a limited-time offer. Terms and conditions apply.",
    ],
}

DEFAULT_DISCLAIMER = "This advertisement has not been reviewed by the Monetary Authority of Singapore."


def get_required_disclaimers(product: str) -> list[str]:
    """Get required disclaimers for a product type."""
    disclaimers = [DEFAULT_DISCLAIMER]

    # Match product (case-insensitive, partial match)
    product_upper = product.upper() if product else ""
    for key, values in PRODUCT_DISCLAIMERS.items():
        if key.upper() in product_upper or product_upper in key.upper():
            disclaimers.extend(values)
            break

    return disclaimers


def check_disclaimers(artifact_content: dict, product: str) -> list[dict]:
    """Check if required disclaimers are present in artifact content.
    Returns list of {disclaimer, present, required}.
    """
    required = get_required_disclaimers(product)
    text_content = _extract_text(artifact_content).lower()

    results = []
    for disclaimer in required:
        # Check if key phrases from the disclaimer appear in the content
        key_phrases = disclaimer.lower().split(".")
        present = any(
            phrase.strip() and phrase.strip() in text_content
            for phrase in key_phrases
            if len(phrase.strip()) > 10
        )
        results.append({
            "disclaimer": disclaimer,
            "present": present,
            "required": True,
        })

    return results


def _extract_text(content: dict) -> str:
    """Extract all text content from artifact content JSON."""
    texts = []
    for key, value in content.items():
        if key in ("locks", "remixed_from", "formats", "frames"):
            continue
        if isinstance(value, str):
            texts.append(value)
    return " ".join(texts)
