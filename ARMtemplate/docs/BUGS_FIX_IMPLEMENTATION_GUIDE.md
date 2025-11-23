# Bug Fixes Implementation Guide

This guide provides step-by-step instructions to fix both critical bugs in [`createUiDefinition.json`](../catalog/createUiDefinition.json).

---

## 🎯 Pre-Implementation Checklist

- [ ] Backup current `createUiDefinition.json`
- [ ] Review [`CRITICAL_BUGS_ANALYSIS.md`](CRITICAL_BUGS_ANALYSIS.md)
- [ ] Test environment ready (Azure Portal Sandbox)
- [ ] Have existing Azure OpenAI resource for testing

---

## 🔧 Fix #1: Add Azure OpenAI Deployment Name Fields

### Problem Summary
Missing input fields for `azureOpenAIDeployment` and `azureEmbeddingDeployment` cause null values in outputs.

### Implementation Steps

#### Step 1: Locate Insert Position

**File:** `ARMtemplate/catalog/createUiDefinition.json`  
**Location:** After line 471 (after `azureOpenAIEndpointComputed` element)  
**Section:** `steps[3].elements` (aiServicesStep)

#### Step 2: Add Chat Model Deployment Field

Insert this element after line 471:

```json
{
  "name": "azureOpenAIDeployment",
  "type": "Microsoft.Common.TextBox",
  "label": "Chat model deployment name",
  "placeholder": "e.g., gpt-4, gpt-35-turbo, gpt-4o",
  "toolTip": "The deployment name for your chat/completion model in Azure OpenAI Studio. This is the name YOU chose when creating the deployment, not the base model name.",
  "constraints": {
    "required": true,
    "regex": "^[a-zA-Z0-9][a-zA-Z0-9-_.]{0,62}[a-zA-Z0-9]$",
    "validationMessage": "Deployment name must be 1-64 characters, start and end with alphanumeric, and contain only letters, numbers, hyphens, underscores, and periods."
  }
},
```

#### Step 3: Add Embedding Model Deployment Field

Insert immediately after the previous element:

```json
{
  "name": "azureEmbeddingDeployment",
  "type": "Microsoft.Common.TextBox",
  "label": "Embedding model deployment name",
  "placeholder": "e.g., text-embedding-3-small, text-embedding-ada-002",
  "toolTip": "The deployment name for your embedding model in Azure OpenAI Studio. Required for document search functionality.",
  "constraints": {
    "required": true,
    "regex": "^[a-zA-Z0-9][a-zA-Z0-9-_.]{0,62}[a-zA-Z0-9]$",
    "validationMessage": "Deployment name must be 1-64 characters, start and end with alphanumeric, and contain only letters, numbers, hyphens, underscores, and periods."
  }
},
```

#### Step 4: Add Help InfoBox

Insert immediately after the previous element:

```json
{
  "name": "deploymentNamesHelp",
  "type": "Microsoft.Common.InfoBox",
  "options": {
    "icon": "Info",
    "text": "📍 How to find deployment names:\n\n1. Go to Azure OpenAI Studio (https://oai.azure.com)\n2. Select your resource\n3. Click 'Deployments' in left menu\n4. Copy the 'Deployment name' column values\n\n⚠️ IMPORTANT: Use the DEPLOYMENT NAME you created, NOT the base model name.\n\nExample:\n• Your deployment name: 'my-gpt4-deployment' ✅\n• Base model name: 'gpt-4' ❌"
  }
},
```

#### Step 5: Update defaultEmbeddingModel Default Value (Optional Improvement)

Find the `defaultEmbeddingModel` element (around line 509) and update its `defaultValue`:

```json
{
  "name": "defaultEmbeddingModel",
  "type": "Microsoft.Common.TextBox",
  "label": "Default embedding model identifier",
  "defaultValue": "[steps('aiServicesStep').azureEmbeddingDeployment]",
  "toolTip": "Model identifier SmartLib loads on startup (automatically matches your embedding deployment name).",
  "visible": false
},
```

**Why this change?** It synchronizes the default with the user's actual deployment name.

#### Step 6: Verify Outputs Section

Confirm lines 1001-1003 in `outputs` section already reference these fields correctly:

```json
"azureOpenAIDeployment": "[steps('aiServicesStep').azureOpenAIDeployment]",
"azureOpenAIAPIVersion": "[steps('aiServicesStep').azureOpenAIAPIVersion]",
"azureEmbeddingDeployment": "[steps('aiServicesStep').azureEmbeddingDeployment]",
```

**No changes needed in outputs** - mainTemplate already expects these parameters!

### Testing Fix #1

1. **Syntax Test:**
   ```bash
   python -m json.tool ARMtemplate/catalog/createUiDefinition.json > /dev/null
   ```

2. **Azure Portal Sandbox Test:**
   - Go to: https://portal.azure.com/#view/Microsoft_Azure_CreateUIDef/SandboxBlade
   - Paste entire JSON content
   - Navigate to "AI & Cognitive Services" step
   - Verify two new fields appear after endpoint field
   - Enter test values
   - Check "Review + Create" tab shows correct outputs

3. **Validation Test:**
   - Try empty values → Should show required error
   - Try invalid characters (spaces) → Should show validation error
   - Try valid deployment names → Should accept

---

## 🔧 Fix #2: Document Intelligence Validation

### Problem Summary
Current TextBox validation always fails because it's missing the resource group in the API path.

### Solution A: ResourceSelector (RECOMMENDED)

This is the cleanest, most user-friendly solution.

#### Step 1: Locate Section to Replace

**File:** `ARMtemplate/catalog/createUiDefinition.json`  
**Lines to replace:** 536-595 (entire Document Intelligence section)

#### Step 2: Replace with ResourceSelector Implementation

Replace lines 536-595 with:

```json
{
  "name": "docIntelligenceInfo",
  "type": "Microsoft.Common.InfoBox",
  "options": {
    "icon": "Info",
    "text": "📄 Document Intelligence is OPTIONAL\n\nIf enabled, SmartLib uses Azure Document Intelligence for advanced document parsing (tables, forms, complex layouts).\n\nIf disabled, SmartLib uses built-in OCR for basic document processing."
  }
},
{
  "name": "useDocIntelligence",
  "type": "Microsoft.Common.CheckBox",
  "label": "Enable Azure Document Intelligence (optional)",
  "defaultValue": false,
  "toolTip": "Check this box if you want to use Azure Document Intelligence for enhanced document processing capabilities."
},
{
  "name": "docIntelligenceSelector",
  "type": "Microsoft.Solutions.ResourceSelector",
  "label": "Select Document Intelligence resource",
  "resourceType": "Microsoft.CognitiveServices/accounts",
  "visible": "[steps('aiServicesStep').useDocIntelligence]",
  "options": {
    "filter": {
      "kind": "FormRecognizer"
    }
  },
  "constraints": {
    "required": "[steps('aiServicesStep').useDocIntelligence]"
  }
},
{
  "name": "docIntelligenceResourceFound",
  "type": "Microsoft.Common.InfoBox",
  "visible": "[and(steps('aiServicesStep').useDocIntelligence, not(equals(steps('aiServicesStep').docIntelligenceSelector.name, '')))]",
  "options": {
    "icon": "Info",
    "text": "[concat('✅ Document Intelligence resource selected\n📍 Name: ', steps('aiServicesStep').docIntelligenceSelector.name, '\n📍 Location: ', steps('aiServicesStep').docIntelligenceSelector.location, '\n🔗 Endpoint: ', steps('aiServicesStep').docIntelligenceSelector.properties.endpoint)]",
    "style": "Success"
  }
},
{
  "name": "docIntelligenceEndpoint",
  "type": "Microsoft.Common.TextBox",
  "label": "Document Intelligence endpoint (auto-detected)",
  "defaultValue": "[if(steps('aiServicesStep').useDocIntelligence, coalesce(steps('aiServicesStep').docIntelligenceSelector.properties.endpoint, ''), '')]",
  "toolTip": "Endpoint URL automatically populated from the selected resource.",
  "visible": false,
  "constraints": {
    "required": false
  }
},
{
  "name": "docIntelligenceKeyInfo",
  "type": "Microsoft.Common.InfoBox",
  "visible": "[steps('aiServicesStep').useDocIntelligence]",
  "options": {
    "icon": "Info",
    "text": "💡 IMPORTANT: Store your Document Intelligence API key in Key Vault and provide the secret URI below.\n\nHow to get the key:\n1. Azure Portal → Document Intelligence resource\n2. Keys and Endpoint\n3. Copy Key 1 or Key 2\n4. Store in Key Vault as a secret\n5. Paste the secret URI here"
  }
},
{
  "name": "docIntelligenceKeySecretUri",
  "type": "Microsoft.Common.TextBox",
  "label": "Document Intelligence key secret URI",
  "visible": "[steps('aiServicesStep').useDocIntelligence]",
  "toolTip": "Key Vault secret URI containing the Azure Document Intelligence API key.",
  "constraints": {
    "required": "[steps('aiServicesStep').useDocIntelligence]",
    "regex": "^https://[a-zA-Z0-9-]+\\.vault\\.azure\\.net/secrets/[a-zA-Z0-9-]+(/[a-zA-Z0-9]+)?$",
    "validationMessage": "Must be a valid Azure Key Vault secret URI (format: https://{vault}.vault.azure.net/secrets/{secret-name})"
  }
}
```

#### Step 3: Update Outputs Section

Find line 1007-1008 in outputs and update:

```json
"docIntelligenceEndpoint": "[if(steps('aiServicesStep').useDocIntelligence, steps('aiServicesStep').docIntelligenceSelector.properties.endpoint, '')]",
"docIntelligenceKeySecretUri": "[if(steps('aiServicesStep').useDocIntelligence, steps('aiServicesStep').docIntelligenceKeySecretUri, '')]"
```

### Testing Fix #2 (ResourceSelector)

1. **Enable/Disable Test:**
   - Navigate to AI Services step
   - Verify checkbox appears
   - Check box → Verify selector dropdown appears
   - Uncheck box → Verify selector disappears

2. **Resource Selection Test:**
   - Check "Enable Document Intelligence"
   - Click resource selector dropdown
   - Verify only Document Intelligence/FormRecognizer resources appear
   - Select a resource
   - Verify green success message appears with resource details

3. **Endpoint Population Test:**
   - After selecting resource
   - Check "Review + Create" tab
   - Verify `docIntelligenceEndpoint` output contains correct URL

4. **Key Vault Secret URI Test:**
   - Enter valid Secret URI
   - Verify validation accepts it
   - Try invalid URL → Verify error message

---

## 📋 Complete Implementation Checklist

### Pre-Implementation
- [ ] Backup current file: `cp createUiDefinition.json createUiDefinition.json.backup`
- [ ] Review entire bug analysis document
- [ ] Identify Azure test resources

### Bug #1 Implementation
- [ ] Add `azureOpenAIDeployment` TextBox (after line 471)
- [ ] Add `azureEmbeddingDeployment` TextBox
- [ ] Add `deploymentNamesHelp` InfoBox
- [ ] Update `defaultEmbeddingModel` default value (optional)
- [ ] Verify outputs section (lines 1001-1003)

### Bug #2 Implementation (ResourceSelector)
- [ ] Replace lines 536-595 with new ResourceSelector code
- [ ] Update outputs section (lines 1007-1008)

### Validation
- [ ] Run JSON syntax validation
- [ ] Test in Azure Portal Sandbox
- [ ] Test all fields appear correctly
- [ ] Test validation rules work
- [ ] Test outputs contain correct values

### Testing
- [ ] Test Fix #1: Enter deployment names, verify outputs
- [ ] Test Fix #2: Select Doc Intelligence resource, verify endpoint
- [ ] Test complete deployment flow
- [ ] Verify deployment succeeds without errors

---

## 🚨 Common Implementation Mistakes

### Mistake #1: JSON Syntax Errors
**Problem:** Missing comma between elements  
**Solution:** Every element needs a comma after closing `}` except the last one

### Mistake #2: Incorrect Line Numbers
**Problem:** Documentation line numbers don't match your file  
**Solution:** Use element names to find positions (search for `"name": "azureOpenAIEndpointComputed"`)

### Mistake #3: Breaking Outputs References
**Problem:** Changed element name but forgot to update outputs  
**Solution:** Keep element names exactly as specified: `azureOpenAIDeployment`, `azureEmbeddingDeployment`

### Mistake #4: Wrong Insert Position
**Problem:** Added fields in wrong step or wrong order  
**Solution:** Must be in `aiServicesStep` (step index 3), after `azureOpenAIEndpointComputed`

---

## 🧪 Post-Implementation Testing

### Test 1: Sandbox Validation
```bash
# Azure Portal Sandbox URL
https://portal.azure.com/#view/Microsoft_Azure_CreateUIDef/SandboxBlade
```

1. Paste entire JSON
2. Click through all wizard steps
3. Verify no errors
4. Check "Review + Create" outputs

### Test 2: Actual Deployment
```bash
az deployment group create \
  --resource-group test-smartlib-rg \
  --template-file ARMtemplate/catalog/mainTemplate.json \
  --parameters ARMtemplate/catalog/createUiDefinition.json
```

### Test 3: Environment Variables Check

After deployment, verify web app settings:

```bash
# View app settings
az webapp config appsettings list \
  --name {your-web-app-name} \
  --resource-group {your-rg} \
  --query "[?name=='AZURE_OPENAI_DEPLOYMENT' || name=='AZURE_EMBEDDING_DEPLOYMENT'].{Name:name, Value:value}" \
  --output table
```

Expected output:
```
Name                          Value
----------------------------  ------------------------
AZURE_OPENAI_DEPLOYMENT      <your-chat-deployment>
AZURE_EMBEDDING_DEPLOYMENT   <your-embedding-deployment>
```

---

## 🔄 Rollback Plan

If implementation fails:

```bash
# Restore backup
cp createUiDefinition.json.backup createUiDefinition.json

# Re-validate
python -m json.tool createUiDefinition.json > /dev/null && echo "✅ Backup restored"
```

---

## 📞 Support

**For Issues:**
1. Check JSON syntax: `python -m json.tool createUiDefinition.json`
2. Test in Azure Portal Sandbox
3. Review browser DevTools console for errors
4. Compare with [`CRITICAL_BUGS_ANALYSIS.md`](CRITICAL_BUGS_ANALYSIS.md)

**Additional Resources:**
- [Azure CreateUIDefinition elements reference](https://learn.microsoft.com/azure/azure-resource-manager/managed-applications/create-uidefinition-elements)
- [ResourceSelector documentation](https://learn.microsoft.com/azure/azure-resource-manager/managed-applications/microsoft-solutions-resourceselector)
- [Validation patterns](https://learn.microsoft.com/azure/azure-resource-manager/managed-applications/create-uidefinition-functions)

---

**Implementation Guide Version:** 1.0  
**Last Updated:** 2024-01-22  
**Status:** Ready for Implementation  
**Estimated Implementation Time:** 30-60 minutes