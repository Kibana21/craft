"""Poster Wizard Step 5 chat-refinement service (Phase D).

Implements the `refine-chat` flow per `.claude/plans/poster-generation/07-chat-refinement-design.md`:

  1. Load + lock the artifact.
  2. Enforce the 6-turn hard cap per variant (source of truth: row count in
     `poster_chat_turns` excluding REDIRECT turns).
  3. Pre-classify the user message. Structural changes (copy/layout/subject
     edits) short-circuit to a REDIRECT response and do not count against the
     cap.
  4. Build a re-prompt that stacks the original merged prompt + accepted
     change history + the new user request, then call Gemini image with the
     current variant image as conditioning input.
  5. Summarise the edit as ≤5 words for the change-log pill.
  6. Upload result, insert a PosterChatTurn row, update the variant's
     `image_url` + `change_log`, mirror the turn count onto the JSONB for
     cheap frontend reads, commit.
  7. On the 6th successful turn the response carries action_type
     TURN_LIMIT_NUDGE so the UI can surface the "Save as variant" prompt.

Undo-pill flow (doc 07 §Change Log): a message prefixed with
`"undo the change: "` is treated as a client-driven re-render without
incrementing the cap. The caller is expected to have already removed the
undone entry from `change_history`.
"""
from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.artifact import Artifact
from app.models.poster import PosterChatTurn
from app.schemas.poster import ChangeLogEntrySchema, RefineChatResponse
from app.services.ai_service import GeminiImageError, _gemini_model, generate_image_gemini
from app.services.poster_ai_service import classify_structural_change
from app.services.poster_image_service import (
    VARIANT_IMAGE_SUBFOLDER,
    _fetch_image_bytes,
)
from app.services.upload_service import upload_image_bytes

logger = logging.getLogger(__name__)

# Hard cap from doc 07 §Turn Model.
TURN_LIMIT = 6

# Structural-change classifier confidence threshold for redirect (doc 07).
STRUCTURAL_CONFIDENCE_THRESHOLD = 0.7

# Prefix the client uses when the user clicks ✕ on a change-log pill.
_UNDO_PREFIX = "undo the change: "


# ── Turn counting / limit ─────────────────────────────────────────────────────


async def count_turns(
    db: AsyncSession,
    artifact_id: uuid.UUID,
    variant_id: uuid.UUID,
    *,
    exclude_redirects: bool = True,
) -> int:
    """Return the number of logged turns for (artifact, variant).

    Redirect turns do not consume the 6-turn budget (doc 07 §Turn Model).
    """
    stmt = select(func.count(PosterChatTurn.id)).where(
        and_(
            PosterChatTurn.artifact_id == artifact_id,
            PosterChatTurn.variant_id == variant_id,
            PosterChatTurn.deleted_at.is_(None),
        )
    )
    if exclude_redirects:
        stmt = stmt.where(PosterChatTurn.action_type != "REDIRECT")
    return int((await db.execute(stmt)).scalar_one())


async def enforce_turn_limit(
    db: AsyncSession,
    artifact_id: uuid.UUID,
    variant_id: uuid.UUID,
) -> int:
    """Raise 429 if this variant has already hit the 6-turn cap. Returns the
    current count (the next turn will be at index == returned value).
    """
    current = await count_turns(db, artifact_id, variant_id)
    if current >= TURN_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "detail": "Save as variant to continue refining.",
                "error_code": "TURN_LIMIT_REACHED",
            },
        )
    return current


# ── Prompt assembly + change-description summarisation ────────────────────────


def _build_refine_prompt(
    original_merged_prompt: str,
    change_history: list[ChangeLogEntrySchema],
    user_message: str,
) -> str:
    """Stack original prompt + accepted changes + new user request.

    Keeps layout / composition stable while re-applying accepted changes in
    order, so we don't drift even after several turns.
    """
    history_block = ""
    if change_history:
        history_block = "\n## Changes accepted so far (apply all of these):\n" + "\n".join(
            f"- {e.description}" for e in change_history
        )
    return (
        f"{original_merged_prompt.strip()}\n"
        f"{history_block}\n\n"
        f"## New request:\n{user_message.strip()}\n\n"
        "Return the edited poster image that incorporates the new request "
        "while preserving every previously accepted change. Keep the layout, "
        "typography hierarchy, subject pose, and brand identity stable unless "
        "the request explicitly says otherwise."
    )


async def _summarise_change(user_message: str) -> str:
    """≤5-word pill description. Falls back to a truncation on any failure so
    the user still sees a reasonable label.
    """
    fallback = user_message.strip()
    if len(fallback) > 30:
        fallback = fallback[:27] + "…"

    prompt = (
        "Summarise this poster edit request as a 2-5 word imperative phrase "
        "suitable for a UI pill. Return only the phrase, no quotes or trailing "
        f"punctuation.\n\nRequest: {user_message.strip()}"
    )
    try:
        model = _gemini_model()
        response = await model.generate_content(prompt, temperature=0.2)
        text = (response.text or "").strip().strip('"').strip("'").rstrip(".")
        # Clamp to ~5 words so a verbose model response doesn't blow up the UI.
        words = text.split()
        if not words:
            return fallback
        return " ".join(words[:5])
    except Exception as exc:  # noqa: BLE001 — any failure just falls back
        logger.warning("refine-chat summarise failed; using fallback: %s", exc)
        return fallback


# ── Main entry point ──────────────────────────────────────────────────────────


async def refine_chat_turn(
    db: AsyncSession,
    *,
    artifact_id: uuid.UUID,
    variant_id: uuid.UUID,
    user_message: str,
    change_history: list[ChangeLogEntrySchema],
    original_merged_prompt: str,
) -> RefineChatResponse:
    """One refinement turn. See module docstring for the full flow."""
    variant_id_str = str(variant_id)
    is_undo = user_message.startswith(_UNDO_PREFIX)

    # ── 1. Load + lock the artifact ───────────────────────────────────────────
    result = await db.execute(
        select(Artifact)
        .where(Artifact.id == artifact_id, Artifact.deleted_at.is_(None))
        .with_for_update()
    )
    artifact = result.scalar_one_or_none()
    if artifact is None:
        raise HTTPException(status_code=404, detail="Artifact not found")

    content = dict(artifact.content or {})
    generation = dict(content.get("generation") or {})
    variants = list(generation.get("variants") or [])

    idx = next((i for i, v in enumerate(variants) if v.get("id") == variant_id_str), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="Variant not found on this artifact")
    variant = dict(variants[idx])

    # ── 2. Enforce the 6-turn hard cap (undo turns are free) ──────────────────
    if not is_undo:
        current_turn_index = await enforce_turn_limit(db, artifact_id, variant_id)
    else:
        current_turn_index = await count_turns(db, artifact_id, variant_id)

    # ── 3. Structural-change pre-check (not for undo re-renders) ──────────────
    if not is_undo:
        classification = await classify_structural_change(user_message)
        if (
            classification.get("is_structural")
            and float(classification.get("confidence") or 0) >= STRUCTURAL_CONFIDENCE_THRESHOLD
        ):
            # Log the redirect so telemetry / audit has a record, but don't
            # consume a turn. We still assign a turn_index for ordering.
            redirect_turn = PosterChatTurn(
                id=uuid.uuid4(),
                artifact_id=artifact_id,
                variant_id=variant_id,
                turn_index=current_turn_index,
                user_message=user_message,
                ai_response="Structural change detected — redirecting.",
                action_type="REDIRECT",
                resulting_image_url=None,
                inpaint_mask_url=None,
                structural_change_detected=True,
            )
            db.add(redirect_turn)
            await db.flush()

            return RefineChatResponse(
                turn_id=redirect_turn.id,
                ai_response="That looks like a structural change. Jump back to the relevant step?",
                change_description="",
                new_image_url=None,
                action_type="REDIRECT",
                redirect_target=classification.get("target"),
                turn_index=current_turn_index,
            )

    # ── 4. Build the refine prompt + fetch the current variant bytes ──────────
    if not variant.get("image_url"):
        raise HTTPException(
            status_code=409,
            detail="Variant has no image yet — regenerate before refining.",
        )
    current_image_bytes = await _fetch_image_bytes(variant["image_url"])
    prompt = _build_refine_prompt(original_merged_prompt, change_history, user_message)

    # ── 5. Call Gemini image editing ──────────────────────────────────────────
    try:
        new_image_bytes = await generate_image_gemini(
            prompt=prompt,
            input_images=[current_image_bytes],
        )
    except GeminiImageError as exc:
        # Do NOT log a turn on upstream AI failure (doc 07 §Error Handling — turn
        # does not count). Surface as 502 so the client shows its retry UX.
        logger.warning("refine-chat Gemini failure: %s", exc)
        raise HTTPException(
            status_code=502,
            detail={
                "detail": "The image model failed. Try rephrasing or try again.",
                "error_code": exc.error_code,
            },
        ) from exc

    # ── 6. Summarise the edit (≤5 words) for the change-log pill ──────────────
    change_description = await _summarise_change(user_message)

    # ── 7. Upload result ──────────────────────────────────────────────────────
    new_url = await upload_image_bytes(
        data=new_image_bytes,
        subfolder=f"{VARIANT_IMAGE_SUBFOLDER}/{artifact_id}/refine",
        extension="png",
    )

    # ── 8. Persist: PosterChatTurn row + JSONB variant update ─────────────────
    turn_id = uuid.uuid4()
    chat_turn = PosterChatTurn(
        id=turn_id,
        artifact_id=artifact_id,
        variant_id=variant_id,
        turn_index=current_turn_index,
        user_message=user_message,
        ai_response=change_description,
        action_type="CHAT_REFINE",
        resulting_image_url=new_url,
        inpaint_mask_url=None,
        structural_change_detected=False,
    )
    db.add(chat_turn)

    now_iso = datetime.now(UTC).isoformat()
    variant["image_url"] = new_url
    variant["generated_at"] = now_iso
    variant["status"] = "READY"

    # Change-log mutations: undo removes the entry client-side and re-submits
    # without it, so the server just mirrors `change_history` as-is. A normal
    # refine appends the new pill.
    change_log = [entry.model_dump() for entry in change_history]
    if not is_undo:
        change_log.append(
            {"id": str(turn_id), "description": change_description, "accepted_at": now_iso}
        )
    variant["change_log"] = change_log

    variants[idx] = variant
    generation["variants"] = variants

    # Mirror the turn count onto JSONB for cheap frontend reads. Undo does not
    # advance the counter. The +1 accounts for the turn we just logged.
    if is_undo:
        generation["turn_count_on_selected"] = current_turn_index
    else:
        generation["turn_count_on_selected"] = current_turn_index + 1

    content["generation"] = generation
    artifact.content = content
    await db.flush()

    # ── 9. Decide response action_type ────────────────────────────────────────
    # The turn we just logged is at index `current_turn_index`. If that was the
    # 6th (index 5), surface the save-as-variant nudge on this response.
    is_last_allowed_turn = (current_turn_index + 1) >= TURN_LIMIT
    action_type = "TURN_LIMIT_NUDGE" if (is_last_allowed_turn and not is_undo) else "CHAT_REFINE"

    ai_response = (
        "You've made several refinements. Save this as a new variant to keep iterating?"
        if action_type == "TURN_LIMIT_NUDGE"
        else f"Done — {change_description.lower()}."
    )

    logger.info(
        "poster_refine_turn_succeeded",
        extra={
            "artifact_id": str(artifact_id),
            "variant_id": variant_id_str,
            "turn_index": current_turn_index,
            "action_type": action_type,
            "is_undo": is_undo,
        },
    )

    return RefineChatResponse(
        turn_id=turn_id,
        ai_response=ai_response,
        change_description=change_description,
        new_image_url=new_url,
        action_type=action_type,  # type: ignore[arg-type]
        redirect_target=None,
        turn_index=current_turn_index,
    )
