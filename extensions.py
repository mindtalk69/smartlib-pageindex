from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_wtf.csrf import CSRFProtect
from sqlalchemy import event
from sqlalchemy.engine import Engine
import sqlite3
import logging
import os

# Get a logger instance
logger = logging.getLogger(__name__)

# Initialize extension objects without app instance
db = SQLAlchemy()
login_manager = LoginManager()
csrf = CSRFProtect()

# Event listener to set PRAGMA for SQLite connections
@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """Sets PRAGMA journal_mode=WAL and busy_timeout for SQLite connections."""
    if isinstance(dbapi_connection, sqlite3.Connection):
        cursor = dbapi_connection.cursor()
        journal_mode = os.environ.get("SQLITE_JOURNAL_MODE", "WAL").upper()
        applied_mode = journal_mode
        try:
            cursor.execute(f"PRAGMA journal_mode={journal_mode};")
        except sqlite3.Error as exc:
            logger.warning(
                "Failed to set SQLite journal_mode=%s: %s", journal_mode, exc
            )
            if journal_mode != "DELETE":
                try:
                    cursor.execute("PRAGMA journal_mode=DELETE;")
                    applied_mode = "DELETE"
                    logger.info("SQLite journal_mode fallback to DELETE applied.")
                except sqlite3.Error as fallback_exc:
                    logger.error(
                        "Failed to apply SQLite journal_mode fallback: %s",
                        fallback_exc,
                    )
        else:
            logger.info("SQLite journal_mode set to %s.", applied_mode)

        try:
            cursor.execute("PRAGMA busy_timeout = 10000;")
            logger.info("SQLite busy_timeout set to 10,000 ms.")
        except sqlite3.Error as exc:
            logger.warning("Failed to set SQLite busy_timeout: %s", exc)
        finally:
            cursor.close()
