from flask_sqlalchemy import SQLAlchemy
from flask_login import LoginManager
from flask_wtf.csrf import CSRFProtect
from sqlalchemy import event
from sqlalchemy.engine import Engine
import sqlite3
import logging

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
        try:
            cursor.execute("PRAGMA journal_mode=WAL;")
            cursor.execute("PRAGMA busy_timeout = 10000;") # 10 seconds, for example
            logger.info("SQLite PRAGMA journal_mode=WAL and busy_timeout=10,000 set for new connection.")
        except sqlite3.Error as e:
            logger.error(f"Failed to set SQLite PRAGMAs: {e}")
        finally:
            cursor.close()
