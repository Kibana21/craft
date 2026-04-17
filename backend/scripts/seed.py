"""Seed script — creates test users, sample brand kit, and compliance rules.
Run: cd backend && source .venv/bin/activate && python -m scripts.seed
"""
import asyncio

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import hash_password
from app.core.database import async_session, engine
from app.models.user import User
from app.models.brand_kit import BrandKit
from app.models.compliance_rule import ComplianceRule
from app.models.enums import UserRole, ComplianceSeverity

SEED_PASSWORD = hash_password("craft2026")

SEED_USERS = [
    {
        "name": "Sarah Lim",
        "email": "sarah@example.com",
        "role": UserRole.BRAND_ADMIN,
        "agent_id": None,
    },
    {
        "name": "James Tan",
        "email": "james@example.com",
        "role": UserRole.BRAND_ADMIN,
        "agent_id": None,
    },
    {
        "name": "David Lee",
        "email": "david@example.com",
        "role": UserRole.DISTRICT_LEADER,
        "agent_id": None,
    },
    {
        "name": "Rachel Wong",
        "email": "rachel@example.com",
        "role": UserRole.DISTRICT_LEADER,
        "agent_id": None,
    },
    {
        "name": "Michael Ng",
        "email": "michael@example.com",
        "role": UserRole.AGENCY_LEADER,
        "agent_id": None,
    },
    {
        "name": "Priya Kumar",
        "email": "priya@example.com",
        "role": UserRole.AGENCY_LEADER,
        "agent_id": None,
    },
    {
        "name": "Maya Chen",
        "email": "maya@agent.example.com",
        "role": UserRole.FSC,
        "agent_id": "FSC-1001",
    },
    {
        "name": "Alex Ong",
        "email": "alex@agent.example.com",
        "role": UserRole.FSC,
        "agent_id": "FSC-1002",
    },
]

SEED_COMPLIANCE_RULES = [
    {
        "rule_text": "All insurance product advertisements must include the disclaimer: 'This advertisement has not been reviewed by the Monetary Authority of Singapore.'",
        "category": "disclaimer_required",
        "severity": ComplianceSeverity.ERROR,
    },
    {
        "rule_text": "Do not use the word 'guaranteed' when referring to investment-linked policy returns.",
        "category": "prohibited_claim",
        "severity": ComplianceSeverity.ERROR,
    },
    {
        "rule_text": "Benefit illustrations must clearly state that they are non-guaranteed and based on assumed rates of return.",
        "category": "benefit_illustration",
        "severity": ComplianceSeverity.ERROR,
    },
    {
        "rule_text": "Content should not compare AIA products with competitor products by name.",
        "category": "competitor_reference",
        "severity": ComplianceSeverity.WARNING,
    },
    {
        "rule_text": "Customer testimonials must include a disclaimer that individual results may vary.",
        "category": "testimonial",
        "severity": ComplianceSeverity.WARNING,
    },
]


async def seed() -> None:
    async with async_session() as session:
        # Seed users (idempotent)
        for user_data in SEED_USERS:
            result = await session.execute(
                select(User).where(User.email == user_data["email"])
            )
            if result.scalar_one_or_none() is None:
                user = User(
                    **user_data,
                    hashed_password=SEED_PASSWORD,
                )
                session.add(user)
                print(f"  Created user: {user_data['name']} ({user_data['role'].value})")
            else:
                print(f"  Skipped user: {user_data['name']} (already exists)")

        # Seed brand kit (idempotent)
        result = await session.execute(select(BrandKit))
        if result.scalar_one_or_none() is None:
            brand_kit = BrandKit(
                name="Brand Kit v1",
                primary_color="#D0103A",
                secondary_color="#1A1A18",
                accent_color="#1B9D74",
                fonts={
                    "heading": "Inter",
                    "body": "Inter",
                    "disclaimer": "Inter",
                    "disclaimer_inherited": True,
                },
                color_names={
                    "primary_name": "Brand Red",
                    "secondary_name": "Deep Charcoal",
                    "accent_name": "Teal Green",
                    "primary_usage": "Poster backgrounds, CTA buttons, title cards",
                    "secondary_usage": "Body copy, overlay backgrounds, dark sections",
                    "accent_usage": "Callout badges, icon highlights, video end-cards",
                },
                zone_roles={
                    "poster_background": "primary",
                    "cta_fill": "primary",
                    "disclaimer_strip": "secondary",
                    "badge_callout": "accent",
                    "headline_text": "white",
                },
                is_active=True,
                version=1,
            )
            session.add(brand_kit)
            print("  Created brand kit: AIA Singapore v1")
        else:
            print("  Skipped brand kit (already exists)")

        # Seed compliance rules (idempotent — check by rule_text)
        for rule_data in SEED_COMPLIANCE_RULES:
            result = await session.execute(
                select(ComplianceRule).where(
                    ComplianceRule.rule_text == rule_data["rule_text"]
                )
            )
            if result.scalar_one_or_none() is None:
                rule = ComplianceRule(**rule_data, is_active=True)
                session.add(rule)
                print(f"  Created rule: {rule_data['category']}")
            else:
                print(f"  Skipped rule: {rule_data['category']} (already exists)")

        await session.commit()
        print("\nSeed complete.")


if __name__ == "__main__":
    print("Seeding CRAFT database...\n")
    asyncio.run(seed())
    asyncio.run(engine.dispose())
