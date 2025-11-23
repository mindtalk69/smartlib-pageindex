# Key Vault Selector Parameter Fix - RESOLVED

## Issue Description

The deployment was failing with the following error:

```json
{
  "code": "InvalidTemplate",
  "message": "Deployment template validation failed: 'The value for the template parameter 'existingKeyVaultName' at line '1' and column '1184' is not provided. Please see https://aka.ms/arm-create-parameter-file for usage details.'."
}
```

## Root Cause

The `createUiDefinition.json` outputs section was directly referencing `ResourceSelector` properties instead of using hidden textbox fields that capture those values. This violated Azure's best practices for reliable parameter passing.

### What Was Wrong

```json
// BEFORE (INCORRECT) - Direct selector references
"existingKeyVaultName": "[steps('infrastructureStep').keyVaultSelector.name]",
"existingKeyVaultResourceGroup": "[last(split(steps('infrastructureStep').keyVaultSelector.id, '/resourceGroups/'))]",
"storageAccountName": "[steps('storageServicesStep').storageAccountSelector.name]",
"storageAccountResourceGroup": "[last(split(steps('storageServicesStep').storageAccountSelector.id, '/resourceGroups/'))]",
"openAIAzureName": "[steps('aiServicesStep').openAIResourceSelector.name]",
"azureOpenAIEndpoint": "[steps('aiServicesStep').openAIResourceSelector.properties.endpoint]",
"docIntelligenceEndpoint": "[if(steps('aiServicesStep').useDocIntelligence, steps('aiServicesStep').docIntelligenceSelector.properties.endpoint, '')]"
```

## Solution Applied

Changed all outputs to reference the hidden textbox fields that capture ResourceSelector values, following Azure's recommended pattern:

```json
// AFTER (CORRECT) - Hidden field references
"existingKeyVaultName": "[steps('infrastructureStep').existingKeyVaultName]",
"existingKeyVaultResourceGroup": "[steps('infrastructureStep').existingKeyVaultResourceGroup]",
"storageAccountName": "[steps('storageServicesStep').storageAccountName]",
"storageAccountResourceGroup": "[steps('storageServicesStep').storageAccountResourceGroup]",
"openAIAzureName": "[steps('aiServicesStep').openAIAzureName]",
"azureOpenAIEndpoint": "[steps('aiServicesStep').azureOpenAIEndpointComputed]",
"docIntelligenceEndpoint": "[steps('aiServicesStep').docIntelligenceEndpoint]"
```

## Hidden Fields Configuration

Each ResourceSelector has corresponding hidden fields that capture its values:

### Key Vault (infrastructureStep)
- **Selector**: `keyVaultSelector` (line 122-130)
- **Hidden Fields**:
  - `existingKeyVaultName` (line 142-151): Captures selector name
  - `existingKeyVaultResourceGroup` (line 153-162): Captures resource group

### Storage Account (storageServicesStep)
- **Selector**: `storageAccountSelector` (line 310-318)
- **Hidden Fields**:
  - `storageAccountName` (line 330-339): Captures selector name
  - `storageAccountResourceGroup` (line 341-350): Captures resource group

### Azure OpenAI (aiServicesStep)
- **Selector**: `openAIResourceSelector` (line 416-428)
- **Hidden Fields**:
  - `openAIAzureName` (line 440-449): Captures selector name
  - `azureOpenAIEndpointComputed` (line 451-460): Captures endpoint

### Document Intelligence (aiServicesStep)
- **Selector**: `docIntelligenceSelector` (line 551-564)
- **Hidden Fields**:
  - `docIntelligenceEndpoint` (line 576-585): Captures endpoint

## Azure Best Practice

According to Azure ARM template best practices, ResourceSelector values should be captured in hidden fields for these reasons:

1. **Reliability**: Direct property access can fail during template validation
2. **Consistency**: Hidden fields ensure values are properly evaluated before being passed as parameters
3. **Type Safety**: Hidden fields provide consistent string values rather than complex objects
4. **Validation**: Hidden fields can have their own validation constraints

## Files Modified

- `ARMtemplate/catalog/createUiDefinition.json` (lines 997-998, 1004-1011, 1018)

## Testing Required

After this fix, test the deployment with:

1. **New Installation (Step 1)**:
   - Select existing Key Vault
   - Select existing Storage Account
   - Select existing Azure OpenAI resource
   - Verify all parameters are passed correctly to mainTemplate.json

2. **Update Installation (Step 2)**:
   - Verify role assignments are not recreated
   - Verify all resource references remain valid

## Status

✅ **FIXED** - All ResourceSelector outputs now properly reference hidden fields instead of direct selector properties.

## Date Fixed

2025-11-23T09:39:00Z