"""Poster Wizard AI endpoints — /api/ai/poster/…

Phase B  (implemented): generate-brief, generate-appearance-paragraph,
                        generate-scene-description, copy-draft-all,
                        copy-draft-field, tone-rewrite,
                        classify-structural-change (heuristic)
Phase C  (implemented): generate-composition-prompt, generate-variants,
                        generate-variants/retry
Phase D  (stub — 501):  refine-chat, inpaint

The composition-prompt assembler is deterministic and does not call Gemini;
it is implemented here and returns 200 even in Phase B builds.
"""
import logging
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.rbac import require_artifact_access
from app.models.user import User
from app.schemas.poster import (
    AppearanceParagraphRequest,
    AppearanceParagraphResponse,
    ClassifyStructuralChangeRequest,
    ClassifyStructuralChangeResponse,
    CompositionPromptRequest,
    CompositionPromptResponse,
    CopyDraftAllRequest,
    CopyDraftAllResponse,
    CopyDraftFieldRequest,
    CopyDraftFieldResponse,
    CopyValues,
    GenerateBriefRequest,
    GenerateBriefResponse,
    GenerateVariantsRequest,
    GenerateVariantsResponse,
    InpaintResponse,
    RefineChatRequest,
    RefineChatResponse,
    RetryVariantRequest,
    RetryVariantResponse,
    SceneDescriptionRequest,
    SceneDescriptionResponse,
    ToneRewriteRequest,
    ToneRewriteResponse,
    UpscaleVariantRequest,
    UpscaleVariantResponse,
    Variant,
)
from app.services.poster_ai_service import (
    build_composition_prompt,
    build_style_sentence,
    classify_structural_change,
    copy_draft_all,
    copy_draft_field,
    generate_appearance_paragraph,
    generate_poster_brief,
    generate_scene_description,
    tone_rewrite,
)
from app.services.poster_image_service import generate_variants as svc_generate_variants
from app.services.poster_image_service import retry_single_variant

router = APIRouter(prefix="/api/ai/poster", tags=["poster-ai"])


# ── Fallback data ──────────────────────────────────────────────────────────────

_BRIEF_FALLBACK = (
    "This campaign aims to connect with our target audience on an emotional level, "
    "highlighting the peace of mind that comes with comprehensive AIA coverage. "
    "Through warm, relatable imagery and clear benefit communication, we will "
    "inspire confidence in financial protection and motivate action."
)

_APPEARANCE_FALLBACK = (
    "A confident professional in smart business attire, warm smile, facing the camera "
    "directly. Soft-focus modern office background with warm ambient lighting. "
    "Approachable and trustworthy expression, mid-30s, business casual attire."
)

_SCENE_FALLBACK = (
    "Soft morning light filters through floor-to-ceiling windows into a modern, "
    "airy living space. Warm tones of cream and gold suggest comfort and security. "
    "A family photograph sits on a side table, slightly out of focus."
)

_COPY_FALLBACK = {
    "headline": "Protection That Grows With You",
    "subheadline": "Comprehensive coverage designed for every stage of life",
    "body": (
        "AIA Singapore gives you the confidence to live fully, knowing your family "
        "is protected no matter what comes next."
    ),
    "cta_text": "Get Protected Today",
}


# ── Phase B endpoints ──────────────────────────────────────────────────────────


@router.post(
    "/generate-brief",
    response_model=GenerateBriefResponse,
    summary="Generate poster brief narrative",
)
async def generate_brief(
    data: GenerateBriefRequest,
    _current_user: User = Depends(get_current_user),
) -> GenerateBriefResponse:
    """Synthesise a 60–120 word campaign brief paragraph from Step 1 inputs."""
    try:
        brief_text = await generate_poster_brief(
            campaign_objective=data.campaign_objective.value,
            target_audience=data.target_audience,
            tone=data.tone.value,
            call_to_action=data.call_to_action,
            existing_brief=data.existing_brief,
        )
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning("generate-brief Gemini call failed: %s", exc)
        brief_text = _BRIEF_FALLBACK

    return GenerateBriefResponse(brief=brief_text, generation_id=uuid.uuid4())


@router.post(
    "/generate-appearance-paragraph",
    response_model=AppearanceParagraphResponse,
    summary="Expand appearance keywords into a description paragraph",
)
async def appearance_paragraph(
    data: AppearanceParagraphRequest,
    _current_user: User = Depends(get_current_user),
) -> AppearanceParagraphResponse:
    """Expand human-model appearance cues into a 40–80 word image-prompt paragraph."""
    try:
        paragraph, word_count = await generate_appearance_paragraph(
            appearance_keywords=data.appearance_keywords,
            expression_mood=data.expression_mood,
            posture_framing=data.posture_framing.value,
            brief_context=data.brief_context,
        )
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning(
            "generate-appearance-paragraph Gemini call failed: %s", exc
        )
        paragraph = _APPEARANCE_FALLBACK
        word_count = len(paragraph.split())

    return AppearanceParagraphResponse(paragraph=paragraph, word_count=word_count)


@router.post(
    "/generate-scene-description",
    response_model=SceneDescriptionResponse,
    summary="Generate a scene / abstract subject description",
)
async def scene_description(
    data: SceneDescriptionRequest,
    _current_user: User = Depends(get_current_user),
) -> SceneDescriptionResponse:
    """Generate a visual scene description for the SCENE_ABSTRACT subject type."""
    try:
        description = await generate_scene_description(
            visual_style=data.visual_style.value,
            brief_context=data.brief_context,
            seed_hint=data.seed_hint,
        )
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning(
            "generate-scene-description Gemini call failed: %s", exc
        )
        description = _SCENE_FALLBACK

    return SceneDescriptionResponse(description=description)


@router.post(
    "/copy-draft-all",
    response_model=CopyDraftAllResponse,
    summary="Draft all copy fields in one call",
)
async def draft_all_copy(
    data: CopyDraftAllRequest,
    _current_user: User = Depends(get_current_user),
) -> CopyDraftAllResponse:
    """Draft headline, subheadline, body, and CTA in a single Gemini call."""
    try:
        result = await copy_draft_all(
            brief=data.brief,
            tone=data.tone.value,
            campaign_objective=data.campaign_objective.value,
            audience=data.audience,
        )
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning("copy-draft-all Gemini call failed: %s", exc)
        result = _COPY_FALLBACK

    return CopyDraftAllResponse(**result)


@router.post(
    "/copy-draft-field",
    response_model=CopyDraftFieldResponse,
    summary="Regenerate a single copy field",
)
async def draft_single_field(
    data: CopyDraftFieldRequest,
    _current_user: User = Depends(get_current_user),
) -> CopyDraftFieldResponse:
    """Regenerate one copy field with sibling context for coherence."""
    try:
        value = await copy_draft_field(
            field=data.field,
            brief=data.brief,
            tone=data.tone.value,
            current_values=data.current_values.model_dump(),
        )
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning("copy-draft-field Gemini call failed: %s", exc)
        value = _COPY_FALLBACK.get(data.field, "")

    return CopyDraftFieldResponse(value=value)


@router.post(
    "/tone-rewrite",
    response_model=ToneRewriteResponse,
    summary="Rewrite all copy fields with a new tone",
)
async def rewrite_tone(
    data: ToneRewriteRequest,
    _current_user: User = Depends(get_current_user),
) -> ToneRewriteResponse:
    """Rewrite headline, subheadline, body, and CTA with a tone direction."""
    try:
        result = await tone_rewrite(
            rewrite_tone=data.rewrite_tone,
            copy_values=data.current_copy.model_dump(),
        )
    except Exception as exc:
        import logging
        logging.getLogger(__name__).warning("tone-rewrite Gemini call failed: %s", exc)
        result = data.current_copy.model_dump()  # fallback: return unchanged

    return ToneRewriteResponse(rewritten=CopyValues(**result))


@router.post(
    "/classify-structural-change",
    response_model=ClassifyStructuralChangeResponse,
    summary="Classify whether a chat message requests a structural change",
)
async def classify_change(
    data: ClassifyStructuralChangeRequest,
    _current_user: User = Depends(get_current_user),
) -> ClassifyStructuralChangeResponse:
    """Keyword + heuristic classifier. Returns is_structural, target step, confidence."""
    result = await classify_structural_change(data.message)
    return ClassifyStructuralChangeResponse(**result)


# ── Phase C — composition prompt (deterministic, available from Phase B) ───────


@router.post(
    "/generate-composition-prompt",
    response_model=CompositionPromptResponse,
    summary="Assemble merged generation prompt from wizard state",
)
async def generate_composition_prompt(
    data: CompositionPromptRequest,
    _current_user: User = Depends(get_current_user),
) -> CompositionPromptResponse:
    """Deterministic prompt assembly. Returns merged_prompt and style_sentence.

    No LLM call in Phase B/C — the style-sentence LLM polish is deferred.
    """
    # Resolve subject description from the active sub-type
    subject_type = data.subject.type
    if subject_type == "HUMAN_MODEL":
        subject_description = (
            data.subject.human_model.full_appearance
            or data.subject.human_model.appearance_keywords
        )
    elif subject_type == "PRODUCT_ASSET":
        subject_description = f"product asset, placement: {data.subject.product_asset.placement}"
    else:
        subject_description = data.subject.scene_abstract.description

    # LLM style-sentence sub-call (doc 03 §7)
    style_sent = await build_style_sentence(
        visual_style=data.composition_settings.visual_style,
        palette=data.composition_settings.palette,
        tone=data.brief.tone,
    )

    merged_prompt, style_sentence = build_composition_prompt(
        brief_narrative=data.brief.narrative,
        subject_type=subject_type,
        subject_description=subject_description,
        copy_headline=data.copy.headline,
        copy_cta=data.copy.cta_text,
        format_name=data.composition_settings.format,
        layout_template=data.composition_settings.layout_template,
        visual_style=data.composition_settings.visual_style,
        palette=data.composition_settings.palette,
        style_sentence=style_sent,
        tone=data.brief.tone,
    )
    return CompositionPromptResponse(merged_prompt=merged_prompt, style_sentence=style_sentence)


# ── Phase C — image generation (stub) ─────────────────────────────────────────


@router.post(
    "/generate-variants",
    response_model=GenerateVariantsResponse,
    summary="Generate 4 poster image variants (Phase C)",
)
async def generate_variants(
    data: GenerateVariantsRequest,
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> GenerateVariantsResponse:
    """Fire up to 4 parallel gemini-2.5-flash-image calls with seed-phrase diversity."""
    logger = logging.getLogger(__name__)

    # Verify caller has access to the artifact
    try:
        await require_artifact_access(
            artifact_id=data.artifact_id,
            current_user=_current_user,
            db=db,
        )
    except HTTPException:
        raise

    try:
        result = await svc_generate_variants(
            db=db,
            artifact_id=data.artifact_id,
            merged_prompt=data.merged_prompt,
            subject_type=data.subject_type.value,
            reference_image_ids=data.reference_image_ids,
            count=data.count,
            format_name=data.format.value,
        )
    except ValueError as exc:
        msg = str(exc)
        if "quota" in msg.lower() or "limit" in msg.lower():
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={"detail": msg, "error_code": "PROJECT_QUOTA_EXCEEDED"},
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": msg, "error_code": "NOT_FOUND"},
        ) from exc
    except Exception as exc:
        logger.exception("generate-variants failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"detail": "Image generation failed.", "error_code": "AI_UPSTREAM_ERROR"},
        ) from exc

    variants = [
        Variant(
            id=uuid.UUID(v["id"]),
            slot=v["slot"],
            status=v["status"],
            image_url=v.get("image_url"),
            error_code=v.get("error_code"),
            retry_token=v.get("retry_token"),
        )
        for v in result["variants"]
    ]
    return GenerateVariantsResponse(
        job_id=result["job_id"],
        variants=variants,
        partial_failure=result["partial_failure"],
    )


@router.post(
    "/generate-variants/retry",
    response_model=RetryVariantResponse,
    summary="Retry a single failed variant slot (Phase C)",
)
async def retry_variant(
    data: RetryVariantRequest,
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RetryVariantResponse:
    """Re-run one failed variant slot using the signed retry token."""
    logger = logging.getLogger(__name__)

    try:
        await require_artifact_access(
            artifact_id=data.artifact_id,
            current_user=_current_user,
            db=db,
        )
    except HTTPException:
        raise

    try:
        variant_dict = await retry_single_variant(
            db=db,
            artifact_id=data.artifact_id,
            job_id=data.job_id,
            slot=data.slot,
            retry_token=data.retry_token,
            merged_prompt=data.merged_prompt,
            reference_image_ids=data.reference_image_ids,
            subject_type=data.subject_type.value,
        )
    except PermissionError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"detail": str(exc), "error_code": "INVALID_RETRY_TOKEN"},
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"detail": str(exc), "error_code": "VALIDATION_ERROR"},
        ) from exc
    except Exception as exc:
        logger.exception("retry-variant failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"detail": "Retry failed.", "error_code": "AI_UPSTREAM_ERROR"},
        ) from exc

    return RetryVariantResponse(
        variant=Variant(
            id=uuid.UUID(variant_dict["id"]),
            slot=variant_dict["slot"],
            status=variant_dict["status"],
            image_url=variant_dict.get("image_url"),
            error_code=variant_dict.get("error_code"),
            retry_token=variant_dict.get("retry_token"),
        )
    )


# ── Phase D — chat refinement (stubs) ─────────────────────────────────────────


@router.post(
    "/refine-chat",
    response_model=RefineChatResponse,
    summary="One chat refinement turn (Phase D)",
)
async def refine_chat(
    data: RefineChatRequest,
    _current_user: User = Depends(get_current_user),
    _db: AsyncSession = Depends(get_db),
) -> RefineChatResponse:
    """Chat-based poster refinement. Phase D — not yet implemented."""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail={
            "detail": "Chat refinement is coming in Phase D.",
            "error_code": "PHASE_NOT_IMPLEMENTED",
        },
    )


@router.post(
    "/inpaint",
    response_model=InpaintResponse,
    summary="Region edit via inpainting (Phase D)",
)
async def inpaint(
    artifact_id: uuid.UUID = Form(...),
    variant_id: uuid.UUID = Form(...),
    description: str = Form(...),
    original_merged_prompt: str = Form(...),
    mask_png: UploadFile = File(...),
    _current_user: User = Depends(get_current_user),
    _db: AsyncSession = Depends(get_db),
) -> InpaintResponse:
    """Inpaint a masked region of a poster variant. Phase D — not yet implemented."""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail={
            "detail": "Inpainting is coming in Phase D.",
            "error_code": "PHASE_NOT_IMPLEMENTED",
        },
    )


# ── Phase E — 2× Upscale ──────────────────────────────────────────────────────


@router.post(
    "/upscale",
    response_model=UpscaleVariantResponse,
    summary="Upscale a poster variant to 2× resolution (Phase E)",
)
async def upscale_variant(
    data: UpscaleVariantRequest,
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UpscaleVariantResponse:
    """Double the resolution of a variant image using LANCZOS resampling.

    The upscaled result is stored as {variant_id}@2x.png alongside the original
    and the new URL is returned. Does not count against the 6-turn chat limit.
    """
    logger = logging.getLogger(__name__)

    try:
        await require_artifact_access(
            artifact_id=data.artifact_id,
            current_user=_current_user,
            db=db,
        )
    except HTTPException:
        raise

    try:
        from app.services.upscale_service import upscale_variant as svc_upscale
        result = await svc_upscale(
            artifact_id=str(data.artifact_id),
            variant_id=str(data.variant_id),
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": str(exc), "error_code": "VARIANT_NOT_FOUND"},
        ) from exc
    except Exception as exc:
        logger.exception("upscale failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"detail": "Upscale failed.", "error_code": "UPSCALE_ERROR"},
        ) from exc

    return UpscaleVariantResponse(
        image_url=result["image_url"],
        width=result["width"],
        height=result["height"],
    )
