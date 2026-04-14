import enum


class UserRole(str, enum.Enum):
    BRAND_ADMIN = "brand_admin"
    DISTRICT_LEADER = "district_leader"
    AGENCY_LEADER = "agency_leader"
    FSC = "fsc"


class ProjectType(str, enum.Enum):
    PERSONAL = "personal"
    TEAM = "team"


class ProjectPurpose(str, enum.Enum):
    PRODUCT_LAUNCH = "product_launch"
    CAMPAIGN = "campaign"
    SEASONAL = "seasonal"
    AGENT_ENABLEMENT = "agent_enablement"


class ProjectMemberRole(str, enum.Enum):
    OWNER = "owner"
    MEMBER = "member"


class ArtifactType(str, enum.Enum):
    POSTER = "poster"
    WHATSAPP_CARD = "whatsapp_card"
    REEL = "reel"
    STORY = "story"
    VIDEO = "video"
    DECK = "deck"
    INFOGRAPHIC = "infographic"
    SLIDE_DECK = "slide_deck"


class ArtifactChannel(str, enum.Enum):
    INSTAGRAM = "instagram"
    WHATSAPP = "whatsapp"
    PRINT = "print"
    SOCIAL = "social"
    INTERNAL = "internal"


class ArtifactFormat(str, enum.Enum):
    SQUARE = "1:1"
    PORTRAIT_4_5 = "4:5"
    PORTRAIT_9_16 = "9:16"
    A4 = "A4"
    WA_SQUARE = "800x800"


class ArtifactStatus(str, enum.Enum):
    DRAFT = "draft"
    READY = "ready"
    EXPORTED = "exported"


class LibraryItemStatus(str, enum.Enum):
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    PUBLISHED = "published"
    REJECTED = "rejected"


class ComplianceSeverity(str, enum.Enum):
    ERROR = "error"
    WARNING = "warning"


class DocumentType(str, enum.Enum):
    MAS_REGULATION = "mas_regulation"
    PRODUCT_FACT_SHEET = "product_fact_sheet"
    DISCLAIMER = "disclaimer"


class SuggestionAudience(str, enum.Enum):
    INTERNAL = "internal"
    EXTERNAL = "external"
    BOTH = "both"


# --- Video pipeline enums ---

class SpeakingStyle(str, enum.Enum):
    AUTHORITATIVE = "authoritative"
    CONVERSATIONAL = "conversational"
    ENTHUSIASTIC = "enthusiastic"
    EMPATHETIC = "empathetic"


class CameraFraming(str, enum.Enum):
    WIDE_SHOT = "wide_shot"
    MEDIUM_SHOT = "medium_shot"
    CLOSE_UP = "close_up"
    OVER_THE_SHOULDER = "over_the_shoulder"
    TWO_SHOT = "two_shot"
    AERIAL = "aerial"
    POV = "pov"


class VideoStatus(str, enum.Enum):
    QUEUED = "queued"
    RENDERING = "rendering"
    READY = "ready"
    FAILED = "failed"


class ScriptAction(str, enum.Enum):
    DRAFT = "draft"
    WARM = "warm"
    PROFESSIONAL = "professional"
    SHORTER = "shorter"
    STRONGER_CTA = "stronger_cta"
    MANUAL = "manual"


class TargetDuration(str, enum.Enum):
    SECONDS_30 = "30s"
    SECONDS_60 = "60s"
    SECONDS_90 = "90s"
    MINUTES_2 = "2m"
    MINUTES_3 = "3m"
    MINUTES_5 = "5m"


class VideoSessionStep(str, enum.Enum):
    PRESENTER = "presenter"
    SCRIPT = "script"
    STORYBOARD = "storyboard"
    GENERATION = "generation"


# --- My Studio enums (Phase A+) ---

class StudioImageType(str, enum.Enum):
    PHOTO = "PHOTO"                   # user-uploaded, unprocessed
    AI_GENERATED = "AI_GENERATED"     # Text→Image output
    ENHANCED = "ENHANCED"             # Image→Image output
    POSTER_EXPORT = "POSTER_EXPORT"   # registered from Poster Wizard export


class StudioIntent(str, enum.Enum):
    MAKE_PROFESSIONAL = "MAKE_PROFESSIONAL"
    CHANGE_BACKGROUND = "CHANGE_BACKGROUND"
    ENHANCE_QUALITY = "ENHANCE_QUALITY"
    VARIATION = "VARIATION"
    CUSTOM = "CUSTOM"


class WorkflowStatus(str, enum.Enum):
    QUEUED = "QUEUED"
    RUNNING = "RUNNING"
    DONE = "DONE"
    FAILED = "FAILED"
    PARTIAL = "PARTIAL"
