# Brand Kit Redesign — Implementation Plans

**PRD:** `.claude/specs/BRAND_KIT_REDESIGN_PRD.md`
**Wireframe:** `.claude/specs/craft_brand_kit_page.html`

## Overview

Transform the Brand Kit page from a flat settings screen into a 6-tab brand governance hub: Colours, Typography, Logo Vault, Poster Templates, Live Preview, Version History.

## Phase dependency graph

```
Phase 1 (scaffold + tabs) ──> Phase 2 (versioning)
                           ──> Phase 3 (templates) ──> Phase 4 (preview)
```

Phase 1 must ship first. Phases 2 and 3 can run in parallel after that. Phase 4 benefits from Phase 3 but can ship a basic version after Phase 1 alone.

## Plan documents

| File | Phase | Scope |
|---|---|---|
| [01-tab-scaffold.md](01-tab-scaffold.md) | Phase 1 | Tab scaffold + Colours + Typography + Logo Vault |
| [02-version-history.md](02-version-history.md) | Phase 2 | Version History tab + restore flow + notifications |
| [03-poster-templates.md](03-poster-templates.md) | Phase 3 | Poster Templates tab + wizard integration |
| [04-live-preview.md](04-live-preview.md) | Phase 4 | Live Preview + Validation checklist |

## File inventory (all phases)

### New files (20)

```
backend/
  alembic/versions/<hash>_brand_kit_redesign_phase1.py       # Phase 1
  alembic/versions/<hash>_brand_kit_templates.py              # Phase 3
  app/models/brand_kit_template.py                            # Phase 3
  app/services/brand_kit_template_service.py                  # Phase 3

frontend/src/components/brand-kit/
  tabs/colours-tab.tsx                                        # Phase 1
  tabs/typography-tab.tsx                                     # Phase 1
  tabs/logo-vault-tab.tsx                                     # Phase 1
  tabs/templates-tab.tsx                                      # Phase 1 placeholder -> Phase 3
  tabs/live-preview-tab.tsx                                   # Phase 1 placeholder -> Phase 4
  tabs/version-history-tab.tsx                                # Phase 1 placeholder -> Phase 2
  colour-card.tsx                                             # Phase 1
  tint-row.tsx                                                # Phase 1
  contrast-pairing.tsx                                        # Phase 1
  font-slot-card.tsx                                          # Phase 1
  logo-card.tsx                                               # Phase 1
  template-card.tsx                                           # Phase 3
  zone-table.tsx                                              # Phase 3
  preview-canvas.tsx                                          # Phase 4
  validation-checklist.tsx                                    # Phase 4
  version-card.tsx                                            # Phase 2
```

### Modified files (14)

```
backend/
  app/models/brand_kit.py                     # Phase 1: add columns
  app/schemas/brand_kit.py                    # Phase 1-3: new types, renames
  app/services/brand_kit_service.py           # Phase 1-2: snapshot pattern, versions, restore
  app/api/brand_kit.py                        # Phase 1-3: new endpoints
  app/services/project_service.py             # Phase 1: active kit query
  app/services/render_service.py              # Phase 1: disclaimer fallback
  app/services/prompt_builder.py              # Phase 1: disclaimer fallback
  app/services/poster_ai_service.py           # Phase 3: template zones
  scripts/seed.py                             # Phase 1: updated fonts + color_names

frontend/src/
  app/(authenticated)/brand-kit/page.tsx      # Phase 1: full rewrite
  types/brand-kit.ts                          # Phase 1-3: new types
  lib/api/brand-kit.ts                        # Phase 1-3: new API functions
  lib/query-keys.ts                           # Phase 1: add brandKit keys
  app/.../new-poster/compose/page.tsx         # Phase 3: template selector
```
