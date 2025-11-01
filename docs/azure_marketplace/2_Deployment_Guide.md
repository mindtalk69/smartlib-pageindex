# Deployment Guide for Azure Marketplace

## 1. Introduction

This deployment guide provides detailed instructions for deploying the SmartLib application from the Azure Marketplace. SmartLib is a powerful Retrieval-Augmented Generation (RAG) web application that enables organizations to create intelligent knowledge bases with advanced semantic search capabilities.

## 2. Prerequisites

### 2.1 Azure Subscription Requirements
- Active Azure subscription with billing enabled
- Contributor or Owner role on the subscription
- Sufficient quota for the following resources:
  - App Service Plan (minimum B1, recommended P1v2)
  - Azure Redis Cache (for task queue and results storage)
  - Azure Storage Account with Azure Files share
  - Azure OpenAI Service with deployments
  - Azure Database for PostgreSQL (optional, only if choosing PGVector)

### 2.2 Network Requirements
- Outbound internet connectivity for the Azure App Service
- Inbound connectivity to the application (ports 80 and 443)
- Optional: Virtual Network for private connectivity

### 2.3 Authentication Requirements
- Azure AD tenant for Azure AD integration
- Service principal with appropriate permissions (for managed identity)
- App Registration with Client ID and Secret for OAuth authentication

## 3. Deployment Parameters

### 3.1 Required Parameters

| Parameter | Description | Default | Example |
|-----------|-------------|---------|---------|
| appName | Name for the SmartLib application | None | smartlib-demo |
| location | Azure region for deployment | None | East US |
| adminUsername | Admin username for the application | admin | smartlibadmin |
| adminPassword | Admin password for the application | None | (Strong password) |
| adminEmail | Admin email for the application | None | admin@example.com |
| azureOpenAIKey | Azure OpenAI API key | None | (Your API key) |
| azureOpenAIEndpoint | Azure OpenAI endpoint URL | None | https://your-resource.openai.azure.com |
| azureOpenAIDeployment | Azure OpenAI model deployment name | None | gpt-35-turbo |
| azureEmbeddingDeployment | Azure OpenAI embedding deployment name | text-embedding-3-small | text-embedding-3-small |
| storageAccountName | Azure Storage account name | None | smartlibstorage |
| dataShareName | Azure Files share name | None | smartlibdata |
| storageAccountKey | Storage account access key | None | (Your storage key) |
| appServicePlanSkuName | App Service Plan SKU | B1 | B1, S1, or P1v2 |

### 3.2 Optional Parameters

| Parameter | Description | Default | Example |
|-----------|-------------|---------|---------|
| tenantId | Azure AD tenant ID | None | your-tenant-id |
| keyVaultName | Azure Key Vault name | Generated | smartlib-kv |
| APP_CLIENT_ID | Azure AD application client ID | None | your-client-id |
| APP_CLIENT_SECRET | Azure AD application client secret | None | your-client-secret |
| autoPromoteAdmin | Bootstrap admin account on startup | true | true or false |
| runDefaultModels | Run create_default_models.py on startup | false | true or false |
| defaultEmbeddingModel | Default embedding model | text-embedding-3-small | all-MiniLM-L6-v2 |
| appAdminPasswordSecretUri | Key Vault secret URI for admin password | None | https://your-kv.vault.azure.net/secrets/admin-pwd |
| appAdminEmailSecretUri | Key Vault secret URI for admin email | None | https://your-kv.vault.azure.net/secrets/admin-email |
| vectorStoreProvider | Vector store provider to use | chromadb | chromadb or pgvector |

## 4. Deployment Steps

### 4.1 Azure Marketplace Deployment

1. **Access the Marketplace Offering**
   - Navigate to the Azure Marketplace
   - Search for "SmartLib"
   - Click on the SmartLib offering

2. **Create New Deployment**
   - Click "Create" or "Get It Now"
   - Select your subscription and resource group (create a new one if needed)
   - Enter the required parameters from Section 3.1
   - Configure optional parameters as needed

3. **Review and Create**
   - Review the configuration settings
   - Accept the terms and conditions
   - Click "Create" to start the deployment

4. **Monitor Deployment**
   - Deployment typically takes 15-30 minutes
   - Monitor the deployment status in the Azure Portal
   - Check for any deployment errors in the Activity Log

### 4.2 Post-Deployment Verification

1. **Verify App Service**
   ```bash
   # Check Web App Status
   az webapp show \
     --name <your-app-name> \
     --resource-group <your-resource-group> \
     --query state
   # Expected: "Running"

   # Check Logs
   az webapp log tail \
     --name <your-app-name> \
     --resource-group <your-resource-group>
   # Look for: "Starting container..." "Flask app running..."
   ```

2. **Verify Worker Service**
   ```bash
   # Check Worker Status
   az webapp show \
     --name <your-app-name>-worker \
     --resource-group <your-resource-group> \
     --query state
   # Expected: "Running"

   # Check Worker Logs
   az webapp log tail \
     --name <your-app-name>-worker \
     --resource-group <your-resource-group>
   # Look for: "celery@hostname ready" "Connected to redis"
   ```

## 5. Post-Deployment Configuration

### 5.1 Access the Application

1. **Get Application URL**
   - Navigate to the deployed App Service in the Azure Portal
   - Copy the application URL (e.g., https://smartlib-demo.azurewebsites.net)

2. **Initial Login**
   - Open the application URL in a web browser
   - Log in using the admin credentials provided during deployment
   - If you enabled autoPromoteAdmin, your credentials are already set up

### 5.2 Configure Vector Store

1. **Verify Database Connection**
   - Navigate to "Admin > Settings > Database" in the application
   - Confirm the database connection status is "Connected"
   - By default, the application uses SQLite stored on the Azure Files share

2. **Choose Vector Store Provider**
   - Navigate to "Admin > Settings > Vector Store"
   - Default is ChromaDB which uses the file system on Azure Files
   - Alternatively, select PGVector if you've provisioned a PostgreSQL database
   - Click "Save" to apply the settings

3. **Initialize Vector Indices**
   - Navigate to "Admin > Vector Store > Initialize"
   - Click "Initialize Vector Indices"
   - Wait for the initialization to complete

### 5.3 Configure Authentication

1. **Local Authentication**
   - Navigate to "Admin > Settings > Authentication"
   - Configure user registration options
   - Set password policies

2. **Azure AD Authentication (if enabled)**
   - Navigate to "Admin > Settings > Azure AD"
   - Configure the Azure AD tenant ID
   - Set up required claims and roles

### 5.4 Configure OpenAI Integration

1. **Azure OpenAI Configuration**
   - Navigate to "Admin > Integrations > Azure OpenAI"
   - Verify that your Azure OpenAI endpoint and key are correctly configured
   - Configure model deployments if needed

2. **Model Settings**
   - Navigate to "Admin > Models"
   - Configure available models and capabilities
   - Set default models for different operations

### 5.5 Knowledge Base Setup

1. **Create Knowledge Bases**
   - Navigate to "Admin > Knowledge Bases"
   - Click "Add New Knowledge Base"
   - Enter name and description
   - Click "Save"

2. **Set Up Categories and Groups**
   - Navigate to "Admin > Categories" to create document categories
   - Navigate to "Admin > Groups" to set up user groups and permissions

## 6. Data Upload and Ingestion

### 6.1 Document Upload

1. **Direct Upload**
   - Navigate to "Upload" in the main menu
   - Select the target knowledge base
   - Choose files to upload (supported formats include PDF, DOCX, TXT, etc.)
   - Click "Upload" to begin processing

2. **URL Ingestion**
   - Navigate to "Upload > URL Import"
   - Enter the URL to ingest
   - Select the target knowledge base
   - Click "Import" to begin processing

### 6.2 Monitoring Upload Progress

1. **Check Upload Status**
   - Navigate to "Admin > Uploads"
   - View the status of pending and completed uploads
   - Check for any errors in the processing logs

2. **Verify Document Indexing**
   - Navigate to "Admin > Documents"
   - Confirm that uploaded documents appear in the list
   - Check that vector embeddings have been created

## 7. Deployment Validation

### 7.1 Functional Validation

1. **User Authentication**
   - Verify admin login functionality
   - Create a test user and verify login
   - Test password reset functionality

2. **Document Search**
   - Navigate to "Search" in the main menu
   - Enter a query related to your uploaded documents
   - Verify that relevant results are returned

3. **Chat Functionality**
   - Navigate to "Chat" in the main menu
   - Ask questions about your uploaded documents
   - Verify that responses include relevant citations

### 7.2 Performance Validation

1. **Response Time**
   - Measure application response time for various operations
   - Verify that document uploads complete within acceptable timeframes
   - Check query response times under typical load

2. **Scaling Tests**
   - Perform concurrent user tests if possible
   - Monitor resource utilization during peak usage
   - Test the system with increasing document volumes

## 8. Backup and Disaster Recovery

### 8.1 Backup Configuration

1. **Database Backup**
   - For SQLite (default): Azure Files backup is handled automatically
   - For PostgreSQL (optional): Configure regular backups if using PGVector
   - Set appropriate retention policies

2. **Document Backup**
   - Ensure Azure Storage snapshots or backups are enabled
   - Verify that vector store data is included in backup strategy

### 8.2 Disaster Recovery Testing

1. **Recovery Testing**
   - Periodically test restoration from backups
   - Document recovery procedures
   - Verify application functionality after restoration

## 9. Security Configuration

### 9.1 Network Security

1. **TLS Configuration**
   - Ensure TLS 1.2+ is enforced
   - Configure appropriate cipher suites

2. **Access Restrictions**
   - Consider implementing IP restrictions for admin access
   - Configure Azure App Service access restrictions as needed

### 9.2 Authentication Security

1. **Password Policies**
   - Configure strong password requirements
   - Set appropriate password expiration policies

2. **Multi-factor Authentication**
   - Enable MFA for administrative access if possible
   - Configure Azure AD Conditional Access policies

## 10. Monitoring and Alerting

1. **Application Insights**
   - Review Application Insights dashboards
   - Set up custom queries for monitoring key metrics

2. **Alert Configuration**
   - Configure alerts for critical errors
   - Set up notification channels for alerts

## 11. Troubleshooting

### 11.1 Common Issues

1. **Deployment Failures**
   - Check resource constraints and quotas
   - Verify parameter values
   - Review deployment logs in the Activity Log

2. **Connection Issues**
   - Verify network connectivity
   - Check Redis connection string
   - Validate Azure OpenAI endpoints and keys

### 11.2 Log Analysis

1. **Web App Logs**
   - Review App Service logs for errors
   - Check application-specific logs

2. **Worker Logs**
   - Review Celery worker logs
   - Check for task processing errors

## 12. Support Resources

1. **Documentation**
   - Refer to the SmartLib documentation
   - Check Azure Marketplace FAQs

2. **Support Channels**
   - Submit support tickets through the Azure Portal
   - Contact SmartLib support for application-specific issues

## 13. Next Steps

1. **User Training**
   - Train administrators on system management
   - Provide end-user training materials

2. **Customization**
   - Explore customization options
   - Consider integration with other systems

This deployment guide provides a comprehensive overview of the steps required to deploy and configure SmartLib from the Azure Marketplace. Follow these instructions to ensure a successful deployment and optimal system performance.