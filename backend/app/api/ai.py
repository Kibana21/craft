from fastapi import APIRouter, Depends

from app.core.auth import get_current_user
from app.models.user import User
from app.schemas.ai import (
    GenerateTaglinesRequest,
    GenerateTaglinesResponse,
    GenerateImageRequest,
    GenerateImageResponse,
    GenerateStoryboardRequest,
    GenerateStoryboardResponse,
)
from app.services.ai_service import (
    generate_taglines,
    generate_image,
    generate_storyboard,
)

router = APIRouter(prefix="/api/ai", tags=["ai"])


@router.post("/generate-taglines", response_model=GenerateTaglinesResponse)
async def gen_taglines(
    data: GenerateTaglinesRequest,
    _current_user: User = Depends(get_current_user),
) -> GenerateTaglinesResponse:
    taglines = await generate_taglines(
        product=data.product,
        audience=data.audience,
        tone=data.tone,
        count=data.count,
    )
    return GenerateTaglinesResponse(taglines=taglines)


@router.post("/generate-image", response_model=GenerateImageResponse)
async def gen_image(
    data: GenerateImageRequest,
    _current_user: User = Depends(get_current_user),
) -> GenerateImageResponse:
    image_url, prompt_used = await generate_image(
        product=data.prompt_context,
        audience="",
        tone=data.tone,
        artifact_type=data.artifact_type,
        aspect_ratio=data.aspect_ratio,
    )
    return GenerateImageResponse(image_url=image_url, prompt_used=prompt_used)


@router.post("/generate-storyboard", response_model=GenerateStoryboardResponse)
async def gen_storyboard(
    data: GenerateStoryboardRequest,
    _current_user: User = Depends(get_current_user),
) -> GenerateStoryboardResponse:
    frames = await generate_storyboard(
        topic=data.topic,
        key_message=data.key_message,
        product=data.product,
        tone=data.tone,
    )
    return GenerateStoryboardResponse(frames=frames)
