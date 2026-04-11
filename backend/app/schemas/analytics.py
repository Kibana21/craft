from pydantic import BaseModel


class OverviewResponse(BaseModel):
    assets_created_week: int
    assets_created_month: int
    total_remixes: int
    compliance_rate: float
    active_fscs: int


class TopRemixedItem(BaseModel):
    item_id: str
    artifact_name: str
    artifact_type: str
    product: str | None
    remix_count: int


class TopRemixedResponse(BaseModel):
    items: list[TopRemixedItem]


class ContentGap(BaseModel):
    product: str | None
    artifact_type: str
    fsc_count: int


class ContentGapResponse(BaseModel):
    gaps: list[ContentGap]


class ActivityDataPoint(BaseModel):
    date: str
    created: int
    exported: int


class ActivityResponse(BaseModel):
    data: list[ActivityDataPoint]
    granularity: str
