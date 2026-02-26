from pydantic import BaseModel, ConfigDict, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID

# Base Schema with common Config
class SmartLibBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

# Auth Schemas
class Token(BaseModel):
    """JWT token response."""
    access_token: str
    token_type: str = "bearer"

class TokenData(BaseModel):
    """Decoded JWT token data."""
    user_id: Optional[str] = None

class LoginResponse(BaseModel):
    """Flask-compatible login response."""
    success: bool
    user: Optional["UserResponse"] = None
    error: Optional[str] = None
    access_token: Optional[str] = None
    token_type: Optional[str] = "bearer"

class UserLogin(BaseModel):
    """Login request."""
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    """Login request accepting username or email."""
    username: str  # Can be username or email
    password: str

class UserRegister(BaseModel):
    """Registration request."""
    username: str
    email: EmailStr
    password: str

class PasswordChange(BaseModel):
    """Password change request."""
    current_password: str
    new_password: str

class ForgotPasswordRequest(BaseModel):
    """Forgot password request."""
    email: EmailStr

class UserResponse(BaseModel):
    """User data response (excludes sensitive fields)."""
    user_id: str
    username: str
    email: Optional[str] = None
    is_admin: bool = False
    is_disabled: bool = False
    created_at: Optional[datetime] = None

# User Schemas
class UserBase(SmartLibBase):
    username: str
    auth_provider: str
    email: Optional[EmailStr] = None
    is_admin: bool = False
    is_disabled: bool = False

class UserCreate(UserBase):
    user_id: str
    password_hash: Optional[str] = None
    azure_oid: Optional[str] = None

class UserRead(UserBase):
    user_id: str
    created_at: Optional[datetime] = None

# Group Schemas
class GroupBase(SmartLibBase):
    name: str
    description: Optional[str] = None

class GroupCreate(GroupBase):
    created_by_user_id: str

class GroupRead(GroupBase):
    group_id: int
    created_by_user_id: str
    created_at: Optional[datetime] = None

# Library Schemas
class LibraryBase(SmartLibBase):
    name: str
    description: Optional[str] = None

class LibraryCreate(LibraryBase):
    created_by_user_id: str

class LibraryRead(LibraryBase):
    library_id: int
    created_by_user_id: str
    created_at: Optional[datetime] = None

# Knowledge Schemas
class KnowledgeBase(SmartLibBase):
    name: str
    description: Optional[str] = None
    brand_manufacturer_organization: Optional[str] = None
    product_model_name_service: Optional[str] = None
    embedding_model: Optional[str] = None

class KnowledgeCreate(KnowledgeBase):
    created_by_user_id: str

class KnowledgeRead(KnowledgeBase):
    id: int
    created_by_user_id: str
    created_at: Optional[datetime] = None

# LLM Provider Schemas
class LLMProviderBase(SmartLibBase):
    name: str
    provider_type: str
    base_url: Optional[str] = None
    is_active: bool = True
    is_default: bool = False
    priority: int = 0
    config: Dict[str, Any] = {}

class LLMProviderCreate(LLMProviderBase):
    api_key: Optional[str] = None

class LLMProviderRead(LLMProviderBase):
    id: int
    health_status: Optional[str] = None
    last_health_check: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

# Model Config Schemas
class ModelConfigBase(SmartLibBase):
    name: str
    deployment_name: str
    provider: str = "azure_openai"
    temperature: Optional[float] = None
    streaming: bool = False
    description: Optional[str] = None
    is_default: bool = False

class ModelConfigCreate(ModelConfigBase):
    provider_id: Optional[int] = None
    created_by: Optional[str] = None

class ModelConfigRead(ModelConfigBase):
    id: int
    provider_id: Optional[int] = None
    created_by: Optional[str] = None
    created_at: Optional[datetime] = None

# Search Results / General
class Citations(SmartLibBase):
    citations: List[Dict[str, Any]] = []


class Message(BaseModel):
    """Chat message format."""
    role: str  # "user" or "assistant"
    content: str


class ThreadInfo(BaseModel):
    """Thread information for conversation list."""
    id: str
    preview: str
    lastUpdated: str
    messageCount: int


class MessageHistoryRead(SmartLibBase):
    message_id: int
    user_id: str
    thread_id: Optional[str] = None
    message_text: str
    answer: Optional[str] = None
    timestamp: datetime
    citations: Optional[str] = None
    suggested_questions: Optional[str] = None


# Upload Schemas
class FileUploadResponse(BaseModel):
    """Response for file upload."""
    filename: str
    task_id: str


class UploadResponse(BaseModel):
    """Flask-compatible upload response."""
    success: bool
    message: str
    files: Optional[List[FileUploadResponse]] = None


class DuplicateCheckRequest(BaseModel):
    """Request to check for duplicate files."""
    filenames: List[str]
    library_id: int
    knowledge_id: Optional[int] = None


class DuplicateInfo(BaseModel):
    """Information about a duplicate file."""
    filename: str
    file_id: int
    upload_time: Optional[str] = None


class DuplicateCheckResponse(BaseModel):
    """Response for duplicate check."""
    duplicates: List[DuplicateInfo]
    error: Optional[str] = None


class UploadTaskInfo(BaseModel):
    """Information about an upload task."""
    task_id: str
    status: str
    filename: str
    info: Optional[Dict[str, Any]] = None


class UploadStatusResponse(BaseModel):
    """Response for upload status."""
    tasks: List[UploadTaskInfo]


class UrlDownloadRequest(BaseModel):
    """Request to process URL download."""
    url: str
    library_id: int
    library_name: Optional[str] = None
    knowledge_id: Optional[int] = None


class UrlDownloadResponse(BaseModel):
    """Response for URL download."""
    success: bool
    message: str
    task_id: Optional[str] = None
    download_id: Optional[int] = None


class UrlValidateRequest(BaseModel):
    """Request to validate URL."""
    url: str


class UrlValidateResponse(BaseModel):
    """Response for URL validation."""
    valid: bool
    message: str


# Library/Knowledge Schemas for Flask-compatible endpoints
class CategoryInfo(BaseModel):
    """Category information."""
    id: int
    name: str


class CatalogInfo(BaseModel):
    """Catalog information."""
    id: int
    name: str


class GroupInfo(BaseModel):
    """Group information."""
    group_id: int
    name: str


class KnowledgeInfo(BaseModel):
    """Knowledge information with relationships."""
    id: int
    name: str
    categories: List[CategoryInfo] = []
    catalogs: List[CatalogInfo] = []
    groups: List[GroupInfo] = []


class LibraryInfo(BaseModel):
    """Library information with knowledges."""
    library_id: int
    name: str
    description: str
    knowledges: List[KnowledgeInfo] = []


class LibrariesResponse(BaseModel):
    """Response for libraries endpoint."""
    libraries: List[LibraryInfo]


class KnowledgeSimple(BaseModel):
    """Simple knowledge information."""
    id: int
    name: str


class LibrarySimple(BaseModel):
    """Simple library information."""
    id: int
    name: str


class KnowledgeWithLibraries(BaseModel):
    """Knowledge with associated libraries."""
    name: str
    libraries: List[LibrarySimple]


class KnowledgesResponse(BaseModel):
    """Response for knowledges endpoint."""
    knowledges: List[KnowledgeSimple]
    knowledge_libraries_map: Dict[str, KnowledgeWithLibraries]
    mode: str = "user"


# User Profile & Stats Schemas
class UserProfile(BaseModel):
    """User profile information."""
    user_id: str
    username: str
    email: Optional[str] = None
    is_admin: bool = False
    created_at: Optional[datetime] = None


class UserProfileUpdate(BaseModel):
    """User profile update request."""
    username: Optional[str] = None
    email: Optional[str] = None


class UserStats(BaseModel):
    """User statistics."""
    file_count: int = 0
    total_file_size_bytes: int = 0
    message_count: int = 0
    library_count: int = 0
    knowledge_count: int = 0


# Feedback Schemas
class FeedbackRequest(BaseModel):
    """Feedback request."""
    message_id: int
    feedback_type: str  # "like" or "dislike"


class FeedbackResponse(BaseModel):
    """Feedback response."""
    success: bool
    like_count: int
    dislike_count: int


# Query Schemas
class QueryRequest(BaseModel):
    """RAG query request."""
    query: str
    thread_id: Optional[str] = None
    conversation_id: Optional[str] = None
    library_id: Optional[int] = None
    knowledge_id: Optional[int] = None
    messages: List[Message] = []
    user: Optional[Dict[str, Any]] = None
    enable_visual_grounding: Optional[bool] = False
    use_web_search: Optional[bool] = False


class ConfirmWebSearchRequest(BaseModel):
    """Confirm web search request."""
    thread_id: str
    confirm: bool


class ResumeRagRequest(BaseModel):
    """Resume RAG agent session request."""
    thread_id: str
    user_input: Optional[str] = None
