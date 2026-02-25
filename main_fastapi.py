from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqladmin import Admin, ModelView
from database_fastapi import sync_engine, init_db, get_db
from modules.models import (
    User, Group, Library, Knowledge, UploadedFile,
    MessageHistory, LLMProvider, ModelConfig, AppSettings, LLMPrompt,
    LLMLanguage
)
from modules.crud_router import CRUDRouter
from modules.auth import (
    get_password_hash,
    create_access_token,
    get_current_user,
    authenticate_user_async,
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
import uuid

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
admin = Admin(app, sync_engine)

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
models = [
    (User, "/users"), (Group, "/groups"), (Library, "/libraries"),
    (Knowledge, "/knowledges"), (UploadedFile, "/files"),
    (MessageHistory, "/messages"), (LLMProvider, "/providers"),
    (ModelConfig, "/models"), (AppSettings, "/settings"),
    (LLMPrompt, "/prompts"), (LLMLanguage, "/languages")
]

for model, prefix in models:
    crud = CRUDRouter(model, prefix=prefix)
    app.include_router(crud.router, prefix="/api/v1")

# Auth endpoints
@app.post("/api/v1/auth/login", response_model=Token)
async def login(login_data: UserLogin, db = Depends(get_db)):
    """
    Login with email and password.

    Returns JWT access token for authenticated user.
    """
    user = await authenticate_user_async(login_data.email, login_data.password, db)
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
async def register(register_data: UserRegister, db = Depends(get_db)):
    """
    Register a new user account.

    Creates a new user with the given username, email, and password.
    """
    # Check if email already exists
    existing_user = await db.exec(select(User).where(User.email == register_data.email))
    if existing_user.first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    # Check if username already exists
    existing_username = await db.exec(select(User).where(User.username == register_data.username))
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
    await db.commit()
    await db.refresh(user)

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
