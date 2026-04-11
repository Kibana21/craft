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
