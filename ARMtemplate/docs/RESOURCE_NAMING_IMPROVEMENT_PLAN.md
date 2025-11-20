# Resource Naming Improvement Implementation Plan

## Problem Statement

**Current Issue:**
- Template uses `uniqueString(resourceGroup().id, deployment().name)` creating unpredictable names like `smartlib-basic-r73slbyxlsa6m-web`
- Redeployment with different deployment names creates NEW resources instead of updating existing ones
- Creates duplicate App Service Plans, Web Apps, and Worker Apps
- Increases costs and management complexity

**Desired Outcome:**
- Predictable, user-controlled resource names
- Idempotent redeployments that update existing resources
- User flexibility with clear naming guidance
- Alignment with SHARED_PLAN_GUIDE.md documentation

---

## Solution Overview

### Approach
Make `appPrefix` user-editable with validation and guidance:
- Remove `uniqueString()` from resource naming
- Add user input field in createUiDefinition.json
- Provide validation regex for Azure naming rules
- Add clear guidance with examples (e.g., `smartlib-<company-name>`)
- Update documentation with best practices

### Resource Naming Pattern

**Before:**
```
smartlib-basic-r73slbyxlsa6m-plan
smartlib-basic-r73slbyxlsa6m-web
smartlib-basic-r73slbyxlsa6m-worker
```

**After:**
```
{appPrefix}-plan      (e.g., smartlib-acme-plan)
{appPrefix}-web       (e.g., smartlib-acme-web)
{appPrefix}-worker    (e.g., smartlib-acme-worker)
```

---

## Implementation Steps

### Step 1: Update mainTemplate.json

#### Change 1.1: Update `baseAppName` Variable (Line 267)

**Current:**
```json
"baseAppName": "[concat(parameters('appPrefix'), '-', uniqueString(resourceGroup().id, deployment().name))]"
```

**New:**
```json
"baseAppName": "[parameters('appPrefix')]"
```

#### Change 1.2: Update `appPrefix` Parameter Metadata (Lines 155-161)

**Current:**
```json
"appPrefix": {
  "type": "string",
  "defaultValue": "smartlib-basic",
  "metadata": {
    "description": "Prefix for resource naming (smartlib-basic for marketplace)"
  }
}
```

**New:**
```json
"appPrefix": {
  "type": "string",
  "defaultValue": "smartlib-basic",
  "minLength": 3,
  "maxLength": 40,
  "metadata": {
    "description": "Unique prefix for resource naming. Must be unique within your Azure subscription. Resources will be named: {prefix}-web, {prefix}-worker, {prefix}-plan. Example: smartlib-acme"
  }
}
```

#### Change 1.3: Add Validation Constraint (Optional)

Add regex validation in parameter definition:
```json
"appPrefix": {
  "type": "string",
  "defaultValue": "smartlib-basic",
  "minLength": 3,
  "maxLength": 40,
  "metadata": {
    "description": "Unique prefix for resource naming. Must be unique within your Azure subscription. Resources will be named: {prefix}-web, {prefix}-worker, {prefix}-plan. Example: smartlib-acme"
  }
}
```

Note: Full regex validation is better done in createUiDefinition.json

#### Change 1.4: Add Additional Output (Lines 650+)

Add `webAppName` output to help users configure redirect URI:
```json
"outputs": {
  "webAppUrl": {
    "type": "string",
    "value": "[concat('https://', variables('webAppName'), '.azurewebsites.net')]"
  },
  "webAppName": {
    "type": "string",
    "value": "[variables('webAppName')]"
  },
  "workerAppName": {
    "type": "string",
    "value": "[variables('workerAppName')]"
  },
  "sharedAppServicePlan": {
    "type": "string",
    "value": "[variables('sharedAppServicePlanName')]"
  },
  "redirectUri": {
    "type": "string",
    "value": "[concat('https://', variables('webAppName'), '.azurewebsites.net/auth/callback')]",
    "metadata": {
      "description": "Add this Redirect URI to your Azure AD App Registration"
    }
  },
  "keyVaultName": {
    "type": "string",
    "value": "[parameters('existingKeyVaultName')]"
  },
  "costSavings": {
    "type": "object",
    "value": {
      "monthlyCost": "~$30",
      "savings": "~$13 (30%)",
      "description": "Shared App Service Plan reduces costs compared to separate plans"
    }
  }
}
```

---

### Step 2: Update createUiDefinition.json

#### Change 2.1: Add Resource Naming Section to deploymentStep

Insert after line 442 (in deploymentStep elements array):

```json
{
  "name": "resourceNamingInfo",
  "type": "Microsoft.Common.InfoBox",
  "options": {
    "icon": "Info",
    "text": "SmartLib creates three main resources:\n• App Service Plan: {prefix}-plan\n• Web Application: {prefix}-web\n• Worker Application: {prefix}-worker\n\nChoose a unique prefix to avoid naming conflicts."
  }
},
{
  "name": "appPrefix",
  "type": "Microsoft.Common.TextBox",
  "label": "Resource name prefix",
  "defaultValue": "smartlib-basic",
  "toolTip": "Unique prefix for resource naming. Must be globally unique within Azure. Will create: {prefix}-web, {prefix}-worker, {prefix}-plan",
  "placeholder": "e.g., smartlib-acme",
  "constraints": {
    "required": true,
    "regex": "^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$",
    "validationMessage": "Prefix must be 3-40 characters, start/end with alphanumeric, contain only lowercase letters, numbers, and hyphens."
  }
},
{
  "name": "namingGuidance",
  "type": "Microsoft.Common.InfoBox",
  "options": {
    "icon": "Warning",
    "text": "⚠️ IMPORTANT: Choose a unique prefix to prevent deployment conflicts.\n\n✅ Good examples:\n• smartlib-acme\n• smartlib-contoso\n• smartlib-dev-001\n\n❌ Avoid:\n• smartlib-basic (default, may conflict)\n• Names with special characters\n• Names over 40 characters\n\n💡 TIP: Use your company name or project identifier"
  }
},
{
  "name": "redeploymentInfo",
  "type": "Microsoft.Common.InfoBox",
  "options": {
    "icon": "Info",
    "text": "🔄 REDEPLOYMENT: Using the same prefix will UPDATE existing resources instead of creating new ones. This ensures idempotent deployments and prevents duplicate resources."
  }
}
```

#### Change 2.2: Update outputs Section (Line ~770+)

Update the outputs section to pass `appPrefix` from the UI to the template:

```json
"outputs": {
  "location": "[if(equals(steps('deploymentStep').deploymentRegion, 'resourceGroup'), location(), steps('deploymentStep').deploymentRegion)]",
  "tenantId": "[steps('identityStep').tenantId]",
  "redisConnectionString": "[steps('infrastructureStep').redisConnectionString.password]",
  "redisConnectionStringSecretUri": "[steps('infrastructureStep').redisConnectionStringSecretUri]",
  "existingKeyVaultName": "[steps('infrastructureStep').existingKeyVaultName]",
  "existingKeyVaultResourceGroup": "[steps('infrastructureStep').existingKeyVaultResourceGroup]",
  "createRoleAssignment": "[equals(steps('infrastructureStep').deploymentType, 'new')]",
  "azureOpenAIKey": "[steps('aiServicesStep').azureOpenAIKey.password]",
  "azureOpenAIKeySecretUri": "[steps('aiServicesStep').azureOpenAIKeySecretUri]",
  "openAIAzureName": "[steps('aiServicesStep').openAIAzureName]",
  "azureOpenAIEndpoint": "[steps('aiServicesStep').azureOpenAIEndpoint]",
  "azureOpenAIDeployment": "[steps('aiServicesStep').azureOpenAIDeployment]",
  "azureOpenAIAPIVersion": "[steps('aiServicesStep').azureOpenAIAPIVersion]",
  "docIntelligenceEndpoint": "[steps('aiServicesStep').docIntelligenceEndpoint]",
  "docIntelligenceKeySecretUri": "[steps('aiServicesStep').docIntelligenceKeySecretUri]",
  "storageAccountName": "[steps('infrastructureStep').storageAccountName]",
  "storageAccountKey": "[steps('infrastructureStep').storageAccountKey.password]",
  "storageAccountKeySecretUri": "[steps('infrastructureStep').storageAccountKeySecretUri]",
  "dataShareName": "[steps('infrastructureStep').dataShareName]",
  "azureEmbeddingDeployment": "[steps('aiServicesStep').azureEmbeddingDeployment]",
  "defaultEmbeddingModel": "[steps('aiServicesStep').defaultEmbeddingModel]",
  "appPrefix": "[steps('deploymentStep').appPrefix]",
  "webDockerImageName": "[steps('deploymentStep').webDockerImageName]",
  "workerDockerImageName": "[steps('deploymentStep').workerDockerImageName]",
  "APP_CLIENT_ID": "[steps('identityStep').APP_CLIENT_ID]",
  "APP_CLIENT_SECRET": "[steps('identityStep').APP_CLIENT_SECRET.password]",
  "appAdminUsername": "[steps('adminAccountStep').appAdminUsername]",
  "appAdminPassword": "[steps('adminAccountStep').appAdminPassword.password]",
  "appAdminPasswordSecretUri": "[steps('adminAccountStep').appAdminPasswordSecretUri]",
  "appAdminEmail": "[steps('adminAccountStep').appAdminEmail]",
  "appAdminEmailSecretUri": "[steps('adminAccountStep').appAdminEmailSecretUri]",
  "autoPromoteAdmin": "[steps('adminAccountStep').autoPromoteAdmin]",
  "runDefaultModels": "[steps('adminAccountStep').runDefaultModels]",
  "appServicePlanSkuName": "[steps('deploymentStep').appServicePlanSkuName]",
  "enableAutomaticUpdates": "[steps('deploymentStep').enableAutomaticUpdates]"
}
```

---

### Step 3: Documentation Updates

#### Create New Guide: RESOURCE_NAMING_GUIDE.md

```markdown
# SmartLib Resource Naming Guide

## Overview

SmartLib uses a simple, predictable naming pattern for Azure resources based on a user-specified prefix.

## Naming Pattern

All resources follow this pattern:
- **App Service Plan**: `{prefix}-plan`
- **Web Application**: `{prefix}-web`
- **Worker Application**: `{prefix}-worker`

### Example
With prefix `smartlib-acme`:
- `smartlib-acme-plan`
- `smartlib-acme-web`
- `smartlib-acme-worker`

## Choosing a Prefix

### Requirements
- **Length**: 3-40 characters
- **Format**: Lowercase letters, numbers, and hyphens only
- **Start/End**: Must begin and end with alphanumeric character
- **Uniqueness**: Must be unique within your Azure subscription

### Recommended Patterns

✅ **Good Examples:**
- `smartlib-{company}` (e.g., `smartlib-acme`)
- `smartlib-{project}` (e.g., `smartlib-research`)
- `smartlib-{environment}` (e.g., `smartlib-dev`, `smartlib-prod`)
- `smartlib-{company}-{env}` (e.g., `smartlib-acme-dev`)

❌ **Avoid:**
- Default prefix `smartlib-basic` (may conflict with other deployments)
- Special characters except hyphens
- Capital letters
- Names over 40 characters

## Redeployment Behavior

### Same Prefix = Update Resources
Using the same prefix in a redeployment will:
- ✅ Update existing App Service Plan settings
- ✅ Update existing Web App configuration
- ✅ Update existing Worker App configuration
- ✅ Preserve data in mounted Azure Files storage
- ✅ Maintain existing managed identities and role assignments

### Different Prefix = New Resources
Using a different prefix will:
- ⚠️ Create completely new resources
- ⚠️ Leave old resources running (incurring costs)
- ⚠️ Require manual cleanup of old resources
- ⚠️ Require re-configuration of Azure AD redirect URI

## Best Practices

1. **Plan Ahead**: Choose your prefix carefully before first deployment
2. **Document**: Record your chosen prefix in your team documentation
3. **Consistency**: Use the same prefix for all related deployments
4. **Cleanup**: If changing prefix, manually delete old resources to avoid costs
5. **Multiple Environments**: Use different prefixes for dev/staging/prod

## Troubleshooting

### Deployment Fails: "Resource Already Exists"
**Cause**: Another deployment is using the same prefix in your subscription
**Solution**: Choose a different, more unique prefix

### Cannot Find Resources After Redeployment
**Cause**: Used a different prefix, creating new resources
**Solution**: Check Azure Portal for resources with both old and new prefixes

### Redirect URI Not Working
**Cause**: Azure AD App Registration still points to old resource name
**Solution**: Update redirect URI to use new `{prefix}-web` name
```

#### Update SHARED_PLAN_GUIDE.md

Add section after line 36 (Resource Naming):

```markdown
### Resource Naming (Updated)

SmartLib now uses user-specified prefixes for resource naming:

| Resource | Name Pattern | Example with prefix "smartlib-acme" |
|----------|-------------|-------------------------------------|
| App Service Plan | `{appPrefix}-plan` | `smartlib-acme-plan` |
| Web App | `{appPrefix}-web` | `smartlib-acme-web` |
| Worker App | `{appPrefix}-worker` | `smartlib-acme-worker` |

**Important**: Choose a unique prefix during deployment. Using the same prefix on redeployment will update existing resources instead of creating duplicates.

See [RESOURCE_NAMING_GUIDE.md](RESOURCE_NAMING_GUIDE.md) for detailed naming guidance.
```

---

## Validation & Testing Plan

### Pre-Deployment Validation

1. **Regex Validation** (in createUiDefinition.json)
   - Test valid: `smartlib-acme`, `smartlib-dev-001`, `sl-test`
   - Test invalid: `Smartlib-Acme`, `smartlib_test`, `a`, `this-is-a-very-long-prefix-that-exceeds-forty-characters`

2. **ARM Template Validation**
   ```bash
   az deployment group validate \
     --resource-group test-rg \
     --template-file ARMtemplate/catalog/mainTemplate.json \
     --parameters appPrefix=smartlib-test
   ```

### Post-Deployment Testing

1. **First Deployment**
   - Deploy with prefix `smartlib-test-001`
   - Verify resources created:
     - `smartlib-test-001-plan`
     - `smartlib-test-001-web`
     - `smartlib-test-001-worker`

2. **Redeployment Test**
   - Redeploy with SAME prefix `smartlib-test-001`
   - Verify resources UPDATED (not duplicated)
   - Check resource creation timestamps (should not change)

3. **Different Prefix Test**
   - Deploy with NEW prefix `smartlib-test-002`
   - Verify NEW resources created
   - Verify OLD resources still exist
   - Cleanup old resources

4. **Edge Cases**
   - Minimum length: `abc`
   - Maximum length: 40 characters
   - Hyphens: `smart-lib-test`
   - Numbers: `smartlib123`

---

## Migration Guide for Existing Deployments

### For Deployments Using uniqueString()

⚠️ **Breaking Change**: Existing deployments with random suffixes need manual migration.

#### Option 1: Keep Existing Resources (Recommended)
1. Find your current resource names in Azure Portal
2. Extract the random suffix (e.g., `r73slbyxlsa6m`)
3. Use full name as `appPrefix`: `smartlib-basic-r73slbyxlsa6m`
4. Redeploy with this prefix to maintain existing resources

#### Option 2: Migrate to Clean Names
1. Deploy with new clean prefix (e.g., `smartlib-acme`)
2. Migrate data from old storage to new
3. Update Azure AD redirect URI
4. Test new deployment
5. Delete old resources

---

## Security Considerations

### Resource Name Exposure
- Resource names are publicly visible in URLs
- Don't include sensitive information in prefix
- Avoid customer-specific identifiers if multi-tenant

### Naming Conflicts
- Malicious users could squat on common names
- Use organization-specific prefixes
- Monitor for unauthorized resource creation

---

## Rollout Plan

### Phase 1: Update Templates (Week 1)
- [ ] Update mainTemplate.json
- [ ] Update createUiDefinition.json
- [ ] Create documentation

### Phase 2: Testing (Week 1-2)
- [ ] Validate ARM template
- [ ] Test UI definition
- [ ] Perform redeployment tests
- [ ] Test edge cases

### Phase 3: Documentation (Week 2)
- [ ] Update SHARED_PLAN_GUIDE.md
- [ ] Create RESOURCE_NAMING_GUIDE.md
- [ ] Update README.md
- [ ] Create migration guide

### Phase 4: Release (Week 3)
- [ ] Publish to marketplace
- [ ] Notify existing customers
- [ ] Provide migration support

---

## Success Criteria

✅ Users can specify custom resource prefixes  
✅ Validation prevents invalid names  
✅ Clear guidance helps users choose unique prefixes  
✅ Redeployment with same prefix updates resources  
✅ Redeployment with different prefix creates new resources  
✅ Documentation covers all naming scenarios  
✅ Migration path exists for existing deployments

---

## Appendix: Azure Resource Naming Rules

### App Service / Web App Names
- Length: 2-60 characters
- Format: Alphanumeric and hyphens only
- Start: Letter or number
- End: Letter or number
- Must be globally unique across all Azure

### App Service Plan Names
- Length: 1-40 characters
- Format: Alphanumeric and hyphens
- Unique within resource group

### Validation Regex
```regex
^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$
```

This ensures:
- Starts with alphanumeric (lowercase)
- Contains 1-38 characters of lowercase, numbers, or hyphens
- Ends with alphanumeric (lowercase)
- Total length: 3-40 characters when including start/end