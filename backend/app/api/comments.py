import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.comment import CommentResponse, CreateCommentRequest
from app.services.comment_service import add_comment, list_comments

router = APIRouter(tags=["comments"])


@router.post(
    "/api/artifacts/{artifact_id}/comments",
    response_model=CommentResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_comment(
    artifact_id: uuid.UUID,
    data: CreateCommentRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    comment = await add_comment(db, current_user, artifact_id, data.text)
    return {
        "id": comment.id,
        "user": {
            "id": comment.author.id,
            "name": comment.author.name,
            "avatar_url": comment.author.avatar_url,
        },
        "text": comment.text,
        "created_at": comment.created_at,
    }


@router.get("/api/artifacts/{artifact_id}/comments", response_model=list[CommentResponse])
async def get_comments(
    artifact_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    comments = await list_comments(db, current_user, artifact_id)
    return [
        {
            "id": c.id,
            "user": {
                "id": c.author.id,
                "name": c.author.name,
                "avatar_url": c.author.avatar_url,
            },
            "text": c.text,
            "created_at": c.created_at,
        }
        for c in comments
    ]
