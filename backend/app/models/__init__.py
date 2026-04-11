# Re-export all models for Alembic auto-detection
from app.models.base import Base, BaseModel
from app.models.enums import (
    UserRole,
    ProjectType,
    ProjectPurpose,
    ProjectMemberRole,
    ArtifactType,
    ArtifactChannel,
    ArtifactFormat,
    ArtifactStatus,
    LibraryItemStatus,
    ComplianceSeverity,
    DocumentType,
    SuggestionAudience,
)
from app.models.user import User
from app.models.project import Project
from app.models.project_member import ProjectMember
from app.models.artifact import Artifact
from app.models.artifact_suggestion import ArtifactSuggestion
from app.models.brand_library_item import BrandLibraryItem
from app.models.brand_kit import BrandKit
from app.models.compliance_rule import ComplianceRule
from app.models.compliance_document import ComplianceDocument
from app.models.compliance_check import ComplianceCheck
from app.models.export_log import ExportLog
from app.models.notification import Notification

__all__ = [
    "Base",
    "BaseModel",
    "UserRole",
    "ProjectType",
    "ProjectPurpose",
    "ProjectMemberRole",
    "ArtifactType",
    "ArtifactChannel",
    "ArtifactFormat",
    "ArtifactStatus",
    "LibraryItemStatus",
    "ComplianceSeverity",
    "DocumentType",
    "SuggestionAudience",
    "User",
    "Project",
    "ProjectMember",
    "Artifact",
    "ArtifactSuggestion",
    "BrandLibraryItem",
    "BrandKit",
    "ComplianceRule",
    "ComplianceDocument",
    "ComplianceCheck",
    "ExportLog",
    "Notification",
]
