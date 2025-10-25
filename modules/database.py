import sqlite3 # Keep for old connection functions
import contextlib # Keep for old connection functions
from datetime import datetime, timezone
from pathlib import Path
import logging
from extensions import db # Import the db instance from extensions.py
from sqlalchemy.sql import func # For default timestamps
from sqlalchemy.orm import joinedload, foreign # For eager loading and foreign() annotation
from flask_login import UserMixin # Import UserMixin
from sqlalchemy import text # Keep for potential future raw SQL if needed

DB_PATH = Path(__file__).parent.parent / "data" / "app.db" # Keep for old connection functions
# Ensure data directory exists
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

# Configure basic logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- SQLAlchemy Models ---

# Association table for many-to-many between Knowledge and Catalog

class LLMPrompt(db.Model):
    __tablename__ = 'llm_prompts'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False, unique=True)
    content = db.Column(db.Text, nullable=False)
    description = db.Column(db.String(256), nullable=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, server_default=db.func.now(), nullable=False)
    updated_at = db.Column(db.DateTime, server_default=db.func.now(), onupdate=db.func.now(), nullable=False)
knowledge_catalogs_table = db.Table('knowledge_catalogs',
    db.Column('knowledge_id', db.Integer, db.ForeignKey('knowledges.id', ondelete='CASCADE'), primary_key=True),
    db.Column('catalog_id', db.Integer, db.ForeignKey('catalogs.id', ondelete='CASCADE'), primary_key=True)
)

# Association table for many-to-many between Knowledge and Category
knowledge_category_association = db.Table('knowledge_category_association',
    db.Column('knowledge_id', db.Integer, db.ForeignKey('knowledges.id', ondelete='CASCADE'), primary_key=True),
    db.Column('category_id', db.Integer, db.ForeignKey('categories.id', ondelete='CASCADE'), primary_key=True)
)

# Association table for many-to-many between Knowledge and Library
knowledge_libraries_association = db.Table('knowledge_libraries_association',
    db.Column('knowledge_id', db.Integer, db.ForeignKey('knowledges.id', ondelete='CASCADE'), primary_key=True),
    db.Column('library_id', db.Integer, db.ForeignKey('libraries.library_id', ondelete='CASCADE'), primary_key=True)
)

# Association table for many-to-many between Knowledge and Group
knowledge_groups_association = db.Table('knowledge_groups_association',
    db.Column('knowledge_id', db.Integer, db.ForeignKey('knowledges.id', ondelete='CASCADE'), primary_key=True),
    db.Column('group_id', db.Integer, db.ForeignKey('groups.group_id', ondelete='CASCADE'), primary_key=True)
)

class User(db.Model, UserMixin): # Add UserMixin inheritance
    __tablename__ = 'users'
    # Add get_id method required by UserMixin, mapping to user_id
    def get_id(self):
           return (self.user_id)

    user_id = db.Column(db.String, primary_key=True)
    username = db.Column(db.String, nullable=False)
    auth_provider = db.Column(db.String, nullable=False)
    azure_oid = db.Column(db.String, unique=True, nullable=True) # Assuming unique across providers if set
    email = db.Column(db.String, nullable=True)
    password_hash = db.Column(db.String, nullable=True)
    is_admin = db.Column(db.Boolean, nullable=False, default=False)
    is_disabled = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())

    # Relationships (optional but useful)
    uploaded_files = db.relationship('UploadedFile', backref='uploader', lazy=True)
    message_history = db.relationship('MessageHistory', backref='author', lazy=True)
    libraries_created = db.relationship('Library', backref='creator', lazy=True, foreign_keys='Library.created_by_user_id')
    library_references = db.relationship('LibraryReference', backref='user', lazy=True, foreign_keys='LibraryReference.user_id')
    knowledges_created = db.relationship('Knowledge', backref='creator', lazy=True, foreign_keys='Knowledge.created_by_user_id')
    catalogs_created = db.relationship('Catalog', backref='creator', lazy=True, foreign_keys='Catalog.created_by_user_id')
    categories_created = db.relationship('Category', backref='creator', lazy=True, foreign_keys='Category.created_by_user_id')
    url_downloads = db.relationship('UrlDownload', backref='user', lazy=True)
    user_groups = db.relationship('UserGroup', backref='user', lazy=True, cascade="all, delete-orphan")

    # Explicitly define all constraints with names for better migration support
    __table_args__ = (
        db.UniqueConstraint('auth_provider', 'azure_oid', name='uq_user_auth_provider_azure_oid'),
        db.UniqueConstraint('azure_oid', name='uq_user_azure_oid'), # Add explicit name for azure_oid unique constraint
        # Add other constraints here if needed (e.g., foreign keys if not defined inline)
    )

class Group(db.Model):
    __tablename__ = 'groups'
    group_id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False, unique=True)
    description = db.Column(db.Text, nullable=True)
    created_by_user_id = db.Column(db.String, db.ForeignKey('users.user_id'), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())

    # Add creator relationship for admin display
    creator = db.relationship('User', backref='groups_created', foreign_keys=[created_by_user_id])

    user_groups = db.relationship('UserGroup', backref='group', lazy=True, cascade="all, delete-orphan")
    # Many-to-many: groups <-> knowledges
    knowledges = db.relationship('Knowledge', secondary='knowledge_groups_association', back_populates='groups')
    # Removed vector_references relationship as VectorReference no longer has group_id
    visual_grounding_activities = db.relationship('VisualGroundingActivity', backref='group', lazy=True)

class UserGroup(db.Model):
    __tablename__ = 'user_groups'
    user_id = db.Column(db.String, db.ForeignKey('users.user_id'), primary_key=True)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.group_id'), primary_key=True)
    joined_at = db.Column(db.DateTime(timezone=True), server_default=func.now())

class UploadedFile(db.Model):
    __tablename__ = 'uploaded_files'
    is_ocr = db.Column(db.Boolean, default=False)
    is_az_doci = db.Column(db.Boolean, default=False)
    file_id = db.Column(db.Integer, primary_key=True) # AUTOINCREMENT is default for Integer PK
    user_id = db.Column(db.String, db.ForeignKey('users.user_id'), nullable=False)
    library_id = db.Column(db.Integer, db.ForeignKey('libraries.library_id'), nullable=True)
    knowledge_id = db.Column(db.Integer, db.ForeignKey('knowledges.id'), nullable=True)
    original_filename = db.Column(db.String, nullable=False)
    stored_filename = db.Column(db.String, nullable=False)
    file_size = db.Column(db.Integer, nullable=False)
    upload_time = db.Column(db.DateTime(timezone=True), server_default=func.now())

    # Relationship (optional)
    vector_references = db.relationship('VectorReference', backref='uploaded_file', lazy=True, foreign_keys='VectorReference.file_id')
    # Add overlaps to silence SAWarning about conflicting relationships managing the same column
    library_references = db.relationship(
        'LibraryReference',
        backref='uploaded_file_source',
        lazy=True,
        primaryjoin="and_(LibraryReference.reference_type=='file', foreign(LibraryReference.source_id)==UploadedFile.file_id)",
        overlaps="library,url_download_source,uploaded_file_source" # Explicitly declare overlaps
    )


class MessageHistory(db.Model):
    __tablename__ = 'message_history'
    message_id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String, db.ForeignKey('users.user_id'), nullable=False)
    thread_id = db.Column(db.String(64), nullable=True)  # New: conversation/thread identifier
    message_text = db.Column(db.Text, nullable=False) # Use Text for potentially long messages
    answer = db.Column(db.Text, nullable=True) # AI response/answer
    timestamp = db.Column(db.DateTime(timezone=True), server_default=func.now())
    citations = db.Column(db.Text, nullable=True)  # Store as JSON string
    usage_metadata = db.Column(db.Text, nullable=True)  # Store as JSON string
    suggested_questions = db.Column(db.Text, nullable=True)  # Store as JSON string
    structured_query = db.Column(db.Text, nullable=True) # <<< ADDED: Store the self-query used
    # Relationship to feedback
    feedback = db.relationship('MessageFeedback', backref='message', lazy=True, cascade="all, delete-orphan")

class MessageFeedback(db.Model):
    __tablename__ = 'message_feedback'
    id = db.Column(db.Integer, primary_key=True)
    message_id = db.Column(db.Integer, db.ForeignKey('message_history.message_id'), nullable=False)
    user_id = db.Column(db.String, db.ForeignKey('users.user_id'), nullable=False)
    feedback_type = db.Column(db.String, nullable=False)  # 'like' or 'dislike'
    timestamp = db.Column(db.DateTime(timezone=True), server_default=func.now())
    __table_args__ = (db.UniqueConstraint('message_id', 'user_id', name='uq_message_user_feedback'),)

class Library(db.Model):
    __tablename__ = 'libraries'
    library_id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String, nullable=False, unique=True)
    description = db.Column(db.Text, nullable=True)
    created_by_user_id = db.Column(db.String, db.ForeignKey('users.user_id'), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    # Relationships
    references = db.relationship('LibraryReference', backref='library', lazy=True, cascade="all, delete-orphan") # Delete refs if library deleted
    knowledges = db.relationship('Knowledge', secondary=knowledge_libraries_association, back_populates='libraries')

    # Explicitly define constraints for better migration support (especially SQLite)
    __table_args__ = (
        db.ForeignKeyConstraint(['created_by_user_id'], ['users.user_id'], name='fk_library_created_by'),
    )

class LibraryReference(db.Model):
    __tablename__ = 'library_references'
    reference_id = db.Column(db.Integer, primary_key=True)
    library_id = db.Column(db.Integer, db.ForeignKey('libraries.library_id'), nullable=False)
    user_id = db.Column(db.String, db.ForeignKey('users.user_id'), nullable=False)
    reference_type = db.Column(db.String, nullable=False) # 'file' or 'url_download'
    source_id = db.Column(db.Integer, nullable=False) # file_id or download_id
    added_at = db.Column(db.DateTime(timezone=True), server_default=func.now())

    # Note: Polymorphic relationship for source_id is complex.
    # We might handle this in application logic or use more advanced SQLAlchemy patterns if needed.

class Category(db.Model):
    __tablename__ = 'categories' # Assuming table name is 'categories' based on FK in knowledges
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String, nullable=False, unique=True)
    description = db.Column(db.Text, nullable=True)
    created_by_user_id = db.Column(db.String, db.ForeignKey('users.user_id'), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())

    # Relationships (many-to-many defined via knowledge_category_association)
    knowledges = db.relationship('Knowledge', secondary=knowledge_category_association, back_populates='categories')

class Catalog(db.Model):
    __tablename__ = 'catalogs' # Assuming table name is 'catalogs' based on FK in knowledge_catalogs
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String, nullable=False, unique=True)
    description = db.Column(db.Text, nullable=True)
    created_by_user_id = db.Column(db.String, db.ForeignKey('users.user_id'), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())

    # Relationships (many-to-many defined via knowledge_catalogs_table)
    knowledges = db.relationship('Knowledge', secondary=knowledge_catalogs_table, back_populates='catalogs')


class Knowledge(db.Model):
    __tablename__ = 'knowledges'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String, nullable=False, unique=True)
    description = db.Column(db.Text, nullable=True)
    # Remove direct category_id foreign key
    # category_id = db.Column(db.Integer, db.ForeignKey('categories.id', ondelete='SET NULL'), nullable=True)
    created_by_user_id = db.Column(db.String, db.ForeignKey('users.user_id'), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    embedding_model = db.Column(db.String(255), nullable=True)  # Track which embedding model was used at creation

    # Relationships
    libraries = db.relationship('Library', secondary=knowledge_libraries_association, back_populates='knowledges', lazy=True)
    catalogs = db.relationship('Catalog', secondary=knowledge_catalogs_table, back_populates='knowledges') # Many-to-many with Catalog
    # Add many-to-many relationship with Category
    categories = db.relationship('Category', secondary=knowledge_category_association, back_populates='knowledges')
    # Add many-to-many relationship with Group
    groups = db.relationship('Group', secondary='knowledge_groups_association', back_populates='knowledges')


class LlmLanguage(db.Model):
    __tablename__ = 'llm_languages' # Assuming table name based on functions
    id = db.Column(db.Integer, primary_key=True)
    language_code = db.Column(db.String, nullable=False, unique=True)
    language_name = db.Column(db.String, nullable=False, unique=True)
    is_active = db.Column(db.Boolean, nullable=False, default=False)
    # Allow NULL for created_by to handle existing data during migration
    created_by = db.Column(db.String, nullable=True) # Assuming this stores user_id or username text
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())

class UrlDownload(db.Model):
    __tablename__ = 'url_downloads' # Assuming table name based on functions
    is_ocr = db.Column(db.Boolean, default=False)
    is_az_doci = db.Column(db.Boolean, default=False)
    download_id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String, db.ForeignKey('users.user_id'), nullable=False)
    library_id = db.Column(db.Integer, db.ForeignKey('libraries.library_id'), nullable=True)
    knowledge_id = db.Column(db.Integer, db.ForeignKey('knowledges.id'), nullable=True)
    url = db.Column(db.Text, nullable=False)
    status = db.Column(db.String, nullable=False) # e.g., 'success', 'error'
    content_type = db.Column(db.String, nullable=False, default='unknown')
    error_message = db.Column(db.Text, nullable=True)
    processed_at = db.Column(db.DateTime(timezone=True), server_default=func.now()) # Renamed from download_time in get_url_downloads

    # Relationship (optional)
    vector_references = db.relationship('VectorReference', backref='url_download', lazy=True, foreign_keys='VectorReference.url_download_id')
    # Add overlaps to silence SAWarning about conflicting relationships managing the same column
    library_references = db.relationship(
        'LibraryReference',
        backref='url_download_source',
        lazy=True,
        primaryjoin="and_(LibraryReference.reference_type=='url_download', foreign(LibraryReference.source_id)==UrlDownload.download_id)",
        overlaps="library,uploaded_file_source,url_download_source" # Explicitly declare overlaps
    )


# --- VectorReference Model Restored ---
class VectorReference(db.Model):
    __tablename__ = 'vector_references'
    id = db.Column(db.Integer, primary_key=True) # Restored primary key
    file_id = db.Column(db.Integer, db.ForeignKey('uploaded_files.file_id'), nullable=True)
    url_download_id = db.Column(db.Integer, db.ForeignKey('url_downloads.download_id'), nullable=True)
    chunk_index = db.Column(db.Integer, nullable=False)
    # Remove group_id column as it doesn't exist in the DB
    # group_id = db.Column(db.Integer, db.ForeignKey('groups.group_id'), nullable=True)
    # Comment out timestamp column again as it doesn't exist in the DB
    # added_at = db.Column(db.DateTime(timezone=True), server_default=func.now())

class VisualGroundingActivity(db.Model):
    __tablename__ = 'visual_grounding_activity'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.String, db.ForeignKey('users.user_id'), nullable=False)
    group_id = db.Column(db.Integer, db.ForeignKey('groups.group_id'), nullable=True)
    file_id = db.Column(db.Integer, db.ForeignKey('uploaded_files.file_id'), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    updated_at = db.Column(db.DateTime(timezone=True), onupdate=func.now())
    status = db.Column(db.String, nullable=False, default='pending')

class FolderUploadJob(db.Model):
    __tablename__ = 'folder_upload_jobs'
    id = db.Column(db.Integer, primary_key=True)
    created_by_user_id = db.Column(db.String, db.ForeignKey('users.user_id'), nullable=False)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())
    file_list = db.Column(db.Text, nullable=False)  # JSON-encoded list of files
    file_types = db.Column(db.Text, nullable=True)  # JSON-encoded list of file types
    background_enabled = db.Column(db.Boolean, nullable=False, default=True)
    scheduled_time = db.Column(db.DateTime(timezone=True), nullable=True)
    status = db.Column(db.String, nullable=False, default='pending')  # pending, scheduled, running, completed, failed, cancelled, revoked
    log = db.Column(db.Text, nullable=True)
    task_id = db.Column(db.String, nullable=True) # Store Celery task ID for cancellation
    library_id = db.Column(db.Integer, db.ForeignKey('libraries.library_id'), nullable=True)
    knowledge_id = db.Column(db.Integer, db.ForeignKey('knowledges.id'), nullable=True)
    enable_visual_grounding_for_job = db.Column(db.Boolean, nullable=False, default=False) # Added for job-level VG control

    # Relationships
    user = db.relationship('User', backref='folder_upload_jobs', foreign_keys=[created_by_user_id])
    library = db.relationship('Library', backref='folder_upload_jobs', foreign_keys=[library_id])

# --- RAG Document Metadata Table ---
from sqlalchemy import JSON
import uuid
from sqlalchemy.dialects.postgresql import UUID

class Document(db.Model):
    __tablename__ = 'documents'
    id = db.Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source = db.Column(db.Text, nullable=True)
    library_id = db.Column(db.Integer, nullable=True)
    knowledge_id = db.Column(db.Integer, nullable=True)
    dl_meta = db.Column(JSON, nullable=True)
    docling_json_path = db.Column(db.Text, nullable=True)
    content_preview = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())

class AppSettings(db.Model):
    __tablename__ = 'app_settings'
    key = db.Column(db.String, primary_key=True)
    value = db.Column(db.Text, nullable=False)

# --- Model configuration table for managing LLM deployments ---
class ModelConfig(db.Model):
    """
    Stores model/deployment configurations that can be selected as the site default.
    """
    __tablename__ = 'model_configs'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(128), nullable=False, unique=True)  # Friendly name
    deployment_name = db.Column(db.String(256), nullable=False)   # e.g., Azure deployment id / model alias
    provider = db.Column(db.String(64), nullable=False, default='azure_openai')  # e.g., azure_openai, local
    temperature = db.Column(db.Float, nullable=True)
    streaming = db.Column(db.Boolean, nullable=False, default=False)
    description = db.Column(db.Text, nullable=True)
    is_default = db.Column(db.Boolean, nullable=False, default=False)
    created_by = db.Column(db.String, db.ForeignKey('users.user_id'), nullable=True)
    created_at = db.Column(db.DateTime(timezone=True), server_default=func.now())

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "deployment_name": self.deployment_name,
            "provider": self.provider,
            "temperature": self.temperature,
            "streaming": self.streaming,
            "description": self.description,
            "is_default": self.is_default,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

# --- Helper functions for ModelConfig management ---
def get_models():
    """Return all model configs ordered by name."""
    return ModelConfig.query.order_by(ModelConfig.name).all()

def get_model_by_id(model_id):
    """Return a single ModelConfig by its ID."""
    return db.session.get(ModelConfig, model_id)

def create_model(name, deployment_name, provider='azure_openai', temperature=None, streaming=False, description=None, created_by=None, set_as_default=False):
    """Create a new ModelConfig. If set_as_default is True, unset other defaults."""
    new_model = ModelConfig(
        name=name,
        deployment_name=deployment_name,
        provider=provider,
        temperature=temperature,
        streaming=streaming,
        description=description,
        created_by=created_by
    )
    try:
        if set_as_default:
            # Clear existing defaults
            ModelConfig.query.update({ModelConfig.is_default: False})
        db.session.add(new_model)
        db.session.commit()
        if set_as_default:
            # Ensure only this one is default
            new_model.is_default = True
            db.session.commit()
        return new_model.id
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error creating model config '{name}': {e}", exc_info=True)
        raise

def update_model(model_id, **kwargs):
    """
    Update fields on a ModelConfig.
    Allowed kwargs: name, deployment_name, provider, temperature, streaming, description, is_default
    """
    model = db.session.get(ModelConfig, model_id)
    if not model:
        logging.warning(f"Attempted to update non-existent ModelConfig with ID: {model_id}")
        return False
    try:
        is_default = kwargs.get('is_default', None)
        if is_default:
            # Clear other defaults first
            ModelConfig.query.update({ModelConfig.is_default: False})
        for field in ['name', 'deployment_name', 'provider', 'temperature', 'streaming', 'description', 'is_default']:
            if field in kwargs:
                setattr(model, field, kwargs[field])
        db.session.commit()
        return True
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error updating ModelConfig {model_id}: {e}", exc_info=True)
        raise

def set_default_model(model_id):
    """Set a specific model as the global default; clears previous default."""
    model = db.session.get(ModelConfig, model_id)
    if not model:
        logging.warning(f"Attempted to set default for non-existent ModelConfig ID: {model_id}")
        return False
    try:
        # Clear existing defaults in one statement
        ModelConfig.query.update({ModelConfig.is_default: False})
        model.is_default = True
        db.session.commit()
        logging.info(f"ModelConfig ID {model_id} set as default.")
        return True
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error setting default ModelConfig {model_id}: {e}", exc_info=True)
        raise

def get_default_model():
    """Return the default ModelConfig as a dict or None if not set."""
    logging.info("--- Inside get_default_model ---")
    try:
        default = ModelConfig.query.filter_by(is_default=True).first()
        if default:
            logging.info(f"--- Found default model in DB: ID={default.id}, Name={default.name}, is_default={default.is_default} ---")
            return default.to_dict()
        else:
            logging.info("--- No default model found with is_default=True in DB ---")
            return None
    except Exception as e:
        logging.error(f"--- Error in get_default_model: {e} ---", exc_info=True)
        return None

# --- Old connection functions removed ---

# --- Rewritten User Functions using SQLAlchemy ---

def create_user(auth_provider, user_id, username, azure_oid=None, email=None, password_hash=None, is_admin=False):
    """Create a new user record using SQLAlchemy, ignoring if exists."""
    # Check if user already exists (by primary key)
    existing_user = db.session.get(User, user_id)
    if existing_user:
        logging.info(f"User with user_id {user_id} already exists. Skipping creation.")
        return existing_user # Optionally return the existing user

    # Check unique constraint for azure_oid if provided
    if auth_provider == 'azure' and azure_oid:
        existing_azure_user = User.query.filter_by(auth_provider='azure', azure_oid=azure_oid).first()
        if existing_azure_user:
            logging.warning(f"User with azure_oid {azure_oid} already exists (user_id: {existing_azure_user.user_id}). Skipping creation.")
            # Decide how to handle this - maybe update existing user? For now, skip.
            return existing_azure_user

    new_user = User(
        user_id=user_id,
        username=username,
        auth_provider=auth_provider,
        azure_oid=azure_oid,
        email=email,
        password_hash=password_hash, # Added password_hash
        is_admin=is_admin,
        is_disabled=False # Default value
    )
    try:
        db.session.add(new_user)
        db.session.commit()
        logging.info(f"Created new user with user_id: {user_id}")
        return new_user
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error creating user {user_id}: {e}")
        raise

def get_user_by_username_local(username):
    """Get local user by username using SQLAlchemy."""
    # Removed extra logging added for debugging
    user = User.query.filter_by(username=username, auth_provider='local').first()
    return user

def get_user_by_azure_oid(azure_oid):
    """Get user by Azure Object ID using SQLAlchemy."""
    return User.query.filter_by(auth_provider='azure', azure_oid=azure_oid).first()

def set_user_admin(user_id, is_admin=True):
    """Set admin status for a user using SQLAlchemy."""
    user = db.session.get(User, user_id)
    if user:
        try:
            user.is_admin = is_admin
            db.session.commit()
            logging.info(f"Set admin status for user {user_id} to {is_admin}")
            return True
        except Exception as e:
            db.session.rollback()
            logging.error(f"Error setting admin status for user {user_id}: {e}")
            raise
    else:
        logging.warning(f"User {user_id} not found for setting admin status.")
        return False

def is_user_admin(user_id):
    """Check if user is admin using SQLAlchemy."""
    user = db.session.get(User, user_id)
    return user.is_admin if user else False

def get_user_by_id(user_id):
    """Get user by their primary user_id using SQLAlchemy."""
    # db.session.get is efficient for PK lookups
    return db.session.get(User, user_id)

def toggle_user_disabled_status(user_id):
    """Toggle the is_disabled status for a user using SQLAlchemy."""
    user = db.session.get(User, user_id)
    if not user:
        logging.error(f"User with ID {user_id} not found for toggling disabled status.")
        return False # Indicate user not found

    try:
        new_status = not user.is_disabled
        user.is_disabled = new_status
        db.session.commit()
        logging.info(f"Toggled is_disabled status for user {user_id} to {new_status}.")
        return True # Indicate success
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error toggling disabled status for user {user_id}: {e}")
        raise

# --- Rewritten File/Message Functions using SQLAlchemy ---

def add_uploaded_file(user_id, original_name, stored_name, size, library_id=None, knowledge_id=None, is_ocr=False, is_az_doci=False):
    """Record an uploaded file using SQLAlchemy."""
    new_file = UploadedFile(
        user_id=user_id,
        original_filename=original_name,
        stored_filename=stored_name,
        file_size=size,
        library_id=library_id,
        knowledge_id=knowledge_id,
        is_ocr=is_ocr,
        is_az_doci=is_az_doci
    )
    try:
        db.session.add(new_file)
        db.session.commit()
        logging.info(f"Added uploaded file '{original_name}' for user {user_id}, file_id: {new_file.file_id}, is_ocr: {is_ocr}, is_az_doci: {is_az_doci}")
        return new_file.file_id # Return the auto-generated ID
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error adding uploaded file for user {user_id}: {e}")
        raise

def get_user_files(user_id):
    """Get all files uploaded by a user using SQLAlchemy."""
    return UploadedFile.query.filter_by(user_id=user_id).order_by(UploadedFile.upload_time.desc()).all()

import json

def add_message(user_id, message_text, answer=None, citations=None, usage_metadata=None, suggested_questions=None, thread_id=None, structured_query=None): # <<< ADDED structured_query parameter
    """Record a user message and optional AI answer using SQLAlchemy. Returns the message_id.
    Now supports thread_id for conversation separation."""
    logging.info(f"[add_message] citations type: {type(citations)}, value: {repr(citations)}")
    logging.info(f"[add_message] structured_query: {structured_query}") # <<< ADDED Log
    logging.info(f"[add_message] suggested_questions type: {type(suggested_questions)}, value: {repr(suggested_questions)}")
    new_message = MessageHistory(
        user_id=user_id,
        thread_id=thread_id,
        message_text=message_text,
        answer=answer,
        citations=json.dumps(citations) if citations else None,
        usage_metadata=json.dumps(usage_metadata) if usage_metadata else None,
        suggested_questions=json.dumps(suggested_questions) if suggested_questions else None,
        structured_query=structured_query # <<< ADDED Assignment
    )
    try:
        db.session.add(new_message)
        db.session.commit()
        # Return the autogenerated message ID
        return new_message.message_id
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error adding message for user {user_id}: {e}")
        raise

def get_user_messages(user_id, limit=50, thread_id=None):
    """Get user message history using SQLAlchemy. Returns ORM objects for backend use.
    Now supports thread_id for conversation separation."""
    query = MessageHistory.query.filter_by(user_id=user_id)
    if thread_id is not None:
        query = query.filter_by(thread_id=thread_id)
    return query.order_by(MessageHistory.timestamp.desc()).limit(limit).all()

def get_user_messages_serialized(user_id, limit=50, thread_id=None):
    """Get user message history as serialized dicts for frontend/API.
    Now supports thread_id for conversation separation."""
    query = MessageHistory.query.filter_by(user_id=user_id)
    if thread_id is not None:
        query = query.filter_by(thread_id=thread_id)
    messages = query.order_by(MessageHistory.timestamp.desc()).limit(limit).all()
    result = []
    for msg in reversed(messages):  # chronological order
        # User message
        result.append({
            "role": "user",
            "message": msg.message_text,
            "message_id": msg.message_id,
            "timestamp": msg.timestamp.isoformat() if msg.timestamp else None,
        })
        # Agent answer (if present)
        if msg.answer:
            result.append({
                "role": "agent",
                "message": msg.answer,
                "citations": json.loads(msg.citations) if msg.citations else [],
                "usage_metadata": json.loads(msg.usage_metadata) if msg.usage_metadata else None,
                "suggested_questions": json.loads(msg.suggested_questions) if msg.suggested_questions else [],
            "structured_query": msg.structured_query, # <<< ADDED: Include structured query
                "message_id": msg.message_id,
                "timestamp": msg.timestamp.isoformat() if msg.timestamp else None,
            })
    return result

def count_user_documents(user_id):
    """Count documents uploaded by user using SQLAlchemy."""
    return UploadedFile.query.filter_by(user_id=user_id).count()

def count_user_messages(user_id):
    """Count messages sent by user using SQLAlchemy."""
    return MessageHistory.query.filter_by(user_id=user_id).count()

# --- Rewritten URL Download Functions using SQLAlchemy ---

def create_url_download(user_id, url, status, content_type='unknown', error_message=None, library_id=None, knowledge_id=None, is_ocr=False, is_az_doci=False):
    """Record a URL download attempt using SQLAlchemy."""
    new_download = UrlDownload(
        user_id=user_id,
        url=url,
        status=status,
        content_type=content_type if content_type is not None else 'unknown',
        error_message=error_message,
        library_id=library_id,
        knowledge_id=knowledge_id,
        is_ocr=is_ocr,
        is_az_doci=is_az_doci
        # processed_at is handled by server_default
    )
    try:
        db.session.add(new_download)
        db.session.commit()
        logging.info(f"Recorded URL download for {user_id}, url: {url}, status: {status}, download_id: {new_download.download_id}, is_ocr: {is_ocr}, is_az_doci: {is_az_doci}")
        return new_download.download_id
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error recording URL download for user {user_id}, url: {url}: {e}")
        raise

def get_url_downloads(limit=100):
    """Get all URL downloads for admin view using SQLAlchemy, including library and knowledge names."""
    from modules.database import Library, Knowledge, User
    downloads_data = (
        UrlDownload.query
        .join(User, UrlDownload.user_id == User.user_id)
        .outerjoin(Library, UrlDownload.library_id == Library.library_id)
        .outerjoin(Knowledge, UrlDownload.knowledge_id == Knowledge.id)
        .with_entities(
            UrlDownload.download_id,
            UrlDownload.url,
            UrlDownload.status,
            UrlDownload.content_type,
            UrlDownload.error_message,
            UrlDownload.processed_at,
            User.username,
            Library.name.label('library_name'),
            Knowledge.name.label('knowledge_name'),
            UrlDownload.is_ocr
        )
        .order_by(UrlDownload.processed_at.desc())
        .limit(limit)
        .all()
    )
    downloads = [
        {
            'id': d[0], 'url': d[1], 'status': d[2], 'content_type': d[3],
            'error_message': d[4], 'processed_at': d[5], 'username': d[6],
            'library_name': d[7], 'knowledge_name': d[8],
            'is_ocr': d[9]
        } for d in downloads_data
    ]
    return downloads


# --- Rewritten LLM Language Management Functions using SQLAlchemy ---

def create_llm_language(language_code, language_name, created_by):
    """Create a new LLM language entry using SQLAlchemy."""
    new_lang = LlmLanguage(
        language_code=language_code,
        language_name=language_name,
        created_by=created_by # Assuming created_by stores user_id or username text
        # is_active defaults to False, created_at handled by server_default
    )
    try:
        db.session.add(new_lang)
        db.session.commit()
        logging.info(f"Created LLM language '{language_name}' ({language_code}) with ID: {new_lang.id}")
        return new_lang.id
    except Exception as e: # Catch broader exceptions, IntegrityError is common for unique constraints
        db.session.rollback()
        logging.error(f"Error creating LLM language '{language_name}': {e}")
        # Re-raise to indicate failure, possibly IntegrityError
        raise

def get_llm_languages():
    """Get all LLM languages using SQLAlchemy."""
    # Note: Joining to get creator username might require adjustment if 'created_by' isn't a proper foreign key.
    # For now, return as is. Parsing timestamps is handled by SQLAlchemy.
    return LlmLanguage.query.order_by(LlmLanguage.language_name).all()

def get_active_llm_languages():
    """Get all active LLM languages for dropdowns using SQLAlchemy."""
    return LlmLanguage.query.filter_by(is_active=True).order_by(LlmLanguage.language_name).all()

def get_llm_language_by_id(language_id):
    """Get a single LLM language by its ID using SQLAlchemy."""
    return db.session.get(LlmLanguage, language_id)

def update_llm_language(language_id, language_code, language_name, is_active):
    """Update an existing LLM language using SQLAlchemy."""
    lang = db.session.get(LlmLanguage, language_id)
    if not lang:
        logging.warning(f"Attempted to update non-existent LLM language with ID: {language_id}")
        return False

    try:
        # If setting this language to active, first deactivate all others
        if is_active and not lang.is_active: # Only deactivate others if changing to active
            LlmLanguage.query.filter(LlmLanguage.id != language_id, LlmLanguage.is_active == True).update({'is_active': False})
            logging.info(f"Deactivated other active languages before activating language ID: {language_id}")

        lang.language_code = language_code
        lang.language_name = language_name
        lang.is_active = is_active
        db.session.commit()
        logging.info(f"Updated LLM language with ID: {language_id}. Set active status to {is_active}")
        return True
    except Exception as e: # Catch broader exceptions
        db.session.rollback()
        logging.error(f"Error updating LLM language {language_id}: {e}")
        # Re-raise to indicate failure, possibly IntegrityError
        raise

def delete_llm_language(language_id):
    """Delete an LLM language by its ID using SQLAlchemy."""
    lang = db.session.get(LlmLanguage, language_id)
    if not lang:
        logging.warning(f"Attempted to delete non-existent LLM language with ID: {language_id}")
        return False

    try:
        db.session.delete(lang)
        db.session.commit()
        logging.info(f"Deleted LLM language with ID: {language_id}")
        return True
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error deleting LLM language {language_id}: {e}")
        raise

# --- Rewritten Knowledge Management Functions using SQLAlchemy ---

def create_knowledge(name, description, user_id): # Remove category_id parameter
    """Create a new knowledge entry using SQLAlchemy."""
    # Import to get current embedding model
    from modules.llm_utils import get_current_embedding_model

    try:
        current_embedding = get_current_embedding_model()
        logging.info(f"Creating knowledge '{name}' with embedding model: {current_embedding}")
    except Exception as emb_e:
        current_embedding = "unknown"  # Fallback if unable to determine
        logging.warning(f"Could not determine embedding model during knowledge creation: {emb_e}")

    new_knowledge = Knowledge(
        name=name,
        description=description,
        # category_id=category_id, # Remove assignment
        created_by_user_id=user_id,
        embedding_model=current_embedding
    )
    try:
        db.session.add(new_knowledge)
        db.session.commit()
        logging.info(f"Created knowledge '{name}' with ID: {new_knowledge.id}, embedding: {current_embedding}")
        return new_knowledge.id
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error creating knowledge '{name}': {e}")
        raise

def add_knowledge_catalogs(knowledge_id, catalog_ids):
    """Associate multiple catalogs with a knowledge entry using SQLAlchemy."""
    knowledge = db.session.get(Knowledge, knowledge_id)
    if not knowledge:
        logging.error(f"Knowledge with ID {knowledge_id} not found for associating catalogs.")
        return False

    if not catalog_ids:
        # If no IDs provided, ensure associations are cleared (optional, depends on desired behavior)
        # knowledge.catalogs = []
        # db.session.commit()
        return True

    try:
        # Fetch catalog objects - ensure they exist
        catalogs_to_add = Catalog.query.filter(Catalog.id.in_(catalog_ids)).all()
        existing_catalog_ids = {cat.id for cat in catalogs_to_add}

        # Check if all requested catalog_ids were found
        requested_ids = set(map(int, catalog_ids)) # Ensure requested are ints
        if requested_ids != existing_catalog_ids:
            missing_ids = requested_ids - existing_catalog_ids
            logging.warning(f"Cannot associate non-existent catalog IDs {missing_ids} with knowledge {knowledge_id}")
            # Decide: proceed with found ones or raise error? Proceeding for now.

        # Use the relationship to add associations (SQLAlchemy handles the junction table)
        # Add only the valid, found catalogs
        for catalog in catalogs_to_add:
            if catalog not in knowledge.catalogs: # Avoid duplicates if relationship already exists
                 knowledge.catalogs.append(catalog)

        db.session.commit()
        logging.info(f"Associated catalogs {existing_catalog_ids} with knowledge ID: {knowledge_id}")
        return True
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error associating catalogs with knowledge {knowledge_id}: {e}")
        raise

def get_knowledges():
    """Get all knowledge entries with categories, libraries, groups, and creator username using SQLAlchemy."""
    # Use joinedload for eager loading of related objects to avoid N+1 queries if accessing them later
    return Knowledge.query.options(
        joinedload(Knowledge.categories), # Eager load categories (many-to-many)
        joinedload(Knowledge.creator),    # Eager load creator (User)
        joinedload(Knowledge.libraries),  # Eager load libraries (many-to-many)
        joinedload(Knowledge.groups)      # Eager load groups (many-to-many)
    ).order_by(Knowledge.name).all()

def get_knowledge_by_id(knowledge_id):
    """Get a single knowledge entry by its ID using SQLAlchemy, including categories and catalogs."""
    # Eager load both many-to-many relationships
    return Knowledge.query.options(
        joinedload(Knowledge.categories),
        joinedload(Knowledge.catalogs),
        joinedload(Knowledge.libraries),
        joinedload(Knowledge.groups)
    ).get(knowledge_id)

def get_knowledge_catalogs(knowledge_id):
    """Get Catalog objects associated with a knowledge entry using SQLAlchemy."""
    knowledge = db.session.get(Knowledge, knowledge_id)
    if knowledge:
        # Access the relationship directly
        return knowledge.catalogs # Returns a list of Catalog objects
    return [] # Return empty list if knowledge not found

# Note: This function is likely no longer used directly by the admin edit route,
# as relationship updates are handled there. Keeping it for potential other uses,
# but removing the direct category_id update.
def update_knowledge_basic_info(knowledge_id, name, description):
    """Update basic info (name, description) for an existing knowledge entry."""
    knowledge = db.session.get(Knowledge, knowledge_id)
    if not knowledge:
        logging.warning(f"Attempted to update non-existent knowledge with ID: {knowledge_id}")
        return False

    updated = False
    if name is not None and knowledge.name != name:
        knowledge.name = name
        updated = True
    if description is not None and knowledge.description != description:
        knowledge.description = description
        updated = True
    # Removed category_id update: knowledge.category_id = category_id

    if updated:
        try:
            db.session.commit()
            logging.info(f"Updated basic info for knowledge ID {knowledge_id}")
            return True
        except Exception as e:
            db.session.rollback()
            logging.error(f"Error updating basic info for knowledge {knowledge_id}: {e}")
            raise # Re-raise the exception after rollback
    else:
        logging.info(f"No basic info changes detected for knowledge ID {knowledge_id}.")
        return True # No changes is still considered success
    # The except block below was incorrectly indented. It should be part of the outer try if needed,
    # but since the inner try/except handles the commit, it's likely redundant here. Removing it.
    # except Exception as e:
    #     db.session.rollback()
    #     logging.error(f"Error updating knowledge {knowledge_id}: {e}")
    #     raise

def update_knowledge_catalogs(knowledge_id, catalog_ids):
    """Update the associated catalogs for a knowledge entry using SQLAlchemy."""
    knowledge = db.session.get(Knowledge, knowledge_id)
    if not knowledge:
        logging.error(f"Knowledge with ID {knowledge_id} not found for updating catalogs.")
        return False

    try:
        if not catalog_ids:
            # Clear existing associations if no IDs are provided
            knowledge.catalogs = []
        else:
            # Fetch the Catalog objects for the given IDs
            catalogs_to_set = Catalog.query.filter(Catalog.id.in_(catalog_ids)).all()
            # Directly assign the list of objects to the relationship
            knowledge.catalogs = catalogs_to_set

        db.session.commit()
        updated_ids = [cat.id for cat in knowledge.catalogs]
        logging.info(f"Updated catalog associations for knowledge ID {knowledge_id} to {updated_ids}")
        return True
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error updating catalog associations for knowledge {knowledge_id}: {e}")
        raise

def delete_knowledge(knowledge_id):
    """Delete a knowledge entry using SQLAlchemy (associations handled by cascade)."""
    knowledge = db.session.get(Knowledge, knowledge_id)
    if not knowledge:
        logging.warning(f"Attempted to delete non-existent knowledge with ID: {knowledge_id}")
        return False

    try:
        # SQLAlchemy handles cascading deletes based on relationship/FK definitions
        db.session.delete(knowledge)
        db.session.commit()
        logging.info(f"Deleted knowledge with ID: {knowledge_id} and its associations.")
        return True
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error deleting knowledge {knowledge_id}: {e}")
        raise


# --- Rewritten Library Management Functions using SQLAlchemy ---

def create_library(name, description, user_id, knowledge_id=None):
    """Create a new library using SQLAlchemy."""
    new_library = Library(
        name=name,
        description=description,
        created_by_user_id=user_id
    )
    try:
        db.session.add(new_library)
        if knowledge_id is not None:
            from modules.database import Knowledge
            knowledge = db.session.get(Knowledge, knowledge_id)
            if knowledge:
                knowledge.libraries.append(new_library)
        db.session.commit()
        logging.info(f"Created library '{name}' with ID: {new_library.library_id}")
        return new_library.library_id
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error creating library '{name}': {e}")
        raise

def get_libraries():
    """Get all libraries with creator username using SQLAlchemy."""
    # Eager load the creator (User) relationship
    return Library.query.options(joinedload(Library.creator)).order_by(Library.name).all()

def get_libraries_with_details():
    """Get all libraries with creator, knowledge, categories, and catalogs using SQLAlchemy."""
    # Eager load the necessary relationships to avoid N+1 queries in the template
    return Library.query.options(
        joinedload(Library.creator), # Keep creator info
        joinedload(Library.knowledges).joinedload(Knowledge.categories), # Load knowledges -> categories
        joinedload(Library.knowledges).joinedload(Knowledge.catalogs)  # Load knowledges -> catalogs
    ).order_by(Library.name).all()

def get_library_by_id(library_id):
    """Get a single library by its ID using SQLAlchemy."""
    return db.session.get(Library, library_id)

def update_library(library_id, name, description, knowledge_id):
    """Update an existing library using SQLAlchemy."""
    library = db.session.get(Library, library_id)
    if not library:
        logging.warning(f"Attempted to update non-existent library with ID: {library_id}")
        return False

    # Check for duplicate name in other libraries
    existing = Library.query.filter(Library.name == name, Library.library_id != library_id).first()
    if existing:
        logging.warning(f"Library name '{name}' already exists in another record.")
        return False

    try:
        library.name = name
        library.description = description

        # Update many-to-many knowledge association
        if knowledge_id is not None:
            from modules.database import Knowledge
            knowledge = db.session.get(Knowledge, knowledge_id)
            if knowledge:
                if library not in knowledge.libraries:
                    knowledge.libraries.append(library)
            # Remove library from other knowledges if needed
            for k in library.knowledges[:]:
                if knowledge_id != k.id:
                    library.knowledges.remove(k)
        else:
            # If knowledge_id is None, clear all associations
            library.knowledges = []

        db.session.commit()
        logging.info(f"Updated library with ID: {library_id}")
        return True
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error updating library {library_id}: {e}")
        raise

def delete_library(library_id):
    """Delete a library by its ID using SQLAlchemy (references handled by cascade)."""
    library = db.session.get(Library, library_id)
    if not library:
        logging.warning(f"Attempted to delete non-existent library with ID: {library_id}")
        return False

    try:
        # Cascade delete should handle LibraryReference entries
        db.session.delete(library)
        db.session.commit()
        logging.info(f"Deleted library with ID: {library_id}")
        return True
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error deleting library {library_id}: {e}")
        raise

# --- Rewritten Library Reference Functions using SQLAlchemy ---

def add_library_reference(library_id, user_id, reference_type, source_id):
    """Add a reference linking a source (file/url) to a library using SQLAlchemy."""
    new_ref = LibraryReference(
        library_id=library_id,
        user_id=user_id,
        reference_type=reference_type,
        source_id=source_id
    )
    try:
        db.session.add(new_ref)
        db.session.commit()
        logging.info(f"Added reference type '{reference_type}' source_id {source_id} to library {library_id} for user {user_id}")
        return new_ref.reference_id
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error adding library reference for library {library_id}: {e}")
        raise

# --- Rewritten Catalog Management Functions using SQLAlchemy ---

def create_catalog(name, description, user_id):
    """Create a new catalog using SQLAlchemy."""
    new_catalog = Catalog(
        name=name,
        description=description,
        created_by_user_id=user_id
    )
    try:
        db.session.add(new_catalog)
        db.session.commit()
        logging.info(f"Created catalog '{name}' with ID: {new_catalog.id}")
        return new_catalog.id
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error creating catalog '{name}': {e}")
        raise

def get_catalogs():
    """Get all catalogs with creator username using SQLAlchemy."""
    return Catalog.query.options(joinedload(Catalog.creator)).order_by(Catalog.name).all()

def get_catalog_by_id(catalog_id):
    """Get a single catalog by its ID using SQLAlchemy."""
    return db.session.get(Catalog, catalog_id)

def update_catalog(catalog_id, name, description):
    """Update an existing catalog using SQLAlchemy."""
    catalog = db.session.get(Catalog, catalog_id)
    if not catalog:
        logging.warning(f"Attempted to update non-existent catalog with ID: {catalog_id}")
        return False

    try:
        catalog.name = name
        catalog.description = description
        db.session.commit()
        logging.info(f"Updated catalog with ID: {catalog_id}")
        return True
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error updating catalog {catalog_id}: {e}")
        raise

def delete_catalog(catalog_id):
    """Delete a catalog by its ID using SQLAlchemy (associations handled by cascade)."""
    catalog = db.session.get(Catalog, catalog_id)
    if not catalog:
        logging.warning(f"Attempted to delete non-existent catalog with ID: {catalog_id}")
        return False

    try:
        # Cascade delete should handle knowledge_catalogs entries
        db.session.delete(catalog)
        db.session.commit()
        logging.info(f"Deleted catalog with ID: {catalog_id}")
        return True
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error deleting catalog {catalog_id}: {e}")
        raise

# --- Rewritten Category Management Functions using SQLAlchemy ---

def create_category(name, description, user_id):
    """Create a new category using SQLAlchemy."""
    new_category = Category(
        name=name,
        description=description,
        created_by_user_id=user_id
    )
    try:
        db.session.add(new_category)
        db.session.commit()
        logging.info(f"Created category '{name}' with ID: {new_category.id}")
        return new_category.id
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error creating category '{name}': {e}")
        raise

def get_categories():
    """Get all categories with creator username using SQLAlchemy."""
    return Category.query.options(joinedload(Category.creator)).order_by(Category.name).all()

def get_category_by_id(category_id):
    """Get a single category by its ID using SQLAlchemy."""
    return db.session.get(Category, category_id)

def update_category(category_id, name, description):
    """Update an existing category using SQLAlchemy."""
    category = db.session.get(Category, category_id)
    if not category:
        logging.warning(f"Attempted to update non-existent category with ID: {category_id}")
        return False

    try:
        category.name = name
        category.description = description
        db.session.commit()
        logging.info(f"Updated category with ID: {category_id}")
        return True
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error updating category {category_id}: {e}")
        raise

def delete_category(category_id):
    """Delete a category by its ID using SQLAlchemy."""
    category = db.session.get(Category, category_id)
    if not category:
        logging.warning(f"Attempted to delete non-existent category with ID: {category_id}")
        return False

    try:
        # Check if knowledges reference this category - ON DELETE SET NULL should handle it in DB
        # SQLAlchemy relationship doesn't automatically cascade nullification here, DB constraint does.
        db.session.delete(category)
        db.session.commit()
        logging.info(f"Deleted category with ID: {category_id}")
        return True
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error deleting category {category_id}: {e}")
        raise

# --- Rewritten Vector Reference Functions using ORM (Restored) ---

def add_vector_reference(file_id, url_download_id, chunk_index):
    """Record a reference to a vector chunk using SQLAlchemy ORM."""
    # Create a VectorReference object (assuming the model is now correctly defined)
    new_vector_ref = VectorReference(
        file_id=file_id,
        url_download_id=url_download_id,
        chunk_index=chunk_index
    )
    try:
        db.session.add(new_vector_ref)       
        logging.info(f"Added vector reference via ORM for chunk {chunk_index}") # Optional logging
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error adding vector reference for chunk {chunk_index}: {e}")
        raise

def add_document(id, source, library_id, knowledge_id, dl_meta, content_preview, docling_json_path=None):
    new_document = Document(
        id=id,
        source=source,
        library_id=library_id,
        knowledge_id=knowledge_id,
        dl_meta=dl_meta,
        content_preview=content_preview,
        docling_json_path=docling_json_path
    )
    try:
        db.session.add(new_document)        
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error adding document for Id {id}: {e}")
        raise

def get_document_for_citations(id):
    """ Get dl_meta and docling_json_path column from Document for citations"""    
    return Document.query.filter_by(id=id).first()

    
def get_user_url_downloads(user_id, limit=50):
    """Get URL downloads for specific user using SQLAlchemy."""
    return UrlDownload.query.filter_by(user_id=user_id).order_by(UrlDownload.processed_at.desc()).limit(limit).all()


def add_visual_grounding_activities(user_id, file_id, status=None,group_id=None ):
    """Record a visual grounding activity using SQLAlchemy."""
    
    new_activity = VisualGroundingActivity(        
        user_id = user_id,
        file_id = file_id,
        status = status,
        group_id = group_id
    )
    try:
        db.session.add(new_activity)        
        logging.info(f"Added Visual Grounding Activity for user {user_id}, file_id: {file_id}, group_id: {group_id}")
    except Exception as e:
        db.session.rollback()
        logging.error(f"Error adding Visual Grounding Activity for user {user_id}: {e}")
        raise

    



# --- Database Initialization ---
def init_db():
    """Create all tables for the current SQLAlchemy models."""
    db.create_all()
