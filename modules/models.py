from datetime import datetime
from typing import List, Optional, Dict, Any
from sqlmodel import (
    SQLModel,
    Field,
    Relationship,
    Column,
    JSON,
    String,
    Text,
    DateTime,
    Boolean,
    Integer,
    Float,
    ForeignKey,
    Table,
)
from sqlalchemy import func, text
import uuid


class LLMPrompt(SQLModel, table=True):
    __tablename__ = "llm_prompts"
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(sa_column=Column(String(128), nullable=False, unique=True))
    content: str = Field(sa_column=Column(Text, nullable=False))
    description: Optional[str] = Field(
        default=None, sa_column=Column(String(256), nullable=True)
    )
    is_active: bool = Field(default=True, nullable=False)
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(DateTime, server_default=func.now()),
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(DateTime, server_default=func.now(), onupdate=func.now()),
    )


class User(SQLModel, table=True):
    __tablename__ = "users"
    user_id: str = Field(primary_key=True)
    username: str = Field(index=True)
    auth_provider: str = Field(index=True)
    azure_oid: Optional[str] = Field(
        default=None, sa_column=Column(String, unique=True, nullable=True)
    )
    email: Optional[str] = Field(default=None)
    password_hash: Optional[str] = Field(default=None)
    is_admin: bool = Field(default=False)
    is_disabled: bool = Field(default=False)
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(DateTime(timezone=True), server_default=func.now()),
    )

    # Relationships
    uploaded_files: List["UploadedFile"] = Relationship(back_populates="uploader")
    groups_created: List["Group"] = Relationship(back_populates="creator")


# Association table for many-to-many between Knowledge and Group
knowledge_groups_association = Table(
    "knowledge_groups_association",
    SQLModel.metadata,
    Column(
        "knowledge_id",
        Integer,
        ForeignKey("knowledges.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column(
        "group_id",
        Integer,
        ForeignKey("groups.group_id", ondelete="CASCADE"),
        primary_key=True,
    ),
)


class Group(SQLModel, table=True):
    __tablename__ = "groups"
    group_id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)
    description: Optional[str] = Field(default=None)
    created_by_user_id: str = Field(foreign_key="users.user_id")
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(DateTime(timezone=True), server_default=func.now()),
    )

    creator: Optional[User] = Relationship(back_populates="groups_created")
    # Many-to-many: groups <-> knowledges via knowledge_groups_association
    knowledges: List["Knowledge"] = Relationship(
        back_populates="groups",
        sa_relationship_kwargs={"secondary": knowledge_groups_association},
    )


class UserGroup(SQLModel, table=True):
    __tablename__ = "user_groups"
    user_id: str = Field(foreign_key="users.user_id", primary_key=True)
    group_id: int = Field(foreign_key="groups.group_id", primary_key=True)
    joined_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(DateTime(timezone=True), server_default=func.now()),
    )


class Library(SQLModel, table=True):
    __tablename__ = "libraries"
    library_id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)
    description: Optional[str] = Field(default=None)
    created_by_user_id: str = Field(foreign_key="users.user_id")
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(DateTime(timezone=True), server_default=func.now()),
    )


class Knowledge(SQLModel, table=True):
    __tablename__ = "knowledges"
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)
    description: Optional[str] = Field(default=None)
    brand_manufacturer_organization: Optional[str] = Field(default=None)
    product_model_name_service: Optional[str] = Field(default=None)
    created_by_user_id: str = Field(foreign_key="users.user_id")
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(DateTime(timezone=True), server_default=func.now()),
    )
    embedding_model: Optional[str] = Field(default=None)

    # Many-to-many: knowledge <-> groups via knowledge_groups_association
    groups: List["Group"] = Relationship(
        back_populates="knowledges",
        sa_relationship_kwargs={"secondary": knowledge_groups_association},
    )


class UploadedFile(SQLModel, table=True):
    __tablename__ = "uploaded_files"
    file_id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(foreign_key="users.user_id")
    library_id: Optional[int] = Field(default=None, foreign_key="libraries.library_id")
    knowledge_id: Optional[int] = Field(default=None, foreign_key="knowledges.id")
    original_filename: str = Field()
    stored_filename: str = Field()
    file_size: int = Field()
    upload_time: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(DateTime(timezone=True), server_default=func.now()),
    )
    is_ocr: bool = Field(default=False)
    is_az_doci: bool = Field(default=False)
    brand_manufacturer_organization: Optional[str] = Field(default=None)
    product_model_name_service: Optional[str] = Field(default=None)

    uploader: Optional[User] = Relationship(back_populates="uploaded_files")


class MessageHistory(SQLModel, table=True):
    __tablename__ = "message_history"
    message_id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(foreign_key="users.user_id")
    thread_id: Optional[str] = Field(default=None)
    message_text: str = Field(sa_column=Column(Text, nullable=False))
    answer: Optional[str] = Field(default=None, sa_column=Column(Text))
    timestamp: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(DateTime(timezone=True), server_default=func.now()),
    )
    citations: Optional[str] = Field(default=None, sa_column=Column(Text))
    usage_metadata: Optional[str] = Field(default=None, sa_column=Column(Text))
    suggested_questions: Optional[str] = Field(default=None, sa_column=Column(Text))
    structured_query: Optional[str] = Field(default=None, sa_column=Column(Text))


class LLMProvider(SQLModel, table=True):
    __tablename__ = "llm_providers"
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)
    provider_type: str = Field()
    base_url: Optional[str] = Field(default=None)
    api_key: Optional[str] = Field(default=None)
    is_active: bool = Field(default=True)
    is_default: bool = Field(default=False)
    priority: int = Field(default=0)
    config: Dict[str, Any] = Field(default={}, sa_column=Column(JSON))
    last_health_check: Optional[datetime] = Field(default=None)
    health_status: Optional[str] = Field(default=None)
    error_message: Optional[str] = Field(default=None)
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(DateTime, server_default=func.now()),
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(DateTime, server_default=func.now(), onupdate=func.now()),
    )


class ModelConfig(SQLModel, table=True):
    __tablename__ = "model_configs"
    id: Optional[int] = Field(default=None, primary_key=True)
    provider_id: Optional[int] = Field(default=None, foreign_key="llm_providers.id")
    name: str = Field(unique=True)
    deployment_name: str = Field()
    provider: str = Field(default="azure_openai")
    temperature: Optional[float] = Field(default=None)
    streaming: bool = Field(default=False)
    description: Optional[str] = Field(default=None)
    is_default: bool = Field(default=False)
    created_by: Optional[str] = Field(default=None, foreign_key="users.user_id")
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(DateTime(timezone=True), server_default=func.now()),
    )


class AppSettings(SQLModel, table=True):
    __tablename__ = "app_settings"
    key: str = Field(primary_key=True)
    value: str = Field(sa_column=Column(Text, nullable=False))


class LLMLanguage(SQLModel, table=True):
    __tablename__ = "llm_languages"
    id: Optional[int] = Field(default=None, primary_key=True)
    language_code: str = Field(unique=True)
    language_name: str = Field(unique=True)
    is_active: bool = Field(default=True)
    created_by: Optional[str] = Field(default=None)
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(DateTime, server_default=func.now()),
    )


class PasswordResetRequest(SQLModel, table=True):
    __tablename__ = "password_reset_requests"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(foreign_key="users.user_id")
    email: str = Field()
    token: str = Field(unique=True, index=True)
    status: str = Field(default="pending")  # pending, completed, expired, cancelled
    expires_at: datetime = Field()
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(DateTime(timezone=True), server_default=func.now()),
    )
    completed_at: Optional[datetime] = Field(default=None)
    processed_at: Optional[datetime] = Field(default=None)
    processed_by: Optional[str] = Field(default=None)
    admin_notes: Optional[str] = Field(default=None)


class Catalog(SQLModel, table=True):
    __tablename__ = "catalogs"
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(unique=True)
    description: Optional[str] = Field(default=None)
    created_by_user_id: str = Field(foreign_key="users.user_id")
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(DateTime, server_default=func.now()),
    )


class Category(SQLModel, table=True):
    __tablename__ = "categories"
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(unique=True)
    description: Optional[str] = Field(default=None)
    created_by_user_id: str = Field(foreign_key="users.user_id")
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(DateTime, server_default=func.now()),
    )


class UrlDownload(SQLModel, table=True):
    __tablename__ = "url_downloads"
    download_id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(foreign_key="users.user_id")
    library_id: Optional[int] = Field(default=None, foreign_key="libraries.library_id")
    knowledge_id: Optional[int] = Field(default=None, foreign_key="knowledges.id")
    url: str = Field(sa_column=Column(Text, nullable=False))
    status: str = Field()  # 'queued', 'processing', 'success', 'failed'
    content_type: str = Field(default="unknown")
    error_message: Optional[str] = Field(default=None, sa_column=Column(Text))
    is_ocr: bool = Field(default=False)
    is_az_doci: bool = Field(default=False)
    processed_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(DateTime(timezone=True), server_default=func.now()),
    )


class LibraryReference(SQLModel, table=True):
    __tablename__ = "library_references"
    reference_id: Optional[int] = Field(default=None, primary_key=True)
    library_id: int = Field(foreign_key="libraries.library_id")
    user_id: str = Field(foreign_key="users.user_id")
    reference_type: str = Field()  # 'file' or 'url_download'
    source_id: int = Field()  # file_id or download_id
    added_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(DateTime(timezone=True), server_default=func.now()),
    )


class VectorReference(SQLModel, table=True):
    __tablename__ = "vector_references"
    id: Optional[int] = Field(default=None, primary_key=True)
    file_id: Optional[int] = Field(default=None, foreign_key="uploaded_files.file_id")
    url_download_id: Optional[int] = Field(
        default=None, foreign_key="url_downloads.download_id"
    )
    chunk_index: int = Field()


class VisualGroundingActivity(SQLModel, table=True):
    __tablename__ = "visual_grounding_activity"
    id: Optional[int] = Field(default=None, primary_key=True)
    user_id: str = Field(foreign_key="users.user_id")
    group_id: Optional[int] = Field(default=None, foreign_key="groups.group_id")
    file_id: int = Field(foreign_key="uploaded_files.file_id")
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(DateTime(timezone=True), server_default=func.now()),
    )
    updated_at: Optional[datetime] = Field(
        default=None, sa_column=Column(DateTime(timezone=True), onupdate=func.now())
    )
    status: str = Field(default="pending")


class Document(SQLModel, table=True):
    __tablename__ = "documents"
    id: str = Field(
        default_factory=lambda: str(uuid.uuid4()),
        sa_column=Column(String, primary_key=True),
    )
    source: Optional[str] = Field(default=None, sa_column=Column(Text))
    library_id: Optional[int] = Field(default=None, foreign_key="libraries.library_id")
    knowledge_id: Optional[int] = Field(default=None, foreign_key="knowledges.id")
    dl_meta: Optional[Dict[str, Any]] = Field(default=None, sa_column=Column(JSON))
    docling_json_path: Optional[str] = Field(default=None, sa_column=Column(Text))
    content_preview: Optional[str] = Field(default=None, sa_column=Column(Text))
    brand_manufacturer_organization: Optional[str] = Field(
        default=None, sa_column=Column(String(255))
    )
    product_model_name_service: Optional[str] = Field(
        default=None, sa_column=Column(String(255))
    )
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        sa_column=Column(DateTime(timezone=True), server_default=func.now()),
    )
