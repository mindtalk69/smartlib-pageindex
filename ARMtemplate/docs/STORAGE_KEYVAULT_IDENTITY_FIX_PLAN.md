# Storage Mount & Key Vault Access Fix Plan

## Problem Analysis

**Error:** "Failure mounting the provided storage. Permission was denied."

### Root Causes Identified

1. **CRITICAL: Wrong Key Vault Role Assignment**
   - Current role: `b86a8fe4-44ce-4948-aee5-eccb2c155cd7` (Key Vault Crypto Officer)
   - Required role: `4633458b-17de-408a-b874-0445c86b69e6` (Key Vault Secrets User)
   - **Impact:** Web/Worker apps CANNOT read secrets from Key Vault (storage keys, Redis connection, etc.)

2. **Missing Storage Account Role Assignment**
   - No role assignment for Storage Account access
   - Apps rely solely on access keys (less secure)
   - No fallback if Key Vault access fails

3. **No Managed Identity Parameter Exposure**
   - Identity principal ID not exposed from UI definition
   - Cannot be used for external role assignments

## Current State

### Managed Identity ✅ (Already Configured)
```json
// Web App (lines 307-309)
"identity": {
  "type": "SystemAssigned"
}

// Worker App (lines 459-461)  
"identity": {
  "type": "SystemAssigned"
}
```

### Key Vault Role Assignment ❌ (WRONG ROLE)
```json
// Lines 624-636 (web), 638-650 (worker)
"roleDefinitionId": "[concat('/subscriptions/', subscription().subscriptionId, '/providers/Microsoft.Authorization/roleDefinitions/', 'b86a8fe4-44ce-4948-aee5-eccb2c155cd7')]"
// This is Key Vault Crypto Officer - WRONG!
// Should be: 4633458b-17de-408a-b874-0445c86b69e6 (Key Vault Secrets User)
```

### Storage Configuration ⚠️ (Works but Not Secure)
```json
// Lines 319-327 (web), 471-479 (worker)
"azureStorageAccounts": {
  "data": {
    "type": "AzureFiles",
    "accountName": "[parameters('storageAccountName')]",
    "shareName": "[parameters('dataShareName')]",
    "accessKey": "[if(equals(parameters('storageAccountKeySecretUri'), ''), parameters('storageAccountKey'), concat('@Microsoft.KeyVault(SecretUri=', parameters('storageAccountKeySecretUri'), ')'))]",
    "mountPath": "/home/data"
  }
}
```
**Issue:** If using Key Vault secret URI, app can't read it due to wrong role!

### Redis Configuration ✅ (Correct Approach)
```json
// Uses connection string - no identity needed
"CELERY_BROKER_URL": "[if(not(equals(parameters('redisConnectionStringSecretUri'), '')), concat('@Microsoft.KeyVault(SecretUri=', parameters('redisConnectionStringSecretUri'), ')'), parameters('redisConnectionString'))]"
```
**Note:** Redis uses connection strings (not identity-based), so it's fine.

## Solution: Hybrid Approach

### Strategy
1. **Fix Key Vault role** (immediate fix for reading secrets)
2. **Add Storage role assignments** (enhanced security)
3. **Keep access key fallback** (compatibility)
4. **Expose identity parameters** (for advanced scenarios)

### Azure Role IDs Reference
- **Key Vault Secrets User**: `4633458b-17de-408a-b874-0445c86b69e6` (read secrets)
- **Storage File Data SMB Share Contributor**: `0c867c2a-1d8c-454a-a3db-ab2ea1bdc8bb` (R/W files)
- **Storage File Data SMB Share Reader**: `aba4ae5f-2193-4029-9191-0cb91df5e314` (read-only files)

## Implementation Plan

### Phase 1: Fix Key Vault Access (CRITICAL)

#### 1.1 Update mainTemplate.json - Fix Role ID
**File:** `ARMtemplate/catalog/mainTemplate.json`
**Lines:** 633, 647

**Change From:**
```json
"roleDefinitionId": "[concat('/subscriptions/', subscription().subscriptionId, '/providers/Microsoft.Authorization/roleDefinitions/', 'b86a8fe4-44ce-4948-aee5-eccb2c155cd7')]"
```

**Change To:**
```json
"roleDefinitionId": "[concat('/subscriptions/', subscription().subscriptionId, '/providers/Microsoft.Authorization/roleDefinitions/', '4633458b-17de-408a-b874-0445c86b69e6')]"
```

### Phase 2: Add Storage Account Role Assignments

#### 2.1 Add Storage Resource Group Parameter
**File:** `ARMtemplate/catalog/mainTemplate.json`
**Location:** After line 138 (after dataShareName parameter)

```json
"storageAccountResourceGroup": {
  "type": "string",
  "defaultValue": "[resourceGroup().name]",
  "metadata": {
    "description": "Resource group containing the storage account. Defaults to the current resource group."
  }
}
```

#### 2.2 Add createStorageRoleAssignment Parameter
**File:** `ARMtemplate/catalog/mainTemplate.json`
**Location:** After line 51 (after createRoleAssignment parameter)

```json
"createStorageRoleAssignment": {
  "type": "bool",
  "defaultValue": true,
  "metadata": {
    "description": "If true, role assignments will be created to grant the apps identity-based access to Storage Account. Set to false on subsequent deployments."
  }
}
```

#### 2.3 Add Storage Role Assignments in Resources
**File:** `ARMtemplate/catalog/mainTemplate.json`
**Location:** After line 650 (after worker Key Vault role assignment)

```json
,
{
  "condition": "[parameters('createStorageRoleAssignment')]",
  "type": "Microsoft.Authorization/roleAssignments",
  "apiVersion": "2022-04-01",
  "name": "[guid(resourceId('Microsoft.Web/sites', variables('webAppName')), resourceId(parameters('storageAccountResourceGroup'), 'Microsoft.Storage/storageAccounts', parameters('storageAccountName')), 'web-storage')]",
  "dependsOn": [
    "[resourceId('Microsoft.Web/sites', variables('webAppName'))]"
  ],
  "scope": "[resourceId(parameters('storageAccountResourceGroup'), 'Microsoft.Storage/storageAccounts', parameters('storageAccountName'))]",
  "properties": {
    "roleDefinitionId": "[concat('/subscriptions/', subscription().subscriptionId, '/providers/Microsoft.Authorization/roleDefinitions/', '0c867c2a-1d8c-454a-a3db-ab2ea1bdc8bb')]",
    "principalId": "[reference(resourceId('Microsoft.Web/sites', variables('webAppName')), '2022-03-01', 'Full').identity.principalId]",
    "principalType": "ServicePrincipal"
  }
},
{
  "condition": "[parameters('createStorageRoleAssignment')]",
  "type": "Microsoft.Authorization/roleAssignments",
  "apiVersion": "2022-04-01",
  "name": "[guid(resourceId('Microsoft.Web/sites', variables('workerAppName')), resourceId(parameters('storageAccountResourceGroup'), 'Microsoft.Storage/storageAccounts', parameters('storageAccountName')), 'worker-storage')]",
  "dependsOn": [
    "[resourceId('Microsoft.Web/sites', variables('workerAppName'))]"
  ],
  "scope": "[resourceId(parameters('storageAccountResourceGroup'), 'Microsoft.Storage/storageAccounts', parameters('storageAccountName'))]",
  "properties": {
    "roleDefinitionId": "[concat('/subscriptions/', subscription().subscriptionId, '/providers/Microsoft.Authorization/roleDefinitions/', '0c867c2a-1d8c-454a-a3db-ab2ea1bdc8bb')]",
    "principalId": "[reference(resourceId('Microsoft.Web/sites', variables('workerAppName')), '2022-03-01', 'Full').identity.principalId]",
    "principalType": "ServicePrincipal"
  }
}
```

### Phase 3: Expose Managed Identity in UI Definition

#### 3.1 Add managedIdentityPrincipalId Parameter
**File:** `ARMtemplate/catalog/mainTemplate.json`
**Location:** After line 17 (after tenantId parameter)

```json
"managedIdentityPrincipalId": {
  "type": "string",
  "defaultValue": "",
  "metadata": {
    "description": "Optional: Object ID of a user-assigned managed identity for additional role assignments. Leave empty to use system-assigned identities."
  }
}
```

#### 3.2 Export Identity in UI Definition Outputs
**File:** `ARMtemplate/catalog/createUiDefinition.json`
**Location:** In outputs section (after line 804)

```json
,
"managedIdentityPrincipalId": "[if(steps('identityStep').managedIdentity, steps('identityStep').managedIdentity, '')]"
```

**Note:** This requires adding a managed identity selector in identityStep, but for now we'll use system-assigned identities.

### Phase 4: Update createUiDefinition.json Parameters

#### 4.1 Add Storage Resource Group Field
**File:** `ARMtemplate/catalog/createUiDefinition.json`
**Location:** infrastructureStep elements, after storageAccountName (around line 280)

```json
,
{
  "name": "storageAccountResourceGroup",
  "type": "Microsoft.Common.TextBox",
  "label": "Storage account resource group",
  "defaultValue": "[resourceGroup().name]",
  "toolTip": "Resource group containing the storage account. Defaults to the deployment resource group."
}
```

#### 4.2 Add Storage Role Assignment Checkbox
**File:** `ARMtemplate/catalog/createUiDefinition.json`
**Location:** After createRoleAssignment field (around line 207)

```json
,
{
  "name": "createStorageRoleAssignment",
  "type": "Microsoft.Common.CheckBox",
  "label": "Grant Storage access to web/worker apps",
  "defaultValue": "[equals(steps('infrastructureStep').deploymentType, 'new')]",
  "visible": "[equals(steps('infrastructureStep').deploymentType, 'new')]",
  "toolTip": "Creates managed identity role assignments on the Storage Account. Only shown for Step 1 (New Installation)."
},
{
  "name": "storageRoleInfo",
  "type": "Microsoft.Common.InfoBox",
  "visible": "[steps('infrastructureStep').createStorageRoleAssignment]",
  "options": {
    "icon": "Info",
    "text": "Identity-based Storage access provides enhanced security. Access keys will still work as fallback."
  }
}
```

#### 4.3 Update Outputs Section
**File:** `ARMtemplate/catalog/createUiDefinition.json`
**Location:** In outputs (after storageAccountKeySecretUri, around line 784)

```json
,
"storageAccountResourceGroup": "[steps('infrastructureStep').storageAccountResourceGroup]",
"createStorageRoleAssignment": "[if(equals(steps('infrastructureStep').deploymentType, 'new'), steps('infrastructureStep').createStorageRoleAssignment, false())]"
```

## Deployment Process

### Step 1: Deploy with createRoleAssignment=true & createStorageRoleAssignment=true
This creates:
- Web and Worker app services with system-assigned identities
- Key Vault role assignments (fixed role ID)
- Storage Account role assignments

### Step 2: Redeploy with createRoleAssignment=false & createStorageRoleAssignment=false
This updates:
- Application settings
- Container configurations
- Does NOT recreate role assignments (prevents conflicts)

## Verification Steps

### 1. Check Managed Identities
```bash
# Web app identity
az webapp identity show --name <web-app-name> --resource-group <rg-name>

# Worker app identity
az webapp identity show --name <worker-app-name> --resource-group <rg-name>
```

### 2. Check Key Vault Permissions
```bash
az role assignment list \
  --scope "/subscriptions/<sub-id>/resourceGroups/<kv-rg>/providers/Microsoft.KeyVault/vaults/<kv-name>" \
  --query "[?principalId=='<identity-principal-id>'].{Role:roleDefinitionName}"
```
Should show: "Key Vault Secrets User"

### 3. Check Storage Permissions
```bash
az role assignment list \
  --scope "/subscriptions/<sub-id>/resourceGroups/<storage-rg>/providers/Microsoft.Storage/storageAccounts/<storage-name>" \
  --query "[?principalId=='<identity-principal-id>'].{Role:roleDefinitionName}"
```
Should show: "Storage File Data SMB Share Contributor"

### 4. Test Storage Mount
```bash
# SSH into web app
az webapp ssh --name <web-app-name> --resource-group <rg-name>

# Check mount
ls -la /home/data
# Should show files without permission errors
```

## Rollback Plan

If issues occur:

1. **Immediate:** Ensure storage account key is valid and in Key Vault
2. **Quick Fix:** Manually grant Key Vault Secrets User role via Portal
3. **Full Rollback:** Redeploy with previous template version

## Benefits of This Approach

✅ **Immediate Fix:** Corrects Key Vault role so apps can read secrets  
✅ **Enhanced Security:** Adds identity-based Storage access  
✅ **Backward Compatible:** Keeps access key support as fallback  
✅ **Future-Proof:** Exposes identity for advanced scenarios  
✅ **Proper Dependencies:** Role assignments complete before apps start  

## Testing Checklist

- [ ] Deploy Step 1 with both role assignments enabled
- [ ] Verify Key Vault access (read secret test)
- [ ] Verify Storage mount (file operations test)
- [ ] Deploy Step 2 with role assignments disabled
- [ ] Verify application functionality
- [ ] Test document upload and processing
- [ ] Test RAG query functionality
- [ ] Verify no permission errors in logs

## References

- [Azure Built-in Roles](https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles)
- [Key Vault Access Policies vs RBAC](https://learn.microsoft.com/en-us/azure/key-vault/general/rbac-guide)
- [Azure Files Identity-based Auth](https://learn.microsoft.com/en-us/azure/storage/files/storage-files-identity-auth-active-directory-enable)
- [App Service Managed Identity](https://learn.microsoft.com/en-us/azure/app-service/overview-managed-identity)