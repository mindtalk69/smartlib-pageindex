import os
from dotenv import load_dotenv
import time

SMARTHING_CONFIG_FILE = os.environ.get('SMARTHING_CONFIG_FILE', '.env.dev')

# Load environment variables from .env.dev, especially for secrets
basedir = os.path.abspath(os.path.dirname(__file__))
#dotenv_path = os.path.join(basedir, SMARTHING_CONFIG_FILE)
dotenv_path = os.path.join(basedir, SMARTHING_CONFIG_FILE)

# print(f"DEBUG: Attempting to load .env file from: {dotenv_path}") # Removed print
# Load .env files and allow system environment variables to override
if os.path.exists(dotenv_path):
    # Load .env and explicitly override existing environment variables
    loaded = load_dotenv(dotenv_path, override=False)
    print(f"DEBUG: load_dotenv executed. Variables loaded: {loaded}") # Removed print
    print(f"DEBUG [config.py]: os.environ['VECTOR_STORE_PROVIDER'] after load_dotenv = {os.environ.get('VECTOR_STORE_PROVIDER')}") # Check os.environ
    # Print the specific variable right after loading to see if it was loaded correctly
    # print(f"DEBUG: Value of SQLALCHEMY_DATABASE_URI from os.environ after load_dotenv: {os.environ.get('SQLALCHEMY_DATABASE_URI')}") # Removed print
else:
    print(f"Warning: .env.dev file not found at {dotenv_path}. Relying solely on system environment variables.")

class Config:
    """Base configuration."""
    # Internal build version - update this when deploying new builds
    BUILD_VERSION = "1.1.23"
    BUILD_DATE = "2025-12-10"
    
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'you-will-never-guess'
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Resolve the shared data directory (respect DATA_VOLUME_PATH)
    data_volume_path = os.environ.get('DATA_VOLUME_PATH')
    if data_volume_path:
        data_dir = os.path.abspath(data_volume_path)
    else:
        home_mount = os.path.join('/home', 'data')
        if os.path.isdir('/home') and os.access('/home', os.W_OK | os.X_OK):
            data_dir = home_mount
        else:
            data_dir = os.path.join(basedir, 'data')
    os.makedirs(data_dir, exist_ok=True)
    DATA_VOLUME_PATH = data_dir
    print(f"DEBUG: Ensured data directory exists: {DATA_VOLUME_PATH}") # Add debug print

    log_dir = os.environ.get('LOG_DIR', os.path.join(DATA_VOLUME_PATH, 'logs'))
    os.makedirs(log_dir, exist_ok=True)
    LOG_DIR = log_dir
    APPLICATION_LOG_FILE = os.environ.get(
        'APPLICATION_LOG_FILE',
        os.path.join(LOG_DIR, 'smartlib.log'),
    )
    print(f"DEBUG: Application logs will be written to: {APPLICATION_LOG_FILE}")

    upload_tmp_dir = os.environ.get('UPLOAD_TEMP_DIR', os.path.join(DATA_VOLUME_PATH, 'tmp_uploads'))
    os.makedirs(upload_tmp_dir, exist_ok=True)
    UPLOAD_TEMP_DIR = upload_tmp_dir
    print(f"DEBUG: Ensured upload temp directory exists: {UPLOAD_TEMP_DIR}")

    map_public_dir = os.environ.get('MAP_PUBLIC_DIR', os.path.join(DATA_VOLUME_PATH, 'maps'))
    os.makedirs(map_public_dir, exist_ok=True)
    MAP_PUBLIC_DIR = map_public_dir
    print(f"DEBUG: Ensured map public directory exists: {MAP_PUBLIC_DIR}")

    # --- Tier/Edition Configuration ---
    # APP_EDITION is the primary discriminator for tier-specific behavior
    # Valid values: 'BASIC', 'ENT' (Enterprise)
    # Default to 'BASIC' for backward compatibility with existing deployments
    APP_EDITION = os.environ.get('APP_EDITION', 'BASIC').upper()
    print(f"DEBUG [config.py]: APP_EDITION set to: {APP_EDITION}")

    # Derive VECTOR_STORE_PROVIDER based on APP_EDITION
    # Allow override via VECTOR_STORE_PROVIDER env var for advanced use cases
    if APP_EDITION == 'ENT':
        VECTOR_STORE_PROVIDER = os.environ.get('VECTOR_STORE_PROVIDER', 'pgvector')
    else:
        VECTOR_STORE_PROVIDER = os.environ.get('VECTOR_STORE_PROVIDER', 'chromadb')

    print(f"DEBUG [config.py]: VECTOR_STORE_PROVIDER set to: {VECTOR_STORE_PROVIDER}")

    # --- Database Configuration ---
    if VECTOR_STORE_PROVIDER == 'pgvector':
        # PostgreSQL / PGVector mode (Enterprise tier)
        # Check if PostgreSQL connection components are available (Azure deployment pattern)
        postgres_host = os.environ.get('POSTGRES_HOST')
        postgres_port = os.environ.get('POSTGRES_PORT', '5432')
        postgres_user = os.environ.get('POSTGRES_USER')
        postgres_password = os.environ.get('POSTGRES_PASSWORD')
        postgres_database = os.environ.get('POSTGRES_DATABASE')
        postgres_ssl_mode = os.environ.get('POSTGRES_SSL_MODE', 'require')

        if postgres_host and postgres_user and postgres_password and postgres_database:
            # Build connection string from components (supports Azure Key Vault password references)
            SQLALCHEMY_DATABASE_URI = f"postgresql+psycopg://{postgres_user}:{postgres_password}@{postgres_host}:{postgres_port}/{postgres_database}?sslmode={postgres_ssl_mode}"
            print(f"DEBUG [config.py]: Built PostgreSQL connection string from components (host: {postgres_host}, db: {postgres_database})")
        else:
            # Fallback to SQLALCHEMY_DATABASE_URI environment variable (backward compatibility)
            SQLALCHEMY_DATABASE_URI = os.environ.get('SQLALCHEMY_DATABASE_URI')
            print(f"DEBUG [config.py]: Using SQLALCHEMY_DATABASE_URI from environment variable")
        
        # SAFEGUARD: Enterprise mode MUST have PostgreSQL - fail fast if not configured
        if not SQLALCHEMY_DATABASE_URI or SQLALCHEMY_DATABASE_URI.startswith('sqlite'):
            raise ValueError(
                "Enterprise edition (APP_EDITION=ENT) requires PostgreSQL. "
                "Set POSTGRES_HOST, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DATABASE environment variables, "
                "or set SQLALCHEMY_DATABASE_URI to a PostgreSQL connection string."
            )
        
        # SAFEGUARD: Warn if SQLite files exist in Enterprise mode (cleanup reminder)
        sqlite_path = os.path.join(DATA_VOLUME_PATH, 'app.db')
        if os.path.exists(sqlite_path):
            print(f"WARNING [config.py]: SQLite file '{sqlite_path}' exists but Enterprise mode uses PostgreSQL. Consider deleting it.")
    else:
        # SQLite / ChromaDB mode (Basic tier)
        sqlite_path = os.path.join(DATA_VOLUME_PATH, 'app.db')
        uri_env = os.environ.get('SQLALCHEMY_DATABASE_URI')
        if uri_env and uri_env.startswith('sqlite:///'):
            sqlite_target = uri_env.replace('sqlite:///', '', 1)
            if not os.path.isabs(sqlite_target):
                sqlite_target = os.path.join(basedir, sqlite_target)
            SQLALCHEMY_DATABASE_URI = f"sqlite:///{os.path.normpath(sqlite_target)}"
        else:
            SQLALCHEMY_DATABASE_URI = uri_env or f'sqlite:///{sqlite_path}'

    # --- Feature Flags (Load from env or default) ---
    # Example: Set FEATURE_AZURE_LOGIN_ENABLED=False in .env.dev or system env to disable
    FEATURE_AZURE_LOGIN_ENABLED = os.environ.get('FEATURE_AZURE_LOGIN_ENABLED', 'True').lower() in ('true', '1', 't')
    FEATURE_LOCAL_LOGIN_ENABLED = os.environ.get('FEATURE_LOCAL_LOGIN_ENABLED', 'True').lower() in ('true', '1', 't')
    # Add more feature flags here as needed
    # FEATURE_EXAMPLE_FLAG = False # Example of a flag defaulted to False

    # --- Other App Settings ---
    LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO').upper()
    USER_AGENT = os.environ.get('USER_AGENT', 'FlaskRAG/1.0')
    API_KEY = os.environ.get('API_KEY') # For securing internal APIs if needed
    DEFAULT_SEARCH_STRATEGY = os.environ.get('DEFAULT_SEARCH_STRATEGY', 'mmr').lower()
    TOKENIZERS_PARALLELISM = os.environ.get('TOKENIZERS_PARALLELISM', 'false').lower() in ('true', '1', 't')
    try:
        AGENT_TASK_TIMEOUT = int(os.environ.get('AGENT_TASK_TIMEOUT', '120'))
    except ValueError:
        AGENT_TASK_TIMEOUT = 120
    try:
        RETRIEVAL_OFFLOAD_TIMEOUT = int(os.environ.get('RETRIEVAL_OFFLOAD_TIMEOUT', '180'))
    except ValueError:
        RETRIEVAL_OFFLOAD_TIMEOUT = 180

    # --- Azure OpenAI Config (Load from env) ---
    AZURE_OPENAI_API_KEY = os.environ.get('AZURE_OPENAI_API_KEY')
    AZURE_OPENAI_ENDPOINT = os.environ.get('AZURE_OPENAI_ENDPOINT')
    AZURE_OPENAI_API_VERSION = os.environ.get('AZURE_OPENAI_API_VERSION', '2024-02-01') # Default added
    AZURE_OPENAI_DEPLOYMENT_NAME =  os.environ.get('AZURE_OPENAI_DEPLOYMENT_NAME', 'gpt-4o-mini')

    # --- Azure App Config (Load from env) ---
    APP_CLIENT_ID = os.environ.get('APP_CLIENT_ID')
    APP_CLIENT_SECRET = os.environ.get('APP_CLIENT_SECRET')
    APP_TENANT_ID = os.environ.get('APP_TENANT_ID')
    APP_AUTHORITY = os.environ.get('APP_AUTHORITY') or f"https://login.microsoftonline.com/{os.environ.get('APP_TENANT_ID')}"

    _website_hostname = os.environ.get('WEBSITE_HOSTNAME')
    _default_redirect = (
        f"https://{_website_hostname}/login_azure" if _website_hostname else None
    )
    REDIRECT_URI = os.environ.get('REDIRECT_URI', _default_redirect)

    # --- Docling Config ---
    # TEMPORARY: Hardcoded to DOC_CHUNKS to test visual evidence
    # TODO: Fix Azure environment variable loading issue
    DOCLING_EXPORT_TYPE = 'DOC_CHUNKS'  # os.environ.get('DOCLING_EXPORT_TYPE', 'MARKDOWN')
    HF_TOKEN = os.environ.get('HF_TOKEN')

    # --- LangSmith Config (Optional Tracing) ---
    LANGSMITH_TRACING = os.environ.get('LANGSMITH_TRACING', 'false').lower() in ('true', '1', 't')
    LANGSMITH_ENDPOINT = os.environ.get('LANGSMITH_ENDPOINT', "https://api.smith.langchain.com")
    LANGSMITH_API_KEY = os.environ.get('LANGSMITH_API_KEY')
    LANGSMITH_PROJECT = os.environ.get('LANGSMITH_PROJECT')

    
    # --- Vector Store Configuration ---
    # Base path for local vector stores (ChromaDB)    
    LOCAL_VECTOR_STORE_BASE_PATH = os.environ.get('VECTOR_STORE_BASE_PATH', os.path.join(DATA_VOLUME_PATH, 'chroma'))

    # ChromaDB specific settings
    CHROMA_COLLECTION_NAME = os.environ.get('CHROMA_COLLECTION_NAME', 'documents-vectors') # Default collection name

    # PGVector specific settings (keep these)
    # Use the same connection string as SQLALCHEMY_DATABASE_URI for pgvector, or allow override
    PGVECTOR_CONNECTION_STRING = os.environ.get('PGVECTOR_CONNECTION_STRING', SQLALCHEMY_DATABASE_URI)
    PGVECTOR_COLLECTION_NAME = os.environ.get('PGVECTOR_COLLECTION_NAME', 'documents_vectors')

    # Keep VECTOR_STORE_MODE for structuring local paths (ChromaDB)
    VECTOR_STORE_MODE = os.environ.get('VECTOR_STORE_MODE', 'knowledge').lower() # e.g., knowledge, user, global
    print(f"DEBUG [config.py]: Config.VECTOR_STORE_MODE set to: {VECTOR_STORE_MODE}")
    APP_VERSION = os.environ.get('APP_VERSION') or BUILD_VERSION

    MAP_GENERATE_PNG = os.environ.get('MAP_GENERATE_PNG', 'false').lower() in ('true', '1', 'yes')
    try:
        MAP_RETENTION_HOURS = int(os.environ.get('MAP_RETENTION_HOURS', '24'))
    except ValueError:
        MAP_RETENTION_HOURS = 24
    try:
        MAP_CLEANUP_INTERVAL_HOURS = int(os.environ.get('MAP_CLEANUP_INTERVAL_HOURS', '6'))
    except ValueError:
        MAP_CLEANUP_INTERVAL_HOURS = 6
    MAP_RETENTION_ENABLED = os.environ.get('MAP_RETENTION_ENABLED', 'true').lower() in ('true', '1', 'yes')

    MESSAGE_RETENTION_ENABLED = os.environ.get('MESSAGE_RETENTION_ENABLED', 'true').lower() in ('true', '1', 'yes')
    try:
        MESSAGE_RETENTION_DAYS = int(os.environ.get('MESSAGE_RETENTION_DAYS', '30'))
    except ValueError:
        MESSAGE_RETENTION_DAYS = 30
    try:
        MESSAGE_CLEANUP_INTERVAL_HOURS = int(os.environ.get('MESSAGE_CLEANUP_INTERVAL_HOURS', '24'))
    except ValueError:
        MESSAGE_CLEANUP_INTERVAL_HOURS = 24

    STREAM_BUS_URL = os.environ.get('STREAM_BUS_URL')
    STREAM_QUEUE_PREFIX = os.environ.get('STREAM_QUEUE_PREFIX', 'smartlib:stream:')
    try:
        STREAM_QUEUE_TTL = int(os.environ.get('STREAM_QUEUE_TTL', '600'))
    except ValueError:
        STREAM_QUEUE_TTL = 600
    try:
        STREAM_BLOCK_TIMEOUT_SECONDS = int(
            os.environ.get('STREAM_BLOCK_TIMEOUT_SECONDS', '5')
        )
    except ValueError:
        STREAM_BLOCK_TIMEOUT_SECONDS = 5
    try:
        STREAM_HEARTBEAT_SECONDS = int(os.environ.get('STREAM_HEARTBEAT_SECONDS', '15'))
    except ValueError:
        STREAM_HEARTBEAT_SECONDS = 15
    try:
        STREAM_IDLE_TIMEOUT_SECONDS = int(
            os.environ.get('STREAM_IDLE_TIMEOUT_SECONDS', '300')
        )
    except ValueError:
        STREAM_IDLE_TIMEOUT_SECONDS = 300

    EMBEDDING_WARMUP_ENABLED = os.environ.get('EMBEDDING_WARMUP_ENABLED', 'true').lower() in ('true', '1', 'yes')
    EMBEDDING_WARMUP_TEXT = os.environ.get('EMBEDDING_WARMUP_TEXT', 'SmartLib warmup prompt for embeddings')

    # --- User Limits (Small Business Tier) ---
    try:
        MAX_ACTIVE_USERS = int(os.environ.get('MAX_ACTIVE_USERS', '10'))
    except ValueError:
        MAX_ACTIVE_USERS = 10


class DevelopmentConfig(Config):

    """Development configuration."""
    DEBUG = True
    # Override base settings if needed for development
    SQLALCHEMY_ECHO = False # Useful for debugging SQL


class ProductionConfig(Config):
    """Production configuration."""
    DEBUG = False
    LOG_LEVEL = 'WARNING'
    # Ensure sensitive keys are definitely loaded from env in production
    # Add any production-specific overrides


# Dictionary to map environment names to config classes
config_by_name = dict(
    development=DevelopmentConfig,
    production=ProductionConfig,
    default=DevelopmentConfig # Default to Development if FLASK_ENV not set
)

def get_config():
    """Helper function to get the correct config object based on FLASK_ENV."""
    # Use FLASK_CONFIG environment variable first, then FLASK_ENV, then default
    config_name = os.getenv('FLASK_CONFIG', os.getenv('FLASK_ENV', 'default'))
    return config_by_name.get(config_name, DevelopmentConfig)

# You can add a simple check to print which config is loaded (optional)
# current_config = get_config()
# print(f"Loading configuration: {current_config.__name__}")
