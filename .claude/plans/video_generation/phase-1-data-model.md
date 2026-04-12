# Phase 1: Data Model & Infrastructure

**Goal:** Add all enums, models, and the Alembic migration required by the video pipeline, plus the hook that creates a `VideoSession` when a VIDEO or REEL artifact is created.

**User stories:** US-001 (enums), US-002 (Presenter model), US-003 (pipeline models), US-004 (auto-create VideoSession)

**Dependencies:** None inside this pipeline. Assumes CRAFT main Phase 1 (schema + auth) and Phase 5 (artifacts) are already shipped.

---

## Backend files

| File | Purpose |
|---|---|
| `backend/app/models/enums.py` (extend) | Add `SpeakingStyle` (AUTHORITATIVE, CONVERSATIONAL, ENTHUSIASTIC, EMPATHETIC), `CameraFraming` (WIDE_SHOT, MEDIUM_SHOT, CLOSE_UP, OVER_THE_SHOULDER, TWO_SHOT, AERIAL, POV), `VideoStatus` (QUEUED, RENDERING, READY, FAILED), `ScriptAction` (DRAFT, WARM, PROFESSIONAL, SHORTER, STRONGER_CTA, MANUAL), `TargetDuration` (SECONDS_30, SECONDS_60, SECONDS_90, MINUTES_2, MINUTES_3, MINUTES_5), `VideoSessionStep` (PRESENTER, SCRIPT, STORYBOARD, GENERATION) |
| `backend/app/models/presenter.py` | `Presenter` model: id (UUID pk), name, age_range (str), appearance_keywords (str), full_appearance_description (Text), speaking_style (enum), is_library (bool, default True), created_by_id (FK → users.id), created_at, updated_at, deleted_at. Index on `created_by_id`. |
| `backend/app/models/video_session.py` | `VideoSession` model: id (UUID pk), artifact_id (UNIQUE FK → artifacts.id), presenter_id (FK → presenters.id, nullable), target_duration_seconds (int, default 60), current_step (enum VideoSessionStep, default PRESENTER), current_script_id (FK → video_scripts.id, nullable), scenes_script_version_id (FK → script_versions.id, nullable; used for staleness detection), created_at, updated_at. Indexes on `artifact_id`, `presenter_id`, `current_script_id`, `scenes_script_version_id`. |
| `backend/app/models/video_script.py` | `VideoScript` model: id (UUID pk), video_session_id (FK → video_sessions.id), content (Text), word_count (int, default 0), estimated_duration_seconds (int, default 0), updated_at. Index on `video_session_id`. |
| `backend/app/models/script_version.py` | `ScriptVersion` model: id (UUID pk), video_session_id (FK → video_sessions.id), content (Text), action (enum ScriptAction), created_at. Index on `video_session_id`. Ordered by `created_at DESC` on retrieval. |
| `backend/app/models/scene.py` | `Scene` model: id (UUID pk), video_session_id (FK → video_sessions.id), sequence (int), name (str), dialogue (Text), setting (str), camera_framing (enum CameraFraming), merged_prompt (Text), script_version_id (FK → script_versions.id, nullable), created_at, updated_at. Composite unique constraint on `(video_session_id, sequence)`. Index on `video_session_id`. |
| `backend/app/models/generated_video.py` | `GeneratedVideo` model: id (UUID pk), video_session_id (FK → video_sessions.id), version (int), status (enum VideoStatus, default QUEUED), progress_percent (int, default 0), current_scene (int, nullable), file_url (str, nullable), error_message (Text, nullable), created_at, completed_at (nullable). Composite unique constraint on `(video_session_id, version)`. Index on `video_session_id`, `status`. |
| `backend/app/models/__init__.py` (extend) | Export all new models |
| `backend/alembic/versions/<timestamp>_add_video_pipeline.py` | Single migration creating all 6 tables, all FKs with indexes, all enum types, both composite unique constraints |
| `backend/app/services/artifact_service.py` (extend) | In `create_artifact()`: after artifact is committed, if `type in (VIDEO, REEL)` call `video_session_service.create_for_artifact(artifact_id, target_duration_seconds)` inside the same transaction |
| `backend/app/services/video_session_service.py` | New: `create_for_artifact(artifact_id, target_duration_seconds)` — creates `VideoSession` row with `current_step = PRESENTER`. Other methods stubbed for later phases. |
| `backend/app/schemas/video_session.py` | Basic `VideoSessionResponse` DTO (id, artifact_id, current_step, target_duration_seconds, presenter_id, created_at) for the auto-create hook response |

## Frontend files

No frontend work in this phase — this is a pure backend/data phase.

## API endpoints

No new endpoints. The auto-create `VideoSession` happens inside the existing `POST /api/projects/{id}/artifacts` endpoint as a side effect. The response schema for that endpoint gains a `video_session_id` field for VIDEO/REEL artifacts.

## Key implementation details

- **Enum location:** Add all new enums to the existing `backend/app/models/enums.py` rather than scattering them per-model file. Matches existing convention.
- **UUID generation:** Server-side via `uuid.uuid4()` in model defaults — never database-side. Matches CRAFT's hard rule (see `CLAUDE.md`).
- **FK indexes are mandatory:** Every FK column gets an explicit `index=True` in the SQLAlchemy column definition. The migration must include them as named indexes (`idx_<table>_<column>`).
- **Soft deletes:** Only `Presenter` has a `deleted_at` column — the library is user-facing. `VideoSession`, `Scene`, `GeneratedVideo` are hard-deleted (they're tied 1:1 or N:1 to an Artifact; Artifact itself has soft delete).
- **Atomicity of auto-create hook:** `create_artifact()` and `create_for_artifact()` must run in the same `AsyncSession.begin()` block. If session creation fails, the artifact insert must roll back.
- **Circular FK caveat:** `video_sessions.current_script_id` → `video_scripts.id` and `video_scripts.video_session_id` → `video_sessions.id` form a cycle. Create both tables without the `current_script_id` FK constraint first, then add the FK as a separate `ALTER TABLE` inside the same migration (or mark it as `use_alter=True` in SQLAlchemy). Same pattern applies to `video_sessions.scenes_script_version_id` ↔ `script_versions`.
- **Scene sequence uniqueness under edits:** The composite unique constraint `(video_session_id, sequence)` will be temporarily violated during insert/delete renumbering. Mark the constraint as `DEFERRABLE INITIALLY DEFERRED` in PostgreSQL so multi-row updates inside a transaction don't fail mid-flight. Phase 4 depends on this.
- **Reuse existing patterns:** Every new model inherits from `backend/app/models/base.py` (the existing base with UUID pk, created_at, updated_at helpers). Don't reinvent.

## Verification

- Run `make migrate` — migration applies cleanly on an empty database
- Run `make migrate` a second time — no-op (`alembic current == head`)
- Run `alembic downgrade -1` — all 6 tables + enums drop cleanly; upgrade back to head succeeds
- Create a VIDEO artifact via `POST /api/projects/{id}/artifacts` — response includes `video_session_id`; query the DB and confirm exactly one row in `video_sessions` with `current_step = 'PRESENTER'`
- Create a POSTER artifact — no `video_sessions` row is created
- Force a failure inside `video_session_service.create_for_artifact` (e.g. monkeypatch to raise) — confirm the artifact is also not committed (rollback works)
- `cd backend && pytest tests/` — all existing tests still pass
- `cd backend && mypy app/` — no type errors
