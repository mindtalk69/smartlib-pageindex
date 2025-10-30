#!/bin/bash
set -e

# Azure App Service environment. Login and fetch secrets from Key Vault.
echo "Running in Azure. Authenticating with Managed Identity..."
az login --identity

echo "Running create_keyvault.py to populate secrets..."
# Retry logic for key vault secret creation
MAX_RETRIES=5
RETRY_DELAY=15
RETRY_COUNT=0

# Will Remove tables users
#export CLEAN_USERS_FIRST=true

echo "Attempting to populate secrets in Key Vault..."
until python create_keyvault.py || [ $RETRY_COUNT -eq $MAX_RETRIES ]; do
  RETRY_COUNT=$((RETRY_COUNT+1))
  echo "Failed to populate secrets. Retrying in $RETRY_DELAY seconds... (Attempt $RETRY_COUNT/$MAX_RETRIES)"
  sleep $RETRY_DELAY
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
  echo "FATAL: Failed to populate secrets in Key Vault after $MAX_RETRIES attempts. Exiting."
  exit 1
fi

echo "Successfully populated secrets in Key Vault."

echo "Fetching secrets from Key Vault: $KEY_VAULT_NAME"
echo "The web app name is: $WEB_APP_NAME"

export USER_AGENT=$WEB_APP_NAME

# Fetch secrets and export them as environment variables
# The secret names in Key Vault should be e.g., 'admin-username', 'AzureOpenAI-ApiKey'
export ADMIN_USERNAME=$(az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name "app-admin-username" --query value -o tsv)
export ADMIN_PASSWORD=$(az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name "app-admin-password" --query value -o tsv)
export ADMIN_EMAIL=$(az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name "app-admin-email" --query value -o tsv)
export REDIRECT_URI=$(az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name "redirecturi" --query value -o tsv)
export AZURE_OPENAI_API_KEY=$(az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name "AzureOpenAI-ApiKey" --query value -o tsv)
export AZURE_OPENAI_ENDPOINT=$(az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name "AzureOpenAI-Endpoint" --query value -o tsv)
export AZURE_OPENAI_DEPLOYMENT=$(az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name "AzureOpenAI-Deployment" --query value -o tsv)
export AZURE_OPENAI_API_VERSION=$(az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name "AzureOpenAI-ApiVersion" --query value -o tsv)
export APP_CLIENT_ID=$(az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name "App-Client-Id" --query value -o tsv)
export APP_CLIENT_SECRET=$(az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name "App-Client-Secret" --query value -o tsv)
export TENANT_ID=$(az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name "App-tenant-id" --query value -o tsv)
export APP_AUTHORITY="https://login.microsoftonline.com/$TENANT_ID"
# Add other secrets as needed...

export AZURE_OPENAI_DEPLOYMENT_NAME=$AZURE_OPENAI_DEPLOYMENT
export AZURE_OPENAI_MULTIMODAL_DEPLOYMENT=$AZURE_OPENAI_DEPLOYMENT
export PGVECTOR_COLLECTION_NAME="vector_collection"
export VECTOR_STORE_PROVIDER="chromadb"  # or pgvector
export IS_ENABLED_OCR=1
export DOCLING_EXPORT_TYPE=DOC_CHUNKS
export HF_TOKEN="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"
export SERPER_API_KEY="71cb6463413ed5b49d628c14abd6d5626450b030"
export ANONYMIZED_TELEMETRY=false

echo "Secrets fetched successfully."

# 1. Run Alembic migrations
echo "Running Alembic migrations..."
alembic upgrade head

# 2. Promote admin user
if [ -f promote_admin_sqlalchemy.py ]; then
  echo "Promoting admin user..."
  python promote_admin_sqlalchemy.py
fi

# 3. Create default models
if [ -f create_default_models.py ]; then
  echo "Creating default models..."
  python create_default_models.py
fi

# 4. Start the web application
echo "Starting Gunicorn web server..."
# Use the PORT environment variable provided by the platform (Azure sets PORT).
# Fall back to 8000 for local dev, though Azure will set it.
PORT_TO_USE="${PORT:-8000}"
exec gunicorn app:app \
    --bind "0.0.0.0:${PORT_TO_USE}" \
    --workers 2 \
    --worker-class sync \
    --timeout 300 \
    --access-logfile - \
    --error-logfile - \
    --log-level info
