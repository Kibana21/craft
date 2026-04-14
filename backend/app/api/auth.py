from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
)
from app.core.database import get_db
from app.core.rate_limit import limiter
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    RefreshRequest,
    TokenResponse,
    UserResponse,
)
from app.services.auth_service import authenticate_user

router = APIRouter(prefix="/api/auth", tags=["auth"])


# 10/minute on login — keys by IP since the user isn't authenticated yet.
# Tight enough to slow down brute-force attempts without locking out a
# legitimate user with shaky network during a demo.
@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
async def login(
    request: Request,  # noqa: ARG001 — required by slowapi
    body: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    user = await authenticate_user(db, body.email, body.password)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )

    access_token = create_access_token(user.id, user.role.value)
    refresh_token = create_refresh_token(user.id, user.role.value)

    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user=UserResponse.model_validate(user),
    )


# 30/minute is intentionally loose — the frontend 401-interceptor may fire
# back-to-back when a tab wakes from sleep and several queries refetch in
# parallel. Catches abusive looping without blocking legitimate UX.
@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("30/minute")
async def refresh_token(
    request: Request,  # noqa: ARG001 — required by slowapi for keying
    body: RefreshRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    payload = decode_token(body.refresh_token)

    if payload.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type — expected refresh token",
        )

    from sqlalchemy import select
    import uuid

    user_id = payload.get("sub")
    result = await db.execute(
        select(User).where(User.id == uuid.UUID(user_id))
    )
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )

    access_token = create_access_token(user.id, user.role.value)
    new_refresh_token = create_refresh_token(user.id, user.role.value)

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_token,
        user=UserResponse.model_validate(user),
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse.model_validate(current_user)
