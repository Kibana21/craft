"""Poster Wizard AI endpoints — /api/ai/poster/…

Phase B  (implemented): generate-brief, generate-appearance-paragraph,
                        generate-scene-description, copy-draft-all,
                        copy-draft-field, tone-rewrite,
                        classify-structural-change (heuristic)
Phase C  (implemented): generate-composition-prompt, generate-variants,
                        generate-variants/retry
Phase D  (implemented): refine-chat, inpaint, save-as-variant (artifacts.py)

The composition-prompt assembler is deterministic and does not call Gemini;
it is implemented here and returns 200 even in Phase B builds.
"""
import logging
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user
from app.core.database import get_db
from app.core.rate_limit import limiter
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
    ImproveBriefFieldRequest,
    ImproveBriefFieldResponse,
    ImproveSubjectFieldRequest,
    ImproveSubjectFieldResponse,
    GenerateVariantsJobResponse,
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
    VariantJobStatusResponse,
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
    improve_brief_field,
    improve_subject_field,
    tone_rewrite,
)
from app.services.poster_image_service import dispatch_generate_variants_job
from app.services.poster_image_service import get_variant_job_status
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
    "/improve-brief-field",
    response_model=ImproveBriefFieldResponse,
    summary="Field-level AI assist for Step 1 brief fields",
)
@limiter.limit("15/minute")
async def improve_brief_field_endpoint(
    request: Request,  # noqa: ARG001 — slowapi reads the rate-limit key from here
    data: ImproveBriefFieldRequest,
    _current_user: User = Depends(get_current_user),
) -> ImproveBriefFieldResponse:
    """Suggest a value for one brief field using the other fields as context."""
    try:
        value = await improve_brief_field(
            field=data.field,
            title=data.title,
            campaign_objective=(
                data.campaign_objective.value if data.campaign_objective else None
            ),
            target_audience=data.target_audience,
            tone=data.tone.value if data.tone else None,
            call_to_action=data.call_to_action,
            narrative=data.narrative,
        )
    except Exception as exc:
        logging.getLogger(__name__).warning(
            "improve-brief-field Gemini call failed: %s", exc
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI suggestion failed. Please try again.",
        )

    return ImproveBriefFieldResponse(value=value)


@router.post(
    "/improve-subject-field",
    response_model=ImproveSubjectFieldResponse,
    summary="Field-level AI assist for Step 2 human-model fields",
)
@limiter.limit("15/minute")
async def improve_subject_field_endpoint(
    request: Request,  # noqa: ARG001
    data: ImproveSubjectFieldRequest,
    _current_user: User = Depends(get_current_user),
) -> ImproveSubjectFieldResponse:
    """Suggest a value for appearance_keywords or expression_mood."""
    try:
        value = await improve_subject_field(
            field=data.field,
            appearance_keywords=data.appearance_keywords,
            expression_mood=data.expression_mood,
            posture_framing=(
                data.posture_framing.value if data.posture_framing else None
            ),
            brief_context=data.brief_context,
        )
    except Exception as exc:
        logging.getLogger(__name__).warning(
            "improve-subject-field Gemini call failed: %s", exc
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="AI suggestion failed. Please try again.",
        )

    return ImproveSubjectFieldResponse(value=value)


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

    template_zones_raw = None
    if data.template_zones:
        template_zones_raw = [z.model_dump() for z in data.template_zones]

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
        campaign_title=data.brief.title,
        campaign_objective=data.brief.campaign_objective,
        target_audience=data.brief.target_audience,
        brief_cta=data.brief.call_to_action,
        copy_subheadline=data.copy.subheadline,
        copy_body=data.copy.body,
        template_zones=template_zones_raw,
    )
    return CompositionPromptResponse(merged_prompt=merged_prompt, style_sentence=style_sentence)


# ── Phase C — image generation (stub) ─────────────────────────────────────────


@router.post(
    "/generate-variants",
    response_model=GenerateVariantsJobResponse,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Dispatch a poster image generation job (Phase C)",
)
@limiter.limit("10/minute")
async def generate_variants(
    request: Request,  # noqa: ARG001 — required by slowapi to read the rate-limit key
    data: GenerateVariantsRequest,
    _current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> GenerateVariantsJobResponse:
    """Dispatch generation to a Celery worker and return immediately with a job_id.

    Poll GET /generate-variants/{job_id}/status for QUEUED → RUNNING → READY/FAILED.
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
        job_id = await dispatch_generate_variants_job(
            db=db,
            artifact_id=data.artifact_id,
            merged_prompt=data.merged_prompt,
            subject_type=data.subject_type.value,
            reference_image_ids=data.reference_image_ids,
            count=data.count,
            format_name=data.format.value,
        )
    except ValueError as exc:
        # Validation error before any DB write — no rollback needed, but be
        # defensive in case the service was mid-mutation when it raised.
        await db.rollback()
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
        # Critical: if dispatch raised AFTER mutating artifact.content (e.g.
        # writing last_generation_job_id then failing to enqueue the Celery
        # task), the partial write would be visible to subsequent polls.
        # Rollback restores a consistent state.
        await db.rollback()
        logger.exception("generate-variants dispatch failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"detail": "Failed to dispatch generation job.", "error_code": "DISPATCH_ERROR"},
        ) from exc

    return GenerateVariantsJobResponse(job_id=job_id, status="QUEUED")


@router.get(
    "/generate-variants/{job_id}/status",
    response_model=VariantJobStatusResponse,
    summary="Poll the status of a generation job (Phase C)",
)
async def get_generate_variants_status(
    job_id: str,
    _current_user: User = Depends(get_current_user),
) -> VariantJobStatusResponse:
    """Read job status from Redis. Poll every 2 s until status is READY or FAILED."""
    logger = logging.getLogger(__name__)

    try:
        job = await get_variant_job_status(job_id)
    except Exception as exc:
        logger.exception("get-variant-job-status failed: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"detail": "Could not read job status.", "error_code": "STATUS_READ_ERROR"},
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
        for v in job.get("variants", [])
        if v.get("status") in ("READY", "FAILED")
    ]

    return VariantJobStatusResponse(
        job_id=job_id,
        status=job["status"],
        variants=variants,
        partial_failure=job.get("partial_failure", False),
        error=job.get("error"),
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
@limiter.limit("10/minute")
async def refine_chat(
    request: Request,  # noqa: ARG001 — required by slowapi
    data: RefineChatRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RefineChatResponse:
    """Chat-based poster refinement. See poster_refine_service for the flow."""
    # Ownership / RBAC — reuse the shared artifact-access dependency.
    await require_artifact_access(data.artifact_id, current_user, db)
    from app.services.poster_refine_service import refine_chat_turn
    response = await refine_chat_turn(
        db,
        artifact_id=data.artifact_id,
        variant_id=data.variant_id,
        user_message=data.user_message,
        change_history=data.change_history,
        original_merged_prompt=data.original_merged_prompt,
    )
    await db.commit()
    return response


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
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> InpaintResponse:
    """Inpaint a masked region of a poster variant.

    Counts against the 6-turn cap per variant (doc 07 §Inpainting from Chat).
    """
    from app.services.poster_image_service import inpaint_variant
    from app.services.poster_refine_service import enforce_turn_limit

    await require_artifact_access(artifact_id, current_user, db)
    # Enforce turn cap BEFORE doing expensive Gemini work; raises 429 if hit.
    await enforce_turn_limit(db, artifact_id, variant_id)

    mask_bytes = await mask_png.read()
    try:
        result = await inpaint_variant(
            db,
            artifact_id=artifact_id,
            variant_id=str(variant_id),
            mask_png_bytes=mask_bytes,
            description=description,
            original_merged_prompt=original_merged_prompt,
        )
    except ValueError as exc:
        # Service raises ValueError for 404-ish + validation failures (mask
        # coverage > 60%, mask size mismatch, missing variant image).
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return InpaintResponse(**result)


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
