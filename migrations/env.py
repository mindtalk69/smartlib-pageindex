import logging
from logging.config import fileConfig
import os

# --- Load environment variables from .env.dev if present ---
from pathlib import Path
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent / ".env.dev"
    if env_path.exists():
        load_dotenv(dotenv_path=env_path)
except ImportError:
    pass  # If python-dotenv is not installed, skip loading .env.dev

from alembic import context
from sqlalchemy import engine_from_config, pool

# this is the Alembic Config object, which provides access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
fileConfig(config.config_file_name)
logger = logging.getLogger('alembic.env')

# Import your models' MetaData object here for 'autogenerate' support
# Adjust the import path as needed for your project structure
from modules.database import db

target_metadata = db.metadata

# Optionally override the DB URL from the environment
# db_url = os.environ.get("SQLALCHEMY_DATABASE_URI")
# if db_url:
#     config.set_main_option("sqlalchemy.url", db_url)

def run_migrations_offline():
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url, target_metadata=target_metadata, literal_binds=True
    )

    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online():
    """Run migrations in 'online' mode."""
    from sqlalchemy import create_engine

    db_url = os.environ.get("SQLALCHEMY_DATABASE_URI")
    if not db_url:
        raise RuntimeError("SQLALCHEMY_DATABASE_URI environment variable is not set.")

    connectable = create_engine(db_url, poolclass=pool.NullPool)

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )

        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
