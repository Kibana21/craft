# Phase 1 — Tab Scaffold + Colours + Typography + Logo Vault

**Goal:** Restructure the Brand Kit page into a 6-tab layout (3 populated, 3 placeholder), migrate to TanStack Query, enhance colour/font/logo UX, rename accent->disclaimer font slot.

**Depends on:** Nothing (foundation phase)
**Blocked by this:** Phases 2, 3, 4

---

## 1. Database Migration

**New file:** `backend/alembic/versions/<hash>_brand_kit_redesign_phase1.py`
**down_revision:** `f2c3d4e5f6a7` (current HEAD — add_my_studio_tables)

### upgrade()

```sql
-- 1. Add columns
ALTER TABLE brand_kit ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE brand_kit ADD COLUMN changelog TEXT;
ALTER TABLE brand_kit ADD COLUMN activated_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE brand_kit ADD COLUMN activated_at TIMESTAMPTZ;
ALTER TABLE brand_kit ADD COLUMN color_names JSONB;

-- 2. Index
CREATE INDEX idx_brand_kit_activated_by ON brand_kit (activated_by);

-- 3. Partial unique index: at most one active kit
CREATE UNIQUE INDEX idx_brand_kit_active ON brand_kit (is_active) WHERE is_active = true;

-- 4. Set existing rows active
UPDATE brand_kit SET is_active = true, activated_at = now();

-- 5. Rename fonts JSONB keys: accent -> disclaimer
UPDATE brand_kit
SET fonts = (fonts - 'accent' - 'accent_url')
            || jsonb_build_object(
                 'disclaimer', fonts->>'accent',
                 'disclaimer_url', fonts->>'accent_url',
                 'disclaimer_inherited', 'true'
               )
WHERE fonts ? 'accent';
```

### downgrade()

Reverse: drop index, drop columns, rename JSONB keys back.

---

## 2. Backend Model

**Modify:** `backend/app/models/brand_kit.py`

Add columns to `BrandKit` class:

```python
is_active: Mapped[bool] = mapped_column(
    Boolean, nullable=False, server_default="true"
)
changelog: Mapped[str | None] = mapped_column(Text, nullable=True)
activated_by: Mapped[uuid.UUID | None] = mapped_column(
    UUID(as_uuid=True),
    ForeignKey("users.id", ondelete="SET NULL"),
    nullable=True,
    index=True,
)
activated_at: Mapped[datetime | None] = mapped_column(
    DateTime(timezone=True), nullable=True
)
color_names: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
```

Add to `__table_args__`:
```python
Index("idx_brand_kit_active", "is_active", unique=True, postgresql_where=text("is_active = true")),
```

---

## 3. Backend Schemas

**Modify:** `backend/app/schemas/brand_kit.py`

### Rename font keys

```python
class FontsConfig(BaseModel):
    heading: str | None = None
    body: str | None = None
    disclaimer: str | None = None           # was: accent
    heading_url: str | None = None
    body_url: str | None = None
    disclaimer_url: str | None = None       # was: accent_url
    disclaimer_inherited: bool | None = None # new
    size_scale: dict | None = None          # new
```

### New models

```python
class ColorNames(BaseModel):
    primary_name: str | None = None
    secondary_name: str | None = None
    accent_name: str | None = None
    primary_usage: str | None = None
    secondary_usage: str | None = None
    accent_usage: str | None = None

class ActivatedByInfo(BaseModel):
    id: uuid.UUID
    name: str
```

### Extend BrandKitResponse

Add fields: `is_active: bool`, `changelog: str | None`, `activated_by: ActivatedByInfo | None`, `activated_at: datetime | None`, `color_names: ColorNames | None`

### Extend UpdateBrandKitRequest

Add fields: `color_names: dict | None = None`, `changelog: str | None = None`

---

## 4. Backend Service

**Modify:** `backend/app/services/brand_kit_service.py`

### get_brand_kit() — change query

```python
# Before:
result = await db.execute(select(BrandKit).order_by(BrandKit.created_at).limit(1))

# After:
result = await db.execute(select(BrandKit).where(BrandKit.is_active == true()))
kit = result.scalar_one_or_none()
if kit is None:
    # Defensive fallback
    result = await db.execute(select(BrandKit).order_by(BrandKit.created_at.desc()).limit(1))
    kit = result.scalar_one_or_none()
```

### update_brand_kit() — snapshot pattern

Instead of mutating the existing row:
1. Load active kit
2. Set `active_kit.is_active = False`
3. Create new `BrandKit` row with all values from active kit, plus the updates from `data`
4. Set new row: `is_active=True`, `version=active_kit.version + 1`, `activated_by=user.id`, `activated_at=func.now()`, `updated_by=user.id`
5. `db.add(new_kit)`
6. `await db.flush()`
7. Return new_kit

### upload_font() — accept disclaimer slot

```python
VALID_FONT_SLOTS = {"heading", "body", "disclaimer"}
SLOT_ALIASES = {"accent": "disclaimer"}  # backward compat

def _normalize_slot(slot: str) -> str:
    return SLOT_ALIASES.get(slot, slot)
```

### upload_logo() — same snapshot pattern

Apply the same snapshot approach (new row, deactivate old) so logo changes create version history entries too.

---

## 5. Backend API

**Modify:** `backend/app/api/brand_kit.py`

- Font slot query param validation: `^(heading|body|disclaimer|accent)$`
- GET endpoint: join `users` table on `activated_by` to return `{id, name}` instead of bare UUID
- Response model stays `BrandKitResponse` (now has extra fields)

---

## 6. Other Backend Files

### `backend/app/services/project_service.py`

Change auto-select query (around line ~122):
```python
# Before:
select(BrandKit).order_by(BrandKit.created_at.desc()).limit(1)
# After:
select(BrandKit).where(BrandKit.is_active == true()).limit(1)
```

### `backend/app/services/render_service.py`

Add disclaimer font fallback wherever fonts are read:
```python
fonts = brand_kit.fonts or {}
disclaimer_url = fonts.get("disclaimer_url") or fonts.get("accent_url")
```

### `backend/app/services/prompt_builder.py`

Same pattern — check `disclaimer` first, fallback to `accent`:
```python
fonts = (bk.fonts or {})
tone = fonts.get("tone", "professional")
```

### `backend/scripts/seed.py`

Update brand kit seed block:
```python
BrandKit(
    name="AIA Singapore - Brand Kit v1",
    primary_color="#D0103A",
    secondary_color="#1A1A18",
    accent_color="#1B9D74",
    fonts={
        "heading": "Inter",
        "body": "Inter",
        "disclaimer": "Inter",
        "disclaimer_inherited": True,
    },
    color_names={
        "primary_name": "Brand Red",
        "secondary_name": "Deep Charcoal",
        "accent_name": "Teal Green",
        "primary_usage": "Poster backgrounds, CTA buttons, title cards",
        "secondary_usage": "Body copy, overlay backgrounds, dark sections",
        "accent_usage": "Callout badges, icon highlights, video end-cards",
    },
    is_active=True,
    version=1,
)
```

---

## 7. Frontend Types

**Modify:** `frontend/src/types/brand-kit.ts`

```typescript
// Renamed
export interface FontsConfig {
  heading?: string;
  body?: string;
  disclaimer?: string;            // was: accent
  heading_url?: string;
  body_url?: string;
  disclaimer_url?: string;        // was: accent_url
  disclaimer_inherited?: boolean;
  size_scale?: Record<string, Record<string, number>>;
}

// New
export interface ColorNames {
  primary_name?: string;
  secondary_name?: string;
  accent_name?: string;
  primary_usage?: string;
  secondary_usage?: string;
  accent_usage?: string;
}

// Extended
export interface BrandKit {
  // ... existing fields ...
  is_active: boolean;
  changelog: string | null;
  activated_by: { id: string; name: string } | null;
  activated_at: string | null;
  color_names: ColorNames | null;
}

// Stubs for later phases
export interface BrandKitVersionSummary {
  id: string;
  version: number;
  changelog: string | null;
  activated_by: { id: string; name: string } | null;
  activated_at: string | null;
  is_active: boolean;
  created_at: string;
}

export interface TemplateZone {
  name: string;
  x: number; y: number; width: number; height: number;
}

export interface BrandKitTemplate {
  id: string;
  name: string;
  layout_key: string;
  zones: TemplateZone[];
  is_default: boolean;
}
```

---

## 8. Frontend API Module

**Modify:** `frontend/src/lib/api/brand-kit.ts`

- `uploadFont`: slot type `"heading" | "body" | "disclaimer"`
- Add stubs:

```typescript
export async function fetchBrandKitVersions(): Promise<BrandKitVersionSummary[]> {
  return apiClient.get("/api/brand-kit/versions");
}
export async function restoreBrandKitVersion(versionId: string): Promise<BrandKit> {
  return apiClient.post(`/api/brand-kit/versions/${versionId}/restore`, {});
}
export async function fetchTemplates(): Promise<BrandKitTemplate[]> {
  return apiClient.get("/api/brand-kit/templates");
}
```

---

## 9. Frontend Query Keys

**Modify:** `frontend/src/lib/query-keys.ts`

```typescript
brandKit: () => ["brand-kit"] as const,
brandKitVersions: () => ["brand-kit", "versions"] as const,
brandKitTemplates: () => ["brand-kit", "templates"] as const,
```

---

## 10. Frontend Page Rewrite

**Modify:** `frontend/src/app/(authenticated)/brand-kit/page.tsx` — complete rewrite

### Structure

```
BrandKitPage
  |-- Header (title, Active badge, subtitle, Edit/Save buttons)
  |-- MUI Tabs (6 tabs, URL param driven)
  |-- Tab panels:
      |-- ColoursTab
      |-- TypographyTab
      |-- LogoVaultTab
      |-- TemplatesTab (placeholder)
      |-- LivePreviewTab (placeholder)
      |-- VersionHistoryTab (placeholder)
```

### State management

- `useQuery(queryKeys.brandKit(), fetchBrandKit)` — server state
- `useState<boolean>(false)` — `isEditMode`
- `useState<Partial<BrandKit>>({})`  — `draftChanges` (spread from kit on entering edit mode)
- `useMutation(updateBrandKit)` — save; on success invalidate `queryKeys.brandKit()`
- Tab state via `useSearchParams().get("tab") || "colours"` + `router.push(?tab=key, { scroll: false })`
- `beforeunload` listener when `isEditMode && Object.keys(draftChanges).length > 0`

### Tab pattern (reuse from `creator-home.tsx`)

```typescript
const TABS = [
  { key: "colours", label: "Colours" },
  { key: "typography", label: "Typography" },
  { key: "logo-vault", label: "Logos" },
  { key: "templates", label: "Templates" },
  { key: "live-preview", label: "Live Preview" },
  { key: "version-history", label: "Version History" },
];
```

### Admin gating

```typescript
const { user } = useAuth();
const isAdmin = user?.role === "brand_admin";
// Hide Edit/Save buttons, upload zones, editable fields for non-admins
```

---

## 11. New Components

### `tabs/colours-tab.tsx`

Two-column layout (Grid: 8 / 4):
- **Left:** 3 `<ColourCard>` components stacked
- **Right:** "How these colours are applied" card (4 static bullets) + "Text on brand colours" card (3 `<ContrastPairing>` rows)
- Props: `kit`, `draft`, `isEditMode`, `onDraftChange`

### `tabs/typography-tab.tsx`

- 3 `<FontSlotCard>` in a row (Grid: 4 / 4 / 4)
- Below: size-scale reference table (MUI Table, read-only)
- Disclaimer card shows MAS info box (always visible, secondary bg)

### `tabs/logo-vault-tab.tsx`

- 3 cards in a row (Grid: 4 / 4 / 4): Primary `<LogoCard>`, Secondary `<LogoCard>`, Compositing rules (static card, secondary bg, 5 bullet rules)

### `tabs/templates-tab.tsx` (placeholder)

- Centered card: template icon + "Poster layout templates coming soon" + description

### `tabs/live-preview-tab.tsx` (placeholder)

- Renders existing `<BrandPreview>` component centred with note "Enhanced preview coming in a future update"

### `tabs/version-history-tab.tsx` (placeholder)

- Shows current version number + last updated info + "Full version history coming soon"

### `colour-card.tsx`

- Large swatch (80px square)
- Name field (TextField, editable in edit mode, read-only otherwise)
- Hex field (reuses existing `ColorPicker` hex input logic)
- Usage line (TextField, editable)
- For primary colour only: `<TintRow>` below

### `tint-row.tsx`

- Input: hex string
- Renders 5 boxes with opacity stops: 10%, 25%, 50%, 75%, 100%
- Label: "Derived tints for compositing"
- Pure CSS: `backgroundColor: hex` + `opacity: 0.1|0.25|0.5|0.75|1.0`

### `contrast-pairing.tsx`

- Input: bgColor, textColor, label
- Renders a small preview box (80x28) with text on background
- Label beside it explaining usage

### `font-slot-card.tsx`

- Preview text rendered in uploaded font (CSS fontFamily from kit.fonts[slot])
- Tag row: font name pill, size pill, upload status pill
- Upload zone (active in edit mode): wraps existing `FontUpload` internally
- Disclaimer variant: MAS info box, "Inherited from Body" note, fixed-size badge

### `logo-card.tsx`

- Image preview with light/dark bg toggle (toggle button top-right)
- Specs row: "Min width 120px . Clear space 16px . Format: SVG"
- Upload zone (active in edit mode): wraps existing `LogoUpload` internally

---

## 12. Verification Checklist

- [ ] `make migrate` — migration applies, no errors
- [ ] `make seed` — seed script works with new fonts keys + color_names
- [ ] `GET /api/brand-kit` — returns enriched response (is_active, color_names, etc.)
- [ ] `PATCH /api/brand-kit` — creates new row, old row has `is_active=false` (verify in DB)
- [ ] `POST /api/brand-kit/font?slot=disclaimer` — works
- [ ] `POST /api/brand-kit/font?slot=accent` — still works (backward compat alias)
- [ ] Frontend: page loads, 6 tabs visible
- [ ] Frontend: `?tab=colours` deep-link works
- [ ] Frontend: edit mode toggle shows/hides edit controls
- [ ] Frontend: colour cards show tints, compliance guidance
- [ ] Frontend: typography tab shows 3 font slots with disclaimer MAS note
- [ ] Frontend: logo vault shows light/dark toggle, compositing rules
- [ ] Frontend: non-admin user sees read-only (no Edit button)
- [ ] Frontend: `beforeunload` fires with unsaved changes
- [ ] `make test-backend` — smoke tests pass
- [ ] `make test-frontend` — typecheck passes
- [ ] Video generation still works (backward compat on font keys)
- [ ] Export rendering still works (disclaimer_url fallback to accent_url)
