import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


# Session-scoped so the asyncpg pool inside `app` stays bound to one event
# loop for the whole test run. With function scope, the second test gets a
# fresh loop while the engine still references the first → "Event loop is
# closed" on connection cleanup. pyproject.toml sets
# `asyncio_default_fixture_loop_scope = "session"` to match.
@pytest.fixture(scope="session")
async def client() -> AsyncClient:  # type: ignore[misc]
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac  # type: ignore[misc]
