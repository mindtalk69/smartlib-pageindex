import os
from dotenv import load_dotenv

SMARTHING_CONFIG_FILE = os.environ.get('SMARTHING_CONFIG_FILE', '.env.dev')

# Load environment variables from .env.dev, especially for secrets
basedir = os.path.abspath(os.path.dirname(__file__))
#dotenv_path = os.path.join(basedir, SMARTHING_CONFIG_FILE)
dotenv_path = os.path.join(basedir, SMARTHING_CONFIG_FILE)

# print(f"DEBUG: Attempting to load .env file from: {dotenv_path}") # Removed print
# Load .env files and allow system environment variables to override
if os.path.exists(dotenv_path):
    # Load .env and explicitly override existing environment variables
    loaded = load_dotenv(dotenv_path, override=True)
    print(f"DEBUG: load_dotenv executed. Variables loaded: {loaded}") # Removed print
    print(f"DEBUG [config.py]: os.environ['VECTOR_STORE_PROVIDER'] after load_dotenv = {os.environ.get('VECTOR_STORE_PROVIDER')}") # Check os.environ
    # Print the specific variable right after loading to see if it was loaded correctly
    # print(f"DEBUG: Value of SQLALCHEMY_DATABASE_URI from os.environ after load_dotenv: {os.environ.get('SQLALCHEMY_DATABASE_URI')}") # Removed print
else:
    print(f"Warning: .env.dev file not found at {dotenv_path}. Relying solely on system environment variables.")

class Config:
    """Base configuration."""
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'you-will-never-guess'
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Ensure the data directory exists before defining the URI
    data_dir = os.path.join(basedir, 'data')
    os.makedirs(data_dir, exist_ok=True)
    print(f"DEBUG: Ensured data directory exists: {data_dir}") # Add debug print

    VECTOR_STORE_PROVIDER = os.environ.get('VECTOR_STORE_PROVIDER', 'pgvector')
    print(f"DEBUG [config.py]: Config.VECTOR_STORE_PROVIDER set to: {VECTOR_STORE_PROVIDER}") # Check value assigned in class
    
    if VECTOR_STORE_PROVIDER == 'pgvector':
        SQLALCHEMY_DATABASE_URI = os.environ.get('SQLALCHEMY_DATABASE_URI') 
    else:
        # Use data_dir variable 
        SQLALCHEMY_DATABASE_URI = 'sqlite:///' + os.path.join(data_dir, 'app.db') or \
            'sqlite:///' +os.environ.get('SQLALCHEMY_DATABASE_URI') 
        
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
    TOKENIZERS_PARALLELISM = os.environ.get('TOKENIZERS_PARALLELISM', 'false').lower() in ('true', '1', 't')

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
    REDIRECT_URI = os.environ.get('REDIRECT_URI')

    # --- Docling Config ---
    DOCLING_EXPORT_TYPE = os.environ.get('DOCLING_EXPORT_TYPE', 'MARKDOWN')
    HF_TOKEN = os.environ.get('HF_TOKEN')

    # --- LangSmith Config (Optional Tracing) ---
    LANGSMITH_TRACING = os.environ.get('LANGSMITH_TRACING', 'false').lower() in ('true', '1', 't')
    LANGSMITH_ENDPOINT = os.environ.get('LANGSMITH_ENDPOINT', "https://api.smith.langchain.com")
    LANGSMITH_API_KEY = os.environ.get('LANGSMITH_API_KEY')
    LANGSMITH_PROJECT = os.environ.get('LANGSMITH_PROJECT')

    
    # --- Vector Store Configuration ---
    # Base path for local vector stores (ChromaDB)    
    LOCAL_VECTOR_STORE_BASE_PATH = os.environ.get('VECTOR_STORE_BASE_PATH', 'data/vector_stores')

    # ChromaDB specific settings
    CHROMA_COLLECTION_NAME = os.environ.get('CHROMA_COLLECTION_NAME', 'documents-vectors') # Default collection name

    # PGVector specific settings (keep these)
    PGVECTOR_CONNECTION_STRING = os.environ.get('PGVECTOR_CONNECTION_STRING',SQLALCHEMY_DATABASE_URI)
    PGVECTOR_COLLECTION_NAME = os.environ.get('PGVECTOR_COLLECTION_NAME', 'documents_vectors')

    # Keep VECTOR_STORE_MODE for structuring local paths (ChromaDB)
    VECTOR_STORE_MODE = os.environ.get('VECTOR_STORE_MODE', 'knowledge').lower() # e.g., knowledge, user, global

    

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
