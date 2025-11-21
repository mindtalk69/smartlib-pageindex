# Azure App Service Storage Mount - Verification & Troubleshooting Guide

## Overview

This guide provides comprehensive step-by-step instructions to verify and troubleshoot the storage mounting error: "Failure mounting the provided storage. Permission was denied."

**Your Configuration:**
- Storage Account: `smartlibstorageacc`
- File Share: `smartlibtest`
- Issue: Permission denied on mount

## Quick Diagnosis Decision Tree

```
Storage Mount Failed?
│
├─ Can read Key Vault secrets? (Check app logs)
│  ├─ NO → Section 1: Fix Managed Identity & Key Vault Access
│  └─ YES → Continue
│
├─ Is storage key valid? (Test with Azure Portal)
│  ├─ NO → Section 2: Fix Storage Key in Key Vault
│  └─ YES → Continue
│
├─ Can reach storage from App Service? (Test connectivity)
│  ├─ NO → Section 3: Fix Network Configuration
│  └─ YES → Continue
│
└─ Secret URI format correct?
   ├─ NO → Section 4: Fix Configuration Format
   └─ YES → Section 5: Advanced Diagnostics
```

---

## Pre-Deployment Verification Checklist

Complete ALL these checks BEFORE deploying:

### ✅ Storage Account Prerequisites

```bash
# Set your variables
STORAGE_ACCOUNT="smartlibstorageacc"
FILE_SHARE="smartlibtest"
STORAGE_RG="<your-storage-resource-group>"
SUBSCRIPTION_ID="<your-subscription-id>"

# 1. Verify storage account exists
az storage account show \
  --name $STORAGE_ACCOUNT \
  --resource-group $STORAGE_RG \
  --subscription $SUBSCRIPTION_ID

# Expected: JSON output with account details
# If ERROR: Fix resource group or storage account name
```

### ✅ File Share Prerequisites

```bash
#

 2. Verify file share exists
az storage share show \
  --name $FILE_SHARE \
  --account-name $STORAGE_ACCOUNT \
  --query "name"

# Expected: "smartlibtest"
# If ERROR: Create file share first
```

**Create file share if missing:**
```bash
az storage share create \
  --name $FILE_SHARE \
  --account-name $STORAGE_ACCOUNT
```

### ✅ Key Vault Prerequisites

```bash
KEY_VAULT_NAME="<your-keyvault-name>"
KV_RG="<your-keyvault-resource-group>"

# 3. Verify Key Vault exists
az keyvault show \
  --name $KEY_VAULT_NAME \
  --resource-group $KV_RG

# Expected: JSON output with vault details
```

### ✅ Storage Key in Key Vault

```bash
# 4. Get storage account key
STORAGE_KEY=$(az storage account keys list \
  --account-name $STORAGE_ACCOUNT \
  --resource-group $STORAGE_RG \
  --query "[0].value" -o tsv)

echo "Storage Key (first 10 chars): ${STORAGE_KEY:0:10}..."

# 5. Store in Key Vault
az keyvault secret set \
  --vault-name $KEY_VAULT_NAME \
  --name "STORAGE-ACCOUNT-KEY" \
  --value "$STORAGE_KEY"

# 6. Get secret URI
SECRET_URI=$(az keyvault secret show \
  --vault-name $KEY_VAULT_NAME \
  --name "STORAGE-ACCOUNT-KEY" \
  --query "id" -o tsv)

echo "Secret URI: $SECRET_URI"

# Expected format: https://<vault>.vault.azure.net/secrets/STORAGE-ACCOUNT-KEY/<version>
```

### ✅ Key Vault RBAC Configuration

```bash
# 7. Verify Key Vault uses RBAC (not access policies)
az keyvault show \
  --name $KEY_VAULT_NAME \
  --query "properties.enableRbacAuthorization"

# Expected: true
# If false, enable RBAC:
az keyvault update \
  --name $KEY_VAULT_NAME \
  --resource-group $KV_RG \
  --enable-rbac-authorization true
```

---

## Section 1: Managed Identity & Key Vault Access

### 1.1 Verify App Service Managed Identity

**Azure Portal:**
1. Navigate to: Azure Portal → App Services → `<your-web-app>` → Identity
2. **System assigned** tab should show: Status = **On**
3. Copy the **Object (principal) ID** (looks like: `12345678-1234-1234-1234-123456789012`)

**Azure CLI:**
```bash
WEB_APP_NAME="<your-web-app-name>"
WORKER_APP_NAME="<your-worker-app-name>"
APP_RG="<your-app-resource-group>"

# Check web app identity
WEB_IDENTITY=$(az webapp identity show \
  --name $WEB_APP_NAME \
  --resource-group $APP_RG \
  --query "principalId" -o tsv)

echo "Web App Identity: $WEB_IDENTITY"

# Check worker app identity
WORKER_IDENTITY=$(az webapp identity show \
  --name $WORKER_APP_NAME \
  --resource-group $APP_RG \
  --query "principalId" -o tsv)

echo "Worker App Identity: $WORKER_IDENTITY"

# If empty, enable system-assigned identity:
az webapp identity assign \
  --name $WEB_APP_NAME \
  --resource-group $APP_RG

az webapp identity assign \
  --name $WORKER_APP_NAME \
  --resource-group $APP_RG
```

### 1.2 Verify Key Vault Role Assignment

**CRITICAL: Check the role is "Key Vault Secrets User" NOT "Key Vault Crypto Officer"**

**Azure Portal:**
1. Navigate to: Key Vault → `<your-keyvault>` → Access control (IAM)
2. Click **Role assignments** tab
3. Search for your web app name
4. Verify role = **Key Vault Secrets User**
5. Repeat for worker app

**Azure CLI:**
```bash
# Get Key Vault resource ID
KV_ID="/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$KV_RG/providers/Microsoft.KeyVault/vaults/$KEY_VAULT_NAME"

# Check web app role assignment
az role assignment list \
  --scope "$KV_ID" \
  --assignee $WEB_IDENTITY \
  --query "[].{Role:roleDefinitionName, Scope:scope}" -o table

# Expected output:
# Role                         Scope
# ---------------------------  ------------------------------------------------
# Key Vault Secrets User       /subscriptions/.../Microsoft.KeyVault/vaults/...

# Check worker app role assignment
az role assignment list \
  --scope "$KV_ID" \
  --assignee $WORKER_IDENTITY \
  --query "[].{Role:roleDefinitionName, Scope:scope}" -o table
```

**❌ WRONG ROLE DETECTED? Fix it:**
```bash
# Remove wrong role (Crypto Officer)
WRONG_ROLE_ID="b86a8fe4-44ce-4948-aee5-eccb2c155cd7"
az role assignment delete \
  --assignee $WEB_IDENTITY \
  --role $WRONG_ROLE_ID \
  --scope "$KV_ID"

# Assign correct role (Secrets User)
CORRECT_ROLE_ID="4633458b-17de-408a-b874-0445c86b69e6"
az role assignment create \
  --assignee $WEB_IDENTITY \
  --role $CORRECT_ROLE_ID \
  --scope "$KV_ID"

# Repeat for worker
az role assignment delete \
  --assignee $WORKER_IDENTITY \
  --role $WRONG_ROLE_ID \
  --scope "$KV_ID"

az role assignment create \
  --assignee $WORKER_IDENTITY \
  --role $CORRECT_ROLE_ID \
  --scope "$KV_ID"

# IMPORTANT: Wait 10 minutes for propagation
echo "Waiting for role propagation... (this takes 5-10 minutes)"
```

### 1.3 Test Key Vault Access

**From Azure Cloud Shell or local Azure CLI:**
```bash
# Get access token for web app identity
ACCESS_TOKEN=$(az account get-access-token \
  --resource "https://vault.azure.net" \
  --query "accessToken" -o tsv)

# Test reading secret
curl -X GET \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  "https://$KEY_VAULT_NAME.vault.azure.net/secrets/STORAGE-ACCOUNT-KEY?api-version=7.4"

# Expected: JSON with secret value (base64 encoded)
# Error 403: Role assignment not working or not propagated
# Error 404: Secret doesn't exist
```

**Test from App Service (via Kudu Console):**
```bash
# SSH into web app
az webapp ssh --name $WEB_APP_NAME --resource-group $APP_RG

# Inside container, test Key Vault access
curl -H "Metadata: true" \
  "http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://vault.azure.net" \
  | jq -r .access_token > /tmp/token.txt

# Use token to read secret
curl -H "Authorization: Bearer $(cat /tmp/token.txt)" \
  "https://$KEY_VAULT_NAME.vault.azure.net/secrets/STORAGE-ACCOUNT-KEY?api-version=7.4"

# Expected: JSON with secret value
# If fails: Managed identity not working or wrong role
```

---

## Section 2: Storage Key Validation

### 2.1 Verify Storage Key in Key Vault

```bash
# Read secret from Key Vault
STORED_KEY=$(az keyvault secret show \
  --vault-name $KEY_VAULT_NAME \
  --name "STORAGE-ACCOUNT-KEY" \
  --query "value" -o tsv)

echo "Stored key (first 10 chars): ${STORED_KEY:0:10}..."

# Get current storage key
CURRENT_KEY=$(az storage account keys list \
  --account-name $STORAGE_ACCOUNT \
  --resource-group $STORAGE_RG \
  --query "[0].value" -o tsv)

echo "Current key (first 10 chars): ${CURRENT_KEY:0:10}..."

# Compare keys
if [ "$STORED_KEY" == "$CURRENT_KEY" ]; then
  echo "✅ Keys match!"
else
  echo "❌ Keys DO NOT match - updating Key Vault..."
  az keyvault secret set \
    --vault-name $KEY_VAULT_NAME \
    --name "STORAGE-ACCOUNT-KEY" \
    --value "$CURRENT_KEY"
fi
```

### 2.2 Test Storage Access with Key

```bash
# Test file share access with the key
az storage file list \
  --share-name $FILE_SHARE \
  --account-name $STORAGE_ACCOUNT \
  --account-key "$CURRENT_KEY"

# Expected: List of files (may be empty)
# Error: Invalid key or network issue
```

### 2.3 Verify Secret URI Format

```bash
# Get and validate secret URI
SECRET_URI=$(az keyvault secret show \
  --vault-name $KEY_VAULT_NAME \
  --name "STORAGE-ACCOUNT-KEY" \
  --query "id" -o tsv)

echo "Secret URI: $SECRET_URI"

# Correct format: https://<vault-name>.vault.azure.net/secrets/<secret-name>/<version>
# Example: https://mykeyvault.vault.azure.net/secrets/STORAGE-ACCOUNT-KEY/abc123def456

# Validate format
if [[ $SECRET_URI =~ ^https://.*\.vault\.azure\.net/secrets/.*/.*$ ]]; then
  echo "✅ Secret URI format is valid"
else
  echo "❌ Secret URI format is INVALID"
  echo "Expected: https://VAULT.vault.azure.net/secrets/NAME/VERSION"
fi
```

---

## Section 3: Network Configuration

### 3.1 Storage Account Firewall Rules

**Azure Portal:**
1. Navigate to: Storage Account → `smartlibstorageacc` → Networking
2. Check **Firewalls and virtual networks**

**Recommended Settings:**
- **Public network access**: Enabled from selected virtual networks and IP addresses
- **Add your client IP address**: ✓ Checked (for testing)
- **Allow Azure services on the trusted services list**: ✓ Checked
- **Exception**: Microsoft.Web (App Service) should be allowed

**Azure CLI:**
```bash
# Check current firewall settings
az storage account show \
  --name $STORAGE_ACCOUNT \
  --resource-group $STORAGE_RG \
  --query "networkRuleSet" -o json

# Allow App Service access
az storage account update \
  --name $STORAGE_ACCOUNT \
  --resource-group $STORAGE_RG \
  --bypass AzureServices

# If using VNet integration, add subnet
APP_SUBNET_ID="/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$APP_RG/providers/Microsoft.Network/virtualNetworks/<vnet-name>/subnets/<subnet-name>"

az storage account network-rule add \
  --account-name $STORAGE_ACCOUNT \
  --resource-group $STORAGE_RG \
  --subnet $APP_SUBNET_ID
```

### 3.2 App Service VNet Integration (if applicable)

**Check if using VNet Integration:**
```bash
# Check web app VNet integration
az webapp vnet-integration list \
  --name $WEB_APP_NAME \
  --resource-group $APP_RG

# If empty: Not using VNet integration (skip this section)
# If output: Note the subnet ID
```

**If using VNet, verify service endpoints:**
```bash
VNET_NAME="<your-vnet-name>"
SUBNET_NAME="<your-subnet-name>"
VNET_RG="<your-vnet-resource-group>"

# Check subnet service endpoints
az network vnet subnet show \
  --name $SUBNET_NAME \
  --vnet-name $VNET_NAME \
  --resource-group $VNET_RG \
  --query "serviceEndpoints[].service" -o table

# Expected: Should include "Microsoft.Storage"
# If missing, add it:
az network vnet subnet update \
  --name $SUBNET_NAME \
  --vnet-name $VNET_NAME \
  --resource-group $VNET_RG \
  --service-endpoints Microsoft.Storage Microsoft.KeyVault
```

### 3.3 Network Security Groups (NSG)

```bash
# Get NSG associated with app service subnet
NSG_ID=$(az network vnet subnet show \
  --name $SUBNET_NAME \
  --vnet-name $VNET_NAME \
  --resource-group $VNET_RG \
  --query "networkSecurityGroup.id" -o tsv)

if [ -n "$NSG_ID" ]; then
  echo "NSG ID: $NSG_ID"
  
  # List NSG rules
  az network nsg show --ids $NSG_ID --query "securityRules" -o table
  
  # Check for rules blocking port 445 (SMB) or 443 (HTTPS)
  # Ensure outbound rules allow:
  # - Destination: Storage (service tag)
  # - Port: 443, 445
fi
```

### 3.4 Test Network Connectivity

**From App Service to Storage:**
```bash
# SSH into web app
az webapp ssh --name $WEB_APP_NAME --resource-group $APP_RG

# Inside container
# Test DNS resolution
nslookup $STORAGE_ACCOUNT.file.core.windows.net

# Test connectivity to storage (port 443)
curl -v https://$STORAGE_ACCOUNT.file.core.windows.net

# Test connectivity to Key Vault
curl -v https://$KEY_VAULT_NAME.vault.azure.net

# Expected: Connection successful
# If fails: Network/firewall issue
```

---

## Section 4: App Service Configuration

### 4.1 Verify Azure Files Mount Configuration

**Azure Portal:**
1. Navigate to: App Service → `<web-app>` → Configuration → Path mappings
2. Check **Azure Storage mounts** section

**Expected Configuration:**
```
Name: data
Type: Azure Files
Storage account: smartlibstorageacc
Share name: smartlibtest
Access key: @Microsoft.KeyVault(SecretUri=https://...)
Mount path: /home/data
```

**Azure CLI:**
```bash
# Get current storage mount configuration
az webapp config storage-account list \
  --name $WEB_APP_NAME \
  --resource-group $APP_RG

# Expected output (JSON):
{
  "data": {
    "accessKey": "@Microsoft.KeyVault(SecretUri=https://...)",
    "accountName": "smartlibstorageacc",
    "mountPath": "/home/data",
    "shareName": "smartlibtest",
    "state": "Ok",
    "type": "AzureFiles"
  }
}

# Check "state" field:
# "Ok" = Mount successful
# "InvalidCredentials" = Wrong key or can't read from Key Vault
# "InvalidMount" = Share doesn't exist or network issue
```

### 4.2 Update Storage Mount Configuration

**If configuration is wrong or missing:**
```bash
# Remove existing mount
az webapp config storage-account delete \
  --name $WEB_APP_NAME \
  --resource-group $APP_RG \
  --custom-id data

# Add correct mount with Key Vault reference
az webapp config storage-account add \
  --name $WEB_APP_NAME \
  --resource-group $APP_RG \
  --custom-id data \
  --storage-type AzureFiles \
  --account-name $STORAGE_ACCOUNT \
  --share-name $FILE_SHARE \
  --access-key "@Microsoft.KeyVault(SecretUri=$SECRET_URI)" \
  --mount-path "/home/data"

# Repeat for worker app
az webapp config storage-account delete \
  --name $WORKER_APP_NAME \
  --resource-group $APP_RG \
  --custom-id data

az webapp config storage-account add \
  --name $WORKER_APP_NAME \
  --resource-group $APP_RG \
  --custom-id data \
  --storage-type AzureFiles \
  --account-name $STORAGE_ACCOUNT \
  --share-name $FILE_SHARE \
  --access-key "@Microsoft.KeyVault(SecretUri=$SECRET_URI)" \
  --mount-path "/home/data"
```

### 4.3 Verify App Settings

```bash
# Check Key Vault name setting
az webapp config appsettings list \
  --name $WEB_APP_NAME \
  --resource-group $APP_RG \
  --query "[?name=='KEY_VAULT_NAME'].value" -o tsv

# Should output: your-keyvault-name

# Check if WEBSITES_ENABLE_APP_SERVICE_STORAGE is set correctly
az webapp config appsettings list \
  --name $WEB_APP_NAME \
  --resource-group $APP_RG \
  --query "[?name=='WEBSITES_ENABLE_APP_SERVICE_STORAGE'].value" -o tsv

# Should output: true
```

---

## Section 5: Post-Deployment Verification

### 5.1 Check Application Logs

**Azure Portal:**
1. Navigate to: App Service → `<web-app>` → Log stream
2. Look for errors related to storage mounting

**Azure CLI:**
```bash
# Stream logs in real-time
az webapp log tail \
  --name $WEB_APP_NAME \
  --resource-group $APP_RG

# Look for these error patterns:
# ❌ "Failure mounting the provided storage" = Mount failed
# ❌ "InvalidCredentials" = Can't read Key Vault secret or wrong key
# ❌ "InvalidMount" = Share doesn't exist or network issue
# ✅ No mount errors = SUCCESS
```

### 5.2 Verify Mount Inside Container

```bash
# SSH into web app
az webapp ssh --name $WEB_APP_NAME --resource-group $APP_RG

# Inside container, check mount point
ls -la /home/data

# Expected: Shows files and directories
# If "Permission denied": Mount failed
# If empty: Mount succeeded but share is empty

# Test write access
echo "test" > /home/data/test.txt
cat /home/data/test.txt
rm /home/data/test.txt

# Expected: All commands succeed
# If fails: Mount succeeded but wrong permissions
```

### 5.3 Verify Storage Role Assignments (Enhanced Security)

**Our ARM template update also adds Storage File Data SMB Share Contributor role:**

```bash
# Get storage account resource ID
STORAGE_ID="/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$STORAGE_RG/providers/Microsoft.Storage/storageAccounts/$STORAGE_ACCOUNT"

# Check web app storage role
az role assignment list \
  --scope "$STORAGE_ID" \
  --assignee $WEB_IDENTITY \
  --query "[].{Role:roleDefinitionName, Scope:scope}" -o table

# Expected:
# Role                                        Scope
# ------------------------------------------  --------------------------------------------
# Storage File Data SMB Share Contributor    /subscriptions/.../storageAccounts/...

# Check worker app storage role
az role assignment list \
  --scope "$STORAGE_ID" \
  --assignee $WORKER_IDENTITY \
  --query "[].{Role:roleDefinitionName, Scope:scope}" -o table
```

**If missing, add role:**
```bash
STORAGE_ROLE_ID="0c867c2a-1d8c-454a-a3db-ab2ea1bdc8bb"

az role assignment create \
  --assignee $WEB_IDENTITY \
  --role $STORAGE_ROLE_ID \
  --scope "$STORAGE_ID"

az role assignment create \
  --assignee $WORKER_IDENTITY \
  --role $STORAGE_ROLE_ID \
  --scope "$STORAGE_ID"
```

### 5.4 Test Application Functionality

```bash
# Test document upload (via web interface or API)
# Expected: Files appear in /home/data/tmp_uploads

# Test RAG query
# Expected: ChromaDB files in /home/data/chroma

# Check database
# Expected: SQLite file at /home/data/app.db

# If any fail: Storage mount not working correctly
```

---

## Common Error Messages & Solutions

### Error: "Failure mounting the provided storage. Permission was denied."

**Possible Causes & Solutions:**

1. **Can't read storage key from Key Vault**
   - Solution: Check Section 1 (Managed Identity & Key Vault Access)
   - Verify: Key Vault role = "Key Vault Secrets User"
   - Fix: Wait 10 min after role assignment, then restart app

2. **Invalid storage account key**
   - Solution: Check Section 2.1 (Verify Storage Key)
   - Fix: Update key in Key Vault, restart app

3. **Wrong secret URI format**
   - Solution: Check Section 2.3 (Verify Secret URI Format)
   - Fix: Use full URI with version: `https://vault.vault.azure.net/secrets/NAME/VERSION`

4. **Network blocking storage access**
   - Solution: Check Section 3 (Network Configuration)
   - Fix: Allow App Service in storage firewall, enable service endpoints

5. **File share doesn't exist**
   - Solution: Create file share
   ```bash
   az storage share create --name smartlibtest --account-name smartlibstorageacc
   ```

### Error: "InvalidCredentials"

**Meaning:** App Service can read the key, but it's invalid

**Solutions:**
```bash
# Regenerate and update storage key
NEW_KEY=$(az storage account keys renew \
  --account-name $STORAGE_ACCOUNT \
  --resource-group $STORAGE_RG \
  --key key1 \
  --query "[0].value" -o tsv)

az keyvault secret set \
  --vault-name $KEY_VAULT_NAME \
  --name "STORAGE-ACCOUNT-KEY" \
  --value "$NEW_KEY"

# Restart app
az webapp restart --name $WEB_APP_NAME --resource-group $APP_RG
```

### Error: "InvalidMount"

**Meaning:** Share doesn't exist or network can't reach it

**Solutions:**
1. Verify share exists (Section 2.2)
2. Check network connectivity (Section 3.4)
3. Verify firewall rules (Section 3.1)

---

## Role Definition IDs Reference

```bash
# Key Vault Roles
KEY_VAULT_SECRETS_USER="4633458b-17de-408a-b874-0445c86b69e6"  # ✅ CORRECT
KEY_VAULT_CRYPTO_OFFICER="b86a8fe4-44ce-4948-aee5-eccb2c155cd7"  # ❌ WRONG

# Storage Roles
STORAGE_FILE_DATA_SMB_CONTRIBUTOR="0c867c2a-1d8c-454a-a3db-ab2ea1bdc8bb"  # Read/Write
STORAGE_FILE_DATA_SMB_READER="aba4ae5f-2193-4029-9191-0cb91df5e314"  # Read-only
```

---

## Complete Diagnostic Script

Save this as `diagnose_storage_mount.sh`:

```bash
#!/bin/bash

# Configuration
WEB_APP_NAME="your-web-app-name"
WORKER_APP_NAME="your-worker-app-name"
APP_RG="your-app-resource-group"
STORAGE_ACCOUNT="smartlibstorageacc"
FILE_SHARE="smartlibtest"
STORAGE_RG="your-storage-resource-group"
KEY_VAULT_NAME="your-keyvault-name"
KV_RG="your-keyvault-resource-group"
SUBSCRIPTION_ID="your-subscription-id"

echo "=== SmartLib Storage Mount Diagnostic ==="
echo ""

# 1. Check managed identities
echo "1. Checking managed identities..."
WEB_IDENTITY=$(az webapp identity show --name $WEB_APP_NAME --resource-group $APP_RG --query "principalId" -o tsv)
WORKER_IDENTITY=$(az webapp identity show --name $WORKER_APP_NAME --resource-group $APP_RG --query "principalId" -o tsv)

if [ -z "$WEB_IDENTITY" ]; then
  echo "❌ Web app: NO managed identity"
else
  echo "✅ Web app identity: $WEB_IDENTITY"
fi

if [ -z "$WORKER_IDENTITY" ]; then
  echo "❌ Worker app: NO managed identity"
else
  echo "✅ Worker app identity: $WORKER_IDENTITY"
fi
echo ""

# 2. Check Key Vault role assignments
echo "2. Checking Key Vault role assignments..."
KV_ID="/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$KV_RG/providers/Microsoft.KeyVault/vaults/$KEY_VAULT_NAME"

WEB_KV_ROLE=$(az role assignment list --scope "$KV_ID" --assignee $WEB_IDENTITY --query "[0].roleDefinitionName" -o tsv)
WORKER_KV_ROLE=$(az role assignment list --scope "$KV_ID" --assignee $WORKER_IDENTITY --query "[0].roleDefinitionName" -o tsv)

if [ "$WEB_KV_ROLE" == "Key Vault Secrets User" ]; then
  echo "✅ Web app: Key Vault Secrets User"
else
  echo "❌ Web app: $WEB_KV_ROLE (should be 'Key Vault Secrets User')"
fi

if [ "$WORKER_KV_ROLE" == "Key Vault Secrets User" ]; then
  echo "✅ Worker app: Key Vault Secrets User"
else
  echo "❌ Worker app: $WORKER_KV_ROLE (should be 'Key Vault Secrets User')"
fi
echo ""

# 3. Check storage key in Key Vault
echo "3. Checking storage key in Key Vault..."
SECRET_EXISTS=$(az keyvault secret show --vault-name $KEY_VAULT_NAME --name "STORAGE-ACCOUNT-KEY" --query "id" -o tsv 2>/dev/null)

if [ -n "$SECRET_EXISTS" ]; then
  echo "✅ Secret exists in Key Vault"
  echo "   URI: $SECRET_EXISTS"
else
  echo "❌ Secret NOT found in Key Vault"
fi
echo ""

# 4. Check file share
echo "4. Checking file share..."
SHARE_EXISTS=$(az storage share show --name $FILE_SHARE --account-name $STORAGE_ACCOUNT --query "name" -o tsv 2>/dev/null)

if [ "$SHARE_EXISTS" == "$FILE_SHARE" ]; then
  echo "✅ File share exists: $FILE_SHARE"
else
  echo "❌ File share NOT found: $FILE_SHARE"
fi
echo ""

# 5. Check storage mount configuration
echo "5. Checking storage mount configuration..."
MOUNT_STATE=$(az webapp config storage-account list --name $WEB_APP_NAME --resource-group $APP_RG --query "data.state" -o tsv)

echo "Mount state: $MOUNT_STATE"
if [ "$MOUNT_STATE" == "Ok" ]; then
  echo "✅ Storage mount is OK"
elif [ "$MOUNT_STATE" == "InvalidCredentials" ]; then
  echo "❌ Invalid credentials - can't read Key Vault secret or wrong key"
elif [ "$MOUNT_STATE" == "InvalidMount" ]; then
  echo "❌ Invalid mount - share doesn't exist or network issue"
else
  echo "❌ Unknown state: $MOUNT_STATE"
fi
echo ""

# 6. Check storage role assignments
echo "6. Checking storage role assignments..."
STORAGE_ID="/subscriptions/$SUBSCRIPTION_ID/resourceGroups/$STORAGE_RG/providers/Microsoft.Storage/storageAccounts/$STORAGE_ACCOUNT"

WEB_STORAGE_ROLE=$(az role assignment list --scope "$STORAGE_ID" --assignee $WEB_IDENTITY --query "[0].roleDefinitionName" -o tsv)
WORKER_STORAGE_ROLE=$(az role assignment list --scope "$STORAGE_ID" --assignee $WORKER_IDENTITY --query "[0].roleDefinitionName" -o tsv)

if [ -n "$WEB_STORAGE_ROLE" ]; then
  echo "✅ Web app storage role: $WEB_STORAGE_ROLE"
else
  echo "⚠️  Web app: No storage role (optional enhancement)"
fi

if [ -n "$WORKER_STORAGE_ROLE" ]; then
  echo "✅ Worker app storage role: $WORKER_STORAGE_ROLE"
else
  echo "⚠️  Worker app: No storage role (optional enhancement)"
fi
echo ""

echo "=== Diagnostic Complete ==="
echo ""
echo "Next steps:"
echo "1. Fix any ❌ issues above"
echo "2. Wait 10 minutes after role assignments"
echo "3. Restart apps: az webapp restart --name $WEB_APP_NAME --resource-group $APP_RG"
echo "4. Check logs: az webapp log tail --name $WEB_APP_NAME --resource-group $APP_RG"
```

---

## Quick Fix Checklist

Use this after deployment if storage mount fails:

```bash
# 1. Verify identity exists
az webapp identity show --name <web-app> --resource-group <rg> --query "principalId"
# If empty: az webapp identity assign --name <web-app> --resource-group <rg>

# 2. Check Key Vault role (must be Secrets User)
az role assignment list --scope "<keyvault-id>" --assignee "<identity-principal-id>"
# If wrong: Follow Section 1.2

# 3. Verify storage key in Key Vault
az keyvault secret show --vault-name <kv-name> --name "STORAGE-ACCOUNT-KEY"
# If missing: Follow Section 2.1

# 4. Test key validity
az storage file list --share-name smartlibtest --account-name smartlibstorageacc --account-key "<key>"
# If fails: Key is invalid, regenerate

# 5. Check mount state
az webapp config storage-account list --name <web-app> --resource-group <rg>
# State should be "Ok"

# 6. Wait 10 minutes, then restart
sleep 600
az webapp restart --name <web-app> --resource-group <rg>

# 7. Check logs
az webapp log tail --name <web-app> --resource-group <rg>
```

---

## Support Resources

### Azure Documentation
- [App Service Managed Identity](https://learn.microsoft.com/en-us/azure/app-service/overview-managed-identity)
- [Key Vault RBAC Guide](https://learn.microsoft.com/en-us/azure/key-vault/general/rbac-guide)
- [Azure Files for App Service](https://learn.microsoft.com/en-us/azure/app-service/configure-connect-to-azure-storage)
- [Storage File Data Roles](https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles#storage-file-data-smb-share-contributor)

### Troubleshooting Contacts
- Azure Support: [https://azure.microsoft.com/support](https://azure.microsoft.com/support)
- SmartLib Issues: [Your support channel]

---

## Summary

**Most Common Issues (95% of cases):**
1. ❌ Wrong Key Vault role (Crypto Officer instead of Secrets User)
2. ❌ Role assignments not propagated (need 10 min wait)
3. ❌ Invalid storage key in Key Vault
4. ❌ Wrong secret URI format

**Quick Resolution:**
1. Fix Key Vault role → Section 1.2
2. Wait 10 minutes
3. Restart app
4. Verify mount → Section 5.2

**If still failing:**
- Run diagnostic script
- Check logs for specific error
- Follow error-specific solution in Common Errors section