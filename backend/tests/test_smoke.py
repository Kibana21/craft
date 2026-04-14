"""Smoke tests — minimum viable coverage of the critical paths.

These verify the API surface boots, auth works, and the protected routes
reject unauthenticated callers correctly. They run against a real DB +
Redis (provided by CI services), but mock no AI calls — so they don't
trigger any cost-heavy endpoints.

Add deeper coverage incrementally as features stabilise.
"""
from __future__ import annotations

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health_endpoint(client: AsyncClient) -> None:
    """The simplest reachability check: /api/health returns 200 with a body."""
    response = await client.get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert "status" in body


@pytest.mark.asyncio
async def test_unauth_routes_return_401_or_403(client: AsyncClient) -> None:
    """Every protected route must reject unauthenticated callers — never serve
    data with no Authorization header. This is the contract that the frontend's
    401 interceptor (and the ApiClient's redirect-to-login on 401) relies on."""
    protected_paths = [
        "/api/auth/me",
        "/api/projects",
        "/api/studio/images",
        "/api/brand-kit",
        "/api/notifications",
        "/api/gamification/me",
    ]
    for path in protected_paths:
        response = await client.get(path)
        # FastAPI's Depends(get_current_user) returns 403 when no header is
        # present, 401 when the header is invalid. Either is correct — what
        # we're guarding against is a successful 200 with no auth.
        assert response.status_code in (401, 403), (
            f"Unauth GET {path} returned {response.status_code} — should be 401/403"
        )


@pytest.mark.asyncio
async def test_login_validates_request_shape(client: AsyncClient) -> None:
    """Login schema enforces password length and email format. Catches a
    regression where someone weakens the validation (e.g. removes min_length)
    and accidentally allows empty passwords through.

    Stays away from the DB on purpose so it's robust across the
    pytest-asyncio + asyncpg engine-loop quirk in multi-test runs (which is
    a separate test-infra item tracked under reliability-hardening Tier 3).
    """
    # Missing fields → 422 (Pydantic).
    response = await client.post("/api/auth/login", json={})
    assert response.status_code == 422

    # Short password → 422 (schema min_length).
    response = await client.post(
        "/api/auth/login",
        json={"email": "any@example.com", "password": "short"},
    )
    assert response.status_code == 422
    assert "access_token" not in response.text
