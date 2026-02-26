from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlmodel import Session, select
from typing import Dict, Any

from database_fastapi import get_db
from modules.models import AppSettings, User, Library, Knowledge
from modules.auth import get_current_user
from modules.access_control import get_user_group_ids

router = APIRouter(tags=["config"])
security = HTTPBearer()


@router.get("/config")
async def get_app_config(
    request: Request,
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict[str, Any]:
    """Get application configuration for frontend"""
    user = await get_current_user(credentials.credentials)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )

    # Get app settings
    app_settings = db.exec(select(AppSettings)).first()

    # Get user's vector store mode
    vector_store_mode = "user"  # Default
    if user.is_admin:
        # For admin, check if there are any knowledges
        knowledges_count = db.exec(select(Knowledge).where(
            Knowledge.created_by_user_id == str(user.id)
        )).count()
        if knowledges_count > 0:
            vector_store_mode = "knowledge"

    # Get visual grounding enabled setting
    visual_grounding_enabled = app_settings.visual_grounding_enabled if app_settings else False

    return {
        "vector_store_mode": vector_store_mode,
        "visual_grounding_enabled": visual_grounding_enabled,
        "is_admin": user.is_admin,
        "username": user.username
    }


@router.get("/branding")
async def get_branding() -> Dict[str, Any]:
    """Get branding information (public endpoint)"""
    # Get app settings
    from database_fastapi import get_db
    db = next(get_db())

    try:
        app_settings = db.exec(select(AppSettings)).first()

        return {
            "app_name": "SmartLib",
            "logo_url": app_settings.logo_url if app_settings else None
        }
    finally:
        db.close()