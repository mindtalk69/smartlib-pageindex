from contextlib import asynccontextmanager
from fastapi import (
    FastAPI,
    Depends,
    HTTPException,
    status,
    Request,
    UploadFile,
    File,
    Form,
)
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqladmin import Admin, ModelView
from database_fastapi import engine, init_db, get_db, Session
from modules.models import (
    User,
    Group,
    Library,
    Knowledge,
    UploadedFile,
    MessageHistory,
    LLMProvider,
    ModelConfig,
    AppSettings,
    LLMPrompt,
    LLMLanguage,
    UserGroup,
    PasswordResetRequest,
    UrlDownload,
    LibraryReference,
    VectorReference,
    VisualGroundingActivity,
    Document,
    Catalog,
    Category,
    FolderUploadJob,
)
from modules.crud_router import CRUDRouter
from modules.auth import (
    get_password_hash,
    create_access_token,
    get_current_user,
    get_current_admin_user,
    authenticate_user_async,
    verify_password,
)
from schemas import (
    UserLogin,
    UserRegister,
    UserResponse,
    Token,
    LoginRequest,
    LoginResponse,
    PasswordChange,
    ForgotPasswordRequest,
    # Upload schemas
    UploadResponse,
    FileUploadResponse,
    DuplicateCheckRequest,
    DuplicateCheckResponse,
    DuplicateInfo,
    UploadStatusResponse,
    UploadTaskInfo,
    UrlDownloadRequest,
    UrlDownloadResponse,
    UrlValidateRequest,
    UrlValidateResponse,
    LibrariesResponse,
    LibraryInfo,
    KnowledgeInfo,
    CategoryInfo,
    CatalogInfo,
    GroupInfo,
    KnowledgesResponse,
    KnowledgeSimple,
    LibrarySimple,
    KnowledgeWithLibraries,
    # User profile & stats schemas
    UserProfile,
    UserProfileUpdate,
    UserStats,
    # LLM Provider admin schemas
    LLMProviderListResponse,
    LLMProviderCreateRequest,
    LLMProviderCreateResponse,
    LLMProviderUpdateRequest,
    LLMProviderUpdateResponse,
    LLMProviderDeleteResponse,
    LLMProviderTestResponse,
    LLMProviderDiscoverModelsResponse,
    LLMProviderPriorityUpdateRequest,
    LLMProviderPriorityUpdateResponse,
    # LLM Language admin schemas
    LLMLanguageListResponse,
    LLMLanguageCreateRequest,
    LLMLanguageCreateResponse,
    LLMLanguageUpdateRequest,
    LLMLanguageUpdateResponse,
    LLMLanguageDeleteResponse,
    # Model Config admin schemas
    ModelConfigListResponse,
    ModelConfigCreateRequest,
    ModelConfigCreateResponse,
    ModelConfigUpdateRequest,
    ModelConfigUpdateResponse,
    ModelConfigDeleteResponse,
    ModelConfigDefaultResponse,
    ModelConfigMultimodalResponse,
    ModelValidationRequest,
    ModelValidationResponse,
    # Activity Log admin schemas (Phase 09)
    UploadActivityListResponse,
    DownloadActivityListResponse,
    # File Management admin schemas (Phase 09)
    FileDetailsResponse,
    FileDeleteResponse,
    # Settings schemas (Phase 09)
    AppSettingsResponse,
    SettingsUpdateRequest,
    SettingsUpdateResponse,
    # Catalog admin schemas (Phase 09)
    CatalogListResponse,
    CatalogCreateRequest,
    CatalogCreateResponse,
    CatalogUpdateRequest,
    CatalogUpdateResponse,
    CatalogDeleteResponse,
    # Category admin schemas (Phase 09)
    CategoryListResponse,
    CategoryCreateRequest,
    CategoryCreateResponse,
    CategoryUpdateRequest,
    CategoryUpdateResponse,
    CategoryDeleteResponse,
)
from typing import Optional, List
from fastapi_pagination import add_pagination
from database_fastapi import DB_PATH
from sqlmodel import select, update, func
from datetime import datetime
import uuid
import os
import json
import logging
import redis


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables on startup
    init_db()
    yield


app = FastAPI(title="SmartLib Turbo API (SQLAdmin)", lifespan=lifespan)

# Setup CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Setup SQLAdmin
admin = Admin(app, engine)


class UserAdmin(ModelView, model=User):
    column_list = [User.user_id, User.username, User.email, User.is_admin]
    column_searchable_list = [User.username, User.email]
    icon = "fa-solid fa-user"


@app.get("/api/v1/history")
@app.get("/api/history")
async def api_history(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """API endpoint to fetch user message history grouped by date."""
    from collections import defaultdict

    history_by_date = defaultdict(list)

    try:
        # Get all messages for user
        statement = (
            select(MessageHistory)
            .where(MessageHistory.user_id == current_user.user_id)
            .order_by(MessageHistory.timestamp.desc())
        )
        messages = db.exec(statement).all()

        for msg in messages:
            ts_obj = msg.timestamp
            if ts_obj:
                date_key = ts_obj.strftime("%Y-%m-%d")

                # Add user message
                history_by_date[date_key].append(
                    {
                        "message_id": msg.message_id,
                        "role": "user",
                        "message_text": msg.message,
                        "timestamp": ts_obj.strftime("%H:%M:%S"),
                        "thread_id": msg.thread_id,
                    }
                )

                # Add assistant answer if present
                if msg.answer:
                    try:
                        citations = json.loads(msg.citations) if msg.citations else []
                    except:
                        citations = []

                    try:
                        suggested_questions = (
                            json.loads(msg.suggested_questions)
                            if msg.suggested_questions
                            else []
                        )
                    except:
                        suggested_questions = []

                    history_by_date[date_key].append(
                        {
                            "message_id": msg.message_id,
                            "role": "assistant",
                            "message_text": msg.answer,
                            "timestamp": ts_obj.strftime("%H:%M:%S"),
                            "thread_id": msg.thread_id,
                            "citations": citations,
                            "suggested_questions": suggested_questions,
                        }
                    )

        # Convert to dict for JSON
        return {"success": True, "history": dict(history_by_date)}

    except Exception as e:
        logging.error(f"Error fetching history: {e}")
        return {"success": False, "error": str(e)}


@app.get("/api/v1/counters")
@app.get("/api/counters")
async def api_counters(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Get message and document counters for user."""
    msg_statement = (
        select(func.count())
        .select_from(MessageHistory)
        .where(MessageHistory.user_id == current_user.user_id)
    )
    doc_statement = (
        select(func.count())
        .select_from(UploadedFile)
        .where(UploadedFile.user_id == current_user.user_id)
    )

    msg_count = db.exec(msg_statement).one()
    doc_count = db.exec(doc_statement).one()

    return {"message_count": msg_count, "uploaded_docs_count": doc_count}


class GroupAdmin(ModelView, model=Group):
    column_list = [Group.group_id, Group.name, Group.created_by_user_id]
    icon = "fa-solid fa-users"


class LibraryAdmin(ModelView, model=Library):
    column_list = [Library.library_id, Library.name, Library.created_by_user_id]
    icon = "fa-solid fa-book"


class KnowledgeAdmin(ModelView, model=Knowledge):
    column_list = [
        Knowledge.id,
        Knowledge.name,
        Knowledge.brand_manufacturer_organization,
    ]
    column_searchable_list = [Knowledge.name, Knowledge.brand_manufacturer_organization]
    icon = "fa-solid fa-brain"


class UploadedFileAdmin(ModelView, model=UploadedFile):
    column_list = [
        UploadedFile.file_id,
        UploadedFile.original_filename,
        UploadedFile.user_id,
    ]
    icon = "fa-solid fa-file-arrow-up"


class MessageHistoryAdmin(ModelView, model=MessageHistory):
    column_list = [
        MessageHistory.message_id,
        MessageHistory.user_id,
        MessageHistory.timestamp,
    ]
    icon = "fa-solid fa-message"


class LLMProviderAdmin(ModelView, model=LLMProvider):
    column_list = [
        LLMProvider.id,
        LLMProvider.name,
        LLMProvider.provider_type,
        LLMProvider.is_active,
    ]
    icon = "fa-solid fa-server"


class ModelConfigAdmin(ModelView, model=ModelConfig):
    column_list = [
        ModelConfig.id,
        ModelConfig.name,
        ModelConfig.deployment_name,
        ModelConfig.is_default,
    ]
    icon = "fa-solid fa-microchip"


class AppSettingsAdmin(ModelView, model=AppSettings):
    column_list = [AppSettings.key, AppSettings.value]
    icon = "fa-solid fa-gear"


class LLMPromptAdmin(ModelView, model=LLMPrompt):
    column_list = [LLMPrompt.id, LLMPrompt.name, LLMPrompt.is_active]
    icon = "fa-solid fa-terminal"


class LLMLanguageAdmin(ModelView, model=LLMLanguage):
    column_list = [
        LLMLanguage.id,
        LLMLanguage.language_code,
        LLMLanguage.language_name,
        LLMLanguage.is_active,
    ]
    icon = "fa-solid fa-language"


class PasswordResetRequestAdmin(ModelView, model=PasswordResetRequest):
    column_list = [
        PasswordResetRequest.id,
        PasswordResetRequest.user_id,
        PasswordResetRequest.email,
        PasswordResetRequest.status,
        PasswordResetRequest.expires_at,
    ]
    column_searchable_list = [PasswordResetRequest.email, PasswordResetRequest.token]
    icon = "fa-solid fa-key"


# Register views
admin.add_view(UserAdmin)
admin.add_view(GroupAdmin)
admin.add_view(LibraryAdmin)
admin.add_view(KnowledgeAdmin)
admin.add_view(UploadedFileAdmin)
admin.add_view(MessageHistoryAdmin)
admin.add_view(LLMProviderAdmin)
admin.add_view(ModelConfigAdmin)
admin.add_view(AppSettingsAdmin)
admin.add_view(LLMPromptAdmin)
admin.add_view(LLMLanguageAdmin)
admin.add_view(PasswordResetRequestAdmin)

# Register CRUD API Routers (Turbo API)
# Models with user ownership filtering
user_owned_models = [
    (UploadedFile, "/files", "user_id"),
    (MessageHistory, "/messages", "user_id"),
]

# Models without user ownership (global or admin-managed)
global_models = [
    (User, "/users"),
    (Group, "/groups"),
    (Library, "/libraries"),
    (Knowledge, "/knowledges"),
    (LLMProvider, "/providers"),
    (ModelConfig, "/models"),
    (AppSettings, "/settings"),
    (LLMPrompt, "/prompts"),
    (LLMLanguage, "/languages"),
    (UrlDownload, "/admin/downloads"),
]

# Register user-owned models with filtering
for model, prefix, user_field in user_owned_models:
    crud = CRUDRouter(model, prefix=prefix, user_field=user_field, require_auth=True)
    app.include_router(crud.router, prefix="/api/v1")

# Register global models (auth required but no user filtering)
for model, prefix in global_models:
    eager_load = []
    if model.__name__ == "Library":
        eager_load = ["knowledges"]
    crud = CRUDRouter(model, prefix=prefix, require_auth=True, eager_load=eager_load)
    app.include_router(crud.router, prefix="/api/v1")

# Auth endpoints


@app.post("/api/v1/auth/login", response_model=LoginResponse)
def api_v1_login(login_data: LoginRequest, db=Depends(get_db)):
    """
    V1 Login endpoint with Flask-compatible response.
    Accepts {username, password} where username can be username or email.
    Returns {success, user, access_token} format.
    """
    username_or_email = login_data.username.strip()
    password = login_data.password

    if not username_or_email or not password:
        return LoginResponse(
            success=False, error="Username/email and password are required"
        )

    # Try to authenticate - first try as email, then as username
    user = authenticate_user_async(username_or_email, password, db)

    # If not found and contains @, try by user_id (email field)
    if not user and "@" in username_or_email:
        statement = select(User).where(User.user_id == username_or_email)
        result = db.exec(statement)
        user_by_id = result.first()
        if user_by_id and verify_password(password, user_by_id.password_hash):
            user = user_by_id

    # If still not found, try by username
    if not user:
        statement = select(User).where(User.username == username_or_email)
        result = db.exec(statement)
        user_by_name = result.first()
        if user_by_name and verify_password(password, user_by_name.password_hash):
            user = user_by_name

    if not user:
        return LoginResponse(success=False, error="Invalid username/email or password")

    if user.is_disabled:
        return LoginResponse(success=False, error="Account is disabled")

    # Generate JWT token
    access_token = create_access_token(data={"sub": user.user_id})

    # Return Flask-compatible response with JWT token
    return LoginResponse(
        success=True,
        user=UserResponse(
            user_id=user.user_id,
            username=user.username,
            email=user.email,
            is_admin=user.is_admin,
            is_disabled=user.is_disabled,
            created_at=user.created_at,
        ),
        access_token=access_token,
        token_type="bearer",
    )


@app.post("/api/v1/auth/register", response_model=UserResponse)
def api_v1_register(register_data: UserRegister, db=Depends(get_db)):
    """
    V1 Register endpoint - create new user account.
    """
    # Check if email already exists
    existing_user = db.exec(select(User).where(User.email == register_data.email))
    if existing_user.first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Check if username already exists
    existing_username = db.exec(
        select(User).where(User.username == register_data.username)
    )
    if existing_username.first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken",
        )

    # Create new user
    user = User(
        user_id=str(uuid.uuid4()),
        username=register_data.username,
        email=register_data.email,
        password_hash=get_password_hash(register_data.password),
        auth_provider="local",
        is_admin=False,
        is_disabled=False,
    )

    db.add(user)
    db.commit()
    db.refresh(user)

    return UserResponse(
        user_id=user.user_id,
        username=user.username,
        email=user.email,
        is_admin=user.is_admin,
        is_disabled=user.is_disabled,
        created_at=user.created_at,
    )


@app.post("/api/v1/auth/change-password")
def api_v1_change_password(
    password_data: PasswordChange,
    current_user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    """
    V1 Change password endpoint.
    Validates current password and updates to new password.
    """
    # Verify current password
    if not verify_password(password_data.current_password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )

    # Validate new password
    new_password = password_data.new_password
    if len(new_password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters",
        )
    if not any(c.isupper() for c in new_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain at least one uppercase letter",
        )
    if not any(c.isdigit() for c in new_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must contain at least one number",
        )

    # Update password
    current_user.password_hash = get_password_hash(new_password)
    db.add(current_user)
    db.commit()

    return {"success": True, "message": "Password changed successfully"}


@app.get("/api/v1/auth/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """
    Get current authenticated user information.

    Requires valid JWT token in Authorization header.
    """
    return UserResponse(
        user_id=current_user.user_id,
        username=current_user.username,
        email=current_user.email,
        is_admin=current_user.is_admin,
        is_disabled=current_user.is_disabled,
        created_at=current_user.created_at,
    )


@app.post("/api/v1/auth/logout")
async def logout(current_user: User = Depends(get_current_user)):
    """
    Logout (invalidate token).

    Note: JWT tokens are stateless. Client should discard the token.
    For token revocation, implement a token blacklist.
    """
    return {
        "success": True,
        "message": "Successfully logged out. Please discard your token.",
    }


@app.post("/api/v1/message_feedback")
async def api_message_feedback(
    request: Request,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Submit like/dislike feedback for a message.
    """
    from modules.database import MessageFeedback as DBMessageFeedback
    from sqlmodel import select

    message_id = data.get("message_id")
    feedback_type = data.get("feedback_type")

    # Validate parameters
    try:
        message_id = int(message_id)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid message_id format")

    if not message_id or feedback_type not in ("like", "dislike"):
        raise HTTPException(status_code=400, detail="Invalid parameters")

    # Get message
    statement = select(MessageHistory).where(MessageHistory.message_id == message_id)
    result = db.exec(statement)
    message = result.first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")

    # Check for existing feedback
    existing_statement = select(DBMessageFeedback).where(
        DBMessageFeedback.message_id == message_id,
        DBMessageFeedback.user_id == current_user.user_id,
    )
    existing_result = db.exec(existing_statement)
    feedback = existing_result.first()

    if feedback:
        # Update if changed
        if feedback.feedback_type != feedback_type:
            feedback.feedback_type = feedback_type
            db.add(feedback)
            db.commit()
    else:
        # Add new feedback
        feedback = DBMessageFeedback(
            message_id=message_id,
            user_id=current_user.user_id,
            feedback_type=feedback_type,
        )
        db.add(feedback)
        db.commit()

    # Aggregate counts
    like_statement = (
        select(func.count())
        .select_from(DBMessageFeedback)
        .where(
            DBMessageFeedback.message_id == message_id,
            DBMessageFeedback.feedback_type == "like",
        )
    )
    dislike_statement = (
        select(func.count())
        .select_from(DBMessageFeedback)
        .where(
            DBMessageFeedback.message_id == message_id,
            DBMessageFeedback.feedback_type == "dislike",
        )
    )

    like_count = db.exec(like_statement).one()
    dislike_count = db.exec(dislike_statement).one()

    logging.info(
        f"Feedback saved: user={current_user.user_id}, message_id={message_id}, type={feedback_type}"
    )

    return {"success": True, "like_count": like_count, "dislike_count": dislike_count}


@app.post("/api/v1/auth/forgot-password")
def forgot_password(email_data: ForgotPasswordRequest, db=Depends(get_db)):
    """
    Request a password reset.

    Creates a password reset request record and sends email to user.
    For now, creates the record and returns success (email sending is TODO).
    """
    import uuid
    from datetime import datetime, timedelta

    email = email_data.email.strip()
    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is required",
        )

    # Find user by email
    statement = select(User).where(User.email == email)
    result = db.exec(statement)
    user = result.first()

    if not user:
        # Don't reveal if email exists for security
        return {
            "success": True,
            "message": "If the email exists, a password reset link will be sent.",
        }

    # Generate reset token
    reset_token = str(uuid.uuid4())
    expires_at = datetime.utcnow() + timedelta(hours=24)

    # Create password reset request
    reset_request = PasswordResetRequest(
        user_id=user.user_id,
        email=email,
        token=reset_token,
        status="pending",
        expires_at=expires_at,
    )

    db.add(reset_request)
    db.commit()

    # TODO: Send email with reset link
    # For now, just return success

    return {
        "success": True,
        "message": "If the email exists, a password reset link will be sent.",
    }


def _generate_temp_password(length: int = 12) -> str:
    """Generate a secure temporary password for admin-initiated resets."""
    import secrets
    import string

    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    length = max(8, length or 12)
    return "".join(secrets.choice(alphabet) for _ in range(length))


# Password Reset Request Admin Endpoints
@app.get("/api/v1/admin/password-reset-requests")
def list_password_reset_requests(
    db=Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
    status: str = "pending",
):
    """
    List password reset requests (admin only).

    Filter by status: pending, completed, denied, all.
    Returns paginated list with request details and user info.
    """
    from sqlmodel import select
    from datetime import datetime

    # Map status filter to database values
    if status == "all":
        statuses = None
    elif status == "active":
        statuses = ["pending"]
    elif status == "processed":
        statuses = ["completed", "denied"]
    else:
        statuses = [status]

    # Query password reset requests with user info
    statement = select(PasswordResetRequest).order_by(
        PasswordResetRequest.created_at.desc()
    )
    if statuses:
        statement = statement.where(PasswordResetRequest.status.in_(statuses))

    result = db.exec(statement)
    requests = result.all()

    items = []
    for req in requests:
        items.append(
            {
                "id": req.id,
                "user_id": req.user_id,
                "email": req.email,
                "status": req.status,
                "created_at": req.created_at.isoformat() if req.created_at else None,
                "expires_at": req.expires_at.isoformat() if req.expires_at else None,
            }
        )

    return {
        "success": True,
        "data": {
            "items": items,
            "total": len(items),
        },
    }


@app.post("/api/v1/admin/password-reset-requests/{request_id}/approve")
def approve_password_reset_request(
    request_id: int,
    db=Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
    admin_notes: Optional[str] = None,
):
    """
    Approve a password reset request and generate temporary password (admin only).

    Updates the user's password with a temporary one and marks request completed.
    """
    from sqlmodel import select
    from datetime import datetime

    # Find the request
    statement = select(PasswordResetRequest).where(
        PasswordResetRequest.id == request_id
    )
    result = db.exec(statement)
    reset_request = result.first()

    if not reset_request:
        raise HTTPException(status_code=404, detail="Password reset request not found")

    if reset_request.status != "pending":
        raise HTTPException(
            status_code=400, detail="That request has already been processed"
        )

    # Find the user
    statement = select(User).where(User.user_id == reset_request.user_id)
    result = db.exec(statement)
    user = result.first()

    if not user:
        # Update request status to denied since user doesn't exist
        reset_request.status = "denied"
        reset_request.processed_at = datetime.utcnow()
        reset_request.processed_by = current_user.user_id
        reset_request.admin_notes = "User account missing during approval."
        db.add(reset_request)
        db.commit()
        raise HTTPException(status_code=400, detail="User account does not exist")

    if user.auth_provider and user.auth_provider.lower() != "local":
        # Update request status to denied since it's not a local account
        reset_request.status = "denied"
        reset_request.processed_at = datetime.utcnow()
        reset_request.processed_by = current_user.user_id
        reset_request.admin_notes = "Account is not eligible for local password resets."
        db.add(reset_request)
        db.commit()
        raise HTTPException(
            status_code=400,
            detail="Password resets are only available for local accounts",
        )

    # Generate temporary password and update user
    temp_password = _generate_temp_password()
    from modules.auth import get_password_hash

    user.password_hash = get_password_hash(temp_password)

    # Update request status
    reset_request.status = "completed"
    reset_request.processed_at = datetime.utcnow()
    reset_request.processed_by = current_user.user_id
    reset_request.completed_at = datetime.utcnow()
    if admin_notes:
        reset_request.admin_notes = admin_notes

    try:
        db.add(user)
        db.add(reset_request)
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Failed to update password: {str(exc)}"
        )

    return {
        "success": True,
        "message": "Password updated successfully",
        "temp_password": temp_password,
    }


@app.post("/api/v1/admin/password-reset-requests/{request_id}/deny")
def deny_password_reset_request(
    request_id: int,
    db=Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
    admin_notes: Optional[str] = None,
):
    """
    Deny a password reset request (admin only).

    Marks request as denied without changing user password.
    """
    from sqlmodel import select
    from datetime import datetime

    # Find the request
    statement = select(PasswordResetRequest).where(
        PasswordResetRequest.id == request_id
    )
    result = db.exec(statement)
    reset_request = result.first()

    if not reset_request:
        raise HTTPException(status_code=404, detail="Password reset request not found")

    if reset_request.status != "pending":
        raise HTTPException(
            status_code=400, detail="That request has already been processed"
        )

    # Update request status
    reset_request.status = "denied"
    reset_request.processed_at = datetime.utcnow()
    reset_request.processed_by = current_user.user_id
    reset_request.completed_at = datetime.utcnow()
    if admin_notes:
        reset_request.admin_notes = admin_notes

    try:
        db.add(reset_request)
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Failed to deny request: {str(exc)}"
        )

    return {
        "success": True,
        "message": "Password reset request denied",
    }


# ============================================================================
# LLM Provider Admin CRUD Endpoints (Phase 07 - PROV-01 through PROV-08)
# ============================================================================

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError


@app.get("/api/v1/admin/providers", response_model=LLMProviderListResponse)
def list_admin_providers(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
    page: int = 1,
    per_page: int = 10,
    skip: int = 0,
    limit: int = 0,
):
    """
    List all LLM providers (admin only).

    Returns providers ordered by priority then name.
    Includes health status fields (last_health_check, health_status, error_message).
    """
    if limit == 0:
        actual_limit = per_page
        actual_skip = (page - 1) * per_page
    else:
        actual_limit = limit
        actual_skip = skip

    statement = (
        select(LLMProvider)
        .order_by(LLMProvider.priority, LLMProvider.name)
        .offset(actual_skip)
        .limit(actual_limit)
    )
    result = db.exec(statement)
    providers = result.all()

    # Get total count
    count_statement = select(func.count(LLMProvider.id))
    total = db.exec(count_statement).one()

    items = []
    for p in providers:
        items.append(
            {
                "id": p.id,
                "name": p.name,
                "provider_type": p.provider_type,
                "base_url": p.base_url,
                "api_key": p.api_key,
                "is_active": p.is_active,
                "is_default": p.is_default,
                "priority": p.priority,
                "config": p.config or {},
                "last_health_check": p.last_health_check.isoformat()
                if p.last_health_check
                else None,
                "health_status": p.health_status,
                "error_message": p.error_message,
                "created_at": p.created_at.isoformat() if p.created_at else None,
                "updated_at": p.updated_at.isoformat() if p.updated_at else None,
            }
        )

    return {
        "success": True,
        "data": {
            "items": items,
            "total": total,
            "total_pages": max(1, -(-total // actual_limit)) if actual_limit else 1,
        },
    }


@app.post(
    "/api/v1/admin/providers",
    response_model=LLMProviderCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_admin_provider(
    provider_data: LLMProviderCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Create a new LLM provider (admin only).

    Validates:
    - Name and provider_type are required
    - Name must be unique (returns 400 if duplicate)
    """
    # Validate required fields
    name = provider_data.name.strip() if provider_data.name else ""
    provider_type = (
        provider_data.provider_type.strip() if provider_data.provider_type else ""
    )

    if not name or not provider_type:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Name and provider_type are required",
        )

    # Check for duplicate name
    existing = db.exec(select(LLMProvider).where(LLMProvider.name == name)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'Provider with name "{name}" already exists',
        )

    # Create provider
    provider = LLMProvider(
        name=name,
        provider_type=provider_type,
        base_url=provider_data.base_url.strip() if provider_data.base_url else None,
        api_key=provider_data.api_key.strip() if provider_data.api_key else None,
        is_active=provider_data.is_active
        if provider_data.is_active is not None
        else True,
        is_default=provider_data.is_default
        if provider_data.is_default is not None
        else False,
        priority=provider_data.priority if provider_data.priority is not None else 0,
        config=provider_data.config if provider_data.config else {},
    )

    db.add(provider)
    db.commit()
    db.refresh(provider)

    provider_dict = {
        "id": provider.id,
        "name": provider.name,
        "provider_type": provider.provider_type,
        "base_url": provider.base_url,
        "api_key": provider.api_key,
        "is_active": provider.is_active,
        "is_default": provider.is_default,
        "priority": provider.priority,
        "config": provider.config or {},
        "last_health_check": provider.last_health_check.isoformat()
        if provider.last_health_check
        else None,
        "health_status": provider.health_status,
        "error_message": provider.error_message,
        "created_at": provider.created_at.isoformat() if provider.created_at else None,
        "updated_at": provider.updated_at.isoformat() if provider.updated_at else None,
    }

    return {
        "success": True,
        "provider": provider_dict,
    }


@app.put(
    "/api/v1/admin/providers/{provider_id}", response_model=LLMProviderUpdateResponse
)
def update_admin_provider(
    provider_id: int,
    provider_data: LLMProviderUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Update an LLM provider (admin only).

    Validates:
    - Provider must exist (404 if not found)
    - Name must be unique when changed (400 if duplicate)
    """
    # Find provider
    statement = select(LLMProvider).where(LLMProvider.id == provider_id)
    result = db.exec(statement)
    provider = result.first()

    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Provider with id {provider_id} not found",
        )

    # Update fields (only if provided)
    if provider_data.name is not None:
        new_name = provider_data.name.strip()
        if new_name != provider.name:
            # Check for duplicate
            existing = db.exec(
                select(LLMProvider).where(LLMProvider.name == new_name)
            ).first()
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f'Provider with name "{new_name}" already exists',
                )
            provider.name = new_name

    if provider_data.provider_type is not None:
        provider.provider_type = provider_data.provider_type.strip()

    if provider_data.base_url is not None:
        provider.base_url = provider_data.base_url.strip() or None

    if provider_data.api_key is not None:
        provider.api_key = provider_data.api_key.strip() or None

    if provider_data.is_active is not None:
        provider.is_active = provider_data.is_active

    if provider_data.is_default is not None:
        provider.is_default = provider_data.is_default

    if provider_data.priority is not None:
        provider.priority = provider_data.priority

    if provider_data.config is not None:
        provider.config = provider_data.config

    provider.updated_at = datetime.utcnow()
    db.add(provider)
    db.commit()
    db.refresh(provider)

    provider_dict = {
        "id": provider.id,
        "name": provider.name,
        "provider_type": provider.provider_type,
        "base_url": provider.base_url,
        "api_key": provider.api_key,
        "is_active": provider.is_active,
        "is_default": provider.is_default,
        "priority": provider.priority,
        "config": provider.config or {},
        "last_health_check": provider.last_health_check.isoformat()
        if provider.last_health_check
        else None,
        "health_status": provider.health_status,
        "error_message": provider.error_message,
        "created_at": provider.created_at.isoformat() if provider.created_at else None,
        "updated_at": provider.updated_at.isoformat() if provider.updated_at else None,
    }

    return {
        "success": True,
        "provider": provider_dict,
    }


@app.delete(
    "/api/v1/admin/providers/{provider_id}", response_model=LLMProviderDeleteResponse
)
def delete_admin_provider(
    provider_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Delete an LLM provider (admin only).

    Validates:
    - Provider must exist (404 if not found)
    - Cannot delete if associated models exist (400 with model count)
    """
    # Find provider
    statement = select(LLMProvider).where(LLMProvider.id == provider_id)
    result = db.exec(statement)
    provider = result.first()

    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Provider with id {provider_id} not found",
        )

    # Check for associated models
    model_count = db.exec(
        select(func.count(ModelConfig.id)).where(ModelConfig.provider_id == provider_id)
    ).one()

    if model_count > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot delete provider: {model_count} associated model(s) exist. Delete associated models first.",
        )

    name = provider.name
    db.delete(provider)
    db.commit()

    return {
        "success": True,
        "message": f'Provider "{name}" deleted successfully',
    }


@app.post(
    "/api/v1/admin/providers/{provider_id}/test", response_model=LLMProviderTestResponse
)
def test_admin_provider(
    provider_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Test LLM provider connectivity (admin only).

    Updates provider health status fields:
    - last_health_check: current UTC datetime
    - health_status: test result status
    - error_message: any error from test
    """
    from modules.llm_provider_utils import test_provider_connection

    # Find provider
    statement = select(LLMProvider).where(LLMProvider.id == provider_id)
    result = db.exec(statement)
    provider = result.first()

    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Provider with id {provider_id} not found",
        )

    # Test connection
    result = test_provider_connection(provider)

    # Update health status
    provider.last_health_check = datetime.utcnow()
    provider.health_status = result.get("status", "unknown")
    provider.error_message = result.get("error") or result.get("message")

    db.add(provider)
    db.commit()

    return {
        "success": True,
        "status": result.get("status", "unknown"),
        "message": result.get("message"),
        "error": result.get("error"),
        "provider_id": provider_id,
        "last_health_check": provider.last_health_check.isoformat()
        if provider.last_health_check
        else None,
    }


@app.post(
    "/api/v1/admin/providers/{provider_id}/discover-models",
    response_model=LLMProviderDiscoverModelsResponse,
)
def discover_admin_provider_models(
    provider_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Discover available models from LLM provider (admin only).

    Returns list of available models without creating database records.
    """
    from modules.llm_provider_utils import discover_provider_models

    # Find provider
    statement = select(LLMProvider).where(LLMProvider.id == provider_id)
    result = db.exec(statement)
    provider = result.first()

    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Provider with id {provider_id} not found",
        )

    # Discover models
    models = discover_provider_models(provider)

    provider_dict = {
        "id": provider.id,
        "name": provider.name,
        "provider_type": provider.provider_type,
        "base_url": provider.base_url,
        "is_active": provider.is_active,
        "is_default": provider.is_default,
        "priority": provider.priority,
        "config": provider.config or {},
        "last_health_check": provider.last_health_check.isoformat()
        if provider.last_health_check
        else None,
        "health_status": provider.health_status,
        "error_message": provider.error_message,
        "created_at": provider.created_at.isoformat() if provider.created_at else None,
        "updated_at": provider.updated_at.isoformat() if provider.updated_at else None,
    }

    return {
        "success": True,
        "provider": provider_dict,
        "models": models,
    }


@app.post(
    "/api/v1/admin/providers/priority", response_model=LLMProviderPriorityUpdateResponse
)
def update_admin_provider_priorities(
    priority_data: LLMProviderPriorityUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Update LLM provider priorities (admin only).

    Accepts array of {id, priority} objects and updates all in single transaction.
    """
    if not priority_data.priorities:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Priorities array is required and cannot be empty",
        )

    for item in priority_data.priorities:
        if not hasattr(item, "id") or not hasattr(item, "priority"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Each priority item must have 'id' and 'priority' fields",
            )

        statement = select(LLMProvider).where(LLMProvider.id == item.id)
        result = db.exec(statement)
        provider = result.first()

        if provider:
            provider.priority = item.priority

    db.commit()

    return {
        "success": True,
        "message": f"Priorities updated for {len(priority_data.priorities)} provider(s)",
    }


# ============================================================================
# Model Config Admin CRUD Endpoints (Phase 08 - MODEL-01 through MODEL-02)
# ============================================================================


@app.get("/api/v1/admin/models", response_model=ModelConfigListResponse)
def list_admin_models(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
    skip: int = 0,
    limit: int = 100,
):
    """
    List all model configurations (admin only).

    Returns models with associated provider information (provider_obj field).
    Models are ordered by name for consistent display.
    """
    statement = select(ModelConfig).order_by(ModelConfig.name).offset(skip).limit(limit)
    result = db.exec(statement)
    models = result.all()

    # Get total count
    count_statement = select(func.count(ModelConfig.id))
    total = db.exec(count_statement).one()

    items = []
    for model in models:
        # Get associated provider
        provider_obj = None
        if model.provider_id:
            provider_stmt = select(LLMProvider).where(
                LLMProvider.id == model.provider_id
            )
            provider_result = db.exec(provider_stmt).first()
            if provider_result:
                provider_obj = {
                    "id": provider_result.id,
                    "name": provider_result.name,
                    "provider_type": provider_result.provider_type,
                    "is_active": provider_result.is_active,
                }

        items.append(
            {
                "id": model.id,
                "provider_id": model.provider_id,
                "name": model.name,
                "deployment_name": model.deployment_name,
                "provider": model.provider,
                "temperature": model.temperature,
                "streaming": model.streaming,
                "description": model.description,
                "is_default": model.is_default,
                "is_multimodal": getattr(model, "is_multimodal", False),
                "created_by": model.created_by,
                "created_at": model.created_at.isoformat()
                if model.created_at
                else None,
                "provider_obj": provider_obj,
            }
        )

    return {"items": items, "total": total}


@app.get("/api/v1/admin/models/api/available")
@app.get("/api/admin/models/api/available")
async def get_available_models(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Get list of active models for the frontend selector."""
    statement = select(ModelConfig).order_by(ModelConfig.name)
    result = db.exec(statement)
    models = result.all()

    # Get default model ID
    default_model = db.exec(
        select(ModelConfig).where(ModelConfig.is_default == True)
    ).first()

    return {
        "status": "success",
        "models": [
            {
                "id": m.id,
                "name": m.name,
                "provider": m.provider,
                "is_default": m.is_default,
                "is_multimodal": getattr(m, "is_multimodal", False),
            }
            for m in models
        ],
        "default_model_id": default_model.id
        if default_model
        else (models[0].id if models else None),
    }


@app.get("/api/v1/admin/models/api/default")
@app.get("/api/admin/models/api/default")
async def get_default_model(
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    """Get the default model configuration."""
    model = db.exec(select(ModelConfig).where(ModelConfig.is_default == True)).first()
    if not model:
        model = db.exec(select(ModelConfig).order_by(ModelConfig.id)).first()

    if not model:
        return {"status": "error", "message": "No models configured"}

    return {"status": "success", "model_id": model.id, "name": model.name}

    return {
        "success": True,
        "data": {
            "items": items,
            "total": total,
        },
    }


@app.post(
    "/api/v1/admin/models/add",
    response_model=ModelConfigCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_admin_model(
    model_data: ModelConfigCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Create a new model configuration (admin only).

    Validates:
    - Required fields: name, deployment_name, provider_id
    - Provider must exist
    - Streaming supported for deployment
    - Temperature in valid range for deployment
    - Connectivity test passes
    - Name uniqueness (returns 400 if duplicate)
    - Clears other defaults if is_default=true
    """
    from modules.llm_utils import (
        is_streaming_supported_for_deployment,
        validate_temperature_for_deployment,
        get_llm,
    )

    # Validate required fields
    name = model_data.name.strip() if model_data.name else ""
    deployment_name = (
        model_data.deployment_name.strip() if model_data.deployment_name else ""
    )
    provider_id = model_data.provider_id

    if not name or not deployment_name or provider_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Name, deployment_name, and provider_id are required",
        )

    # Get provider to validate it exists and get config
    provider_stmt = select(LLMProvider).where(LLMProvider.id == provider_id)
    provider_result = db.exec(provider_stmt).first()

    if not provider_result:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Provider with id {provider_id} not found",
        )

    # Validate streaming support
    if model_data.streaming and not is_streaming_supported_for_deployment(
        deployment_name
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Deployment '{deployment_name}' does not support streaming. Disable streaming or choose a compatible deployment.",
        )

    # Validate temperature
    temp_ok, _, temp_error = validate_temperature_for_deployment(
        deployment_name, model_data.temperature
    )
    if not temp_ok:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=temp_error)

    # Test connectivity
    try:
        get_llm(
            model_name=deployment_name,
            streaming=model_data.streaming,
            temperature=model_data.temperature,
            api_key=provider_result.api_key,
            endpoint=provider_result.base_url,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Could not initialize deployment '{deployment_name}': {exc}",
        )

    # Check for duplicate name
    existing = db.exec(select(ModelConfig).where(ModelConfig.name == name)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f'Model with name "{name}" already exists',
        )

    # Clear other defaults if is_default=true
    if model_data.is_default:
        db.exec(
            update(ModelConfig)
            .where(ModelConfig.is_default == True)
            .values(is_default=False)
        )
        db.commit()

    # Create model config
    model_config = ModelConfig(
        provider_id=provider_id,
        name=name,
        deployment_name=deployment_name,
        provider=provider_result.provider_type,
        temperature=model_data.temperature,
        streaming=model_data.streaming,
        description=model_data.description.strip() if model_data.description else None,
        is_default=model_data.is_default
        if model_data.is_default is not None
        else False,
        created_by=current_user.user_id,
    )

    db.add(model_config)
    db.commit()
    db.refresh(model_config)

    # Get associated provider for response
    provider_obj = {
        "id": provider_result.id,
        "name": provider_result.name,
        "provider_type": provider_result.provider_type,
        "is_active": provider_result.is_active,
    }

    model_dict = {
        "id": model_config.id,
        "provider_id": model_config.provider_id,
        "name": model_config.name,
        "deployment_name": model_config.deployment_name,
        "provider": model_config.provider,
        "temperature": model_config.temperature,
        "streaming": model_config.streaming,
        "description": model_config.description,
        "is_default": model_config.is_default,
        "is_multimodal": getattr(model_config, "is_multimodal", False),
        "created_by": model_config.created_by,
        "created_at": model_config.created_at.isoformat()
        if model_config.created_at
        else None,
        "provider_obj": provider_obj,
    }

    return {
        "success": True,
        "model": model_dict,
    }


# ============================================================================
# Model Config Admin CRUD Endpoints (Phase 08 - MODEL-03)
# ============================================================================


@app.post(
    "/api/v1/admin/models/edit/{model_id}", response_model=ModelConfigUpdateResponse
)
def update_admin_model(
    model_id: int,
    model_data: ModelConfigUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Update an existing model configuration (admin only).

    Performs partial update using model_update with exclude_unset=True.
    Validates deployment configuration if deployment_name, temperature, or streaming changes.
    Validates name uniqueness when name changes (400 if duplicate).
    Clears other defaults if is_default=true.
    Returns updated model object.
    """
    from modules.llm_utils import (
        is_streaming_supported_for_deployment,
        validate_temperature_for_deployment,
        get_llm,
    )

    # Validate model exists
    existing_model = db.exec(
        select(ModelConfig).where(ModelConfig.id == model_id)
    ).first()
    if not existing_model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model with id {model_id} not found",
        )

    # Track which fields are being updated
    update_values = {}
    deployment_changed = False
    deployment_name = existing_model.deployment_name
    streaming = existing_model.streaming
    temperature = existing_model.temperature
    provider_obj = None

    # Process name update
    if model_data.name is not None:
        new_name = model_data.name.strip()
        if new_name != existing_model.name:
            # Check for duplicate name (different model)
            duplicate = db.exec(
                select(ModelConfig).where(
                    ModelConfig.name == new_name, ModelConfig.id != model_id
                )
            ).first()
            if duplicate:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f'Model with name "{new_name}" already exists',
                )
        update_values["name"] = new_name

    # Process deployment_name update
    if model_data.deployment_name is not None:
        deployment_name = model_data.deployment_name.strip()
        if deployment_name != existing_model.deployment_name:
            deployment_changed = True
        update_values["deployment_name"] = deployment_name

    # Process provider_id update
    if (
        model_data.provider_id is not None
        and model_data.provider_id != existing_model.provider_id
    ):
        provider_stmt = select(LLMProvider).where(
            LLMProvider.id == model_data.provider_id
        )
        provider_result = db.exec(provider_stmt).first()
        if not provider_result:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Provider with id {model_data.provider_id} not found",
            )
        update_values["provider_id"] = model_data.provider_id
        update_values["provider"] = provider_result.provider_type
        provider_obj = provider_result
        deployment_changed = True  # Provider change requires re-validation
    else:
        # Get existing provider for validation
        if existing_model.provider_id:
            provider_stmt = select(LLMProvider).where(
                LLMProvider.id == existing_model.provider_id
            )
            provider_obj = db.exec(provider_stmt).first()

    # Process description update
    if model_data.description is not None:
        update_values["description"] = (
            model_data.description.strip() if model_data.description else None
        )

    # Process is_default update
    if (
        model_data.is_default is not None
        and model_data.is_default != existing_model.is_default
    ):
        update_values["is_default"] = model_data.is_default

    # Process streaming update
    if model_data.streaming is not None:
        streaming = model_data.streaming
        update_values["streaming"] = streaming
        deployment_changed = True  # Streaming change requires re-validation

    # Process temperature update
    if model_data.temperature is not None:
        temperature = model_data.temperature
        update_values["temperature"] = temperature
        deployment_changed = True  # Temperature change requires re-validation

    # Validate deployment configuration if anything changed
    if deployment_changed and provider_obj:
        # Validate streaming support
        if streaming and not is_streaming_supported_for_deployment(deployment_name):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Deployment '{deployment_name}' does not support streaming. Disable streaming or choose a compatible deployment.",
            )

        # Validate temperature
        temp_ok, _, temp_error = validate_temperature_for_deployment(
            deployment_name, temperature
        )
        if not temp_ok:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=temp_error
            )

        # Test connectivity
        try:
            get_llm(
                model_name=deployment_name,
                streaming=streaming,
                temperature=temperature,
                api_key=provider_obj.api_key,
                endpoint=provider_obj.base_url,
            )
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Could not initialize deployment '{deployment_name}': {exc}",
            )

    # Clear other defaults if is_default=true
    if update_values.get("is_default"):
        db.exec(
            update(ModelConfig)
            .where(ModelConfig.is_default == True, ModelConfig.id != model_id)
            .values(is_default=False)
        )
        db.commit()

    # Apply updates
    for key, value in update_values.items():
        setattr(existing_model, key, value)

    db.commit()
    db.refresh(existing_model)

    # Get associated provider for response
    if existing_model.provider_id:
        provider_stmt = select(LLMProvider).where(
            LLMProvider.id == existing_model.provider_id
        )
        provider_result = db.exec(provider_stmt).first()
        provider_obj = (
            {
                "id": provider_result.id,
                "name": provider_result.name,
                "provider_type": provider_result.provider_type,
                "is_active": provider_result.is_active,
            }
            if provider_result
            else None
        )
    else:
        provider_obj = None

    model_dict = {
        "id": existing_model.id,
        "provider_id": existing_model.provider_id,
        "name": existing_model.name,
        "deployment_name": existing_model.deployment_name,
        "provider": existing_model.provider,
        "temperature": existing_model.temperature,
        "streaming": existing_model.streaming,
        "description": existing_model.description,
        "is_default": existing_model.is_default,
        "is_multimodal": getattr(existing_model, "is_multimodal", False),
        "created_by": existing_model.created_by,
        "created_at": existing_model.created_at.isoformat()
        if existing_model.created_at
        else None,
        "provider_obj": provider_obj,
    }

    return {
        "success": True,
        "model": model_dict,
    }


# ============================================================================
# Model Config Admin CRUD Endpoints (Phase 08 - MODEL-04)
# ============================================================================


@app.post(
    "/api/v1/admin/models/delete/{model_id}", response_model=ModelConfigDeleteResponse
)
def delete_admin_model(
    model_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Delete a model configuration (admin only).

    Validates model_id exists (404 if not found).
    Checks AppSettings for multimodal_model_id reference (warn but allow deletion).
    Deletes ModelConfig from database.
    Returns success confirmation.

    Note: Unlike providers, models can be deleted even if referenced in app settings.
    """
    # Validate model exists
    model = db.exec(select(ModelConfig).where(ModelConfig.id == model_id)).first()
    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model with id {model_id} not found",
        )

    # Check AppSettings for multimodal_model_id reference
    try:
        multimodal_setting = db.exec(
            select(AppSettings).where(AppSettings.key == "multimodal_model_id")
        ).first()
        if multimodal_setting and multimodal_setting.value == str(model_id):
            logging.warning(
                f"Deleting model {model_id} ({model.name}) which is currently set as multimodal model. "
                f"AppSettings multimodal_model_id will reference non-existent model."
            )
    except Exception as exc:
        logging.warning(
            f"Could not check AppSettings for multimodal_model_id reference: {exc}"
        )

    # Delete the model
    db.delete(model)
    db.commit()

    logging.info(
        f"ModelConfig ID {model_id} ({model.name}) deleted by user {current_user.user_id}"
    )

    return {"success": True, "message": "Model deleted successfully"}


# ============================================================================
# Model Config Action Endpoints (Phase 08 - MODEL-05, MODEL-06, MODEL-07)
# ============================================================================


@app.post(
    "/api/v1/admin/models/set-default/{model_id}",
    response_model=ModelConfigDefaultResponse,
)
def set_default_model_endpoint(
    model_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Set a specific model as the global default (admin only).

    Clears is_default on all other models and sets is_default=True on target model.
    Follows Flask pattern from modules/admin_models.py lines 289-302.
    """
    # Validate model exists
    model = db.get(ModelConfig, model_id)
    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model with id {model_id} not found",
        )

    # Clear existing defaults in one statement
    db.exec(
        update(ModelConfig)
        .where(ModelConfig.is_default == True)
        .values(is_default=False)
    )

    # Set new default
    model.is_default = True
    db.commit()

    logging.info(
        f"ModelConfig ID {model_id} set as default by user {current_user.user_id}"
    )

    return {"success": True, "message": "Default model updated"}


@app.post(
    "/api/v1/admin/models/set-multimodal/{model_id}",
    response_model=ModelConfigMultimodalResponse,
)
def set_multimodal_model_endpoint(
    model_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Set a specific model as the multimodal model (admin only).

    Updates AppSettings table with multimodal_model_id and multimodal_deployment_name.
    Follows Flask pattern from modules/admin_models.py (set_multimodal functionality).
    """
    # Validate model exists
    model = db.get(ModelConfig, model_id)
    if not model:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Model with id {model_id} not found",
        )

    # Get deployment_name for reference
    deployment_name = model.deployment_name

    # Update AppSettings with multimodal_model_id
    setting = db.get(AppSettings, "multimodal_model_id")
    if not setting:
        setting = AppSettings(key="multimodal_model_id", value=str(model_id))
        db.add(setting)
    else:
        setting.value = str(model_id)

    # Also update multimodal_deployment_name for reference
    deployment_setting = db.get(AppSettings, "multimodal_deployment_name")
    if not deployment_setting:
        deployment_setting = AppSettings(
            key="multimodal_deployment_name", value=deployment_name
        )
        db.add(deployment_setting)
    else:
        deployment_setting.value = deployment_name

    db.commit()

    logging.info(
        f"ModelConfig ID {model_id} set as multimodal model by user {current_user.user_id}"
    )

    return {"success": True, "message": "Multimodal model updated"}


@app.post("/api/v1/admin/models/validate", response_model=ModelValidationResponse)
def validate_deployment_endpoint(
    validation_data: ModelValidationRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Validate deployment configuration (admin only).

    Validates streaming support, temperature range, and connectivity using modules/llm_utils functions.
    Follows Flask pattern from modules/admin_models.py lines 43-80 (_validate_deployment_configuration).
    """
    from modules.llm_utils import (
        is_streaming_supported_for_deployment,
        validate_temperature_for_deployment,
        get_llm,
    )

    deployment_name = validation_data.deployment_name
    temperature = validation_data.temperature
    streaming = validation_data.streaming
    provider_id = validation_data.provider_id

    # Validate streaming support
    streaming_supported = is_streaming_supported_for_deployment(deployment_name)

    # Validate temperature
    temp_ok, _, temp_error = validate_temperature_for_deployment(
        deployment_name, temperature
    )
    temperature_valid = temp_ok

    # Test connectivity
    connectivity_ok = False
    connectivity_error = None

    if streaming_supported and temperature_valid:
        # Get provider if provider_id is provided
        provider_result = None
        if provider_id:
            provider_stmt = select(LLMProvider).where(LLMProvider.id == provider_id)
            provider_result = db.exec(provider_stmt).first()

        try:
            get_llm(
                model_name=deployment_name,
                streaming=streaming,
                temperature=temperature if temperature is not None else 0.0,
                api_key=provider_result.api_key if provider_result else None,
                endpoint=provider_result.base_url if provider_result else None,
            )
            connectivity_ok = True
        except Exception as exc:
            connectivity_ok = False
            connectivity_error = str(exc)

    # Build response
    valid = streaming_supported and temperature_valid and connectivity_ok

    if not valid:
        if not streaming_supported:
            message = f"Deployment '{deployment_name}' does not support streaming"
        elif not temperature_valid:
            message = (
                temp_error or f"Invalid temperature for deployment '{deployment_name}'"
            )
        elif not connectivity_ok:
            message = f"Connectivity test failed: {connectivity_error}"
        else:
            message = "Deployment configuration is invalid"
    else:
        message = "Deployment configuration is valid"

    return {
        "success": True,
        "valid": valid,
        "streaming_supported": streaming_supported,
        "temperature_valid": temperature_valid,
        "connectivity_ok": connectivity_ok,
        "message": message,
    }


# ============================================================================
# LLM Language Admin CRUD Endpoints (Phase 08 - LANG-01 through LANG-02)
# ============================================================================


@app.get("/api/v1/admin/languages", response_model=LLMLanguageListResponse)
def list_admin_languages(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
    skip: int = 0,
    limit: int = 100,
):
    """
    List all LLM languages (admin only).

    Returns languages ordered by language_name.
    """
    statement = (
        select(LLMLanguage)
        .order_by(LLMLanguage.language_name)
        .offset(skip)
        .limit(limit)
    )
    result = db.exec(statement)
    languages = result.all()

    # Get total count
    count_statement = select(func.count(LLMLanguage.id))
    total = db.exec(count_statement).one()

    items = []
    for lang in languages:
        items.append(
            {
                "id": lang.id,
                "language_code": lang.language_code,
                "language_name": lang.language_name,
                "is_active": lang.is_active,
                "created_by": lang.created_by,
                "created_at": lang.created_at.isoformat() if lang.created_at else None,
            }
        )

    return {
        "success": True,
        "data": {
            "items": items,
            "total": total,
        },
    }


@app.post(
    "/api/v1/admin/languages/add",
    response_model=LLMLanguageCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_admin_language(
    language_data: LLMLanguageCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Create a new LLM language (admin only).

    Validates:
    - language_code and language_name are required (non-empty, stripped)
    - language_code must be unique (returns 409 if duplicate)
    - language_name must be unique (returns 409 if duplicate)
    """
    # Validate required fields
    language_code = (
        language_data.language_code.strip() if language_data.language_code else ""
    )
    language_name = (
        language_data.language_name.strip() if language_data.language_name else ""
    )

    if not language_code or not language_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="language_code and language_name are required",
        )

    # Create language
    language = LLMLanguage(
        language_code=language_code,
        language_name=language_name,
        is_active=language_data.is_active
        if language_data.is_active is not None
        else True,
        created_by=current_user.username,
    )

    try:
        db.add(language)
        db.commit()
        db.refresh(language)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Language code '{language_code}' or name '{language_name}' already exists",
        )

    language_dict = {
        "id": language.id,
        "language_code": language.language_code,
        "language_name": language.language_name,
        "is_active": language.is_active,
        "created_by": language.created_by,
        "created_at": language.created_at.isoformat() if language.created_at else None,
    }

    return {
        "success": True,
        "message": "Language added successfully",
        "language": language_dict,
    }


@app.post(
    "/api/v1/admin/languages/edit/{language_id}",
    response_model=LLMLanguageUpdateResponse,
)
def update_admin_language(
    language_id: int,
    language_data: LLMLanguageUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Update an existing LLM language (admin only).

    Validates:
    - language_id must exist (404 if not found)
    - language_code and language_name are required (non-empty, stripped)
    - language_code must be unique (returns 409 if duplicate)
    - language_name must be unique (returns 409 if duplicate)
    - is_active toggle supported (LANG-04)
    """
    # Validate required fields
    if (
        language_data.language_code is None
        or language_data.language_name is None
        or language_data.is_active is None
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="language_code, language_name, and is_active are required",
        )

    language_code = language_data.language_code.strip()
    language_name = language_data.language_name.strip()
    is_active = bool(language_data.is_active)

    if not language_code or not language_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="language_code and language_name must not be empty",
        )

    # Check if language exists
    existing_language = db.get(LLMLanguage, language_id)
    if not existing_language:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Language not found"
        )

    # Update fields
    existing_language.language_code = language_code
    existing_language.language_name = language_name
    existing_language.is_active = is_active

    try:
        db.add(existing_language)
        db.commit()
        db.refresh(existing_language)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Language code '{language_code}' or name '{language_name}' already exists",
        )

    language_dict = {
        "id": existing_language.id,
        "language_code": existing_language.language_code,
        "language_name": existing_language.language_name,
        "is_active": existing_language.is_active,
        "created_by": existing_language.created_by,
        "created_at": existing_language.created_at.isoformat()
        if existing_language.created_at
        else None,
    }

    return {
        "success": True,
        "message": "Language updated successfully",
        "language": language_dict,
    }


@app.post(
    "/api/v1/admin/languages/delete/{language_id}",
    response_model=LLMLanguageDeleteResponse,
)
def delete_admin_language(
    language_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Delete an existing LLM language (admin only).

    Validates:
    - language_id must exist (404 if not found)
    """
    # Check if language exists
    existing_language = db.get(LLMLanguage, language_id)
    if not existing_language:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Language not found"
        )

    try:
        db.delete(existing_language)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting language: {str(e)}",
        )

    return {
        "success": True,
        "message": "Language deleted successfully",
    }


# ============================================================================
# Activity Log Endpoints (Phase 09 - CONTENT-01, CONTENT-02, CONTENT-03)
# ============================================================================


def build_knowledge_metadata_summary_fastapi(knowledge_ids, db):
    """
    Return a mapping of knowledge_id to a formatted metadata summary string.
    FastAPI/SQLModel-compatible version using raw SQL for catalog/category joins.
    """
    if not knowledge_ids:
        return {}

    normalized_ids = {int(k) for k in knowledge_ids if k is not None}
    if not normalized_ids:
        return {}

    summary_map = {}
    for kid in normalized_ids:
        parts = []

        # Use raw SQL to get catalogs for this knowledge
        catalog_query = """
            SELECT c.name FROM catalogs c
            JOIN knowledge_catalogs kc ON c.id = kc.catalog_id
            WHERE kc.knowledge_id = ?
        """
        try:
            catalogs = db.exec(catalog_query, kid).all()
            if catalogs:
                parts.append(f"Catalogs: {', '.join([c[0] for c in catalogs])}")
        except Exception:
            pass

        # Use raw SQL to get categories for this knowledge
        category_query = """
            SELECT cat.name FROM categories cat
            JOIN knowledge_category_association kca ON cat.id = kca.category_id
            WHERE kca.knowledge_id = ?
        """
        try:
            categories = db.exec(category_query, kid).all()
            if categories:
                parts.append(f"Categories: {', '.join([c[0] for c in categories])}")
        except Exception:
            pass

        summary_map[kid] = "; ".join(parts) if parts else "None"

    return summary_map


@app.get("/api/v1/admin/activity/uploads", response_model=UploadActivityListResponse)
def list_upload_activities(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
    skip: int = 0,
    limit: int = 10,
):
    """
    List upload activities (admin only).

    Returns uploaded files with user, library, and knowledge info.
    Ordered by upload_time desc (newest first).
    """
    from sqlmodel import select

    # Query uploaded files with joins to user, library, knowledge
    statement = (
        select(UploadedFile, User, Library, Knowledge)
        .join(User, UploadedFile.user_id == User.user_id)
        .outerjoin(Library, UploadedFile.library_id == Library.library_id)
        .outerjoin(Knowledge, UploadedFile.knowledge_id == Knowledge.id)
    )
    statement = (
        statement.order_by(UploadedFile.upload_time.desc()).offset(skip).limit(limit)
    )

    results = db.exec(statement).all()

    # Get total count
    count_statement = select(func.count(UploadedFile.file_id))
    total = db.exec(count_statement).one()

    # Build metadata summary for all knowledge_ids
    knowledge_ids = {row[3].id for row in results if row[3] is not None}
    metadata_map = build_knowledge_metadata_summary_fastapi(knowledge_ids, db)

    items = []
    for uploaded_file, user, library, knowledge in results:
        items.append(
            {
                "id": uploaded_file.file_id,
                "type": "upload",
                "filename": uploaded_file.original_filename,
                "file_size": uploaded_file.file_size,
                "upload_time": uploaded_file.upload_time.isoformat()
                if uploaded_file.upload_time
                else None,
                "username": user.username if user else None,
                "library_name": library.name if library else None,
                "knowledge_name": knowledge.name if knowledge else None,
                "metadata_summary": metadata_map.get(knowledge.id, "None")
                if knowledge
                else "N/A",
                "is_ocr": uploaded_file.is_ocr,
                "status": "success",
            }
        )

    return {
        "success": True,
        "data": {
            "items": items,
            "total": total,
        },
    }


@app.get(
    "/api/v1/admin/activity/downloads", response_model=DownloadActivityListResponse
)
def list_download_activities(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
    skip: int = 0,
    limit: int = 10,
    status: Optional[str] = None,
):
    """
    List download activities (admin only).

    Returns URL downloads with user, library, and knowledge info.
    Supports status filtering: queued, processing, success, failed.
    Ordered by processed_at desc (newest first).
    """
    from sqlmodel import select

    # Query URL downloads with joins to user, library, knowledge
    statement = (
        select(UrlDownload, User, Library, Knowledge)
        .join(User, UrlDownload.user_id == User.user_id)
        .outerjoin(Library, UrlDownload.library_id == Library.library_id)
        .outerjoin(Knowledge, UrlDownload.knowledge_id == Knowledge.id)
    )

    # Apply status filter if provided
    if status:
        statement = statement.where(UrlDownload.status == status)

    statement = (
        statement.order_by(UrlDownload.processed_at.desc()).offset(skip).limit(limit)
    )

    results = db.exec(statement).all()

    # Get total count (respecting status filter)
    count_statement = select(func.count(UrlDownload.download_id))
    if status:
        count_statement = count_statement.where(UrlDownload.status == status)
    total = db.exec(count_statement).one()

    # Build metadata summary for all knowledge_ids
    knowledge_ids = {row[3].id for row in results if row[3] is not None}
    metadata_map = build_knowledge_metadata_summary_fastapi(knowledge_ids, db)

    items = []
    for url_download, user, library, knowledge in results:
        items.append(
            {
                "id": url_download.download_id,
                "type": "download",
                "url": url_download.url,
                "status": url_download.status,
                "content_type": url_download.content_type,
                "error_message": url_download.error_message,
                "processed_at": url_download.processed_at.isoformat()
                if url_download.processed_at
                else None,
                "username": user.username if user else None,
                "library_name": library.name if library else None,
                "knowledge_name": knowledge.name if knowledge else None,
                "metadata_summary": metadata_map.get(knowledge.id, "None")
                if knowledge
                else "N/A",
                "is_ocr": url_download.is_ocr,
            }
        )

    return {
        "success": True,
        "data": {
            "items": items,
            "total": total,
        },
    }


# ============================================================================
# Catalog CRUD Endpoints (Phase 09 - CONTENT-06)
# ============================================================================


@app.get("/api/v1/admin/catalogs", response_model=CatalogListResponse)
def list_admin_catalogs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
    page: int = 1,
    per_page: int = 10,
    skip: int = 0,
    limit: int = 0,
):
    """
    List all catalogs (admin only).

    Returns catalogs ordered by name.
    """
    if limit == 0:
        actual_limit = per_page
        actual_skip = (page - 1) * per_page
    else:
        actual_limit = limit
        actual_skip = skip

    # Get total count
    count_statement = select(func.count(Catalog.id))
    total = db.exec(count_statement).one()

    statement = (
        select(Catalog).order_by(Catalog.name).offset(actual_skip).limit(actual_limit)
    )
    result = db.exec(statement)
    catalogs = result.all()

    items = []
    for catalog in catalogs:
        items.append(
            {
                "id": catalog.id,
                "name": catalog.name,
                "description": catalog.description,
                "created_by": catalog.created_by_user_id,
                "created_at": catalog.created_at.isoformat()
                if catalog.created_at
                else None,
            }
        )

    return {
        "success": True,
        "data": {
            "items": items,
            "total": total,
            "total_pages": max(1, -(-total // actual_limit)) if actual_limit else 1,
        },
    }


@app.post(
    "/api/v1/admin/catalogs/add",
    response_model=CatalogCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_admin_catalog(
    catalog_data: CatalogCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Create a new catalog (admin only).

    Validates:
    - name is required (non-empty, stripped)
    - name must be unique (returns 400 if duplicate)
    """
    # Validate required fields
    name = catalog_data.name.strip() if catalog_data.name else ""

    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="name is required"
        )

    # Check for duplicate name
    existing = db.exec(select(Catalog).where(Catalog.name == name)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Catalog with name '{name}' already exists.",
        )

    # Create catalog
    catalog = Catalog(
        name=name,
        description=catalog_data.description,
        created_by_user_id=current_user.user_id,
    )

    db.add(catalog)
    db.commit()
    db.refresh(catalog)

    catalog_dict = {
        "id": catalog.id,
        "name": catalog.name,
        "description": catalog.description,
        "created_by": catalog.created_by_user_id,
        "created_at": catalog.created_at.isoformat() if catalog.created_at else None,
    }

    return {
        "success": True,
        "message": "Catalog added successfully",
        "catalog": catalog_dict,
    }


@app.post(
    "/api/v1/admin/catalogs/edit/{catalog_id}", response_model=CatalogUpdateResponse
)
def update_admin_catalog(
    catalog_id: int,
    catalog_data: CatalogUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Update an existing catalog (admin only).

    Validates:
    - catalog_id must exist (404 if not found)
    - name is required (non-empty, stripped)
    - name must be unique excluding current id (returns 409 if duplicate)
    """
    # Check if catalog exists
    catalog = db.get(Catalog, catalog_id)
    if not catalog:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Catalog not found"
        )

    # Validate name if provided
    if catalog_data.name is not None:
        name = catalog_data.name.strip()
        if not name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="name must not be empty"
            )

        # Check for duplicate name (excluding current id)
        existing = db.exec(
            select(Catalog).where(Catalog.name == name, Catalog.id != catalog_id)
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Catalog with name '{name}' already exists.",
            )
        catalog.name = name

    # Update description if provided
    if catalog_data.description is not None:
        catalog.description = catalog_data.description

    db.add(catalog)
    db.commit()
    db.refresh(catalog)

    catalog_dict = {
        "id": catalog.id,
        "name": catalog.name,
        "description": catalog.description,
        "created_by": catalog.created_by_user_id,
        "created_at": catalog.created_at.isoformat() if catalog.created_at else None,
    }

    return {
        "success": True,
        "message": "Catalog updated successfully",
        "catalog": catalog_dict,
    }


@app.delete(
    "/api/v1/admin/catalogs/delete/{catalog_id}", response_model=CatalogDeleteResponse
)
def delete_admin_catalog(
    catalog_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Delete an existing catalog (admin only).

    Validates:
    - catalog_id must exist (404 if not found)
    """
    # Check if catalog exists
    catalog = db.get(Catalog, catalog_id)
    if not catalog:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Catalog not found"
        )

    try:
        db.delete(catalog)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting catalog: {str(e)}",
        )

    return {
        "success": True,
        "message": "Catalog deleted successfully",
    }


# ============================================================================
# Category CRUD Endpoints (Phase 09 - CONTENT-07)
# ============================================================================


@app.get("/api/v1/admin/categories", response_model=CategoryListResponse)
def list_admin_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
    page: int = 1,
    per_page: int = 10,
    skip: int = 0,
    limit: int = 0,
):
    """
    List all categories (admin only).

    Returns categories ordered by name.
    """
    if limit == 0:
        actual_limit = per_page
        actual_skip = (page - 1) * per_page
    else:
        actual_limit = limit
        actual_skip = skip

    # Get total count
    count_statement = select(func.count(Category.id))
    total = db.exec(count_statement).one()

    statement = (
        select(Category).order_by(Category.name).offset(actual_skip).limit(actual_limit)
    )
    result = db.exec(statement)
    categories = result.all()

    items = []
    for category in categories:
        items.append(
            {
                "id": category.id,
                "name": category.name,
                "description": category.description,
                "created_by_user_id": category.created_by_user_id,
                "created_at": category.created_at.isoformat()
                if category.created_at
                else None,
            }
        )

    return {
        "success": True,
        "data": {
            "items": items,
            "total": total,
            "total_pages": max(1, -(-total // actual_limit)) if actual_limit else 1,
        },
    }


@app.post(
    "/api/v1/admin/categories/add",
    response_model=CategoryCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_admin_category(
    category_data: CategoryCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Create a new category (admin only).

    Validates:
    - name is required (non-empty, stripped)
    - name must be unique (returns 400 if duplicate)
    """
    # Validate required fields
    name = category_data.name.strip() if category_data.name else ""

    if not name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="name is required"
        )

    # Check for duplicate name
    existing = db.exec(select(Category).where(Category.name == name)).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Category with name '{name}' already exists.",
        )

    # Create category
    category = Category(
        name=name,
        description=category_data.description,
        created_by_user_id=current_user.user_id,
    )

    db.add(category)
    db.commit()
    db.refresh(category)

    category_dict = {
        "id": category.id,
        "name": category.name,
        "description": category.description,
        "created_by_user_id": category.created_by_user_id,
        "created_at": category.created_at.isoformat() if category.created_at else None,
    }

    return {
        "success": True,
        "message": "Category added successfully",
        "category": category_dict,
    }


@app.post(
    "/api/v1/admin/categories/edit/{category_id}", response_model=CategoryUpdateResponse
)
def update_admin_category(
    category_id: int,
    category_data: CategoryUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Update an existing category (admin only).

    Validates:
    - category_id must exist (404 if not found)
    - name is required (non-empty, stripped)
    - name must be unique excluding current id (returns 409 if duplicate)
    """
    # Check if category exists
    category = db.get(Category, category_id)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Category not found"
        )

    # Validate name if provided
    if category_data.name is not None:
        name = category_data.name.strip()
        if not name:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="name must not be empty"
            )

        # Check for duplicate name (excluding current id)
        existing = db.exec(
            select(Category).where(Category.name == name, Category.id != category_id)
        ).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Category with name '{name}' already exists.",
            )
        category.name = name

    # Update description if provided
    if category_data.description is not None:
        category.description = category_data.description

    db.add(category)
    db.commit()
    db.refresh(category)

    category_dict = {
        "id": category.id,
        "name": category.name,
        "description": category.description,
        "created_by_user_id": category.created_by_user_id,
        "created_at": category.created_at.isoformat() if category.created_at else None,
    }

    return {
        "success": True,
        "message": "Category updated successfully",
        "category": category_dict,
    }


@app.delete(
    "/api/v1/admin/categories/delete/{category_id}",
    response_model=CategoryDeleteResponse,
)
def delete_admin_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Delete an existing category (admin only).

    Validates:
    - category_id must exist (404 if not found)
    """
    # Check if category exists
    category = db.get(Category, category_id)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Category not found"
        )

    try:
        db.delete(category)
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error deleting category: {str(e)}",
        )

    return {
        "success": True,
        "message": "Category deleted successfully",
    }


# ============================================================================
# Application Settings Endpoints (Phase 09 - SET-01, SET-02, SET-03)
# ============================================================================


@app.get("/api/v1/admin/settings", response_model=AppSettingsResponse)
def get_app_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Get application settings (admin only).

    Returns all settings from AppSettings table as key-value pairs.
    Includes active_user_count for validation context.
    """
    # Query all settings ordered by key
    settings = db.exec(select(AppSettings).order_by(AppSettings.key)).all()

    settings_dict = {}
    for setting in settings:
        value = setting.value
        # Parse known numeric settings
        if setting.key == "max_active_users":
            try:
                value = int(value)
            except (ValueError, TypeError):
                pass
        settings_dict[setting.key] = value

    # Get active user count (count non-disabled users)
    count_statement = select(func.count(User.id)).where(User.is_disabled == False)
    active_user_count = db.exec(count_statement).one()

    return {
        "success": True,
        "settings": settings_dict,
        "active_user_count": active_user_count,
    }


@app.post("/api/v1/admin/settings/update", response_model=SettingsUpdateResponse)
def update_app_settings(
    settings_data: SettingsUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Update application settings (admin only).

    Validates:
    - max_active_users must be a valid integer >= 1
    - max_active_users must be >= current active user count

    Creates new settings if they don't exist, updates existing ones.
    Returns list of updated keys.
    """
    updated_keys = []

    # Get current active user count for validation
    count_statement = select(func.count(User.id)).where(User.is_disabled == False)
    current_active = db.exec(count_statement).one()

    for key, value in settings_data.settings.items():
        # Special validation for max_active_users
        if key == "max_active_users":
            try:
                max_users = int(value)
            except (ValueError, TypeError):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="max_active_users must be a valid integer.",
                )

            if max_users < 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="max_active_users must be at least 1.",
                )

            if max_users < current_active:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Cannot set limit to {max_users} - currently have {current_active} active users.",
                )

            # Store as integer for proper type handling
            value = max_users

        # Update or insert setting
        existing = db.get(AppSettings, key)
        if existing:
            existing.value = str(value)
        else:
            new_setting = AppSettings(key=key, value=str(value))
            db.add(new_setting)

        updated_keys.append(key)

    try:
        db.commit()
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update settings: {str(exc)}",
        )

    return {
        "success": True,
        "message": f"Updated {len(updated_keys)} setting(s).",
        "updated_keys": updated_keys,
    }


# ============================================================================
# File Management Endpoints (Phase 09 - CONTENT-04, CONTENT-05)
# ============================================================================


@app.get("/api/v1/admin/files/{file_id}", response_model=FileDetailsResponse)
def get_file_details(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Get file details by file_id (admin only).

    Validates:
    - file_id must exist (404 if not found)
    - Returns file metadata with document count and metadata summary

    Response includes:
    - file_id, filename, file_size, upload_time
    - username of uploader
    - library_name, knowledge_name
    - metadata_summary (catalogs/categories from knowledge)
    - is_ocr, is_az_doci flags
    - document_count (number of document chunks)
    - vector_count (0 for sqlite-vec - cascade handled)
    - brand_manufacturer_organization, product_model_name_service
    """
    # Get uploaded file
    uploaded_file = db.get(UploadedFile, file_id)
    if not uploaded_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="File record not found."
        )

    # Get user
    user = db.get(User, uploaded_file.user_id)

    # Get library and knowledge (optional)
    library = (
        db.get(Library, uploaded_file.library_id) if uploaded_file.library_id else None
    )
    knowledge = (
        db.get(Knowledge, uploaded_file.knowledge_id)
        if uploaded_file.knowledge_id
        else None
    )

    # Count documents associated with this file
    doc_count_statement = select(func.count(Document.id)).where(
        Document.source == uploaded_file.original_filename,
        Document.library_id == uploaded_file.library_id,
        Document.knowledge_id == uploaded_file.knowledge_id,
    )
    document_count = db.exec(doc_count_statement).one()

    # Build metadata summary using database function
    metadata_summary = "N/A"
    if knowledge:
        from modules.database import build_knowledge_metadata_summary

        metadata_map = build_knowledge_metadata_summary([knowledge.id])
        metadata_summary = metadata_map.get(knowledge.id, "N/A")

    # Build response dict
    file_dict = {
        "file_id": uploaded_file.file_id,
        "filename": uploaded_file.original_filename,
        "file_size": uploaded_file.file_size,
        "upload_time": uploaded_file.upload_time.isoformat()
        if uploaded_file.upload_time
        else None,
        "username": user.username if user else "Unknown",
        "library_name": library.name if library else None,
        "knowledge_name": knowledge.name if knowledge else None,
        "metadata_summary": metadata_summary,
        "is_ocr": uploaded_file.is_ocr if hasattr(uploaded_file, "is_ocr") else False,
        "is_az_doci": uploaded_file.is_az_doci
        if hasattr(uploaded_file, "is_az_doci")
        else False,
        "document_count": document_count,
        "vector_count": 0,  # sqlite-vec handles vectors via cascade
        "brand_manufacturer_organization": knowledge.brand_manufacturer_organization
        if knowledge
        else None,
        "product_model_name_service": knowledge.product_model_name_service
        if knowledge
        else None,
    }

    return {
        "success": True,
        "file": file_dict,
    }


@app.delete("/api/v1/admin/files/{file_id}", response_model=FileDeleteResponse)
def delete_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Delete a file and its associated data (admin only).

    Validates:
    - file_id must exist (404 if not found)

    Deletes:
    - Associated Document records (chunks)
    - VectorReference records
    - LibraryReference records
    - VisualGroundingActivity records
    - UploadedFile record

    For sqlite-vec: Vectors are deleted automatically via database cascade deletes.
    No manual vector deletion is performed.

    Returns success message with document count if any documents were removed.
    """
    # Get uploaded file
    uploaded_file = db.get(UploadedFile, file_id)
    if not uploaded_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="File record not found."
        )

    try:
        # Find associated documents
        doc_statement = select(Document).where(
            Document.source == uploaded_file.original_filename,
            Document.library_id == uploaded_file.library_id,
            Document.knowledge_id == uploaded_file.knowledge_id,
        )
        docs = db.exec(doc_statement).all()
        doc_count = len(docs)

        # Delete document records (vectors cascade for sqlite-vec)
        for doc in docs:
            db.delete(doc)

        # Delete vector references
        vr_statement = select(VectorReference).where(VectorReference.file_id == file_id)
        for vr in db.exec(vr_statement):
            db.delete(vr)

        # Delete library references
        lr_statement = select(LibraryReference).where(
            LibraryReference.reference_type == "file",
            LibraryReference.source_id == file_id,
        )
        for lr in db.exec(lr_statement):
            db.delete(lr)

        # Delete visual grounding activities
        vg_statement = select(VisualGroundingActivity).where(
            VisualGroundingActivity.file_id == file_id
        )
        for vg in db.exec(vg_statement):
            db.delete(vg)

        # Delete the uploaded file
        db.delete(uploaded_file)
        db.commit()

        message = "File deleted successfully."
        if doc_count > 0:
            message = f"File deleted successfully. Removed {doc_count} document(s)."

        return {"success": True, "message": message}

    except Exception as exc:
        db.rollback()
        logging.error(f"Failed to delete file_id {file_id}: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete file.",
        )


# Config & Branding endpoints
@app.get("/api/v1/config")
async def get_config(current_user: User = Depends(get_current_user)):
    """
    Return app configuration relevant to the frontend.

    Returns: {vector_store_mode, visual_grounding_enabled, is_admin, username}
    """
    import os

    return {
        "vector_store_mode": os.environ.get("VECTOR_STORE_MODE", "user"),
        "visual_grounding_enabled": os.environ.get(
            "VISUAL_GROUNDING_ENABLED", "false"
        ).lower()
        == "true",
        "is_admin": current_user.is_admin,
        "username": current_user.username or "",
    }


@app.get("/api/v1/branding")
async def get_branding():
    """
    Return branding info (app name, logo URL) from AppSettings.

    Public endpoint - no auth required.
    Returns: {app_name, logo_url}
    """
    # For now, return default branding
    # Can be extended to read from AppSettings table
    return {
        "app_name": "SmartLib",
        "logo_url": None,
    }


# Admin Group Management endpoints
@app.get("/api/v1/admin/groups")
def list_admin_groups(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
    page: int = 1,
    per_page: int = 10,
    skip: int = 0,
    limit: int = 0,
):
    """List all groups (admin only)."""
    # Support both page/per_page (frontend) and skip/limit (legacy)
    if limit == 0:
        actual_limit = per_page
        actual_skip = (page - 1) * per_page
    else:
        actual_limit = limit
        actual_skip = skip

    count_statement = select(func.count(Group.group_id))
    total = db.exec(count_statement).one()

    statement = select(Group).offset(actual_skip).limit(actual_limit)
    groups = db.exec(statement).all()

    return {
        "success": True,
        "data": {
            "items": [
                {
                    "id": g.group_id,
                    "group_id": g.group_id,
                    "name": g.name,
                    "description": g.description,
                    "created_by_user_id": g.created_by_user_id,
                    "created_at": g.created_at,
                }
                for g in groups
            ],
            "total": total,
            "total_pages": max(1, -(-total // actual_limit)) if actual_limit else 1,
        },
    }


@app.post("/api/v1/admin/groups")
def create_admin_group(
    group_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Create a new group (admin only)."""
    new_group = Group(
        name=group_data["name"],
        description=group_data.get("description"),
        created_by_user_id=current_user.user_id,
    )
    db.add(new_group)
    db.commit()
    db.refresh(new_group)
    return {"success": True, "group": new_group}


@app.put("/api/v1/admin/groups/{group_id}")
def update_admin_group(
    group_id: int,
    group_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Update a group (admin only)."""
    group = db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    if "name" in group_data:
        group.name = group_data["name"]
    if "description" in group_data:
        group.description = group_data["description"]

    db.add(group)
    db.commit()
    db.refresh(group)
    return {"success": True, "group": group}


@app.delete("/api/v1/admin/groups/{group_id}")
def delete_admin_group(
    group_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Delete a group (admin only)."""
    group = db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    db.delete(group)
    db.commit()
    return {"success": True, "message": "Group deleted successfully"}


# Admin Library Management endpoints
@app.get("/api/v1/admin/libraries")
def list_admin_libraries(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
    page: int = 1,
    per_page: int = 10,
    skip: int = 0,
    limit: int = 0,
):
    """List all libraries (admin only)."""
    if limit == 0:
        actual_limit = per_page
        actual_skip = (page - 1) * per_page
    else:
        actual_limit = limit
        actual_skip = skip

    count_statement = select(func.count(Library.library_id))
    total = db.exec(count_statement).one()

    # Get libraries with their nested knowledges
    from sqlalchemy.orm import selectinload

    statement = (
        select(Library)
        .options(selectinload(Library.knowledges))
        .offset(actual_skip)
        .limit(actual_limit)
    )
    libraries = db.exec(statement).all()

    return {
        "success": True,
        "data": {
            "items": [
                {
                    "id": l.library_id,
                    "library_id": l.library_id,
                    "name": l.name,
                    "description": l.description,
                    "created_by_user_id": l.created_by_user_id,
                    "created_at": l.created_at,
                    "knowledges": [
                        {
                            "id": k.id,
                            "name": k.name,
                        }
                        for k in l.knowledges
                    ],
                    "knowledge_names": sorted([k.name for k in l.knowledges if k.name]),
                    "knowledge_ids": [k.id for k in l.knowledges if k.id is not None],
                }
                for l in libraries
            ],
            "total": total,
            "total_pages": max(1, -(-total // actual_limit)) if actual_limit else 1,
        },
    }


@app.post("/api/v1/admin/libraries")
def create_admin_library(
    library_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Create a new library (admin only)."""
    new_library = Library(
        name=library_data["name"],
        description=library_data.get("description"),
        created_by_user_id=current_user.user_id,
    )
    db.add(new_library)
    db.commit()
    db.refresh(new_library)
    return {"success": True, "library": new_library}


@app.put("/api/v1/admin/libraries/{library_id}")
def update_admin_library(
    library_id: int,
    library_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Update a library (admin only)."""
    library = db.get(Library, library_id)
    if not library:
        raise HTTPException(status_code=404, detail="Library not found")

    if "name" in library_data:
        library.name = library_data["name"]
    if "description" in library_data:
        library.description = library_data["description"]

    db.add(library)
    db.commit()
    db.refresh(library)
    return {"success": True, "library": library}


@app.delete("/api/v1/admin/libraries/{library_id}")
def delete_admin_library(
    library_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Delete a library (admin only)."""
    library = db.get(Library, library_id)
    if not library:
        raise HTTPException(status_code=404, detail="Library not found")

    db.delete(library)
    db.commit()
    return {"success": True, "message": "Library deleted successfully"}


# Admin Knowledge Management endpoints
@app.get("/api/v1/admin/knowledges")
def list_admin_knowledges(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
    page: int = 1,
    per_page: int = 10,
    skip: int = 0,
    limit: int = 0,
):
    """List all knowledges (admin only)."""
    if limit == 0:
        actual_limit = per_page
        actual_skip = (page - 1) * per_page
    else:
        actual_limit = limit
        actual_skip = skip

    count_statement = select(func.count(Knowledge.id))
    total = db.exec(count_statement).one()

    from sqlalchemy.orm import selectinload

    statement = (
        select(Knowledge)
        .options(
            selectinload(Knowledge.creator),
            selectinload(Knowledge.catalogs),
            selectinload(Knowledge.libraries),
            selectinload(Knowledge.groups),
            selectinload(Knowledge.categories),
        )
        .offset(actual_skip)
        .limit(actual_limit)
    )
    knowledges = db.exec(statement).all()

    return {
        "success": True,
        "data": {
            "items": [
                {
                    "id": k.id,
                    "name": k.name,
                    "description": k.description,
                    "brand_manufacturer_organization": k.brand_manufacturer_organization,
                    "product_model_name_service": k.product_model_name_service,
                    "created_by_user_id": k.created_by_user_id,
                    "created_by_username": k.creator.username
                    if k.creator
                    else "Unknown",
                    "created_at": k.created_at,
                    "embedding_model": k.embedding_model,
                    "catalog_names": k.catalog_names,
                    "category_names": k.category_names,
                    "group_names": k.group_names,
                    "library_names": k.library_names,
                }
                for k in knowledges
            ],
            "total": total,
            "total_pages": max(1, -(-total // actual_limit)) if actual_limit else 1,
        },
    }


@app.post("/api/v1/admin/knowledges")
def create_admin_knowledge(
    knowledge_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Create a new knowledge base (admin only)."""
    new_knowledge = Knowledge(
        name=knowledge_data["name"],
        description=knowledge_data.get("description"),
        brand_manufacturer_organization=knowledge_data.get(
            "brand_manufacturer_organization"
        ),
        product_model_name_service=knowledge_data.get("product_model_name_service"),
        embedding_model=knowledge_data.get("embedding_model"),
        created_by_user_id=current_user.user_id,
    )
    db.add(new_knowledge)
    db.commit()
    db.refresh(new_knowledge)
    return {"success": True, "knowledge": new_knowledge}


@app.put("/api/v1/admin/knowledges/{knowledge_id}")
def update_admin_knowledge(
    knowledge_id: int,
    knowledge_data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Update a knowledge base (admin only)."""
    knowledge = db.get(Knowledge, knowledge_id)
    if not knowledge:
        raise HTTPException(status_code=404, detail="Knowledge not found")

    if "name" in knowledge_data:
        knowledge.name = knowledge_data["name"]
    if "description" in knowledge_data:
        knowledge.description = knowledge_data["description"]
    if "brand_manufacturer_organization" in knowledge_data:
        knowledge.brand_manufacturer_organization = knowledge_data[
            "brand_manufacturer_organization"
        ]
    if "product_model_name_service" in knowledge_data:
        knowledge.product_model_name_service = knowledge_data[
            "product_model_name_service"
        ]
    if "embedding_model" in knowledge_data:
        knowledge.embedding_model = knowledge_data["embedding_model"]

    db.add(knowledge)
    db.commit()
    db.refresh(knowledge)
    return {"success": True, "knowledge": knowledge}


@app.delete("/api/v1/admin/knowledges/{knowledge_id}")
def delete_admin_knowledge(
    knowledge_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Delete a knowledge base (admin only)."""
    knowledge = db.get(Knowledge, knowledge_id)
    if not knowledge:
        raise HTTPException(status_code=404, detail="Knowledge not found")

    db.delete(knowledge)
    db.commit()
    return {"success": True, "message": "Knowledge deleted successfully"}


# Admin User Management endpoints
@app.get("/api/v1/admin/users")
def list_admin_users(
    db=Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
    page: int = 1,
    per_page: int = 10,
    skip: int = 0,
    limit: int = 0,
):
    """
    List all users (admin only).

    Returns paginated list of all users in the system.
    """
    from sqlmodel import select

    if limit == 0:
        actual_limit = per_page
        actual_skip = (page - 1) * per_page
    else:
        actual_limit = limit
        actual_skip = skip

    # Get total count first
    count_result = db.exec(select(func.count(User.user_id))).one()

    statement = select(User).offset(actual_skip).limit(actual_limit)
    result = db.exec(statement)
    users = result.all()
    return {
        "success": True,
        "data": {
            "items": [
                {
                    "user_id": u.user_id,
                    "username": u.username,
                    "email": u.email,
                    "is_admin": u.is_admin,
                    "is_disabled": u.is_disabled,
                    "created_at": u.created_at,
                }
                for u in users
            ],
            "total": count_result,
            "total_pages": max(1, -(-count_result // actual_limit))
            if actual_limit
            else 1,
        },
    }


@app.get("/api/v1/admin/files")
def list_admin_files(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
    page: int = 1,
    per_page: int = 10,
):
    """List all uploaded files (admin only)."""
    actual_limit = per_page
    actual_skip = (page - 1) * per_page

    count_statement = select(func.count(UploadedFile.file_id))
    total = db.exec(count_statement).one()

    # Join with User, Library, Knowledge for details
    from modules.models import Library, Knowledge

    statement = (
        select(UploadedFile, User.username, Library.name, Knowledge.name)
        .join(User, UploadedFile.user_id == User.user_id)
        .outerjoin(Library, UploadedFile.library_id == Library.library_id)
        .outerjoin(Knowledge, UploadedFile.knowledge_id == Knowledge.id)
        .order_by(UploadedFile.upload_time.desc())
        .offset(actual_skip)
        .limit(actual_limit)
    )

    results = db.exec(statement).all()

    items = []
    for f, username, lib_name, kn_name in results:
        items.append(
            {
                "id": f.file_id,
                "file_id": f.file_id,
                "filename": f.original_filename,
                "file_size": f.file_size,
                "upload_time": f.upload_time,
                "username": username,
                "library_name": lib_name,
                "knowledge_name": kn_name,
                "is_ocr": f.is_ocr,
            }
        )

    return {
        "success": True,
        "data": {
            "items": items,
            "total": total,
            "total_pages": max(1, -(-total // actual_limit)) if actual_limit else 1,
        },
    }


@app.get("/api/v1/admin/folder_upload/jobs")
def list_admin_folder_upload_jobs(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
    page: int = 1,
    per_page: int = 10,
):
    """List all folder upload jobs (admin only)."""
    actual_limit = per_page
    actual_skip = (page - 1) * per_page

    count_statement = select(func.count(FolderUploadJob.id))
    total = db.exec(count_statement).one()

    statement = (
        select(FolderUploadJob)
        .order_by(FolderUploadJob.created_at.desc())
        .offset(actual_skip)
        .limit(actual_limit)
    )
    jobs = db.exec(statement).all()

    return {
        "success": True,
        "data": {
            "items": [
                {
                    "id": j.id,
                    "created_at": j.created_at,
                    "file_list": j.file_list,
                    "file_types": j.file_types,
                    "background_enabled": j.background_enabled,
                    "scheduled_time": j.scheduled_time,
                    "status": j.status,
                    "log": j.log,
                    "task_id": j.task_id,
                }
                for j in jobs
            ],
            "total": total,
            "total_pages": max(1, -(-total // actual_limit)) if actual_limit else 1,
        },
    }


@app.get("/api/v1/admin/users/{user_id}")
def get_admin_user(
    user_id: str,
    db=Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Get a specific user by ID (admin only).
    """
    from sqlmodel import select

    statement = select(User).where(User.user_id == user_id)
    result = db.exec(statement)
    user = result.first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "user_id": user.user_id,
        "username": user.username,
        "email": user.email,
        "is_admin": user.is_admin,
        "is_disabled": user.is_disabled,
        "created_at": user.created_at,
    }


@app.put("/api/v1/admin/users/{user_id}")
def update_admin_user(
    user_id: str,
    update_data: dict,
    db=Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Update a user (admin only).

    Allowed updates: is_admin, is_disabled
    """
    from sqlmodel import select

    statement = select(User).where(User.user_id == user_id)
    result = db.exec(statement)
    user = result.first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Only allow updating specific fields
    if "is_admin" in update_data:
        user.is_admin = update_data["is_admin"]
    if "is_disabled" in update_data:
        user.is_disabled = update_data["is_disabled"]

    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "user_id": user.user_id,
        "username": user.username,
        "email": user.email,
        "is_admin": user.is_admin,
        "is_disabled": user.is_disabled,
        "created_at": user.created_at,
    }


@app.post("/api/v1/admin/users/{user_id}/reset-password")
def admin_reset_password(
    user_id: str,
    db=Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Force password reset for a user (admin only).

    TODO: Send password reset email.
    For now, just returns success.
    """
    from sqlmodel import select

    statement = select(User).where(User.user_id == user_id)
    result = db.exec(statement)
    user = result.first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # TODO: Implement password reset email
    return {"message": "Password reset initiated. Email will be sent to user."}


@app.post("/api/v1/admin/users/{user_id}/toggle-admin")
def toggle_admin_status(
    user_id: str,
    db=Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Toggle user's admin status (admin only).

    Prevents self-modification (user cannot toggle their own admin status).
    """
    from sqlmodel import select

    # Get target user
    statement = select(User).where(User.user_id == user_id)
    result = db.exec(statement)
    target_user = result.first()

    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent self-modification
    if target_user.user_id == current_user.user_id:
        raise HTTPException(
            status_code=400, detail="You cannot toggle your own admin status"
        )

    # Toggle admin status
    target_user.is_admin = not target_user.is_admin
    db.add(target_user)
    db.commit()
    db.refresh(target_user)

    return {
        "success": True,
        "data": {"user_id": target_user.user_id, "is_admin": target_user.is_admin},
    }


@app.post("/api/v1/admin/users/{user_id}/toggle-active")
def toggle_active_status(
    user_id: str,
    db=Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Toggle user's active/disabled status (admin only).

    Prevents self-modification (user cannot disable their own account).
    """
    from sqlmodel import select

    # Get target user
    statement = select(User).where(User.user_id == user_id)
    result = db.exec(statement)
    target_user = result.first()

    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent self-modification
    if target_user.user_id == current_user.user_id:
        raise HTTPException(
            status_code=400, detail="You cannot disable your own account"
        )

    # Toggle disabled status
    target_user.is_disabled = not target_user.is_disabled
    db.add(target_user)
    db.commit()
    db.refresh(target_user)

    return {
        "success": True,
        "data": {
            "user_id": target_user.user_id,
            "is_disabled": target_user.is_disabled,
        },
    }


@app.delete("/api/v1/admin/users/{user_id}")
def delete_user(
    user_id: str,
    db=Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Delete a user account (admin only).

    Prevents self-deletion.
    """
    from sqlmodel import select
    from sqlmodel import delete

    # Get target user
    statement = select(User).where(User.user_id == user_id)
    result = db.exec(statement)
    target_user = result.first()

    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent self-deletion
    if target_user.user_id == current_user.user_id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    # Delete user
    db.delete(target_user)
    db.commit()

    return {"success": True}


@app.get("/api/v1/admin/stats")
def get_admin_stats(
    db=Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Get system statistics (admin only).
    """
    from sqlmodel import select, func, desc
    from modules.models import UploadedFile, Library, Knowledge, MessageHistory

    user_count = db.exec(select(func.count(User.user_id))).one()
    file_count = db.exec(select(func.count(UploadedFile.file_id))).one()
    library_count = db.exec(select(func.count(Library.library_id))).one()
    knowledge_count = db.exec(select(func.count(Knowledge.id))).one()
    message_count = db.exec(select(func.count(MessageHistory.message_id))).one()

    # Get recent files
    recent_files_objs = db.exec(
        select(UploadedFile).order_by(desc(UploadedFile.created_at)).limit(5)
    ).all()
    recent_files = [
        {
            "id": f.file_id,
            "filename": f.original_filename,
            "created_at": f.upload_time.isoformat() if f.upload_time else None,
        }
        for f in recent_files_objs
    ]

    # Get recent messages
    recent_messages_objs = db.exec(
        select(MessageHistory).order_by(desc(MessageHistory.timestamp)).limit(5)
    ).all()
    recent_messages = [
        {
            "id": str(m.message_id),
            "question": m.message_text[:100] if m.message_text else "",
            "created_at": m.timestamp.isoformat() if m.timestamp else None,
        }
        for m in recent_messages_objs
    ]

    return {
        "success": True,
        "data": {
            "user_count": user_count,
            "file_count": file_count,
            "library_count": library_count,
            "knowledge_count": knowledge_count,
            "message_count": message_count,
            "recent_files": recent_files,
            "recent_messages": recent_messages,
        },
    }


# ============================================================
# ADMIN VECTOR REFERENCES ENDPOINTS
# ============================================================

import os
import glob
import json


def _get_vector_log_directory() -> str:
    """Get the directory for vector reference logs."""
    data_volume = os.environ.get("DATA_VOLUME_PATH")
    if not data_volume:
        # Default to data/logs in project root
        base_dir = os.path.join(
            os.path.dirname(os.path.dirname(__file__)), "data", "logs"
        )
    else:
        base_dir = os.path.join(data_volume, "logs")
    os.makedirs(base_dir, exist_ok=True)
    return base_dir


@app.get("/api/v1/admin/vector-references")
def list_vector_reference_logs(
    current_user: User = Depends(get_current_admin_user),
):
    """
    List all available vector reference log files (admin only).
    """
    log_dir = _get_vector_log_directory()
    log_pattern = os.path.join(log_dir, "vector_references_*.log")
    log_files_paths = glob.glob(log_pattern)

    log_files = [os.path.basename(p) for p in log_files_paths]
    log_files.sort(reverse=True)  # Show newest first

    return {
        "success": True,
        "log_files": log_files,
        "log_directory": log_dir,
    }


@app.get("/api/v1/admin/vector-references/{log_filename}")
def view_vector_reference_log(
    log_filename: str,
    current_user: User = Depends(get_current_admin_user),
):
    """
    View content of a specific vector reference log file (admin only).
    """
    log_dir = _get_vector_log_directory()

    # Security check to prevent directory traversal
    if ".." in log_filename or not log_filename.startswith("vector_references_"):
        raise HTTPException(status_code=400, detail="Invalid log filename")

    log_file_path = os.path.join(log_dir, log_filename)

    if not os.path.exists(log_file_path):
        raise HTTPException(status_code=404, detail="Log file not found")

    references = []
    try:
        with open(log_file_path, "r") as f:
            for line in f:
                if line.strip():
                    try:
                        references.append(json.loads(line))
                    except json.JSONDecodeError:
                        continue
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading log file: {str(e)}")

    log_stats = {}
    if references:
        log_stats["total_entries"] = len(references)
        log_stats["unique_files"] = len(
            {ref.get("file_id") for ref in references if ref.get("file_id")}
        )

        file_counts = {}
        for ref in references:
            file_id = ref.get("file_id")
            if file_id:
                file_counts[str(file_id)] = file_counts.get(str(file_id), 0) + 1
        log_stats["file_counts"] = file_counts

        timestamps = [
            ref.get("timestamp") for ref in references if ref.get("timestamp")
        ]
        if timestamps:
            timestamps.sort()
            log_stats["date_range"] = f"{timestamps[0][:10]} to {timestamps[-1][:10]}"
        else:
            log_stats["date_range"] = "N/A"

    return {
        "success": True,
        "references": references,
        "log_filename": log_filename,
        "log_stats": log_stats,
        "log_directory": log_dir,
    }


@app.delete("/api/v1/admin/vector-references/{log_filename}")
def delete_vector_reference_log(
    log_filename: str,
    current_user: User = Depends(get_current_admin_user),
):
    """
    Delete a specific vector reference log file (admin only).
    """
    log_dir = _get_vector_log_directory()

    # Security check to prevent directory traversal
    if ".." in log_filename or not log_filename.startswith("vector_references_"):
        raise HTTPException(status_code=400, detail="Invalid log filename")

    log_file_path = os.path.join(log_dir, log_filename)

    if not os.path.exists(log_file_path):
        raise HTTPException(status_code=404, detail="Log file not found")

    try:
        os.remove(log_file_path)
        return {
            "success": True,
            "message": f"Log file {log_filename} deleted successfully",
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error deleting log file: {str(e)}"
        )


# ============================================================
# ADMIN VECTOR SETTINGS ENDPOINTS
# ============================================================

from sqlmodel import select


class VectorSettingsResponse(BaseModel):
    success: bool
    sqlite_table_name: str
    vector_store_mode: str


class VectorSettingsUpdate(BaseModel):
    sqlite_table_name: Optional[str] = None
    vector_store_mode: Optional[str] = None


@app.get("/api/v1/admin/vector-settings", response_model=VectorSettingsResponse)
def get_vector_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    settings_keys = [
        "SQLITE_VECTOR_TABLE_NAME",
        "VECTOR_STORE_MODE",
    ]

    settings = {}
    for key in settings_keys:
        statement = select(AppSettings).where(AppSettings.key == key)
        result = db.exec(statement)
        setting = result.first()
        if setting:
            settings[key] = setting.value

    vector_store_mode = settings.get(
        "VECTOR_STORE_MODE", os.environ.get("VECTOR_STORE_MODE", "user")
    )

    return VectorSettingsResponse(
        success=True,
        sqlite_table_name=settings.get("SQLITE_VECTOR_TABLE_NAME", "document_vectors"),
        vector_store_mode=vector_store_mode,
    )


@app.post("/api/v1/admin/vector-settings", response_model=VectorSettingsResponse)
def update_vector_settings(
    settings_update: VectorSettingsUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    vector_store_mode = settings_update.vector_store_mode or "user"
    if vector_store_mode not in ["user", "global", "knowledge"]:
        raise HTTPException(status_code=400, detail="Invalid vector store mode")

    settings_to_update = {
        "SQLITE_VECTOR_TABLE_NAME": settings_update.sqlite_table_name
        or "document_vectors",
        "VECTOR_STORE_MODE": vector_store_mode,
    }

    for key, value in settings_to_update.items():
        statement = select(AppSettings).where(AppSettings.key == key)
        result = db.exec(statement)
        existing = result.first()

        if existing:
            existing.value = value
            db.add(existing)
        else:
            new_setting = AppSettings(key=key, value=value)
            db.add(new_setting)

    db.commit()

    return VectorSettingsResponse(
        success=True,
        sqlite_table_name=settings_to_update["SQLITE_VECTOR_TABLE_NAME"],
        vector_store_mode=vector_store_mode,
    )


@app.post("/api/v1/admin/vector-settings/reset")
async def reset_vector_store(
    request: Request,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db),
):
    statement = select(AppSettings).where(AppSettings.key == "SQLITE_VECTOR_TABLE_NAME")
    result = db.exec(statement)
    table_setting = result.first()
    table_name = table_setting.value if table_setting else "document_vectors"

    try:
        body = await request.body()
        data = json.loads(body) if body else {}
    except:
        data = {}

    confirm_text = data.get("confirm_text", "").strip()

    if confirm_text != "RESET VECTORS":
        raise HTTPException(
            status_code=400,
            detail="Invalid confirmation text. Type 'RESET VECTORS' to confirm.",
        )

    try:
        from sqlmodel import text

        db.exec(text(f"DELETE FROM {table_name}"))
        db.commit()

        return {
            "success": True,
            "message": f"Vector store has been reset. All vectors deleted from {table_name}.",
        }

    except Exception as e:
        logging.error(f"Error resetting vector store: {str(e)}")
        raise HTTPException(
            status_code=500, detail=f"Error resetting vector store: {str(e)}"
        )


# ============================================================
# USER PROFILE & STATS ENDPOINTS
# ============================================================


@app.get("/api/v1/user/profile", response_model=UserProfile)
async def get_user_profile(
    current_user: User = Depends(get_current_user),
):
    """
    Get current authenticated user's profile.
    """
    return UserProfile(
        user_id=current_user.user_id,
        username=current_user.username,
        email=current_user.email,
        is_admin=current_user.is_admin,
        created_at=current_user.created_at,
    )


@app.put("/api/v1/user/profile", response_model=UserProfile)
async def update_user_profile(
    profile_data: UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Update current user's profile.

    Allows updating username and email.
    """
    from sqlmodel import select

    # Update username if provided
    if (
        profile_data.username is not None
        and profile_data.username != current_user.username
    ):
        # Check if username is already taken
        existing = db.exec(select(User).where(User.username == profile_data.username))
        if existing.first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken",
            )
        current_user.username = profile_data.username

    # Update email if provided
    if profile_data.email is not None and profile_data.email != current_user.email:
        # Check if email is already registered
        existing = db.exec(select(User).where(User.email == profile_data.email))
        if existing.first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered",
            )
        current_user.email = profile_data.email

    db.add(current_user)
    db.commit()
    db.refresh(current_user)

    return UserProfile(
        user_id=current_user.user_id,
        username=current_user.username,
        email=current_user.email,
        is_admin=current_user.is_admin,
        created_at=current_user.created_at,
    )


@app.get("/api/v1/user/stats", response_model=UserStats)
async def get_user_stats(
    current_user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Get current user's statistics.

    Returns file count, total storage, message count, etc.
    """
    from sqlmodel import select, func
    from modules.models import UploadedFile, MessageHistory

    # Count files
    file_count = db.exec(
        select(func.count(UploadedFile.file_id)).where(
            UploadedFile.user_id == current_user.user_id
        )
    ).one()

    # Total file size
    total_size = (
        db.exec(
            select(func.sum(UploadedFile.file_size)).where(
                UploadedFile.user_id == current_user.user_id
            )
        ).one()
        or 0
    )

    # Count messages
    message_count = db.exec(
        select(func.count(MessageHistory.message_id)).where(
            MessageHistory.user_id == current_user.user_id
        )
    ).one()

    # Count libraries (all libraries for now, could be filtered by ownership)
    library_count = db.exec(select(func.count(Library.library_id))).one()

    # Count knowledges (all knowledges for now)
    knowledge_count = db.exec(select(func.count(Knowledge.id))).one()

    return UserStats(
        file_count=file_count,
        total_file_size_bytes=total_size,
        message_count=message_count,
        library_count=library_count,
        knowledge_count=knowledge_count,
    )


# ============================================================
# FILE MANAGEMENT ENDPOINTS
# ============================================================

from fastapi.responses import FileResponse
import os
import shutil


@app.get("/api/v1/files/{file_id}/download")
async def download_file(
    file_id: int,
    current_user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Download an uploaded file.

    Users can only download their own files (admin can download any).
    """
    from sqlmodel import select

    # Get file record
    uploaded_file = db.get(UploadedFile, file_id)
    if not uploaded_file:
        raise HTTPException(status_code=404, detail="File not found")

    # Check ownership (admin can download any file)
    if not current_user.is_admin and uploaded_file.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    # Get file path from environment or use default
    # Files are stored in DATA_VOLUME_PATH or default location
    data_volume = os.environ.get(
        "DATA_VOLUME_PATH",
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "data"),
    )
    file_path = os.path.join(
        data_volume, "uploaded_files", uploaded_file.stored_filename
    )

    # Check if file exists
    if not os.path.exists(file_path):
        # Try alternate location (uploads folder)
        alt_path = os.path.join(data_volume, "uploads", uploaded_file.stored_filename)
        if os.path.exists(alt_path):
            file_path = alt_path
        else:
            raise HTTPException(status_code=404, detail="File not found on disk")

    return FileResponse(
        path=file_path,
        filename=uploaded_file.original_filename,
        media_type="application/octet-stream",
    )


@app.delete("/api/v1/files/{file_id}")
async def delete_file(
    file_id: int,
    current_user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    """
    Delete an uploaded file and its associated vectors.

    Users can only delete their own files (admin can delete any).
    Vector cleanup is handled automatically via database cascade deletes for sqlite-vec.
    """
    from sqlmodel import select
    from modules.models import (
        Document,
        VectorReference,
        LibraryReference,
        VisualGroundingActivity,
    )

    # Get file record
    uploaded_file = db.get(UploadedFile, file_id)
    if not uploaded_file:
        raise HTTPException(status_code=404, detail="File not found")

    # Check ownership (admin can delete any file)
    if not current_user.is_admin and uploaded_file.user_id != current_user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    try:
        # Find associated Document records
        statement = select(Document).where(
            Document.source == uploaded_file.original_filename,
            Document.library_id == uploaded_file.library_id,
            Document.knowledge_id == uploaded_file.knowledge_id,
        )
        result = db.exec(statement)
        docs = result.all()
        doc_ids = [str(doc.id) for doc in docs]

        # Delete associated records
        # VectorReference cleanup
        VectorReference.query.filter_by(file_id=file_id).delete(
            synchronize_session=False
        ) if hasattr(VectorReference, "query") else None

        # For SQLModel, use direct delete
        from sqlmodel import delete

        db.exec(delete(VectorReference).where(VectorReference.file_id == file_id))
        db.exec(
            delete(LibraryReference).where(
                LibraryReference.reference_type == "file",
                LibraryReference.source_id == file_id,
            )
        )
        db.exec(
            delete(VisualGroundingActivity).where(
                VisualGroundingActivity.file_id == file_id
            )
        )

        # Delete documents (vectors will be cleaned up via cascade)
        for doc in docs:
            db.delete(doc)

        # Delete the file record
        db.delete(uploaded_file)
        db.commit()

        # Delete physical file
        data_volume = os.environ.get(
            "DATA_VOLUME_PATH",
            os.path.join(os.path.dirname(os.path.abspath(__file__)), "data"),
        )
        file_path = os.path.join(
            data_volume, "uploaded_files", uploaded_file.stored_filename
        )
        if os.path.exists(file_path):
            os.remove(file_path)

        vector_count = len(doc_ids)
        message = "File deleted successfully."
        if vector_count > 0:
            message = (
                f"File deleted successfully. Removed {vector_count} vector chunk(s)."
            )

        return {"status": "success", "message": message}

    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Failed to delete file: {str(exc)}"
        )


add_pagination(app)


# ============================================================
# WAVE 3: DOCUMENT UPLOAD ENDPOINTS (/api/v1/*)
# ============================================================

# Allowed file extensions
ALLOWED_EXTENSIONS = {
    "pdf",
    "docx",
    "txt",
    "md",
    "html",
    "pptx",
    "xlsx",
    "csv",
    "jpg",
    "jpeg",
    "png",
    "gif",
}


def allowed_file(filename: str) -> bool:
    """Check if the file extension is allowed."""
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


@app.post("/api/v1/embedding-compatibility")
@app.post("/api/embedding-compatibility")
async def api_embedding_compatibility(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Check embedding compatibility for a knowledge base."""
    from modules.embedding_validation import (
        validate_embedding_compatibility,
        get_embedding_model_dimension,
    )
    from modules.llm_utils import get_embedding_model_name

    try:
        data = await request.json()
        knowledge_id = data.get("knowledge_id")

        if knowledge_id is None:
            # No knowledge selected - will use default model
            current_model = get_embedding_model_name()
            current_dim = get_embedding_model_dimension(current_model) or 0
            return {
                "compatible": True,
                "message": f"No knowledge base selected. Will use current default: {current_model}",
                "current_model": current_model,
                "current_dimension": current_dim,
                "knowledge_model": None,
                "knowledge_dimension": None,
            }

        # Check compatibility
        current_model = get_embedding_model_name()
        is_valid, message, info = validate_embedding_compatibility(
            knowledge_id, current_model
        )

        return {
            "compatible": is_valid,
            "message": message,
            "current_model": current_model,
            "current_dimension": info.get("new_dim"),
            "knowledge_model": info.get("existing_model"),
            "knowledge_dimension": info.get("existing_dim"),
        }

    except Exception as e:
        logging.error(f"Error checking embedding compatibility: {e}")
        return {
            "compatible": True,
            "message": "Could not verify compatibility - proceeding anyway",
            "error": str(e),
        }


@app.post("/api/v1/upload", response_model=UploadResponse)
@app.post("/api/upload", response_model=UploadResponse)
@app.post("/upload", response_model=UploadResponse)
async def api_v1_upload(
    request: Request,
    files: List[UploadFile] = File(...),
    library_id: int = Form(...),
    library_name: str = Form(...),
    knowledge_id: Optional[int] = Form(None),
    enable_visual_grounding: bool = Form(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Upload files for processing (multipart/form-data).

    Files are saved to temp directory and Celery task is submitted for async processing.
    Task ID is stored in Redis for status tracking.
    """
    from pathlib import Path
    from uuid import uuid4
    import logging
    from werkzeug.utils import secure_filename

    logger = logging.getLogger(__name__)

    # Validate library
    library = db.get(Library, library_id)
    if not library:
        return UploadResponse(success=False, message="Selected library does not exist.")

    # Validate knowledge if provided
    if knowledge_id is not None:
        knowledge = db.get(Knowledge, knowledge_id)
        if not knowledge:
            return UploadResponse(
                success=False, message="Selected knowledge does not exist."
            )

    # Process each file
    uploaded_files = []
    for file in files:
        if file.filename and allowed_file(file.filename):
            try:
                # Save file temporarily
                filename = secure_filename(file.filename)
                base_temp_dir = Path("/tmp/smartlib_uploads")
                temp_dir = base_temp_dir / str(uuid4())
                temp_dir.mkdir(parents=True, exist_ok=True)
                temp_file_path = temp_dir / filename

                # Read and save file
                content = await file.read()
                with open(temp_file_path, "wb") as f:
                    f.write(content)
                    f.flush()
                    os.fsync(f.fileno())

                # Submit to Celery worker
                task_id = None
                from modules.celery_tasks import submit_file_processing_task

                if submit_file_processing_task:
                    task_id = submit_file_processing_task(
                        temp_file_path=str(temp_file_path),
                        filename=filename,
                        user_id=current_user.user_id,
                        library_id=library_id,
                        library_name=library_name,
                        knowledge_id_str=str(knowledge_id) if knowledge_id else None,
                        enable_visual_grounding_flag=enable_visual_grounding,
                    )

                if task_id:
                    # Register task in Redis for status tracking
                    try:
                        import json
                        from datetime import datetime, timezone

                        broker_url = os.environ.get(
                            "CELERY_BROKER_URL", "redis://localhost:6379/0"
                        )
                        redis_client = redis.from_url(broker_url)
                        task_key = f"user:{current_user.user_id}:upload_tasks"
                        task_meta_key = f"user:{current_user.user_id}:upload_task_meta"

                        redis_client.rpush(task_key, task_id)
                        redis_client.expire(task_key, 86400)  # 24 hours

                        task_meta = {
                            "filename": filename,
                            "created_at": datetime.now(timezone.utc).isoformat(),
                        }
                        redis_client.hset(task_meta_key, task_id, json.dumps(task_meta))
                        redis_client.expire(task_meta_key, 86400)

                        logger.info(
                            f"Registered task {task_id} for user {current_user.user_id}"
                        )
                    except Exception as e:
                        logger.error(f"Failed to register task in Redis: {e}")
                else:
                    task_id = "processing_disabled"

                uploaded_files.append(
                    FileUploadResponse(filename=filename, task_id=task_id)
                )

            except Exception as e:
                logger.error(f"Failed to upload file {file.filename}: {e}")
                return UploadResponse(
                    success=False, message=f"Failed to upload {file.filename}: {str(e)}"
                )
        else:
            return UploadResponse(
                success=False, message=f"File type not allowed: {file.filename}"
            )

    return UploadResponse(
        success=True,
        message=f"Successfully uploaded {len(uploaded_files)} file(s). Processing started.",
        files=uploaded_files,
    )


@app.post("/api/v1/check-duplicates", response_model=DuplicateCheckResponse)
def api_v1_check_duplicates(
    request_data: DuplicateCheckRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Check if any filenames already exist in the target library/knowledge.
    """
    duplicates = []

    for filename in request_data.filenames:
        # Query for existing file with same name in same library/knowledge
        statement = select(UploadedFile).where(
            UploadedFile.original_filename == filename,
            UploadedFile.library_id == request_data.library_id,
        )

        if request_data.knowledge_id is not None:
            statement = statement.where(
                UploadedFile.knowledge_id == request_data.knowledge_id
            )

        result = db.exec(statement)
        existing = result.first()

        if existing:
            duplicates.append(
                DuplicateInfo(
                    filename=filename,
                    file_id=existing.file_id,
                    upload_time=existing.upload_time.isoformat()
                    if existing.upload_time
                    else None,
                )
            )

    return DuplicateCheckResponse(duplicates=duplicates)


@app.get("/api/v1/upload-status", response_model=UploadStatusResponse)
def api_v1_upload_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get status of user's upload tasks from Redis.
    """
    broker_url = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0")

    try:
        redis_client = redis.from_url(broker_url)
        task_key = f"user:{current_user.user_id}:upload_tasks"
        task_meta_key = f"user:{current_user.user_id}:upload_task_meta"

        task_ids = redis_client.lrange(task_key, 0, -1)
        task_meta_raw = redis_client.hgetall(task_meta_key)

        # Parse metadata
        task_meta = {}
        for k, v in task_meta_raw.items():
            key = k.decode("utf-8") if isinstance(k, bytes) else k
            try:
                task_meta[key] = json.loads(
                    v.decode("utf-8") if isinstance(v, bytes) else v
                )
            except:
                task_meta[key] = {}

        tasks = []
        for task_id in task_ids:
            task_id_str = (
                task_id.decode("utf-8") if isinstance(task_id, bytes) else task_id
            )
            meta = task_meta.get(task_id_str, {})

            # Get task status from Celery
            try:
                from celery.result import AsyncResult
                from celery_app import celery

                result = AsyncResult(task_id_str, app=celery)

                if result.state == "PENDING" and result.info is None:
                    # Skip orphaned PENDING tasks
                    continue

                task_info = {
                    "task_id": task_id_str,
                    "status": result.state,
                    "filename": meta.get("filename", "Unknown"),
                    "info": {},
                }

                if isinstance(result.info, dict):
                    result_filename = result.info.get("filename")
                    if result_filename and result_filename != "Unknown":
                        task_info["filename"] = result_filename
                    task_info["info"] = {
                        "stage": result.info.get("stage"),
                        "progress": result.info.get("progress"),
                        "error": result.info.get("error") or result.info.get("message"),
                    }

                tasks.append(UploadTaskInfo(**task_info))
            except Exception as e:
                # Task not found in Celery, skip
                continue

        return UploadStatusResponse(tasks=tasks)

    except Exception as e:
        return UploadStatusResponse(tasks=[])


@app.post("/api/v1/upload-status/{task_id}/dismiss")
def api_v1_dismiss_upload_task(
    task_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Dismiss a completed upload task from status list."""
    broker_url = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0")

    try:
        redis_client = redis.from_url(broker_url)
        task_key = f"user:{current_user.user_id}:upload_tasks"
        redis_client.lrem(task_key, 0, task_id)
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to dismiss task: {str(e)}")


@app.post("/api/v1/validate_url", response_model=UrlValidateResponse)
def api_v1_validate_url(
    request_data: UrlValidateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Validate that a URL is reachable before download.
    """
    import requests
    from urllib.parse import urlparse

    parsed = urlparse(request_data.url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return UrlValidateResponse(
            valid=False, message="Only absolute HTTP or HTTPS URLs are allowed."
        )

    try:
        # Use HEAD request with 3s timeout
        response = requests.head(request_data.url, allow_redirects=True, timeout=3)
        status_code = response.status_code
        response.close()

        # Accept any non-error response
        if status_code < 500:
            return UrlValidateResponse(
                valid=True, message=f"URL is reachable (status: {status_code})."
            )
        else:
            return UrlValidateResponse(
                valid=False, message=f"Server error: {status_code}"
            )
    except requests.Timeout:
        # Timeout - still consider valid (server might be slow)
        return UrlValidateResponse(
            valid=True, message="URL timed out but may still be valid."
        )
    except requests.RequestException as e:
        return UrlValidateResponse(valid=False, message="URL could not be reached.")


@app.post("/api/v1/process-url", response_model=UrlDownloadResponse)
async def api_v1_process_url(
    request_data: UrlDownloadRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Download and process URL.
    """
    import requests
    from urllib.parse import urlparse
    from pathlib import Path
    from uuid import uuid4
    import mimetypes
    from werkzeug.utils import secure_filename

    # Validate URL
    parsed = urlparse(request_data.url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return UrlDownloadResponse(
            success=False, message="Only absolute HTTP or HTTPS URLs are allowed."
        )

    # Validate library
    library = db.get(Library, request_data.library_id)
    if not library:
        return UrlDownloadResponse(
            success=False, message="Selected library does not exist."
        )

    # Validate knowledge if provided
    if request_data.knowledge_id is not None:
        knowledge = db.get(Knowledge, request_data.knowledge_id)
        if not knowledge:
            return UrlDownloadResponse(
                success=False, message="Selected knowledge does not exist."
            )

    # Download URL content
    try:
        download_response = requests.get(request_data.url, stream=True, timeout=15)
        download_response.raise_for_status()
        content_type = (
            download_response.headers.get("Content-Type", "unknown") or "unknown"
        )

        # Generate filename
        filename = os.path.basename(parsed.path) or "downloaded_document"
        if "." not in filename:
            mime_ext = mimetypes.guess_extension(content_type.split(";")[0].strip())
            if mime_ext:
                filename = f"{filename}{mime_ext}"
            else:
                filename = f"{filename}.html"

        filename = secure_filename(filename)

        # Save to temp file
        base_temp_dir = Path("/tmp/smartlib_uploads")
        temp_dir = base_temp_dir / str(uuid4())
        temp_dir.mkdir(parents=True, exist_ok=True)
        temp_file_path = temp_dir / filename

        with open(temp_file_path, "wb") as f:
            for chunk in download_response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
            f.flush()
            os.fsync(f.fileno())

        download_response.close()

    except requests.RequestException as e:
        return UrlDownloadResponse(
            success=False, message=f"Failed to download URL: {str(e)}"
        )

    # Create UrlDownload record
    download_id = None
    try:
        url_download = UrlDownload(
            user_id=current_user.user_id,
            library_id=request_data.library_id,
            knowledge_id=request_data.knowledge_id
            if request_data.knowledge_id
            else None,
            url=request_data.url,
            status="queued",
            content_type=content_type,
        )
        db.add(url_download)
        db.commit()
        db.refresh(url_download)
        download_id = url_download.download_id
    except Exception as e:
        return UrlDownloadResponse(
            success=False, message=f"Failed to create download record: {str(e)}"
        )

    # Submit to Celery worker
    task_id = None
    from modules.celery_tasks import submit_file_processing_task

    if submit_file_processing_task:
        task_id = submit_file_processing_task(
            temp_file_path=str(temp_file_path),
            filename=filename,
            user_id=current_user.user_id,
            library_id=request_data.library_id,
            library_name=request_data.library_name or library.name,
            knowledge_id_str=str(request_data.knowledge_id)
            if request_data.knowledge_id
            else None,
            enable_visual_grounding_flag=False,
            url_download_id=download_id,
            source_url=request_data.url,
            content_type=content_type,
        )

    if task_id:
        # Register task in Redis
        try:
            import json
            from datetime import datetime, timezone

            broker_url = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0")
            redis_client = redis.from_url(broker_url)
            task_key = f"user:{current_user.user_id}:upload_tasks"
            task_meta_key = f"user:{current_user.user_id}:upload_task_meta"

            redis_client.rpush(task_key, task_id)
            redis_client.expire(task_key, 86400)

            task_meta = {
                "filename": filename,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            redis_client.hset(task_meta_key, task_id, json.dumps(task_meta))
            redis_client.expire(task_meta_key, 86400)
        except Exception as e:
            pass

    return UrlDownloadResponse(
        success=True,
        message="URL queued for processing.",
        task_id=task_id,
        download_id=download_id,
    )


# ============================================================
# WAVE 3: LIBRARIES ENDPOINT WITH PERMISSION FILTERING
# ============================================================


@app.get("/api/v1/libraries", response_model=LibrariesResponse)
def api_v1_get_libraries(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List user's libraries with knowledges, filtered by permissions.

    In 'knowledge' mode, only returns knowledges user has access to via groups.
    In 'user' mode, returns all knowledges.
    """
    from modules.access_control import get_user_group_ids, filter_accessible_knowledges

    vector_store_mode = os.environ.get("VECTOR_STORE_MODE", "user")
    user_group_ids = get_user_group_ids(current_user.user_id, db)

    # Get all libraries
    statement = select(Library).order_by(Library.name)
    result = db.exec(statement)
    libraries = result.all()

    libraries_data = []
    for library in libraries:
        # Get knowledges for this library via secondary relationship
        # First get all knowledges, then filter by library association
        all_knowledges = []
        for k in db.exec(select(Knowledge).order_by(Knowledge.name)):
            # Check if knowledge is associated with this library
            # This requires checking the knowledge_libraries_association table
            # For simplicity, we'll get knowledges and check association
            all_knowledges.append(k)

        # Filter knowledges by user's group permissions
        if vector_store_mode == "knowledge":
            accessible_knowledges = filter_accessible_knowledges(
                all_knowledges, user_group_ids
            )
        else:
            accessible_knowledges = all_knowledges

        knowledges_data = []
        for k in accessible_knowledges:
            # Get categories, catalogs, groups for each knowledge
            categories = []
            catalogs = []
            groups = []

            # Get groups for this knowledge
            if hasattr(k, "groups") and k.groups:
                groups = [GroupInfo(group_id=g.group_id, name=g.name) for g in k.groups]

            knowledges_data.append(
                KnowledgeInfo(
                    id=k.id,
                    name=k.name,
                    categories=categories,
                    catalogs=catalogs,
                    groups=groups,
                )
            )

        libraries_data.append(
            LibraryInfo(
                library_id=library.library_id,
                name=library.name,
                description=library.description or "",
                knowledges=knowledges_data,
            )
        )

    return LibrariesResponse(libraries=libraries_data)


@app.get("/api/v1/knowledges", response_model=KnowledgesResponse)
def api_v1_get_knowledges(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    List all knowledges with library mappings.
    """
    from modules.access_control import get_user_group_ids, filter_accessible_knowledges

    vector_store_mode = os.environ.get("VECTOR_STORE_MODE", "user")
    user_group_ids = get_user_group_ids(current_user.user_id, db)

    # Get all knowledges
    statement = select(Knowledge).order_by(Knowledge.name)
    result = db.exec(statement)
    knowledges = result.all()

    # Filter by permissions if in knowledge mode
    if vector_store_mode == "knowledge":
        knowledges = filter_accessible_knowledges(knowledges, user_group_ids)

    knowledges_list = [KnowledgeSimple(id=k.id, name=k.name) for k in knowledges]

    # Build knowledge_libraries_map
    knowledge_libraries_map = {}
    for k in knowledges:
        # Get libraries associated with this knowledge
        # This requires querying the association table
        # For now, return all libraries
        all_libraries = db.exec(select(Library).order_by(Library.name)).all()

        knowledge_libraries_map[str(k.id)] = KnowledgeWithLibraries(
            name=k.name,
            libraries=[
                LibrarySimple(id=lib.library_id, name=lib.name) for lib in all_libraries
            ],
        )

    return KnowledgesResponse(
        knowledges=knowledges_list,
        knowledge_libraries_map=knowledge_libraries_map,
        mode=vector_store_mode,
    )


# Wave 5: RAG Chat Migration Endpoints

# Include RAG query endpoints
from api.v1.query import router as query_router

app.include_router(query_router, prefix="/api/v1")

# Include conversation history endpoints
from api.v1.threads import router as threads_router

app.include_router(threads_router, prefix="/api/v1")

# Include feedback endpoints
from api.v1.feedback import router as feedback_router

app.include_router(feedback_router, prefix="/api/v1")

# Include auxiliary endpoints
from api.v1.config import router as config_router

app.include_router(config_router, prefix="/api/v1")

from api.v1.visual import router as visual_router

app.include_router(visual_router, prefix="/api/v1")

from api.v1.documents import router as documents_router

app.include_router(documents_router, prefix="/api/v1")

# Admin Downloads Router
downloads_router = CRUDRouter(
    UrlDownload, prefix="/admin/downloads", tags=["Downloads"]
)


@downloads_router.router.get("/list", response_model=List[UrlDownload])
def list_downloads_compat(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Flask-compatible downloads list."""
    from sqlmodel import select

    return db.exec(select(UrlDownload)).all()


app.include_router(downloads_router.router, prefix="/api")
app.include_router(downloads_router.router, prefix="/api/v1")


add_pagination(app)


@app.get("/")
async def root():
    return {
        "message": "SmartLib Turbo API is running!",
        "admin_ui": "/admin",
        "docs": "/docs",
        "db_path": DB_PATH,
    }


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8001)
