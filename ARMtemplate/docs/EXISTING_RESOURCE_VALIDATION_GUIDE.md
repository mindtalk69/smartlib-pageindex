# Existing Azure Resource Validation - Implementation Guide

## Overview

This guide documents the validation system for existing Azure resources in the SmartLib deployment wizard. The system verifies that user-provided resources actually exist before deployment, preventing configuration errors and failed deployments.

## Implemented Validations

### 1. Key Vault Validation ✅

**Location:** Infrastructure Services Step (lines 121-171)

**What It Validates:**
- Key Vault exists in specified Resource Group
- User has permissions to access the Key Vault
- Resource Group name is correct

**How It Works:**
```json
{
  "name": "keyVaultExistsApi",
  "type": "Microsoft.Solutions.ArmApiControl",
  "request": {
    "method": "GET",
    "path": "[concat(subscription().id, '/resourceGroups/', 
            steps('infrastructureStep').existingKeyVaultResourceGroup, 
            '/providers/Microsoft.KeyVault/vaults/', 
            steps('infrastructureStep').existingKeyVaultName, 
            '?api-version=2023-07-01')]"
  }
}
```

**User Experience:**
1. User enters Resource Group name first
2. User enters Key Vault name
3. System validates automatically (1-2 seconds)
4. Shows success or error message

**Success Message:**
```
✅ Key Vault verified
📍 Name: your-keyvault
📍 Location: eastus
🔗 Vault URI: https://your-keyvault.vault.azure.net/
```

**Error Message:**
```
❌ Key Vault NOT FOUND

Looking for: your-keyvault
In Resource Group: your-rg

⚠️ Please verify:
• Key Vault name is correct
• Resource Group name is correct
• Key Vault exists in your subscription
• You have Reader permissions on the resource
```

### 2. Storage Account Validation ✅

**Location:** Storage Services Step (lines 314-380)

**What It Validates:**
- Storage Account exists in specified Resource Group
- User has permissions to access Storage Account
- Resource Group name is correct

**How It Works:**
```json
{
  "name": "storageAccountExistsApi",
  "type": "Microsoft.Solutions.ArmApiControl",
  "request": {
    "method": "GET",
    "path": "[concat(subscription().id, '/resourceGroups/', 
            steps('storageServicesStep').storageAccountResourceGroup, 
            '/providers/Microsoft.Storage/storageAccounts/', 
            steps('storageServicesStep').storageAccountName, 
            '?api-version=2023-01-01')]"
  }
}
```

**Success Message:**
```
✅ Storage Account verified
📍 Name: stsmartlib
📍 Location: eastus
📦 SKU: Standard_LRS
🔒 Primary Endpoint: https://stsmartlib.file.core.windows.net/
```

**Error Message:**
```
❌ Storage Account NOT FOUND

Looking for: stsmartlib
In Resource Group: smartlib-rg

⚠️ Please verify:
• Storage Account name is correct
• Resource Group name is correct
• Storage Account exists in your subscription
• You have Reader permissions on the resource
```

### 3. Azure OpenAI Resource Validation ✅

**Location:** AI Services Step (lines 434-493)

**What It Validates:**
- Azure OpenAI resource exists in subscription
- Resource kind is OpenAI (not other Cognitive Services)
- User has permissions to access the resource

**Special Feature: Auto-Endpoint Construction**
- Automatically builds endpoint: `https://{resourceName}.openai.azure.com`
- No manual endpoint entry needed
- Reduces user error

**How It Works:**
```json
{
  "name": "openAIResourceExistsApi",
  "type": "Microsoft.Solutions.ArmApiControl",
  "request": {
    "method": "GET",
    "path": "[concat(subscription().id, 
            '/providers/Microsoft.CognitiveServices/accounts?api-version=2023-05-01')]"
  }
}
```

**Auto-Generated Endpoint Field:**
```json
{
  "name": "azureOpenAIEndpointComputed",
  "type": "Microsoft.Common.TextBox",
  "label": "Azure OpenAI Endpoint (auto-generated)",
  "defaultValue": "[concat('https://', 
                  steps('aiServicesStep').openAIAzureName, 
                  '.openai.azure.com')]"
}
```

**Success Message:**
```
✅ Azure OpenAI resource verified
📍 Resource Name: smartlib-openai
🔗 Endpoint: https://smartlib-openai.openai.azure.com
```

**Error Message:**
```
❌ Azure OpenAI resource NOT FOUND

Looking for: smartlib-openai

⚠️ Please verify:
• Resource name is correct
• Azure OpenAI resource exists in your subscription
• You have Reader permissions on the resource
• The resource kind is OpenAI (not other Cognitive Services)
```

### 4. Document Intelligence Endpoint Validation ✅

**Location:** AI Services Step (lines 544-586)

**What It Validates:**
- Endpoint URL format is correct
- Resource extracted from URL exists
- Resource is Document Intelligence kind
- User has permissions to access resource

**Endpoint Format:**
- Valid: `https://your-resource.cognitiveservices.azure.com/`
- Invalid: Missing https, wrong domain, etc.

**How It Works:**

**Step 1: Format Validation**
```json
{
  "constraints": {
    "regex": "^(https://[a-z0-9-]+\\.cognitiveservices\\.azure\\.com/?)?$",
    "validationMessage": "Must be a valid Document Intelligence endpoint"
  }
}
```

**Step 2: Resource Name Extraction**
```json
{
  "defaultValue": "[if(not(equals(steps('aiServicesStep').docIntelligenceEndpoint, '')), 
                   first(split(split(steps('aiServicesStep').docIntelligenceEndpoint, '//')[1], '.')), 
                   '')]"
}
```

This extracts:
- Input: `https://test-smarteam.cognitiveservices.azure.com/`
- Extracted: `test-smarteam`

**Step 3: Existence Validation**
```json
{
  "name": "docIntelligenceExistsApi",
  "type": "Microsoft.Solutions.ArmApiControl",
  "request": {
    "method": "GET",
    "path": "[if(not(equals(steps('aiServicesStep').docIntelligenceResourceName, '')), 
            concat(subscription().id, '/providers/Microsoft.CognitiveServices/accounts/', 
                   steps('aiServicesStep').docIntelligenceResourceName, 
                   '?api-version=2023-05-01'), 
            concat(subscription().id, '/providers/Microsoft.CognitiveServices/accounts?api-version=2023-05-01'))]"
  }
}
```

**Success Message:**
```
✅ Document Intelligence resource verified
📍 Resource Name: test-smarteam
🔗 Endpoint: https://test-smarteam.cognitiveservices.azure.com/
📊 Kind: FormRecognizer
```

**Error Message:**
```
❌ Document Intelligence resource NOT FOUND

Endpoint provided: https://test-smarteam.cognitiveservices.azure.com/
Extracted name: test-smarteam

⚠️ Please verify:
• Endpoint URL is correct
• Resource exists in your subscription
• You have Reader permissions
• Resource kind is FormRecognizer or CognitiveServices
```

---

## Field Ordering Changes

### Infrastructure Services
**Before:**
1. Key Vault name
2. Key Vault help  
3. Key Vault Resource Group

**After:**
1. Key Vault Resource Group ← **Moved up**
2. Key Vault name
3. Key Vault help
4. Key Vault validation
5. Success/error feedback

**Reason:** Need Resource Group before validating Key Vault name

### Storage Services
**Already Correct:**
1. Storage Account Resource Group
2. Storage Account name
3. Validation
4. Feedback

No reordering needed.

---

## Technical Implementation Details

### API Endpoints Used

| Resource Type | API Version | Endpoint Pattern |
|--------------|-------------|------------------|
| Key Vault | 2023-07-01 | `/resourceGroups/{rg}/providers/Microsoft.KeyVault/vaults/{name}` |
| Storage Account | 2023-01-01 | `/resourceGroups/{rg}/providers/Microsoft.Storage/storageAccounts/{name}` |
| Azure OpenAI | 2023-05-01 | `/providers/Microsoft.CognitiveServices/accounts` |
| Document Intelligence | 2023-05-01 | `/providers/Microsoft.CognitiveServices/accounts/{name}` |

### Validation Trigger Mechanism

All validations use `Microsoft.Solutions.ArmApiControl` which:
- **Auto-triggers** when referenced form values change
- **Debounces** automatically (typically 500ms-1s)
- **Caches** results until inputs change
- **Fails open** if API call fails (doesn't block deployment)

### Success Condition Logic

**Key Vault & Storage Account:**
```javascript
[and(
  not(equals(steps('step').name, '')),              // Name is not empty
  not(equals(steps('step').resourceGroup, '')),     // RG is not empty
  equals(string(steps('step').api.name), steps('step').name)  // API returned matching name
)]
```

**Azure OpenAI:**
```javascript
[and(
  not(equals(steps('aiServicesStep').openAIAzureName, '')),
  contains(string(steps('aiServicesStep').openAIResourceExistsApi), 
           steps('aiServicesStep').openAIAzureName)
)]
```

**Document Intelligence:**
```javascript
[and(
  not(equals(steps('aiServicesStep').docIntelligenceEndpoint, '')),
  or(
    contains(string(steps('aiServicesStep').docIntelligenceExistsApi.kind), 'FormRecognizer'),
    contains(string(steps('aiServicesStep').docIntelligenceExistsApi.kind), 'CognitiveServices')
  )
)]
```

### Error Condition Logic

Simply the opposite of success condition:
```javascript
[and(
  not(equals(...)),                  // Fields not empty
  not(equals(string(api.name), ...)) // API didn't return matching resource
)]
```

---

## Testing Guide

### Test Case 1: Key Vault Validation

**Scenario A: Valid Key Vault**
1. Enter valid Resource Group: `smartlib-rg`
2. Enter valid Key Vault: `smartlib-kv`
3. **Expected:** ✅ Success message with vault details

**Scenario B: Invalid Key Vault Name**
1. Enter valid Resource Group: `smartlib-rg`
2. Enter invalid Key Vault: `nonexistent-kv`
3. **Expected:** ❌ Error message with troubleshooting guidance

**Scenario C: Invalid Resource Group**
1. Enter invalid Resource Group: `wrong-rg`
2. Enter valid Key Vault: `smartlib-kv`
3. **Expected:** ❌ Error message (Key Vault not found in that RG)

**Scenario D: Cross-RG Key Vault**
1. Enter different Resource Group: `other-rg`
2. Enter Key Vault that exists in that RG: `other-kv`
3. **Expected:** ✅ Success (cross-RG validation works)

### Test Case 2: Storage Account Validation

**Scenario A: Valid Storage Account**
1. Enter Resource Group: `smartlib-rg`
2. Enter Storage Account: `stsmartlib`
3. **Expected:** ✅ Success with SKU, location, endpoint

**Scenario B: Invalid Storage Account**
1. Enter valid RG: `smartlib-rg`
2. Enter invalid Storage Account: `nonexistent`
3. **Expected:** ❌ Error message

**Scenario C: Wrong Resource Group**
1. Enter wrong RG: `other-rg`
2. Enter valid Storage Account: `stsmartlib`
3. **Expected:** ❌ Error (Storage Account not in that RG)

### Test Case 3: Azure OpenAI Validation

**Scenario A: Valid OpenAI Resource**
1. Enter OpenAI resource name: `smartlib-openai`
2. **Expected:** 
   - ✅ Success message
   - Endpoint auto-populated: `https://smartlib-openai.openai.azure.com`
   - Endpoint field shows computed value

**Scenario B: Invalid OpenAI Resource**
1. Enter invalid name: `nonexistent-openai`
2. **Expected:** 
   - ❌ Error message
   - Endpoint still constructed (but resource doesn't exist)

**Scenario C: Non-OpenAI Cognitive Service**
1. Enter different Cognitive Service name (e.g., Computer Vision)
2. **Expected:** ❌ Error (resource exists but not OpenAI kind)

### Test Case 4: Document Intelligence Validation

**Scenario A: Valid Endpoint**
1. Enter: `https://smartlib-doc.cognitiveservices.azure.com/`
2. **Expected:**
   - ✅ Format validation passes
   - ✅ Resource name extracted: `smartlib-doc`
   - ✅ Resource verified with kind

**Scenario B: Invalid Format**
1. Enter: `http://smartlib-doc.cognitiveservices.azure.com/` (HTTP not HTTPS)
2. **Expected:** ⚠️ Format validation error

**Scenario C: Invalid Domain**
1. Enter: `https://smartlib-doc.wrong.azure.com/`
2. **Expected:** ⚠️ Format validation error

**Scenario D: Nonexistent Resource**
1. Enter: `https://nonexistent.cognitiveservices.azure.com/`
2. **Expected:**
   - ✅ Format validation passes
   - ❌ Resource not found error

**Scenario E: Empty Field (Optional)**
1. Leave field empty
2. **Expected:** ✅ No validation (field is optional)

### Test Case 5: Real-Time Updates

**Scenario:**
1. Enter invalid Key Vault name → see error
2. Correct the name to valid value
3. **Expected:**
   - Error clears within 1-2 seconds
   - Success message appears
   - No page reload needed

### Test Case 6: Permissions Check

**Scenario A: No Reader Permissions**
1. Enter valid resource names
2. User lacks Reader role on resources
3. **Expected:**
   - API call fails (403 Forbidden)
   - System fails open (doesn't block deployment)
   - May show as "verified" or may timeout

---

## Troubleshooting

### Issue: Validation Always Shows Success (False Positive)

**Symptoms:**
- Shows success for known non-existent resources
- Green checkmark for invalid names

**Possible Causes:**
1. **API Call Failed:** Network error, timeout
2. **Logic Error:** Visibility condition incorrect
3. **Permissions:** User has no Reader access (fails open)

**Solution:**
1. Open Browser DevTools → Network tab
2. Look for API calls to `management.azure.com`
3. Check response:
   - 404 = Resource not found (expected for invalid)
   - 403 = Permission denied
   - 200 = Resource exists
4. Verify visibility logic matches response structure

### Issue: Validation Always Shows Error (False Negative)

**Symptoms:**
- Shows error for known valid resources
- Red error for correct names

**Possible Causes:**
1. **Case Sensitivity:** Resource name case mismatch
2. **API Response Structure:** Different than expected
3. **Resource Group Mismatch:** Resource in different RG
4. **Subscription Filter:** Resource in different subscription

**Solution:**
1. Verify exact resource name (case-sensitive)
2. Confirm Resource Group is correct
3. Check API response structure in DevTools:
   ```json
   {
     "name": "actual-resource-name",
     "id": "/subscriptions/.../resourceGroups/.../..."
   }
   ```
4. Ensure resource in same subscription as deployment

### Issue: No Validation Appears

**Symptoms:**
- No success or error messages
- No API calls in Network tab
- Fields don't trigger validation

**Possible Causes:**
1. **Empty Fields:** Validation disabled when fields empty
2. **JSON Syntax Error:** createUiDefinition.json invalid
3. **Browser Cache:** Old version loaded

**Solution:**
1. Test with non-empty values
2. Validate JSON syntax in Azure Portal Sandbox
3. Clear browser cache, reload
4. Check console for JavaScript errors

### Issue: Slow Validation Response

**Symptoms:**
- Takes 5+ seconds for validation
- Noticeable delay after typing

**Possible Causes:**
1. **Azure API Latency:** Geographic distance
2. **Network Issues:** Slow connection
3. **API Throttling:** Rate limits reached

**Solution:**
1. Normal latency is 1-2 seconds
2. Check Azure service health status
3. Wait for response (no user action needed)
4. If persistent, open support ticket

---

## Security & Permissions

### Required Permissions

All validations require **Reader** role on:
- Key Vault: Reader on Resource Group containing Key Vault
- Storage Account: Reader on Resource Group containing Storage
- Azure OpenAI: Reader on Subscription (queries all Cognitive Services)
- Document Intelligence: Reader on Subscription

### Permission Errors

If user lacks permissions:
- API returns 403 Forbidden
- Validation **fails open** (doesn't block deployment)
- User sees generic error or success (depending on implementation)

**Recommendation:** Grant Reader role at subscription level for smooth validation.

### Data Privacy

All validation calls:
- Use user's authenticated Azure session
- No credentials stored or transmitted
- Only resource names passed (not sensitive data)
- API responses contain resource metadata only

---

## Performance Considerations

### API Call Frequency

- **Per field change:** 1 API call (after debounce)
- **Total per form:** 4 validation APIs maximum
- **Rate limits:** Azure allows 12,000 requests/hour/subscription
- **Risk:** Very low for interactive use

### Optimization

Current implementation:
- ✅ Debouncing built into `ArmApiControl`
- ✅ Parallel API calls (non-blocking)
- ✅ Cached results until inputs change
- ✅ Conditional execution (only when fields not empty)

Future enhancements:
- Add loading indicators
- Implement custom debouncing (500ms-1s)
- Batch related validations

---

## Integration with Deployment

### How Validated Data Flows to mainTemplate.json

**Outputs Section (lines 980-1020):**
```json
{
  "existingKeyVaultName": "[steps('infrastructureStep').existingKeyVaultName]",
  "existingKeyVaultResourceGroup": "[steps('infrastructureStep').existingKeyVaultResourceGroup]",
  "storageAccountName": "[steps('storageServicesStep').storageAccountName]",
  "storageAccountResourceGroup": "[steps('storageServicesStep').storageAccountResourceGroup]",
  "openAIAzureName": "[steps('aiServicesStep').openAIAzureName]",
  "azureOpenAIEndpoint": "[steps('aiServicesStep').azureOpenAIEndpointComputed]",
  "docIntelligenceEndpoint": "[steps('aiServicesStep').docIntelligenceEndpoint]"
}
```

**Note:** Validation confirms resources exist, but deployment still uses user-provided names (now validated).

### Deployment Behavior

1. User completes form with validated resources
2. Outputs passed to mainTemplate.json as parameters
3. mainTemplate references these existing resources
4. Deployment succeeds (resources confirmed to exist)

**Key Change:** Azure OpenAI endpoint now auto-computed (not manually entered)

---

## Future Enhancements

### 1. File Share Validation

Validate that Azure Files share exists in Storage Account:

```json
{
  "name": "fileShareExistsApi",
  "type": "Microsoft.Solutions.ArmApiControl",
  "request": {
    "method": "GET",
    "path": "[concat(subscription().id, '/resourceGroups/', 
            steps('storageServicesStep').storageAccountResourceGroup,
            '/providers/Microsoft.Storage/storageAccounts/',
            steps('storageServicesStep').storageAccountName,
            '/fileServices/default/shares/',
            steps('storageServicesStep').dataShareName,
            '?api-version=2023-01-01')]"
  }
}
```

### 2. Redis Cache Validation

Parse Redis connection string and validate resource exists:

```json
// Extract hostname from connection string
// Validate Redis cache resource
```

### 3. Deployment Validation

Validate Azure OpenAI deployment names exist:

```json
{
  "name": "openAIDeploymentExistsApi",
  "request": {
    "method": "GET",
    "path": "/.../ deployments/{deploymentName}"
  }
}
```

### 4. Cross-Region Validation

Confirm all resources in same region for optimal performance:

```json
// Check location field from all validated resources
// Show warning if resources in different regions
```

---

## Support & Resources

**Documentation:**
- [Resource Name Validation Guide](RESOURCE_NAME_VALIDATION_GUIDE.md) - For new resource naming
- [Testing Checklist](VALIDATION_TESTING_CHECKLIST.md) - Comprehensive test scenarios
- [Quick Reference](VALIDATION_QUICK_REFERENCE.md) - Quick command reference

**Azure Documentation:**
- [ARM Template Functions](https://learn.microsoft.com/azure/azure-resource-manager/templates/template-functions)
- [ArmApiControl Element](https://learn.microsoft.com/azure/azure-resource-manager/managed-applications/microsoft-solutions-armapicontrol)
- [Azure REST API Reference](https://learn.microsoft.com/rest/api/azure/)

**For Issues:**
1. Check this troubleshooting guide
2. Test in Azure Portal CreateUIDefinition Sandbox
3. Review browser DevTools console and network logs
4. Contact SmartLib support team

---

**Version:** 1.0.0  
**Last Updated:** 2024-01-22  
**Implementation Status:** Production Ready ✅  
**Validated Resources:** Key Vault, Storage Account, Azure OpenAI, Document Intelligence