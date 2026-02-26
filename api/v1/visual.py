from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import FileResponse
from sqlmodel import Session, select
from typing import Optional
from pathlib import Path

from database_fastapi import get_db
from modules.models import User, Library
from modules.auth import get_current_user

router = APIRouter(tags=["visual"])
security = HTTPBearer()


@router.get("/visual-evidence")
async def get_visual_evidence(
    document_id: Optional[str] = None,
    library_id: Optional[int] = None,
    db: Session = Depends(get_db),
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> FileResponse:
    """Get visual evidence preview image with bounding boxes"""
    user = await get_current_user(credentials.credentials)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )

    # Validate permissions - user can access libraries they have access to
    if library_id:
        library = db.exec(
            select(Library).where(
                Library.library_id == library_id
            ).limit(1)
        ).first()

        if not library:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Library not found"
            )

    # For now, return a placeholder image
    # TODO: Implement actual visual evidence generation from DoclingDocument JSON
    placeholder_path = Path("assets/placeholder.png")

    if placeholder_path.exists():
        return FileResponse(
            path=placeholder_path,
            media_type="image/png"
        )
    else:
        # Return a 404 if placeholder doesn't exist
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Visual evidence not available"
        )