# Storage Mount & Key Vault Access Fix - Implementation Summary

## Changes Completed ✅

### Critical Fix: Key Vault Role Assignment
**File:** `ARMtemplate/catalog/mainTemplate.json`

**Changed Lines 633 & 647:**
```json
// OLD (WRONG - Crypto Officer role):
"roleDefinitionId": "[concat('/subscriptions/', subscription().subscriptionId, '/providers/Microsoft.Authorization/roleDefinitions/', 'b86a8fe4-44ce-4948-aee5-eccb2c155cd7')]"

// NEW (CORRECT - Secrets User role):
"roleDefinitionId": "[concat('/subscriptions/', subscription().subscriptionId, '/providers/Microsoft.Authorization/roleDefinitions/', '4633458b-17de-408a-b874-0445c86b69e6')]"
```

**Impact:** Web and worker apps can now read secrets from Key Vault (storage keys, Redis connection, OpenAI keys, etc.)

---

### Enhancement: Storage Account Identity Access

#### 1. Added Parameters in mainTemplate.json

**After line 51 - New createStorageRoleAssignment parameter:**
```json
"createStorageRoleAssignment": {
  "type": "bool",
  "defaultValue": true,
  "metadata": {
    "description": "If true, role assignments will be created to grant the apps identity-based access to Storage Account. Set to false on subsequent deployments."
  }
}
```

**After line 138 - New storageAccountResourceGroup parameter:**
```json
"storageAccountResourceGroup": {
  "type": "string",
  "defaultValue": "[resourceGroup().name]",
  "metadata": {
    "description": "Resource group containing the storage account. Defaults to the current resource group."
  }
}
```

#### 2. Added Storage Role Assignments in mainTemplate.json

**After line 650 - Two new role assignment resources:**
- Web app → Storage Account (Storage File Data SMB Share Contributor)
- Worker app → Storage Account (Storage File Data SMB Share Contributor)

Role ID: `0c867c2a-1d8c-454a-a3db-ab2ea1bdc8bb`

Both assignments are conditional on `createStorageRoleAssignment` parameter.

#### 3. Updated UI Definition (createUiDefinition.json)

**After line 296 - Added 4 new UI elements:**

1. **Storage Account Resource Group field:**
   - Text box for specifying storage RG
   - Defaults to deployment resource group

2. **Create Storage Role Assignment checkbox:**
   - Only visible in Step 1 (New Installation)
   - Defaults to true for new deployments
   - Automatically false for Step 2 (Update)

3. **Storage Role Info box:**
   - Shows explanatory message
   - Only visible when checkbox is checked

**Updated outputs section (line 782):**
- Added `storageAccountResourceGroup` output
- Added `createStorageRoleAssignment` output

---

## Azure Roles Used

| Service | Role Name | Role ID | Purpose |
|---------|-----------|---------|---------|
| Key Vault | Secrets User | `4633458b-17de-408a-b874-0445c86b69e6` | Read secrets |
| Storage Account | Storage File Data SMB Share Contributor | `0c867c2a-1d8c-454a-a3db-ab2ea1bdc8bb` | Read/Write files |

---

## Deployment Process

### Step 1: Initial Deployment (New Installation)
```bash
# In Azure Portal, during marketplace deployment:
# - Deployment Type: "New Installation (Step 1)"
# - Grant Key Vault access: ✓ Checked
# - Grant Storage access: ✓ Checked
```

**What happens:**
1. Creates Web and Worker App Services with system-assigned identities
2. Assigns "Key Vault Secrets User" role to both apps
3. Assigns "Storage File Data SMB Share Contributor" role to both apps
4. Apps can read secrets AND mount storage with identity

### Step 2: Update Deployment (Existing Installation)
```bash
# Redeploy immediately after Step 1:
# - Deployment Type: "Update Existing Installation (Step 2)"
# - checkboxes automatically disabled
```

**What happens:**
1. Updates application settings
2. Updates container configurations
3. Does NOT recreate role assignments (prevents conflicts)

---

## What This Fixes

### ✅ Storage Mount Permission Error
**Before:** App couldn't read storage key from Key Vault → mount failed  
**After:** App reads storage key from Key Vault → mount succeeds

### ✅ Key Vault Access
**Before:** Wrong role (Crypto Officer) → couldn't read secrets  
**After:** Correct role (Secrets User) → can read all secrets

### ✅ Redis Connection
**Already working:** Uses connection string (not identity-based)  
**Now:** Can read from Key Vault if using secret URI

### ✅ Azure OpenAI Keys
**Before:** Couldn't read from Key Vault if using secret URI  
**After:** Can read from Key Vault

### ✅ Enhanced Security
**New:** Identity-based storage access (no keys in config)  
**Fallback:** Access keys still work if needed

---

## Files Modified

1. **ARMtemplate/catalog/mainTemplate.json**
   - 2 critical role ID fixes (lines 633, 647)
   - 2 new parameters added
   - 2 new storage role assignments added

2. **ARMtemplate/catalog/createUiDefinition.json**
   - 4 new UI elements in infrastructureStep
   - 2 new output parameters

---

## Verification Commands

### Check Managed Identities
```bash
# Web app
az webapp identity show \
  --name <web-app-name> \
  --resource-group <resource-group>

# Worker app  
az webapp identity show \
  --name <worker-app-name> \
  --resource-group <resource-group>
```

### Check Key Vault Role Assignments
```bash
az role assignment list \
  --scope "/subscriptions/<subscription-id>/resourceGroups/<kv-rg>/providers/Microsoft.KeyVault/vaults/<kv-name>" \
  --query "[?principalId=='<identity-principal-id>'].{Role:roleDefinitionName, Scope:scope}"
```

**Expected:** Shows "Key Vault Secrets User"

### Check Storage Role Assignments
```bash
az role assignment list \
  --scope "/subscriptions/<subscription-id>/resourceGroups/<storage-rg>/providers/Microsoft.Storage/storageAccounts/<storage-name>" \
  --query "[?principalId=='<identity-principal-id>'].{Role:roleDefinitionName, Scope:scope}"
```

**Expected:** Shows "Storage File Data SMB Share Contributor"

### Test Storage Mount
```bash
# SSH into web app
az webapp ssh --name <web-app-name> --resource-group <rg-name>

# Inside container, check mount
ls -la /home/data

# Should show files without permission errors
# Try creating a test file
echo "test" > /home/data/test.txt
cat /home/data/test.txt
rm /home/data/test.txt
```

### Check App Logs for Errors
```bash
# Stream logs
az webapp log tail \
  --name <web-app-name> \
  --resource-group <resource-group>

# Look for:
# ✓ No "Permission denied" errors
# ✓ No "Failed to mount storage" errors
# ✓ Successful Key Vault secret access
```

---

## Troubleshooting

### If Storage Still Won't Mount

1. **Check Key Vault access:**
   ```bash
   # Verify app can read the storage key secret
   az webapp config appsettings list \
     --name <web-app-name> \
     --resource-group <rg> \
     --query "[?name=='WEBSITES_ENABLE_APP_SERVICE_STORAGE']"
   ```

2. **Verify storage account key in Key Vault:**
   ```bash
   # Check secret exists
   az keyvault secret show \
     --vault-name <kv-name> \
     --name <secret-name>
   ```

3. **Check role assignment timing:**
   - Role assignments take 5-10 minutes to propagate
   - Restart web app after deployment: `az webapp restart`

4. **Verify storage account settings:**
   - Ensure Azure Files share exists
   - Check storage account firewall rules
   - Verify storage account allows App Service access

### If Key Vault Secrets Can't Be Read

1. **Check role assignment:**
   ```bash
   az role assignment list --assignee <app-identity-principal-id>
   ```

2. **Verify Key Vault RBAC is enabled:**
   ```bash
   az keyvault show \
     --name <kv-name> \
     --query "properties.enableRbacAuthorization"
   ```
   Should return `true`

3. **Check secret URI format:**
   ```
   https://<vault-name>.vault.azure.net/secrets/<secret-name>
   ```

---

## Testing Checklist

- [ ] Deploy Step 1 with both role assignments enabled
- [ ] Wait 10 minutes for role propagation
- [ ] Restart web and worker apps
- [ ] Check logs for errors
- [ ] SSH into container and verify /home/data mount
- [ ] Test document upload functionality
- [ ] Test RAG query functionality
- [ ] Deploy Step 2 (update mode)
- [ ] Verify no deployment errors
- [ ] Retest application functionality

---

## Rollback Plan

If issues occur:

1. **Quick fix:** Manually add "Key Vault Secrets User" role via Portal
   - Azure Portal → Key Vault → Access control (IAM) → Add role assignment
   - Role: Key Vault Secrets User
   - Assign access to: Managed Identity → App Service
   - Select both web and worker apps

2. **Storage workaround:** Use direct storage key (not Key Vault secret URI)
   - Update storage mount to use `storageAccountKey` parameter directly

3. **Full rollback:** Redeploy previous template version

---

## Next Steps

1. ✅ Templates updated and ready for testing
2. ⏳ Deploy to test environment
3. ⏳ Validate all functionality
4. ⏳ Update production deployment

---

## References

- [Azure Built-in Roles Documentation](https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles)
- [Key Vault RBAC Guide](https://learn.microsoft.com/en-us/azure/key-vault/general/rbac-guide)
- [Azure Files Identity-based Auth](https://learn.microsoft.com/en-us/azure/storage/files/storage-files-identity-auth-active-directory-enable)
- [App Service Managed Identity](https://learn.microsoft.com/en-us/azure/app-service/overview-managed-identity)
- [Storage File Data SMB Share Contributor](https://learn.microsoft.com/en-us/azure/role-based-access-control/built-in-roles#storage-file-data-smb-share-contributor)