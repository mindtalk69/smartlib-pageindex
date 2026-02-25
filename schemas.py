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

class UserLogin(BaseModel):
    """Login request."""
    email: EmailStr
    password: str

class UserRegister(BaseModel):
    """Registration request."""
    username: str
    email: EmailStr
    password: str

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

class MessageHistoryRead(SmartLibBase):
    message_id: int
    user_id: str
    thread_id: Optional[str] = None
    message_text: str
    answer: Optional[str] = None
    timestamp: datetime
    citations: Optional[str] = None
    suggested_questions: Optional[str] = None
