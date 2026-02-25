from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from sqladmin import Admin, ModelView
from database_fastapi import engine, init_db, get_db
from modules.models import (
    User, Group, Library, Knowledge, UploadedFile,
    MessageHistory, LLMProvider, ModelConfig, AppSettings, LLMPrompt,
    LLMLanguage, UserGroup
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
)
from fastapi_pagination import add_pagination
from database_fastapi import DB_PATH
from sqlmodel import select
from datetime import datetime
import uuid
import os
import json
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

class GroupAdmin(ModelView, model=Group):
    column_list = [Group.group_id, Group.name, Group.created_by_user_id]
    icon = "fa-solid fa-users"

class LibraryAdmin(ModelView, model=Library):
    column_list = [Library.library_id, Library.name, Library.created_by_user_id]
    icon = "fa-solid fa-book"

class KnowledgeAdmin(ModelView, model=Knowledge):
    column_list = [Knowledge.id, Knowledge.name, Knowledge.brand_manufacturer_organization]
    column_searchable_list = [Knowledge.name, Knowledge.brand_manufacturer_organization]
    icon = "fa-solid fa-brain"

class UploadedFileAdmin(ModelView, model=UploadedFile):
    column_list = [UploadedFile.file_id, UploadedFile.original_filename, UploadedFile.user_id]
    icon = "fa-solid fa-file-arrow-up"

class MessageHistoryAdmin(ModelView, model=MessageHistory):
    column_list = [MessageHistory.message_id, MessageHistory.user_id, MessageHistory.timestamp]
    icon = "fa-solid fa-message"

class LLMProviderAdmin(ModelView, model=LLMProvider):
    column_list = [LLMProvider.id, LLMProvider.name, LLMProvider.provider_type, LLMProvider.is_active]
    icon = "fa-solid fa-server"

class ModelConfigAdmin(ModelView, model=ModelConfig):
    column_list = [ModelConfig.id, ModelConfig.name, ModelConfig.deployment_name, ModelConfig.is_default]
    icon = "fa-solid fa-microchip"

class AppSettingsAdmin(ModelView, model=AppSettings):
    column_list = [AppSettings.key, AppSettings.value]
    icon = "fa-solid fa-gear"

class LLMPromptAdmin(ModelView, model=LLMPrompt):
    column_list = [LLMPrompt.id, LLMPrompt.name, LLMPrompt.is_active]
    icon = "fa-solid fa-terminal"

class LLMLanguageAdmin(ModelView, model=LLMLanguage):
    column_list = [LLMLanguage.id, LLMLanguage.language_code, LLMLanguage.language_name, LLMLanguage.is_active]
    icon = "fa-solid fa-language"

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

# Register CRUD API Routers (Turbo API)
# Models with user ownership filtering
user_owned_models = [
    (UploadedFile, "/files", "user_id"),
    (MessageHistory, "/messages", "user_id"),
]

# Models without user ownership (global or admin-managed)
global_models = [
    (User, "/users"), (Group, "/groups"), (Library, "/libraries"),
    (Knowledge, "/knowledges"), (LLMProvider, "/providers"),
    (ModelConfig, "/models"), (AppSettings, "/settings"),
    (LLMPrompt, "/prompts"), (LLMLanguage, "/languages")
]

# Register user-owned models with filtering
for model, prefix, user_field in user_owned_models:
    crud = CRUDRouter(model, prefix=prefix, user_field=user_field, require_auth=True)
    app.include_router(crud.router, prefix="/api/v1")

# Register global models (auth required but no user filtering)
for model, prefix in global_models:
    crud = CRUDRouter(model, prefix=prefix, require_auth=True)
    app.include_router(crud.router, prefix="/api/v1")

# Auth endpoints
@app.post("/api/v1/auth/login", response_model=Token)
def login(login_data: UserLogin, db = Depends(get_db)):
    """
    Login with email and password.

    Returns JWT access token for authenticated user.
    """
    user = authenticate_user_async(login_data.email, login_data.password, db)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if user.is_disabled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is disabled",
        )

    access_token = create_access_token(data={"sub": user.user_id})
    return {"access_token": access_token, "token_type": "bearer"}

@app.post("/api/v1/auth/register", response_model=UserResponse)
def register(register_data: UserRegister, db = Depends(get_db)):
    """
    Register a new user account.

    Creates a new user with the given username, email, and password.
    """
    # Check if email already exists
    existing_user = db.exec(select(User).where(User.email == register_data.email))
    if existing_user.first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Check if username already exists
    existing_username = db.exec(select(User).where(User.username == register_data.username))
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
    return {"message": "Successfully logged out. Please discard your token."}

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
        "visual_grounding_enabled": os.environ.get("VISUAL_GROUNDING_ENABLED", "false").lower() == "true",
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

# Admin User Management endpoints
@app.get("/api/v1/admin/users")
def list_admin_users(
    db = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
    skip: int = 0,
    limit: int = 100,
):
    """
    List all users (admin only).

    Returns paginated list of all users in the system.
    """
    from sqlmodel import select
    statement = select(User).offset(skip).limit(limit)
    result = db.exec(statement)
    users = result.all()
    return {
        "users": [
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
        "total": len(users),
    }

@app.get("/api/v1/admin/users/{user_id}")
def get_admin_user(
    user_id: str,
    db = Depends(get_db),
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
    db = Depends(get_db),
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
    db = Depends(get_db),
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

@app.get("/api/v1/admin/stats")
def get_admin_stats(
    db = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """
    Get system statistics (admin only).

    Returns counts of users, files, libraries, etc.
    """
    from sqlmodel import select, func
    from modules.models import UploadedFile, Library, Knowledge, MessageHistory

    user_count = db.exec(select(func.count(User.user_id))).one()
    file_count = db.exec(select(func.count(UploadedFile.file_id))).one()
    library_count = db.exec(select(func.count(Library.library_id))).one()
    knowledge_count = db.exec(select(func.count(Knowledge.id))).one()
    message_count = db.exec(select(func.count(MessageHistory.message_id))).one()

    return {
        "users": user_count,
        "files": file_count,
        "libraries": library_count,
        "knowledges": knowledge_count,
        "messages": message_count,
    }

add_pagination(app)

# ============================================================
# FLASK COMPATIBILITY ENDPOINTS (/api/*)
# ============================================================
# These endpoints mirror Flask API response formats exactly
# for gradual frontend migration.

def get_user_group_ids(user_id: str, db) -> list:
    """Get list of group IDs for a user."""
    statement = select(UserGroup.group_id).where(UserGroup.user_id == user_id)
    result = db.exec(statement)
    return list(result.all())


# --- Authentication Compatibility Endpoints ---

@app.post("/api/login")
def api_login_flask_compat(
    request: Request,
    login_data: dict,
    db=Depends(get_db)
):
    """
    Flask-compatible login endpoint.
    Accepts {username, password} and returns {success, user}.
    Also returns JWT token for gradual migration.
    """
    username = login_data.get("username", "").strip()
    password = login_data.get("password", "")

    if not username or not password:
        return {
            "success": False,
            "error": "Username and password are required"
        }

    # Try email lookup first (FastAPI style), then username
    user = authenticate_user_async(username, password, db)
    if not user and "@" in username:
        # Try by user_id (email)
        statement = select(User).where(User.user_id == username)
        result = db.exec(statement)
        user_by_email = result.first()
        if user_by_email and verify_password(password, user_by_email.password_hash):
            user = user_by_email

    if not user:
        return {
            "success": False,
            "error": "Invalid username or password",
        }, 401

    if user.is_disabled:
        return {
            "success": False,
            "error": "Account is disabled",
        }, 403

    # Generate JWT token
    access_token = create_access_token(data={"sub": user.user_id})

    # Return Flask-compatible response with additional JWT token
    return {
        "success": True,
        "user": {
            "id": user.user_id,
            "username": user.username,
            "is_admin": user.is_admin,
            "profile_picture_url": None,
        },
        "access_token": access_token,
        "token_type": "bearer",
    }


@app.get("/api/me")
async def api_me_flask_compat(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """Flask-compatible /api/me endpoint."""
    return {
        "authenticated": True,
        "user": {
            "id": current_user.user_id,
            "username": current_user.username,
            "is_admin": current_user.is_admin,
            "profile_picture_url": None,
        }
    }


@app.post("/api/logout")
async def api_logout_flask_compat(
    current_user: User = Depends(get_current_user)
):
    """Flask-compatible logout endpoint."""
    return {"success": True}


# --- Library & Knowledge Endpoints ---

@app.get("/api/libraries")
def api_libraries_flask_compat(
    request: Request,
    db=Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Flask-compatible libraries endpoint.
    Returns libraries with their knowledges, filtered by user permissions.
    """
    vector_store_mode = os.environ.get("VECTOR_STORE_MODE", "user")
    user_group_ids = get_user_group_ids(current_user.user_id, db)

    # Get all libraries
    statement = select(Library).order_by(Library.name)
    result = db.exec(statement)
    libraries = result.all()

    libraries_data = []
    for library in libraries:
        # Get knowledges for this library
        # In knowledge mode, filter by user's groups
        knowledges_data = []

        # Get knowledges (simplified - no group filtering for now)
        knowledge_statement = select(Knowledge).order_by(Knowledge.name)
        knowledge_result = db.exec(knowledge_statement)
        knowledges = knowledge_result.all()

        for k in knowledges:
            knowledges_data.append({
                "id": k.id,
                "name": k.name,
                "categories": [],
                "catalogs": [],
                "groups": [],
            })

        libraries_data.append({
            "library_id": library.library_id,
            "name": library.name,
            "description": library.description or "",
            "knowledges": knowledges_data,
        })

    return {"libraries": libraries_data}


@app.get("/api/knowledges")
def api_knowledges_flask_compat(
    request: Request,
    db=Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Flask-compatible knowledges endpoint.
    Returns knowledges with library mappings.
    """
    vector_store_mode = os.environ.get("VECTOR_STORE_MODE", "user")

    knowledge_libraries_map = {}
    knowledges_list = []

    statement = select(Knowledge).order_by(Knowledge.name)
    result = db.exec(statement)
    knowledges = result.all()

    for k in knowledges:
        knowledges_list.append({"id": k.id, "name": k.name})

        # Get libraries for this knowledge
        # This requires a many-to-many relationship query
        # For now, return all libraries
        library_statement = select(Library).order_by(Library.name)
        library_result = db.exec(library_statement)
        all_libraries = library_result.all()

        knowledge_libraries_map[str(k.id)] = {
            "name": k.name,
            "libraries": [
                {"id": lib.library_id, "name": lib.name}
                for lib in all_libraries
            ]
        }

    return {
        "knowledges": knowledges_list,
        "knowledge_libraries_map": knowledge_libraries_map,
        "mode": vector_store_mode,
    }


# --- Upload Status Endpoints ---

@app.get("/api/upload-status")
def api_upload_status_flask_compat(
    request: Request,
    db=Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Flask-compatible upload status endpoint.
    Returns status of user's upload tasks from Redis.
    """
    broker_url = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0")

    try:
        redis_client = redis.from_url(broker_url)
        task_key = f"user:{current_user.user_id}:upload_tasks"
        task_meta_key = f"user:{current_user.user_id}:upload_task_meta"

        task_ids = redis_client.lrange(task_key, 0, -1)
        task_meta_raw = redis_client.hgetall(task_meta_key)

        task_meta = {}
        for k, v in task_meta_raw.items():
            key = k.decode("utf-8") if isinstance(k, bytes) else k
            try:
                task_meta[key] = json.loads(v.decode("utf-8") if isinstance(v, bytes) else v)
            except:
                task_meta[key] = {}

        tasks = []
        for task_id in task_ids:
            task_id_str = task_id.decode("utf-8") if isinstance(task_id, bytes) else task_id
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
                    "info": {}
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

                tasks.append(task_info)
            except Exception as e:
                # Task not found in Celery, skip
                continue

        return {"tasks": tasks}

    except Exception as e:
        return {"tasks": []}


@app.post("/api/upload-status/{task_id}/dismiss")
def api_dismiss_upload_task(
    task_id: str,
    db=Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Dismiss a completed upload task."""
    broker_url = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0")

    try:
        redis_client = redis.from_url(broker_url)
        task_key = f"user:{current_user.user_id}:upload_tasks"
        redis_client.lrem(task_key, 0, task_id)
        return {"success": True}
    except:
        return {"success": False, "error": "Failed to dismiss task"}, 500


# --- Self-Retriever Questions Endpoint ---

@app.post("/api/self-retriever-questions")
def api_self_retriever_questions(
    request: Request,
    data: dict,
    db=Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate suggested questions for the given knowledge/library context.
    Simplified version - returns static questions for now.
    """
    knowledge_id = data.get("knowledge_id")
    library_id = data.get("library_id")

    # Get knowledge name for context
    knowledge_name = "Knowledge"
    if knowledge_id:
        statement = select(Knowledge).where(Knowledge.id == knowledge_id)
        result = db.exec(statement)
        k = result.first()
        if k:
            knowledge_name = k.name

    # Generate simple questions based on knowledge name
    questions = [
        f"What is {knowledge_name}?",
        f"How do I use {knowledge_name}?",
        f"What are the main features of {knowledge_name}?",
        f"Where can I find documentation for {knowledge_name}?",
        f"Who created {knowledge_name}?",
        f"What are related resources for {knowledge_name}?",
    ]

    return {"questions": questions}


add_pagination(app)

@app.get("/")
async def root():
    return {
        "message": "SmartLib Turbo API is running!",
        "admin_ui": "/admin",
        "docs": "/docs",
        "db_path": DB_PATH
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
