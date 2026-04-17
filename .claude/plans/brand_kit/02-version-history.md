# Phase 2 — Version History

**Goal:** Version list UI, restore flow, admin notifications on restore.

**Depends on:** Phase 1 (is_active column, changelog, activated_by, activated_at columns, snapshot pattern in service)
**Blocks:** Nothing

---

## 1. No Additional Migration

All required columns (`is_active`, `changelog`, `activated_by`, `activated_at`) were added in the Phase 1 migration. The snapshot versioning model (new row per save) is already implemented in Phase 1's service changes. Every previous save is already a row in the `brand_kit` table with `is_active = false`.

---

## 2. Backend Schema

**Modify:** `backend/app/schemas/brand_kit.py`

```python
class BrandKitVersionSummary(BaseModel):
    id: uuid.UUID
    version: int
    name: str
    changelog: str | None = None
    activated_by: ActivatedByInfo | None = None
    activated_at: datetime | None = None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}
```

Note: `activated_by` needs to be populated from a join — the raw column is a UUID FK. The endpoint handler or service must map this to `{id, name}`.

---

## 3. Backend Service

**Modify:** `backend/app/services/brand_kit_service.py`

### list_versions()

```python
async def list_versions(db: AsyncSession) -> list[dict]:
    """Return all brand kit versions, newest first, with activated_by user info."""
    result = await db.execute(
        select(BrandKit, User.name)
        .outerjoin(User, BrandKit.activated_by == User.id)
        .order_by(BrandKit.version.desc())
    )
    versions = []
    for kit, user_name in result.all():
        versions.append({
            "id": kit.id,
            "version": kit.version,
            "name": kit.name,
            "changelog": kit.changelog,
            "activated_by": {"id": str(kit.activated_by), "name": user_name} if kit.activated_by else None,
            "activated_at": kit.activated_at,
            "is_active": kit.is_active,
            "created_at": kit.created_at,
        })
    return versions
```

### restore_version()

```python
async def restore_version(
    db: AsyncSession, user: User, version_id: uuid.UUID
) -> BrandKit:
    """Restore a past brand kit version. Creates a new active row with the source's values."""
    _require_brand_admin(user)

    # 1. Load source version
    source = await db.get(BrandKit, version_id)
    if source is None:
        raise HTTPException(status_code=404, detail="Version not found")
    if source.is_active:
        raise HTTPException(status_code=409, detail="This version is already active")

    # 2. Deactivate current active kit
    active = await get_brand_kit(db)
    active.is_active = False

    # 3. Create new row with source values
    new_kit = BrandKit(
        name=source.name,
        logo_url=source.logo_url,
        secondary_logo_url=source.secondary_logo_url,
        primary_color=source.primary_color,
        secondary_color=source.secondary_color,
        accent_color=source.accent_color,
        fonts=dict(source.fonts) if source.fonts else None,
        color_names=dict(source.color_names) if source.color_names else None,
        version=active.version + 1,
        is_active=True,
        changelog=f"Restored from v{source.version}",
        activated_by=user.id,
        activated_at=func.now(),
        updated_by=user.id,
    )
    db.add(new_kit)
    await db.flush()

    # 4. Notify all brand admins
    await _notify_brand_admins_kit_restored(db, user, new_kit, source.version)

    return new_kit
```

### _notify_brand_admins_kit_restored()

```python
async def _notify_brand_admins_kit_restored(
    db: AsyncSession, restoring_user: User, new_kit: BrandKit, source_version: int
) -> None:
    """Send in-app notification to all brand admins when a kit version is restored."""
    result = await db.execute(
        select(User).where(User.role == UserRole.BRAND_ADMIN)
    )
    admins = result.scalars().all()

    for admin in admins:
        notification = Notification(
            user_id=admin.id,
            type="BRAND_KIT_RESTORED",
            title="Brand Kit restored",
            message=f"{restoring_user.name} restored Brand Kit to v{source_version} (now v{new_kit.version}).",
            data={"brand_kit_id": str(new_kit.id), "version": new_kit.version},
        )
        db.add(notification)

    await db.flush()
    logger.info(
        "Sent BRAND_KIT_RESTORED notification to %d admins for v%d",
        len(admins), new_kit.version,
    )
```

**Import needed:** `from app.models.notification import Notification`

---

## 4. Backend API

**Modify:** `backend/app/api/brand_kit.py`

### GET /versions

```python
@router.get("/versions")
async def list_brand_kit_versions(
    db: AsyncSession = Depends(get_db),
    _current_user: User = Depends(require_brand_admin),
) -> list[dict]:
    return await list_versions(db)
```

### POST /versions/{version_id}/restore

```python
@router.post("/versions/{version_id}/restore", response_model=BrandKitResponse)
async def restore_brand_kit_version(
    version_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_brand_admin),
) -> BrandKit:
    kit = await restore_version(db, current_user, version_id)
    await db.commit()
    return kit
```

---

## 5. Frontend API

**Modify:** `frontend/src/lib/api/brand-kit.ts`

Replace the stubs added in Phase 1 with working implementations:

```typescript
export async function fetchBrandKitVersions(): Promise<BrandKitVersionSummary[]> {
  return apiClient.get<BrandKitVersionSummary[]>("/api/brand-kit/versions");
}

export async function restoreBrandKitVersion(versionId: string): Promise<BrandKit> {
  return apiClient.post<BrandKit>(`/api/brand-kit/versions/${versionId}/restore`, {});
}
```

---

## 6. Frontend: Version History Tab

**Replace placeholder:** `frontend/src/components/brand-kit/tabs/version-history-tab.tsx`

### Layout

Two-column (Grid: 8 / 4):
- **Left:** vertical timeline of `<VersionCard>` components
- **Right:** static "How versioning works" explanatory card

### Data fetching

```typescript
const versionsQuery = useQuery({
  queryKey: queryKeys.brandKitVersions(),
  queryFn: fetchBrandKitVersions,
});
```

### Restore mutation

```typescript
const restoreMutation = useMutation({
  mutationFn: (versionId: string) => restoreBrandKitVersion(versionId),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.brandKit() });
    queryClient.invalidateQueries({ queryKey: queryKeys.brandKitVersions() });
    setRestoreDialogOpen(false);
  },
});
```

### Restore confirmation dialog

MUI Dialog:
- Title: "Restore to v{version}?"
- Body: "This will apply to all new content generation. Existing published artifacts won't change."
- Actions: Cancel (outlined) + Restore (contained, primary)
- Loading state on Restore button while mutation is pending

### "How versioning works" card

Static content (secondary background):
1. One kit active at a time across the entire organisation
2. Restoring a past version immediately applies it to all new projects and artifact generations
3. Existing published artifacts retain the kit version they were generated under
4. Brand Admins are notified when a kit version is activated or restored

---

## 7. Frontend: Version Card Component

**New file:** `frontend/src/components/brand-kit/version-card.tsx`

### Props

```typescript
interface VersionCardProps {
  version: BrandKitVersionSummary;
  onRestore: (id: string) => void;
  isRestoring: boolean;
}
```

### Layout

```
[ green/grey dot ] v{version} - {name}                     [ Active badge | Restore button ]
                   Activated by {name} . {date} . {changelog}
```

- **Active version:** green dot (#188038), "Active" chip (green bg)
- **Inactive versions:** grey dot (#9E9E9E), "Restore" outlined button
- Metadata line: muted text, formatted date (`toLocaleDateString`)
- Card: border `1px solid #E8EAED`, borderRadius 12px, padding 16px, marginBottom 12px

---

## 8. Verification Checklist

- [ ] `GET /api/brand-kit/versions` returns all versions ordered by version DESC
- [ ] Response includes `activated_by.name` (joined from users table)
- [ ] `POST /api/brand-kit/versions/{id}/restore` with inactive version ID:
  - [ ] Creates new row (version N+1) with source values
  - [ ] Old active row now has `is_active = false`
  - [ ] New row has `is_active = true`
  - [ ] Changelog says "Restored from v{N}"
- [ ] `POST /api/brand-kit/versions/{id}/restore` with active version ID returns 409
- [ ] `POST /api/brand-kit/versions/{id}/restore` with non-existent ID returns 404
- [ ] Non-BRAND_ADMIN user gets 403 on both endpoints
- [ ] After restore: all BRAND_ADMIN users have a `BRAND_KIT_RESTORED` notification
- [ ] Frontend: version history tab loads and shows timeline
- [ ] Frontend: active version shows green dot + Active badge
- [ ] Frontend: inactive versions show Restore button
- [ ] Frontend: clicking Restore opens confirmation dialog
- [ ] Frontend: confirming restore triggers mutation, page updates, dialog closes
- [ ] Frontend: version number in page header updates after restore
- [ ] `make test-backend` passes
- [ ] `make test-frontend` (typecheck) passes
