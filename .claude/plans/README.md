# CRAFT Implementation Plans

9 phases, ordered by dependency. Each file contains the full implementation plan for that phase.

## Phase order

| # | Plan file | Goal | User stories | Depends on |
|---|---|---|---|---|
| 0 | [phase-0-scaffolding.md](phase-0-scaffolding.md) | Monorepo + Docker + tooling | Infrastructure | — |
| 1 | [phase-1-schema-auth-rbac.md](phase-1-schema-auth-rbac.md) | DB schema + JWT auth + RBAC | US-001, 002, 005 | Phase 0 |
| 2 | [phase-2-home-screens-navigation.md](phase-2-home-screens-navigation.md) | Creator/Agent home + nav shells | US-003, 004 | Phase 1 |
| 3 | [phase-3-projects.md](phase-3-projects.md) | Project wizard + CRAFT suggestions + team invites | US-006, 006b, 007, 008, 025 | Phase 2 |
| 4 | [phase-4-brand-library.md](phase-4-brand-library.md) | Library browse, remix, publish | US-009, 010 | Phase 3 |
| 5 | [phase-5-artifacts-ai.md](phase-5-artifacts-ai.md) | Artifact creation + AI generation | US-011–015, 021, 024 | Phase 3 (4 recommended) |
| 6 | [phase-6-compliance-engine.md](phase-6-compliance-engine.md) | Compliance rules, RAG, scoring | US-016, 017, 018 | Phase 5 + 4 |
| 7 | [phase-7-brandkit-exports.md](phase-7-brandkit-exports.md) | Brand kit admin + export pipeline | US-019, 020 | Phase 5 + 6 |
| 8 | [phase-8-gamification-analytics.md](phase-8-gamification-analytics.md) | Gamification + analytics + comments | US-022, 023, 025 | Phase 5 + 6 + 4 |

## Dependency graph

```
Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4
                                    ↘      ↓
                                  Phase 5   ↓
                                    ↓  ↘   ↓
                                  Phase 6 ←─┘
                                    ↓
                              ┌─────┴─────┐
                           Phase 7    Phase 8
```

Phases 4 & 5 can partially overlap. Phases 7 & 8 can run in parallel.

## Specs

All wireframes and PRD are in `.claude/specs/`:
- `prd-craft.md` — full PRD with 25 user stories
- `craft_fsc_home_fixed.html` — Creator vs Agent home screen wireframe
- `craft_two_audiences.html` — platform architecture, content flow, key differences
- `craft_org_structure.html` — org model, roles, user journeys, home screen
