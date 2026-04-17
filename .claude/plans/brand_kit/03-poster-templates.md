# Phase 3 — Poster Templates

**Goal:** New template table, 4 default templates with zone coordinates, template grid UI, wire into poster wizard compose step.

**Depends on:** Phase 1 (active kit concept, TanStack Query, tab scaffold)
**Blocks:** Phase 4 (live preview uses template zones for layout)

---

## 1. Database Migration

**New file:** `backend/alembic/versions/<hash>_brand_kit_templates.py`
**down_revision:** Phase 1 migration hash

### upgrade()

```python
op.create_table(
    "brand_kit_templates",
    sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
    sa.Column("brand_kit_id", postgresql.UUID(as_uuid=True),
              sa.ForeignKey("brand_kit.id", ondelete="CASCADE"), nullable=False),
    sa.Column("name", sa.String(255), nullable=False),
    sa.Column("layout_key", sa.String(100), unique=True, nullable=False),
    sa.Column("zones", postgresql.JSONB, nullable=False),
    sa.Column("is_default", sa.Boolean, server_default="false", nullable=False),
    sa.Column("created_by", postgresql.UUID(as_uuid=True),
              sa.ForeignKey("users.id", ondelete="SET NULL"), nullable=True),
    sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
)
op.create_index("idx_bkt_brand_kit_id", "brand_kit_templates", ["brand_kit_id"])
op.create_index("idx_bkt_created_by", "brand_kit_templates", ["created_by"])
```

### Seed 4 default templates

```python
# Get active brand kit ID
conn = op.get_bind()
result = conn.execute(sa.text("SELECT id FROM brand_kit WHERE is_active = true LIMIT 1"))
row = result.fetchone()
if row:
    bk_id = row[0]
    templates = [
        {
            "id": str(uuid.uuid4()),
            "brand_kit_id": str(bk_id),
            "name": "Hero - Subject left",
            "layout_key": "hero_subject_left",
            "zones": json.dumps([
                {"name": "creative", "x": 0, "y": 0, "width": 594, "height": 1080},
                {"name": "logo", "x": 650, "y": 54, "width": 380, "height": 120},
                {"name": "headline", "x": 620, "y": 240, "width": 420, "height": 320},
                {"name": "disclaimer", "x": 0, "y": 1006, "width": 1080, "height": 74},
            ]),
            "is_default": True,
        },
        {
            "id": str(uuid.uuid4()),
            "brand_kit_id": str(bk_id),
            "name": "Full bleed top",
            "layout_key": "full_bleed_top",
            "zones": json.dumps([
                {"name": "creative", "x": 0, "y": 0, "width": 1080, "height": 594},
                {"name": "logo", "x": 40, "y": 640, "width": 200, "height": 80},
                {"name": "headline", "x": 40, "y": 740, "width": 1000, "height": 160},
                {"name": "body", "x": 40, "y": 900, "width": 800, "height": 80},
                {"name": "disclaimer", "x": 0, "y": 1006, "width": 1080, "height": 74},
            ]),
            "is_default": True,
        },
        {
            "id": str(uuid.uuid4()),
            "brand_kit_id": str(bk_id),
            "name": "Hero - Subject right",
            "layout_key": "hero_subject_right",
            "zones": json.dumps([
                {"name": "creative", "x": 648, "y": 0, "width": 432, "height": 1080},
                {"name": "logo", "x": 40, "y": 54, "width": 200, "height": 80},
                {"name": "headline", "x": 40, "y": 240, "width": 560, "height": 320},
                {"name": "body", "x": 40, "y": 580, "width": 560, "height": 160},
                {"name": "disclaimer", "x": 0, "y": 1006, "width": 1080, "height": 74},
            ]),
            "is_default": True,
        },
        {
            "id": str(uuid.uuid4()),
            "brand_kit_id": str(bk_id),
            "name": "Editorial top title",
            "layout_key": "editorial_top_title",
            "zones": json.dumps([
                {"name": "headline", "x": 40, "y": 40, "width": 1000, "height": 200},
                {"name": "creative", "x": 0, "y": 260, "width": 1080, "height": 540},
                {"name": "body", "x": 40, "y": 820, "width": 760, "height": 120},
                {"name": "logo", "x": 840, "y": 840, "width": 200, "height": 80},
                {"name": "disclaimer", "x": 0, "y": 1006, "width": 1080, "height": 74},
            ]),
            "is_default": True,
        },
    ]
    for t in templates:
        conn.execute(sa.text(
            "INSERT INTO brand_kit_templates (id, brand_kit_id, name, layout_key, zones, is_default) "
            "VALUES (:id, :brand_kit_id, :name, :layout_key, :zones::jsonb, :is_default)"
        ), t)
```

### downgrade()

```python
op.drop_index("idx_bkt_created_by")
op.drop_index("idx_bkt_brand_kit_id")
op.drop_table("brand_kit_templates")
```

---

## 2. Backend Model

**New file:** `backend/app/models/brand_kit_template.py`

```python
import uuid
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.models.base import BaseModel


class BrandKitTemplate(BaseModel):
    __tablename__ = "brand_kit_templates"

    brand_kit_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("brand_kit.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    layout_key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    zones: Mapped[dict] = mapped_column(JSONB, nullable=False)
    is_default: Mapped[bool] = mapped_column(Boolean, server_default="false", nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    __table_args__ = (
        Index("idx_bkt_brand_kit_id", "brand_kit_id"),
        Index("idx_bkt_created_by", "created_by"),
    )
```

---

## 3. Backend Schemas

**Modify:** `backend/app/schemas/brand_kit.py`

```python
class TemplateZone(BaseModel):
    name: str = Field(pattern=r"^(creative|logo|headline|body|disclaimer)$")
    x: int = Field(ge=0)
    y: int = Field(ge=0)
    width: int = Field(gt=0)
    height: int = Field(gt=0)

class BrandKitTemplateResponse(BaseModel):
    id: uuid.UUID
    name: str
    layout_key: str
    zones: list[TemplateZone]
    is_default: bool
    model_config = {"from_attributes": True}

class CreateTemplateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    layout_key: str = Field(min_length=1, max_length=100, pattern=r"^[a-z0-9_]+$")
    zones: list[TemplateZone] = Field(min_length=1)

class UpdateTemplateRequest(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    zones: list[TemplateZone] | None = None
```

---

## 4. Backend Service

**New file:** `backend/app/services/brand_kit_template_service.py`

```python
async def list_templates(db: AsyncSession) -> list[BrandKitTemplate]:
    """Return all templates for the active brand kit."""
    active_kit = await get_brand_kit(db)
    result = await db.execute(
        select(BrandKitTemplate)
        .where(BrandKitTemplate.brand_kit_id == active_kit.id)
        .order_by(BrandKitTemplate.is_default.desc(), BrandKitTemplate.name)
    )
    return list(result.scalars().all())


async def create_template(
    db: AsyncSession, user: User, data: CreateTemplateRequest
) -> BrandKitTemplate:
    _require_brand_admin(user)
    active_kit = await get_brand_kit(db)
    template = BrandKitTemplate(
        brand_kit_id=active_kit.id,
        name=data.name,
        layout_key=data.layout_key,
        zones=[z.model_dump() for z in data.zones],
        is_default=False,
        created_by=user.id,
    )
    db.add(template)
    await db.flush()
    return template


async def update_template(
    db: AsyncSession, user: User, template_id: uuid.UUID, data: UpdateTemplateRequest
) -> BrandKitTemplate:
    _require_brand_admin(user)
    template = await db.get(BrandKitTemplate, template_id)
    if template is None:
        raise HTTPException(404, "Template not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        if field == "zones":
            value = [z.model_dump() if hasattr(z, "model_dump") else z for z in value]
        setattr(template, field, value)
    await db.flush()
    return template


async def delete_template(
    db: AsyncSession, user: User, template_id: uuid.UUID
) -> None:
    _require_brand_admin(user)
    template = await db.get(BrandKitTemplate, template_id)
    if template is None:
        raise HTTPException(404, "Template not found")
    if template.is_default:
        raise HTTPException(403, "Cannot delete a default template")
    await db.delete(template)
    await db.flush()
```

---

## 5. Backend API

**Modify:** `backend/app/api/brand_kit.py`

Add 4 endpoints:

```python
@router.get("/templates", response_model=list[BrandKitTemplateResponse])
async def list_templates_endpoint(
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(get_current_user),
):
    return await list_templates(db)

@router.post("/templates", response_model=BrandKitTemplateResponse, status_code=201)
async def create_template_endpoint(
    data: CreateTemplateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_brand_admin),
):
    template = await create_template(db, current_user, data)
    await db.commit()
    return template

@router.patch("/templates/{template_id}", response_model=BrandKitTemplateResponse)
async def update_template_endpoint(
    template_id: uuid.UUID,
    data: UpdateTemplateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_brand_admin),
):
    template = await update_template(db, current_user, template_id, data)
    await db.commit()
    return template

@router.delete("/templates/{template_id}", status_code=204)
async def delete_template_endpoint(
    template_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_brand_admin),
):
    await delete_template(db, current_user, template_id)
    await db.commit()
```

---

## 6. Poster Wizard Integration

**Modify:** `backend/app/services/poster_ai_service.py`

In `build_composition_prompt()`, add optional `template_zones: list[dict] | None = None` parameter. When provided, append:

```
LAYOUT TEMPLATE:
The AI-generated scene must fill the "creative" zone only.
Do NOT place any text, logos, or UI elements — those are composited separately by the system.
Zone coordinates (on 1080x1080 canvas):
- creative: ({x},{y}) to ({x+w},{y+h})
- logo: ({x},{y}) to ({x+w},{y+h})
- headline: ({x},{y}) to ({x+w},{y+h})
- disclaimer: ({x},{y}) to ({x+w},{y+h})
```

**Modify:** `frontend/src/app/(authenticated)/projects/[id]/artifacts/new-poster/compose/page.tsx`

- Add `useQuery(queryKeys.brandKitTemplates(), fetchTemplates)` to fetch templates
- Render a template selector strip (horizontal scroll of template cards, similar to format selector)
- Selected template stored in `composition.template_layout_key`
- Pass `template_zones` to `generateCompositionPrompt()` API call

---

## 7. Frontend Types & API

Types already stubbed in Phase 1 (`TemplateZone`, `BrandKitTemplate`). Replace stubs with full interfaces.

**Modify:** `frontend/src/lib/api/brand-kit.ts`

```typescript
export async function fetchTemplates(): Promise<BrandKitTemplate[]> {
  return apiClient.get<BrandKitTemplate[]>("/api/brand-kit/templates");
}
export async function createTemplate(data: { name: string; layout_key: string; zones: TemplateZone[] }): Promise<BrandKitTemplate> {
  return apiClient.post<BrandKitTemplate>("/api/brand-kit/templates", data);
}
export async function updateTemplate(id: string, data: { name?: string; zones?: TemplateZone[] }): Promise<BrandKitTemplate> {
  return apiClient.patch<BrandKitTemplate>(`/api/brand-kit/templates/${id}`, data);
}
export async function deleteTemplate(id: string): Promise<void> {
  return apiClient.delete(`/api/brand-kit/templates/${id}`);
}
```

---

## 8. Frontend: Templates Tab

**Replace placeholder:** `frontend/src/components/brand-kit/tabs/templates-tab.tsx`

### Layout

- Header row: "Poster layout templates" + "+ New template" button (edit mode only)
- Template grid: 5 cards (4 default + 1 placeholder)
- Selected template state: `useState<string | null>(null)`
- Below grid: `<ZoneTable>` for the selected template (contextual)

### Data

```typescript
const templatesQuery = useQuery({
  queryKey: queryKeys.brandKitTemplates(),
  queryFn: fetchTemplates,
});
```

### "+ New template" button

In v1, clicking opens a prompt dialog or copies a template-design prompt to clipboard. Future: visual zone editor.

---

## 9. Frontend: Template Card

**New file:** `frontend/src/components/brand-kit/template-card.tsx`

### Props

```typescript
interface TemplateCardProps {
  template: BrandKitTemplate;
  isSelected: boolean;
  onClick: () => void;
}
```

### Canvas diagram

Renders a thumbnail (220px wide, aspect ratio 1:1) with coloured rectangles proportionally scaled from the 1080x1080 base canvas:

| Zone | Colour | Label |
|---|---|---|
| creative | `#4A90D9` (blue) | SCENE |
| logo | `#D0103A` (red) | LOGO |
| headline | `#188038` (green) | HEAD |
| body | `#F5A623` (amber) | BODY |
| disclaimer | `#9E9E9E` (grey) | DISC |

Each rectangle: `position: absolute`, `left/top/width/height` as percentages of 1080. Label centred inside, white text, 9px.

### Zone pills row

Below the canvas: small pills for each zone present (e.g. "scene", "logo", "head").

### Selection state

Selected: `border: 2px solid #D0103A`. Unselected: `border: 1px solid #E8EAED`.

---

## 10. Frontend: Zone Table

**New file:** `frontend/src/components/brand-kit/zone-table.tsx`

### Props

```typescript
interface ZoneTableProps {
  zones: TemplateZone[];
}
```

### Render

MUI Table with columns: Zone, x, y, width, height. One row per zone. Read-only. Caption: "Coordinates assume a 1080 x 1080 base canvas."

---

## 11. Verification Checklist

- [ ] Migration creates `brand_kit_templates` table with 4 seeded rows
- [ ] `GET /api/brand-kit/templates` returns 4 templates with zone data
- [ ] `POST /api/brand-kit/templates` creates a custom template (layout_key unique enforced)
- [ ] `PATCH /api/brand-kit/templates/{id}` updates zones/name
- [ ] `DELETE /api/brand-kit/templates/{id}` on default template returns 403
- [ ] `DELETE /api/brand-kit/templates/{id}` on custom template succeeds (204)
- [ ] Non-BRAND_ADMIN gets 403 on create/update/delete
- [ ] Frontend: template grid renders 4 cards with zone diagrams
- [ ] Frontend: clicking a card selects it, shows zone table below
- [ ] Frontend: "+ New template" button appears in edit mode
- [ ] Poster wizard compose step: template selector strip appears
- [ ] Selecting a template passes zones to `generateCompositionPrompt()` call
- [ ] `make test-backend` passes
- [ ] `make test-frontend` (typecheck) passes
