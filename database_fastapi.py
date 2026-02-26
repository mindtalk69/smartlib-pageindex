import os
from sqlalchemy.ext.asyncio import create_async_engine
from sqlmodel import SQLModel, Session, create_engine

# Determine the database path
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data", "smartlib.db")
DATABASE_URL = f"sqlite:///{DB_PATH}"

# Sync Engine for FastAPI and SQLAdmin
engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)

def get_db():
    """FastAPI Dependency for getting database session."""
    with Session(engine) as session:
        yield session

def init_db():
    """Create tables if they don't exist (using SQLModel)"""
    SQLModel.metadata.create_all(engine)
