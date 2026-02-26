from typing import Any, List, Type, TypeVar, Generic, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import SQLModel, select, Session
from fastapi_pagination import Page, Params
from fastapi_pagination.ext.sqlmodel import paginate
from database_fastapi import get_db
from modules.auth import get_current_user, get_current_admin_user
from modules.models import User

ModelType = TypeVar("ModelType", bound=SQLModel)


class CRUDRouter(Generic[ModelType]):
    """
    Generic CRUD router with optional authentication.

    Args:
        model: SQLModel class to create CRUD endpoints for
        prefix: URL prefix for the router (e.g., "/users")
        require_auth: If True, all endpoints require authentication
        user_field: Field name for user ownership filtering (e.g., "user_id")
        tags: List of tags for OpenAPI docs
    """
    def __init__(
        self,
        model: Type[ModelType],
        prefix: str,
        tags: List[str] = None,
        require_auth: bool = True,
        user_field: Optional[str] = None,
    ):
        self.model = model
        self.require_auth = require_auth
        self.user_field = user_field
        self.router = APIRouter(prefix=prefix, tags=tags or [model.__name__])
        self._setup_routes()

    def _get_auth_dependency(self, admin_only: bool = False):
        """Get the appropriate auth dependency based on requirements."""
        if not self.require_auth:
            return None
        return get_current_admin_user if admin_only else get_current_user

    def _setup_routes(self):
        """Setup CRUD routes with optional authentication."""

        @self.router.get("/", response_model=Page[self.model])
        def read_items(
            db: Session = Depends(get_db),
            page: int = 1,
            size: int = 50,
            current_user: Optional[User] = Depends(self._get_auth_dependency()),
        ):
            """List all items with pagination."""
            # If user_field is set and user is not admin, filter by user ownership
            if self.user_field and current_user and not current_user.is_admin:
                query = select(self.model).where(
                    getattr(self.model, self.user_field) == current_user.user_id
                )
            else:
                query = select(self.model)
            return paginate(db, query, Params(page=page, size=size))

        @self.router.get("/{item_id}", response_model=self.model)
        def read_item(
            item_id: Any,
            db: Session = Depends(get_db),
            current_user: Optional[User] = Depends(self._get_auth_dependency()),
        ):
            """Get a single item by ID."""
            item = db.get(self.model, item_id)
            if not item:
                raise HTTPException(status_code=404, detail=f"{self.model.__name__} not found")

            # If user_field is set and user is not admin, check ownership
            if self.user_field and current_user and not current_user.is_admin:
                if getattr(item, self.user_field) != current_user.user_id:
                    raise HTTPException(status_code=403, detail="Access denied")

            return item

        @self.router.post("/", response_model=self.model)
        def create_item(
            item: self.model,
            db: Session = Depends(get_db),
            current_user: User = Depends(self._get_auth_dependency()),
        ):
            """Create a new item."""
            # If user_field is set, set it to current user's ID
            if self.user_field and hasattr(item, self.user_field):
                setattr(item, self.user_field, current_user.user_id)

            db.add(item)
            db.commit()
            db.refresh(item)
            return item

        @self.router.put("/{item_id}", response_model=self.model)
        def update_item(
            item_id: Any,
            item_data: self.model,
            db: Session = Depends(get_db),
            current_user: User = Depends(self._get_auth_dependency()),
        ):
            """Update an existing item."""
            db_item = db.get(self.model, item_id)
            if not db_item:
                raise HTTPException(status_code=404, detail=f"{self.model.__name__} not found")

            # If user_field is set and user is not admin, check ownership
            if self.user_field and not current_user.is_admin:
                if getattr(db_item, self.user_field) != current_user.user_id:
                    raise HTTPException(status_code=403, detail="Access denied")

            obj_data = item_data.model_dump(exclude_unset=True)
            for key, value in obj_data.items():
                setattr(db_item, key, value)

            db.add(db_item)
            db.commit()
            db.refresh(db_item)
            return db_item

        @self.router.delete("/{item_id}")
        def delete_item(
            item_id: Any,
            db: Session = Depends(get_db),
            current_user: User = Depends(self._get_auth_dependency()),
        ):
            """Delete an item."""
            db_item = db.get(self.model, item_id)
            if not db_item:
                raise HTTPException(status_code=404, detail=f"{self.model.__name__} not found")

            # If user_field is set and user is not admin, check ownership
            if self.user_field and not current_user.is_admin:
                if getattr(db_item, self.user_field) != current_user.user_id:
                    raise HTTPException(status_code=403, detail="Access denied")

            db.delete(db_item)
            db.commit()
            return {"ok": True}
