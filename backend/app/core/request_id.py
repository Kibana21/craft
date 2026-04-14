"""Request-ID middleware for FastAPI.

Generates a UUID4 per request, attaches it to the response as
`X-Request-ID`, and binds it into the request scope so log records emitted
during the request can include it. Frontend stores the header in error
banners so users can quote it back during incident triage.

Honours an inbound `X-Request-ID` header so chained requests (worker → API,
or a fronting proxy) keep the same correlation ID.
"""
from __future__ import annotations

import logging
import uuid
from contextvars import ContextVar

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

# Context var so any logger.info() call inside a request can include the
# request_id automatically via a logging filter (configured below).
request_id_var: ContextVar[str] = ContextVar("request_id", default="-")


class RequestIdMiddleware(BaseHTTPMiddleware):
    HEADER = "X-Request-ID"

    async def dispatch(self, request: Request, call_next):
        rid = request.headers.get(self.HEADER) or uuid.uuid4().hex
        token = request_id_var.set(rid)
        try:
            response: Response = await call_next(request)
        finally:
            request_id_var.reset(token)
        response.headers[self.HEADER] = rid
        return response


class RequestIdLogFilter(logging.Filter):
    """Attaches `request_id` to every LogRecord. Use in formatter via %(request_id)s."""

    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_var.get()
        return True


def install_log_filter() -> None:
    """Attach the filter to the root logger so every emitted record carries
    `request_id`. Idempotent — safe to call multiple times."""
    root = logging.getLogger()
    if any(isinstance(f, RequestIdLogFilter) for f in root.filters):
        return
    root.addFilter(RequestIdLogFilter())
