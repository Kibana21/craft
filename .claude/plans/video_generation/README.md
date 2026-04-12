# Video Generation Implementation Plans

7 phases, ordered by dependency. Each file contains the full implementation plan for that phase. Implements the pipeline defined in `.claude/specs/prd-video-generation.md` (34 user stories, US-001 through US-034), which is itself derived from `.claude/specs/FUNCTIONAL_REQUIREMENTS_VIDEO_GENERATION.md`.

## Phase order

| # | Plan file | Goal | PRD stories | Depends on |
|---|---|---|---|---|
| 1 | [phase-1-data-model.md](phase-1-data-model.md) | New enums, pipeline models, migration, auto-create hook | US-001 … US-004 | — |
| 2 | [phase-2-presenter.md](phase-2-presenter.md) | Presenter library + AI appearance gen + presenter UI | US-005 … US-008 | Phase 1 |
| 3 | [phase-3-script.md](phase-3-script.md) | Script CRUD + AI draft + tone rewrite + version history | US-009 … US-013 | Phase 1 |
| 4 | [phase-4-storyboard.md](phase-4-storyboard.md) | Scene generation + merged prompt + scene card UI | US-014 … US-020 | Phase 2 + 3 |
| 5 | [phase-5-video-generation.md](phase-5-video-generation.md) | Veo 3.1 client + worker + chaining + polling | US-021 … US-025 | Phase 4 |
| 6 | [phase-6-playback-management.md](phase-6-playback-management.md) | Streaming + player + download + delete | US-026 … US-029 | Phase 5 |
| 7 | [phase-7-integration-polish.md](phase-7-integration-polish.md) | Replace reel creator + wizard shell + hooks | US-030 … US-034 | Phase 6 |

## Dependency graph

```
Phase 1 ─────────────┐
  │                  │
  ├─→ Phase 2 (Presenter) ─┐
  └─→ Phase 3 (Script)     │    ← Phase 2 & 3 run in parallel
                           ↓
                       Phase 4 (Storyboard)
                           ↓
                       Phase 5 (Veo generation)
                           ↓
                       Phase 6 (Playback)
                           ↓
                       Phase 7 (Integration + polish)
```

Phases 2 and 3 can be built in parallel once Phase 1 lands.

## Critical external blocker

**Phase 5 requires Google Veo 3.1 API access** (model: `veo-3.1-generate-001`). Before starting Phase 5, confirm with stakeholders:
- Google Cloud project has Veo API enabled
- API key + quota + billing confirmed
- Regional availability in Singapore is acceptable (or routing plan agreed)

Phases 1–4 can proceed without Veo provisioning. Do not start Phase 5 until this is unblocked.

## Specs

- `.claude/specs/prd-video-generation.md` — full PRD with 34 user stories, data model, functional requirements, non-goals, open questions
- `.claude/specs/FUNCTIONAL_REQUIREMENTS_VIDEO_GENERATION.md` — source functional spec (April 2026)

## Relationship to CRAFT-wide plans

These 7 phases are additive to the main CRAFT phase plans in `.claude/plans/phase-*.md`. They assume the main project's Phase 1 (schema + auth + RBAC) and Phase 5 (artifacts + AI) are already shipped. This pipeline replaces the static reel creator built in CRAFT Phase 5 (`frontend/src/components/artifacts/create/reel-creator.tsx`).
