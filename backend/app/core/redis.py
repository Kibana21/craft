from collections.abc import AsyncGenerator

import redis.asyncio as redis

from app.core.config import settings

redis_pool = redis.ConnectionPool.from_url(
    settings.REDIS_URL,
    decode_responses=True,
)


async def get_redis() -> AsyncGenerator[redis.Redis, None]:  # type: ignore[type-arg]
    client = redis.Redis(connection_pool=redis_pool)
    try:
        yield client
    finally:
        await client.aclose()
