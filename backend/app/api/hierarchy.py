import uuid

from fastapi import APIRouter, Depends

from app.core.rbac import require_leader
from app.models.user import User
from app.schemas.auth import UserResponse

router = APIRouter(prefix="/api/hierarchy", tags=["hierarchy"])


# Mock data — will be replaced with real AIA hierarchy API
MOCK_FSCS = [
    {
        "id": "00000000-0000-0000-0000-000000000001",
        "name": "Maya Chen",
        "email": "maya@agent.example.com",
        "role": "fsc",
        "avatar_url": None,
        "agent_id": "FSC-1001",
    },
    {
        "id": "00000000-0000-0000-0000-000000000002",
        "name": "Alex Ong",
        "email": "alex@agent.example.com",
        "role": "fsc",
        "avatar_url": None,
        "agent_id": "FSC-1002",
    },
]


@router.get("/{leader_id}/fscs", response_model=list[UserResponse])
async def get_leader_fscs(
    leader_id: uuid.UUID,
    _current_user: User = Depends(require_leader),
) -> list[dict]:
    """Mock endpoint: returns FSCs under a leader.
    Will be replaced with real AIA hierarchy API integration.
    """
    return MOCK_FSCS
