"""
Authentication utilities for FastAPI - JWT token handling and password hashing.
"""
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import select
from database_fastapi import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from modules.models import User

# Configuration
SECRET_KEY = "smartlib-secret-key-change-in-production"  # TODO: Move to environment
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7  # 7 days

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 scheme for token extraction
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a hashed password."""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password using bcrypt."""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token with the given data."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def decode_access_token(token: str) -> Optional[dict]:
    """Decode and validate a JWT access token."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    """
    Get the current user from the JWT token.

    This dependency should be used for all protected endpoints.
    Raises HTTPException 401 if token is invalid or user not found.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_access_token(token)
    if payload is None:
        raise credentials_exception

    user_id: str = payload.get("sub")
    if user_id is None:
        raise credentials_exception

    # Get user from database
    statement = select(User).where(User.user_id == user_id)
    result = await db.exec(statement)
    user = result.first()

    if user is None or user.is_disabled:
        raise credentials_exception

    return user


async def get_current_admin_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Get the current user and verify they are an admin.

    This dependency should be used for admin-only endpoints.
    Raises HTTPException 403 if user is not an admin.
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


def authenticate_user(email: str, password: str, db: AsyncSession) -> Optional[User]:
    """
    Authenticate a user by email and password.

    Returns the User object if authentication succeeds, None otherwise.
    Note: This is sync, use get_user_by_email for async version.
    """
    # This is a helper - actual auth should use the async version below
    pass


async def get_user_by_email(email: str, db: AsyncSession) -> Optional[User]:
    """Get a user by email address."""
    statement = select(User).where(User.email == email)
    result = await db.exec(statement)
    return result.first()


async def authenticate_user_async(email: str, password: str, db: AsyncSession) -> Optional[User]:
    """
    Authenticate a user by email and password asynchronously.

    Returns the User object if authentication succeeds, None otherwise.
    """
    user = await get_user_by_email(email, db)
    if not user:
        return None
    if not user.password_hash:
        return None  # User has no password (e.g., Azure AD user)
    if not verify_password(password, user.password_hash):
        return None
    return user
