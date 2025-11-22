# ARM Template Deployment Error Fix Plan

## Problem Summary

**Error**: `ResourceNotFound` - The Resource 'Microsoft.Storage/storageAccounts/smarteamsb88f' under resource group 'mrg-smartlib-azure-20251122123841' was not found.

**Root Cause**: The ARM template incorrectly references cross-resource-group storage accounts in managed application deployment contexts. When deploying to a managed resource group, the template searches for the storage account in the wrong resource group.

---

## Issues Identified

### Issue 1: Incorrect `resourceId()` Function Usage (CRITICAL)

**Location**: [`mainTemplate.json`](../catalog/mainTemplate.json) lines 684, 688, 699, 703

**Problem**: 
The template uses a 3-parameter `resourceId()` function to reference storage accounts in different resource groups:

```json
"scope": "[resourceId(parameters('storageAccountResourceGroup'), 'Microsoft.Storage/storageAccounts', parameters('storageAccountName'))]"
```

In managed application deployments (Azure Marketplace), this function resolves the resource ID **relative to the current deployment resource group** (the managed resource group `mrg-smartlib-azure-20251122123841`), not the actual resource group where the storage account exists (`smarteams`).

**Solution**:
Use the 4-parameter `resourceId()` function that explicitly includes the subscription ID:

```json
"scope": "[resourceId(subscription().subscriptionId, parameters('storageAccountResourceGroup'), 'Microsoft.Storage/storageAccounts', parameters('storageAccountName'))]"
```

**Affected Lines**:
- Line 684: Role assignment GUID generation
- Line 688: Role assignment scope (web app)
- Line 699: Role assignment GUID generation 
- Line 703: Role assignment scope (worker app)

---

### Issue 2: Wrong Step Reference in createUiDefinition.json

**Location**: [`createUiDefinition.json`](../catalog/createUiDefinition.json) line 794

**Problem**:
The output parameter `createStorageRoleAssignment` references the wrong step:

```json
"createStorageRoleAssignment": "[if(equals(steps('infrastructureStep').deploymentType, 'new'), steps('infrastructureStep').createStorageRoleAssignment, false())]"
```

The control `createStorageRoleAssignment` is actually defined in `storageServicesStep` (line 337), not `infrastructureStep`.

**Solution**:
```json
"createStorageRoleAssignment": "[if(equals(steps('infrastructureStep').deploymentType, 'new'), steps('storageServicesStep').createStorageRoleAssignment, false())]"
```

---

### Issue 3: Missing UI Fields for Azure OpenAI

**Location**: [`createUiDefinition.json`](../catalog/createUiDefinition.json) aiServicesStep

**Problem**:
The UI definition outputs references for `azureOpenAIEndpoint` and `azureOpenAIDeployment` (lines 796-797) but these fields are not defined in the `aiServicesStep` elements. Users cannot provide these values through the UI.

**Impact**: Medium - Users would need to manually configure these post-deployment or the app would fail to connect to Azure OpenAI.

**Solution**: Add missing input fields in the aiServicesStep elements section (after line 401).

---

## Detailed Fix Instructions

### Fix 1: Update mainTemplate.json - Storage Account Resource References

**File**: [`mainTemplate.json`](../catalog/mainTemplate.json)

**Changes Required**:

1. **Line 684** - Update role assignment GUID generation:
```json
// BEFORE:
"name": "[guid(resourceId('Microsoft.Web/sites', variables('webAppName')), resourceId(parameters('storageAccountResourceGroup'), 'Microsoft.Storage/storageAccounts', parameters('storageAccountName')), 'web-storage')]",

// AFTER:
"name": "[guid(resourceId('Microsoft.Web/sites', variables('webAppName')), resourceId(subscription().subscriptionId, parameters('storageAccountResourceGroup'), 'Microsoft.Storage/storageAccounts', parameters('storageAccountName')), 'web-storage')]",
```

2. **Line 688** - Update role assignment scope (web app):
```json
// BEFORE:
"scope": "[resourceId(parameters('storageAccountResourceGroup'), 'Microsoft.Storage/storageAccounts', parameters('storageAccountName'))]",

// AFTER:
"scope": "[resourceId(subscription().subscriptionId, parameters('storageAccountResourceGroup'), 'Microsoft.Storage/storageAccounts', parameters('storageAccountName'))]",
```

3. **Line 699** - Update role assignment GUID generation:
```json
// BEFORE:
"name": "[guid(resourceId('Microsoft.Web/sites', variables('workerAppName')), resourceId(parameters('storageAccountResourceGroup'), 'Microsoft.Storage/storageAccounts', parameters('storageAccountName')), 'worker-storage')]",

// AFTER:
"name": "[guid(resourceId('Microsoft.Web/sites', variables('workerAppName')), resourceId(subscription().subscriptionId, parameters('storageAccountResourceGroup'), 'Microsoft.Storage/storageAccounts', parameters('storageAccountName')), 'worker-storage')]",
```

4. **Line 703** - Update role assignment scope (worker app):
```json
// BEFORE:
"scope": "[resourceId(parameters('storageAccountResourceGroup'), 'Microsoft.Storage/storageAccounts', parameters('storageAccountName'))]",

// AFTER:
"scope": "[resourceId(subscription().subscriptionId, parameters('storageAccountResourceGroup'), 'Microsoft.Storage/storageAccounts', parameters('storageAccountName'))]",
```

---

### Fix 2: Update createUiDefinition.json - Storage Role Assignment Reference

**File**: [`createUiDefinition.json`](../catalog/createUiDefinition.json)

**Line 794** - Correct the step reference:
```json
// BEFORE:
"createStorageRoleAssignment": "[if(equals(steps('infrastructureStep').deploymentType, 'new'), steps('infrastructureStep').createStorageRoleAssignment, false())]",

// AFTER:
"createStorageRoleAssignment": "[if(equals(steps('infrastructureStep').deploymentType, 'new'), steps('storageServicesStep').createStorageRoleAssignment, false())]",
```

---

### Fix 3: Add Missing Azure OpenAI Fields (Optional but Recommended)

**File**: [`createUiDefinition.json`](../catalog/createUiDefinition.json)

**Location**: After line 401 in the aiServicesStep elements array

**Add these fields**:
```json
{
  "name": "azureOpenAIEndpoint",
  "type": "Microsoft.Common.TextBox",
  "label": "Azure OpenAI endpoint",
  "toolTip": "Full endpoint URL for your Azure OpenAI resource (e.g., https://your-openai.openai.azure.com/)",
  "constraints": {
    "required": true,
    "regex": "^https://.*\\.openai\\.azure\\.com/?$",
    "validationMessage": "Enter a valid Azure OpenAI endpoint URL"
  }
},
{
  "name": "azureOpenAIDeployment",
  "type": "Microsoft.Common.TextBox",
  "label": "Azure OpenAI chat model deployment name",
  "toolTip": "Name of the deployed chat model in Azure OpenAI Studio (e.g., gpt-4, gpt-35-turbo)",
  "constraints": {
    "required": true
  }
},
{
  "name": "azureEmbeddingDeployment",
  "type": "Microsoft.Common.TextBox",
  "label": "Azure OpenAI embedding model deployment name",
  "defaultValue": "text-embedding-3-small",
  "toolTip": "Name of the deployed embedding model in Azure OpenAI Studio",
  "constraints": {
    "required": true
  }
}
```

---

## Testing and Validation Plan

### Pre-Deployment Validation

1. **Validate Template Syntax**:
   ```bash
   az deployment group validate \
     --resource-group smarteams \
     --template-file ARMtemplate/catalog/mainTemplate.json \
     --parameters @ARMtemplate/catalog/parameters.json
   ```

2. **Check Resource Group Permissions**:
   - Verify deployer has `Microsoft.Authorization/roleAssignments/write` on:
     - Storage account resource group (`smarteams`)
     - Key Vault resource group (`smarteams`)

### Post-Fix Deployment Steps

1. **First Deployment (Step 1)**:
   - Use "New Installation (Step 1)" in UI
   - Verify role assignments are created successfully
   - Check deployment outputs

2. **Second Deployment (Step 2)**:
   - Use "Update Existing Installation (Step 2)" in UI
   - Verify apps can access storage and Key Vault
   - Test app functionality

### Verification Checklist

- [ ] Web app can mount Azure Files share at `/home/data`
- [ ] Worker app can mount Azure Files share at `/home/data`
- [ ] Web app managed identity has Key Vault Secret User role
- [ ] Worker app managed identity has Key Vault Secret User role
- [ ] Web app managed identity has Storage Account Contributor role
- [ ] Worker app managed identity has Storage Account Contributor role
- [ ] Apps can read secrets from Key Vault
- [ ] Apps can connect to Redis
- [ ] Apps can connect to Azure OpenAI

---

## Why This Error Occurred

### Azure Marketplace Managed Application Context

When deploying through Azure Marketplace, the deployment happens in a **managed resource group** (e.g., `mrg-smartlib-azure-20251122123841`) that is different from the resource group where your existing resources (storage account, Key Vault, etc.) live.

### The 3-Parameter vs 4-Parameter resourceId() Issue

1. **3-Parameter Version** (incorrect for cross-RG references):
   ```json
   resourceId(resourceGroupName, resourceType, resourceName)
   ```
   This resolves **relative to the current deployment context**, which in a managed app is the managed resource group.

2. **4-Parameter Version** (correct for cross-RG references):
   ```json
   resourceId(subscriptionId, resourceGroupName, resourceType, resourceName)
   ```
   This explicitly specifies the subscription and resource group, ensuring correct resolution.

### What Happened in Your Deployment

1. You selected resource group `smarteams` which has:
   - Storage account `smarteamsb88f`
   - Key Vault `kv-malkysma756652505612`

2. Azure Marketplace created a managed resource group `mrg-smartlib-azure-20251122123841`

3. The deployment tried to create role assignments on the storage account

4. The 3-parameter `resourceId()` looked for the storage account in the **managed resource group** instead of the **actual resource group** (`smarteams`)

5. Storage account not found → **ResourceNotFound error**

---

## Prevention Strategies

### 1. Always Use Full Resource IDs for Cross-RG References

```json
// Good - Explicit subscription and resource group
[resourceId(subscription().subscriptionId, parameters('storageRG'), 'Microsoft.Storage/storageAccounts', parameters('storageName'))]

// Bad - Relative reference
[resourceId(parameters('storageRG'), 'Microsoft.Storage/storageAccounts', parameters('storageName'))]
```

### 2. Test in Managed Application Context

Before publishing to Marketplace:
- Test deployment using managed application resource groups
- Don't just test in same-RG scenarios

### 3. Validate All Cross-Resource-Group References

Search for all `resourceId()` calls that reference cross-RG resources and ensure they use the 4-parameter version.

### 4. Use Azure Policy for Validation

Create a policy to validate ARM templates before deployment:
```json
{
  "policyRule": {
    "if": {
      "allOf": [
        {
          "field": "type",
          "equals": "Microsoft.Authorization/roleAssignments"
        },
        {
          "field": "Microsoft.Authorization/roleAssignments/scope",
          "notContains": "subscription().subscriptionId"
        }
      ]
    },
    "then": {
      "effect": "deny"
    }
  }
}
```

---

## Additional Recommendations

### 1. Improve Error Messages

Consider adding validation in the UI definition to warn users when:
- Storage account RG differs from deployment RG
- Key Vault RG differs from deployment RG

### 2. Add Deployment Logs

Include detailed logging in the deployment to track:
- Which resource groups are being referenced
- What resource IDs are being generated
- Role assignment creation status

### 3. Document Cross-RG Deployment

Update the deployment guide to explicitly mention:
- Resources can be in different resource groups
- Deployer needs permissions in all referenced resource groups
- Managed application context implications

### 4. Consider Resource Consolidation

For simpler deployments, recommend:
- Creating all resources in the same resource group
- Or using managed identities to reduce permission requirements

---

## Summary

**Primary Fix**: Update 4 lines in [`mainTemplate.json`](../catalog/mainTemplate.json) to use the 4-parameter `resourceId()` function with explicit subscription ID.

**Secondary Fix**: Update 1 line in [`createUiDefinition.json`](../catalog/createUiDefinition.json) to reference the correct step.

**Optional Enhancement**: Add missing Azure OpenAI input fields to the UI definition.

**Expected Result**: Successful deployment with role assignments created correctly on cross-resource-group resources.

---

## Next Steps

1. Apply fixes to the template files
2. Validate template syntax
3. Test deployment in a non-production environment
4. Deploy to production
5. Verify all role assignments are created
6. Test application functionality
