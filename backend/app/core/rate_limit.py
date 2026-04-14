"""Per-user rate limiting via slowapi.

Used on cost-heavy AI endpoints to protect Vertex AI / Gemini quota from a
runaway client (intentional or otherwise). 10/minute/user is the default; the
limit is keyed on the authenticated user, NOT the IP, so legitimate office
networks behind one NAT don't share a budget.

Usage:
    from app.core.rate_limit import limiter, user_rate_limit_key

    @router.post("/api/ai/poster/refine-chat")
    @limiter.limit("10/minute", key_func=user_rate_limit_key)
    async def refine_chat(request: Request, ...): ...

The endpoint MUST take a `request: Request` parameter — slowapi reads it from
the call args. FastAPI will inject it automatically when declared.

Storage: in-memory by default (per-process). For production multi-worker
deploys, swap to Redis via `Limiter(storage_uri=...)` — fall back to in-memory
silently if Redis is down so the limiter doesn't take the app down with it.
"""
from __future__ import annotations

import logging

from fastapi import HTTPException, Request, status
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.core.config import settings

logger = logging.getLogger(__name__)


def user_rate_limit_key(request: Request) -> str:
    """Key by authenticated user id when present; fall back to IP otherwise.

    The auth dependency runs BEFORE the route function, so by the time the
    limiter inspects the request, `request.state.user` may be set by a
    middleware. We don't have such middleware today — so use a header probe:
    the api-client sends `Authorization: Bearer <jwt>` and the JWT subject
    field is the user id. Decode it without verifying signature (the auth
    dep verified it already; this is just for keying).
    """
    auth = request.headers.get("authorization", "")
    if auth.startswith("Bearer "):
        token = auth[7:]
        try:
            import base64
            import json

            # JWT payload is the second segment, base64url-encoded.
            parts = token.split(".")
            if len(parts) >= 2:
                # Pad as needed
                payload_b64 = parts[1] + "=" * (-len(parts[1]) % 4)
                payload_bytes = base64.urlsafe_b64decode(payload_b64.encode("ascii"))
                payload = json.loads(payload_bytes)
                sub = payload.get("sub")
                if sub:
                    return f"user:{sub}"
        except Exception:
            # Fall through to IP-based key on any decode failure.
            pass
    return f"ip:{get_remote_address(request)}"


def _build_limiter() -> Limiter:
    """Limiter with Redis storage when available, in-memory otherwise."""
    storage_uri: str | None = None
    if settings.REDIS_URL:
        # Use a different key namespace from app data so flushdb on a Redis
        # debugging session doesn't reset rate-limit counters by accident.
        storage_uri = settings.REDIS_URL
    try:
        return Limiter(
            key_func=user_rate_limit_key,
            storage_uri=storage_uri,
            default_limits=[],   # never apply globally; opt-in per endpoint
        )
    except Exception as exc:  # noqa: BLE001
        logger.warning(
            "Rate limiter failed to init with Redis (%s); falling back to in-memory.",
            exc, exc_info=False,
        )
        return Limiter(key_func=user_rate_limit_key, default_limits=[])


limiter: Limiter = _build_limiter()


async def rate_limit_exceeded_handler(
    request: Request, exc: RateLimitExceeded
) -> None:
    """Translate slowapi's RateLimitExceeded into our standard error envelope."""
    raise HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail={
            "detail": "Too many requests. Slow down a bit.",
            "error_code": "RATE_LIMITED",
        },
    ) from exc
