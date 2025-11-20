# Key Vault Resource Selector Improvement

## Problem Statement

The current Key Vault configuration in [`createUiDefinition.json`](../catalog/createUiDefinition.json:122-144) uses separate text fields for the Key Vault name and resource group:

```json
{
  "name": "existingKeyVaultName",
  "type": "Microsoft.Common.TextBox",
  "label": "Key Vault name",
  ...
},
{
  "name": "existingKeyVaultResourceGroup",
  "type": "Microsoft.Common.TextBox",
  "label": "Key Vault resource group",
  "defaultValue": "[resourceGroup().name]",
  ...
}
```

### Issues with Current Approach

1. **Silent Failure Risk**: The default value `[resourceGroup().name]` auto-fills with the deployment resource group. If users have their Key Vault in a different resource group and don't change this value, deployment will fail trying to access a non-existent Key Vault.

2. **Typo Prone**: Manual text entry for both name and resource group allows typos and configuration errors.

3. **Not User-Friendly**: Users must manually find and type both the Key Vault name and its resource group name.

4. **Cross-RG Confusion**: Users might not realize their Key Vault is in a different resource group, leading to deployment failures.

## Recommended Solution

Replace the two text boxes with a **Resource Selector** that automatically handles both name and resource group detection.

### Implementation

Replace lines 122-144 in [`createUiDefinition.json`](../catalog/createUiDefinition.json:122) with:

```json
{
  "name": "keyVaultSelector",
  "type": "Microsoft.Solutions.ResourceSelector",
  "label": "Select Key Vault",
  "toolTip": "Select the Azure Key Vault that stores SmartLib secrets. The Key Vault can be in any resource group you have access to.",
  "resourceType": "Microsoft.KeyVault/vaults",
  "options": {
    "filter": {
      "subscription": "onBasics",
      "location": "onBasics"
    }
  },
  "constraints": {
    "required": true
  }
},
{
  "name": "keyVaultHelp",
  "type": "Microsoft.Common.InfoBox",
  "options": {
    "icon": "Info",
    "text": "Select your existing Key Vault from the dropdown. The selector will automatically detect the correct resource group, even if it's different from your deployment resource group.\n\n✅ Supports cross-resource-group Key Vaults\n✅ Prevents typos and configuration errors\n✅ Shows only Key Vaults you have access to"
  }
},
```

### Update mainTemplate.json Parameters

Update the parameters in [`mainTemplate.json`](../catalog/mainTemplate.json) to extract values from the resource selector:

**Remove these parameters:**
```json
"existingKeyVaultName": {
  "type": "string",
  ...
},
"existingKeyVaultResourceGroup": {
  "type": "string",
  ...
}
```

**Add these instead:**
```json
"keyVaultId": {
  "type": "string",
  "metadata": {
    "description": "Resource ID of the existing Key Vault"
  }
}
```

### Update outputs.json

In the outputs section of [`createUiDefinition.json`](../catalog/createUiDefinition.json), update how Key Vault is passed:

```json
"keyVaultId": "[steps('infrastructureStep').keyVaultSelector.id]",
"existingKeyVaultName": "[steps('infrastructureStep').keyVaultSelector.name]",
"existingKeyVaultResourceGroup": "[split(steps('infrastructureStep').keyVaultSelector.id, '/')[4]]"
```

This extracts:
- `keyVaultSelector.id` - Full resource ID
- `keyVaultSelector.name` - Key Vault name
- Resource group name from the resource ID (5th segment after splitting by '/')

### Update Uses in mainTemplate.json

Anywhere you currently use `parameters('existingKeyVaultName')` and `parameters('existingKeyVaultResourceGroup')`, you can continue using them since they're derived from the selector.

Alternatively, use the full resource ID:
```json
"[reference(parameters('keyVaultId'), '2021-06-01-preview')]"
```

## Benefits

1. **✅ Automatic Resource Group Detection**: No need for users to manually enter resource group - it's automatically detected from the selected Key Vault

2. **✅ Prevents Typos**: Dropdown selection eliminates manual typing errors

3. **✅ User-Friendly**: Shows all accessible Key Vaults in a dropdown, with search/filter capabilities

4. **✅ Cross-RG Support**: Seamlessly handles Key Vaults in different resource groups without user intervention

5. **✅ Permission Aware**: Only shows Key Vaults the user has access to

6. **✅ Consistent with Azure UX**: Follows Azure Portal's standard resource selection pattern

## Example Resource Selector Output

When a user selects a Key Vault, the resource selector provides:

```json
{
  "id": "/subscriptions/xxx/resourceGroups/my-kv-rg/providers/Microsoft.KeyVault/vaults/my-keyvault",
  "name": "my-keyvault",
  "type": "Microsoft.KeyVault/vaults",
  "location": "eastus",
  "resourceGroup": "my-kv-rg"
}
```

You can then extract any needed property from this object in the outputs section.

## Migration Path

### For New Deployments
Implement the Resource Selector as described above.

### For Existing Deployments
The current text box approach will continue to work. However, updating to Resource Selector is highly recommended to:
- Reduce deployment failures
- Improve user experience
- Eliminate cross-resource-group confusion

## Testing Checklist

After implementing the Resource Selector:

- [ ] Deploy with Key Vault in same resource group
- [ ] Deploy with Key Vault in different resource group
- [ ] Verify dropdown shows only accessible Key Vaults
- [ ] Confirm resource group is correctly extracted
- [ ] Test that role assignments work for cross-RG scenarios
- [ ] Validate Key Vault secrets can be read successfully

## References

- [Microsoft.Solutions.ResourceSelector Documentation](https://docs.microsoft.com/en-us/azure/azure-resource-manager/managed-applications/microsoft-solutions-resourceselector)
- [Azure Resource ID Structure](https://docs.microsoft.com/en-us/azure/azure-resource-manager/management/resource-name-rules)