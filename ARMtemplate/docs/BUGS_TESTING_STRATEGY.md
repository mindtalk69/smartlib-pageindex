# Comprehensive Testing Strategy - ARM Template Bug Fixes

This document outlines the complete testing strategy for validating the bug fixes in [`createUiDefinition.json`](../catalog/createUiDefinition.json).

---

## 🎯 Testing Objectives

1. ✅ Verify Azure OpenAI deployment name fields function correctly
2. ✅ Verify Document Intelligence ResourceSelector works as expected
3. ✅ Ensure no regression in existing functionality
4. ✅ Validate end-to-end deployment success
5. ✅ Confirm application connects to Azure services properly

---

## 📋 Test Environments

### Environment 1: Azure Portal Sandbox
- **Purpose:** JSON syntax and UI validation
- **URL:** https://portal.azure.com/#view/Microsoft_Azure_CreateUIDef/SandboxBlade
- **Cost:** Free
- **Speed:** Instant feedback

### Environment 2: Azure Test Subscription
- **Purpose:** Actual deployment testing
- **Requirements:** 
  - Test resource group
  - Existing Azure OpenAI resource
  - Existing Document Intelligence resource (optional)
  - Key Vault
  - Storage Account
  - Redis Cache

### Environment 3: Local Development
- **Purpose:** JSON validation and structure testing
- **Tools:**
  - Python (JSON validation)
  - VS Code (JSON schema validation)
  - Git (version control)

---

## 🧪 Test Suites

### Test Suite 1: JSON Syntax & Structure

#### Test 1.1: JSON Validity
```bash
# Command
python -m json.tool ARMtemplate/catalog/createUiDefinition.json > /dev/null

# Expected result
✅ No output (success)

# If errors
❌ Parse error with line number
```

#### Test 1.2: Schema Validation
```bash
# In VS Code
1. Open createUiDefinition.json
2. Check bottom-right status bar
3. Verify: "JSON" language mode
4. Verify: No squiggly error lines

# Expected result
✅ No schema violations
```

#### Test 1.3: Element Count Verification
```bash
# Count total elements in aiServicesStep
grep -c '"name":' ARMtemplate/catalog/createUiDefinition.json

# Verify new elements added
# Before: ~15 elements in aiServicesStep
# After: ~18-20 elements (3-5 new elements)
```

---

### Test Suite 2: Azure Portal Sandbox Validation

#### Test 2.1: Initial Load Test

**Steps:**
1. Open Azure Portal Sandbox
2. Paste complete JSON content
3. Click "Ok"

**Expected Results:**
- ✅ No syntax errors displayed
- ✅ Wizard loads successfully
- ✅ All steps appear in left sidebar
- ✅ Can navigate to first step

**Pass Criteria:** Wizard opens without errors

---

#### Test 2.2: Navigation Test

**Steps:**
1. Click through each wizard step
2. Navigate: Identity → Infrastructure → Redis → Storage → AI Services → Deployment → Admin

**Expected Results:**
- ✅ All steps load without errors
- ✅ Can click "Next" on each step
- ✅ Can click "Previous" to go back
- ✅ No JavaScript console errors

**Pass Criteria:** Complete navigation without crashes

---

#### Test 2.3: Bug Fix #1 - Azure OpenAI Deployment Names

##### Test 2.3.1: Field Visibility
**Steps:**
1. Navigate to "AI & Cognitive Services" step
2. Scroll to Azure OpenAI section

**Expected Results:**
- ✅ "Azure OpenAI resource name" field visible
- ✅ "Azure OpenAI Endpoint (auto-generated)" field visible
- ✅ "Chat model deployment name" field visible (NEW)
- ✅ "Embedding model deployment name" field visible (NEW)
- ✅ Help InfoBox visible with deployment instructions (NEW)

**Pass Criteria:** All 5 fields/elements visible in correct order

##### Test 2.3.2: Required Field Validation
**Steps:**
1. Leave "Chat model deployment name" empty
2. Try to click "Next"

**Expected Results:**
- ❌ Red border appears on field
- ❌ Error message: "This field is required" or similar
- ❌ Cannot proceed to next step

**Pass Criteria:** Validation blocks empty submission

##### Test 2.3.3: Pattern Validation
**Steps:**
1. Enter invalid characters in "Chat model deployment name":
   - `my deployment` (space - invalid)
   - `Deploy@123` (@ symbol - invalid)
   - `-deployment` (starts with hyphen - invalid)
   - `deployment-` (ends with hyphen - invalid)

**Expected Results:**
- ❌ Regex validation error appears for each
- ❌ Error message displays validation requirement

**Pass Criteria:** All invalid patterns rejected

##### Test 2.3.4: Valid Input Test
**Steps:**
1. Enter valid deployment names:
   - Chat: `gpt-4-deployment`
   - Embedding: `text-embedding-3-small`

**Expected Results:**
- ✅ No validation errors
- ✅ Can proceed to next step
- ✅ Fields show green checkmark (if validation indicator present)

**Pass Criteria:** Valid inputs accepted

##### Test 2.3.5: Outputs Verification
**Steps:**
1. Complete all wizard steps with valid inputs
2. Navigate to "Review + Create" tab
3. Expand "Outputs" section (if available)

**Expected Results:**
- ✅ `azureOpenAIEndpoint` contains: `https://{resource-name}.openai.azure.com`
- ✅ `azureOpenAIDeployment` contains: entered chat deployment name
- ✅ `azureEmbeddingDeployment` contains: entered embedding deployment name

**Pass Criteria:** All three outputs present with correct values

---

#### Test 2.4: Bug Fix #2 - Document Intelligence ResourceSelector

##### Test 2.4.1: Checkbox Toggle Test
**Steps:**
1. Navigate to "AI & Cognitive Services" step
2. Scroll to Document Intelligence section
3. Observe initial state
4. Check "Enable Azure Document Intelligence"
5. Uncheck the checkbox

**Expected Results:**
- ✅ Initially unchecked (default: false)
- ✅ Checking shows resource selector dropdown (NEW)
- ✅ Unchecking hides resource selector
- ✅ No errors during toggle

**Pass Criteria:** Checkbox controls visibility correctly

##### Test 2.4.2: Resource Selector Functionality
**Steps:**
1. Check "Enable Azure Document Intelligence"
2. Click resource selector dropdown
3. Observe available resources

**Expected Results:**
- ✅ Dropdown opens with list of resources
- ✅ Only shows Cognitive Services accounts
- ✅ Only shows FormRecognizer kind (Document Intelligence)
- ✅ Does NOT show other Cognitive Services (Speech, Vision, etc.)

**Pass Criteria:** Correct resource filtering

##### Test 2.4.3: Resource Selection Test
**Steps:**
1. Select a Document Intelligence resource from dropdown
2. Observe UI changes

**Expected Results:**
- ✅ Green success InfoBox appears
- ✅ Shows selected resource name
- ✅ Shows resource location
- ✅ Shows endpoint URL (automatically populated)

**Pass Criteria:** Resource details display correctly

##### Test 2.4.4: Key Vault Secret URI Validation
**Steps:**
1. With Document Intelligence enabled
2. Enter invalid secret URIs:
   - `https://wrong.com/secrets/test` (wrong domain)
   - `not-a-url` (invalid format)
   - Empty (if required)

**Expected Results:**
- ❌ Validation error for wrong domain
- ❌ Validation error for invalid format
- ❌ Required error if empty (when Doc Intel enabled)

**Pass Criteria:** Invalid URIs rejected

##### Test 2.4.5: Valid Secret URI Test
**Steps:**
1. Enter valid Key Vault secret URI:
   `https://test-kv.vault.azure.net/secrets/doc-intel-key`

**Expected Results:**
- ✅ No validation error
- ✅ Can proceed to next step
- ✅ Value stored in outputs

**Pass Criteria:** Valid URI accepted

##### Test 2.4.6: Optional Feature Test
**Steps:**
1. Leave "Enable Azure Document Intelligence" unchecked
2. Complete all other wizard steps
3. Check outputs

**Expected Results:**
- ✅ Can complete wizard without enabling Doc Intelligence
- ✅ `docIntelligenceEndpoint` output is empty string
- ✅ No validation errors
- ✅ Deployment should still succeed

**Pass Criteria:** Feature is truly optional

---

### Test Suite 3: Integration Testing

#### Test 3.1: Complete Wizard Flow

**Duration:** ~10 minutes  
**Prerequisites:** Test values for all fields prepared

**Steps:**
1. Open Sandbox, paste JSON
2. Complete all wizard steps:
   - **Identity:** Enter Azure AD values
   - **Infrastructure:** Enter Key Vault details
   - **Redis:** Enter connection string
   - **Storage:** Enter storage account details
   - **AI Services:** 
     - Enter OpenAI resource name ✅
     - Enter chat deployment name (NEW) ✅
     - Enter embedding deployment name (NEW) ✅
     - Optionally enable Document Intelligence (NEW) ✅
   - **Deployment:** Enter resource prefix
   - **Admin:** Enter admin credentials
3. Navigate to "Review + Create"
4. Review all outputs

**Expected Results:**
- ✅ Complete all steps without errors
- ✅ All required fields validated
- ✅ All outputs populated correctly
- ✅ No JavaScript console errors
- ✅ Outputs include new fields

**Pass Criteria:** Successful end-to-end wizard completion

---

### Test Suite 4: Actual Deployment Testing

⚠️ **Warning:** This suite incurs Azure costs. Use test subscriptions only.

#### Test 4.1: Deployment with New Fields

**Prerequisites:**
- Existing Azure OpenAI resource with deployments
- Existing Key Vault
- Existing Storage Account
- Existing Redis Cache
- Test resource group

**Deployment Command:**
```bash
az deployment group create \
  --resource-group test-smartlib-rg \
  --template-file ARMtemplate/catalog/mainTemplate.json \
  --parameters @test-parameters.json
```

**Test Parameters File (test-parameters.json):**
```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "azureOpenAIDeployment": {
      "value": "gpt-4-test"
    },
    "azureEmbeddingDeployment": {
      "value": "text-embedding-3-small"
    }
    // ... other parameters
  }
}
```

**Expected Results:**
- ✅ Deployment initiates successfully
- ✅ No validation errors
- ✅ Web app created
- ✅ Worker app created
- ✅ App Service Plan created
- ✅ Deployment completes (status: Succeeded)

**Failure Cases:**
- ❌ `DeploymentFailed` with parameter validation error
- ❌ `ResourceNotFound` for missing OpenAI deployments
- ❌ Template validation errors

**Pass Criteria:** Deployment succeeds with status "Succeeded"

---

#### Test 4.2: Environment Variables Validation

**Post-Deployment Verification:**

```bash
# Get web app name from deployment
WEB_APP_NAME=$(az deployment group show \
  --resource-group test-smartlib-rg \
  --name <deployment-name> \
  --query properties.outputs.webAppName.value \
  --output tsv)

# Check environment variables
az webapp config appsettings list \
  --name $WEB_APP_NAME \
  --resource-group test-smartlib-rg \
  --query "[?name=='AZURE_OPENAI_DEPLOYMENT' || name=='AZURE_EMBEDDING_DEPLOYMENT' || name=='AZURE_OPENAI_ENDPOINT' || name=='DOC_INTELLIGENCE_ENDPOINT'].{Name:name, Value:value}" \
  --output table
```

**Expected Output:**
```
Name                          Value
----------------------------  ------------------------------------------
AZURE_OPENAI_DEPLOYMENT      gpt-4-test
AZURE_EMBEDDING_DEPLOYMENT   text-embedding-3-small
AZURE_OPENAI_ENDPOINT        https://test-openai.openai.azure.com
DOC_INTELLIGENCE_ENDPOINT    <empty or valid URL>
```

**Pass Criteria:** All variables present with correct values

---

#### Test 4.3: Application Functionality Test

**Steps:**
1. Get web app URL from deployment outputs
2. Open URL in browser
3. Login with admin credentials
4. Test chat functionality:
   - Send a test query
   - Verify response generated
   - Check for LLM connection errors

**Expected Results:**
- ✅ App loads successfully
- ✅ Login successful
- ✅ Chat interface appears
- ✅ Query receives AI-generated response
- ✅ No connection errors in UI
- ✅ No errors in Application Insights logs

**Failure Indicators:**
- ❌ "Connection refused" errors
- ❌ "Deployment not found" errors
- ❌ Empty or error responses from AI
- ❌ 500 Internal Server Error

**Pass Criteria:** Successful AI query/response cycle

---

#### Test 4.4: Document Intelligence Integration Test

**Applies only if Document Intelligence was enabled during deployment**

**Steps:**
1. Login to SmartLib web interface
2. Navigate to document upload
3. Upload a test PDF document
4. Wait for processing
5. Query the uploaded document

**Expected Results:**
- ✅ Document uploaded successfully
- ✅ Processing completes without errors
- ✅ Document appears in library
- ✅ Can query document content
- ✅ Receives relevant answers

**With Document Intelligence:**
- ✅ Tables extracted correctly
- ✅ Forms parsed accurately
- ✅ Complex layouts handled

**Without Document Intelligence:**
- ✅ Basic text extracted
- ✅ Simple layouts handled
- ⚠️ Tables may not parse perfectly (expected)

**Pass Criteria:** Document processing succeeds (quality depends on Doc Intel enablement)

---

### Test Suite 5: Regression Testing

#### Test 5.1: Existing Functionality Validation

**Verify these unchanged features still work:**

| Feature | Test | Expected Result |
|---------|------|-----------------|
| Key Vault validation | Enter invalid KV name | Error displayed |
| Storage Account validation | Enter invalid storage name | Error displayed |
| Redis connection string format | Enter wrong format | Validation error |
| Resource name availability | Use conflicting prefix | Conflict error shown |
| Admin password validation | Enter weak password | Validation error |

**Pass Criteria:** All existing validations still function

#### Test 5.2: Backward Compatibility

**Test with old parameter sets:**

If someone has saved parameters from before the fix, test:
- Parameters with `azureOpenAIDeployment` = empty
- Parameters with `azureEmbeddingDeployment` = empty

**Expected Results:**
- ⚠️ Validation should require these fields now
- ❌ Empty values should be rejected
- ✅ This is EXPECTED breaking change (necessary fix)

**Pass Criteria:** New validation enforced (breaking change is intentional)

---

## 📊 Test Results Template

### Test Execution Record

| Test ID | Test Name | Status | Date | Tester | Notes |
|---------|-----------|--------|------|--------|-------|
| 1.1 | JSON Validity | ☐ | | | |
| 1.2 | Schema Validation | ☐ | | | |
| 2.1 | Initial Load | ☐ | | | |
| 2.2 | Navigation | ☐ | | | |
| 2.3.1 | Field Visibility | ☐ | | | |
| 2.3.5 | Outputs Verification | ☐ | | | |
| 2.4.2 | Resource Selector | ☐ | | | |
| 3.1 | Complete Flow | ☐ | | | |
| 4.1 | Actual Deployment | ☐ | | | |
| 4.3 | App Functionality | ☐ | | | |

**Status Legend:**
- ✅ PASS
- ❌ FAIL
- ⚠️ BLOCKED
- ☐ NOT RUN

---

## 🚨 Test Failure Response Plan

### If Sandbox Tests Fail

1. **JSON Syntax Error:**
   - Run: `python -m json.tool createUiDefinition.json`
   - Fix syntax issue
   - Retry

2. **Element Not Visible:**
   - Check element placement in correct step
   - Verify `visible` condition (if any)
   - Check typos in element name

3. **Validation Not Working:**
   - Review `constraints.regex` pattern
   - Test regex pattern separately
   - Check `validationMessage` displays

### If Deployment Fails

1. **Check Deployment Errors:**
```bash
az deployment group show \
  --resource-group test-smartlib-rg \
  --name <deployment-name> \
  --query properties.error
```

2. **Common Failures:**
   - Missing parameters → Check outputs section
   - Invalid parameter values → Check constraints
   - Resource not found → Verify resource exists
   - Permission denied → Check RBAC roles

3. **Rollback:**
```bash
# Delete failed deployment resources
az group delete --name test-smartlib-rg --yes --no-wait
```

---

## ✅ Sign-Off Criteria

Deployment is ready for production when:

- [ ] All JSON syntax tests PASS
- [ ] All sandbox tests PASS
- [ ] Test deployment completes successfully
- [ ] Environment variables populated correctly
- [ ] Application connects to Azure OpenAI successfully
- [ ] No regression in existing features
- [ ] Documentation updated
- [ ] Code reviewed by senior engineer

---

## 📞 Escalation Path

**Level 1:** Development team reviews test failures  
**Level 2:** Senior Azure engineer reviews ARM template  
**Level 3:** Microsoft Azure Support (if Azure API issues)

---

**Testing Strategy Version:** 1.0  
**Last Updated:** 2024-01-22  
**Status:** Ready for Test Execution  
**Estimated Testing Time:** 2-4 hours (complete suite)