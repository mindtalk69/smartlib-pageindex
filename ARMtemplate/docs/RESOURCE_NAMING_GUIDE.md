# SmartLib Resource Naming Guide

## Overview

SmartLib uses a simple, predictable naming pattern for Azure resources based on a user-specified prefix. This guide explains how to choose an appropriate prefix and understand the resource naming behavior.

---

## Naming Pattern

All SmartLib resources follow this consistent pattern:

| Resource Type | Naming Pattern | Example (prefix: `smartlib-acme`) |
|--------------|----------------|-----------------------------------|
| **App Service Plan** | `{prefix}-plan` | `smartlib-acme-plan` |
| **Web Application** | `{prefix}-web` | `smartlib-acme-web` |
| **Worker Application** | `{prefix}-worker` | `smartlib-acme-worker` |

### Example Deployment

With prefix **`smartlib-acme`**:
- App Service Plan: `smartlib-acme-plan`
- Web App: `smartlib-acme-web`  
- Worker App: `smartlib-acme-worker`
- Web URL: `https://smartlib-acme-web.azurewebsites.net`

---

## Choosing a Prefix

### Requirements

✅ **Length**: 3-40 characters  
✅ **Format**: Lowercase letters, numbers, and hyphens only  
✅ **Start/End**: Must begin and end with an alphanumeric character  
✅ **Uniqueness**: Must be unique within your Azure subscription  

### Validation Regex
```regex
^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$
```

### Recommended Patterns

#### ✅ Good Examples

**Company-based naming:**
```
smartlib-acme
smartlib-contoso
smartlib-fabrikam
```

**Project-based naming:**
```
smartlib-research
smartlib-chatbot
smartlib-docs
```

**Environment-based naming:**
```
smartlib-dev
smartlib-staging
smartlib-prod
```

**Combined naming:**
```
smartlib-acme-dev
smartlib-acme-prod
smartlib-contoso-test
```

#### ❌ Avoid These Patterns

**Default prefix (may conflict):**
```
smartlib-basic  ❌ Too common, likely to conflict
```

**Invalid characters:**
```
Smartlib-Acme   ❌ Uppercase letters not allowed
smartlib_test   ❌ Underscores not allowed
smartlib.test   ❌ Periods not allowed
smart lib       ❌ Spaces not allowed
```

**Length violations:**
```
sl              ❌ Too short (minimum 3 characters)
this-is-a-very-long-prefix-that-exceeds-forty-characters  ❌ Too long (maximum 40 characters)
```

**Invalid start/end:**
```
-smartlib       ❌ Cannot start with hyphen
smartlib-       ❌ Cannot end with hyphen
```

---

## Redeployment Behavior

### Same Prefix = Update Resources ✅

Using the **same prefix** in a redeployment will:

✅ Update existing App Service Plan settings  
✅ Update existing Web App configuration  
✅ Update existing Worker App configuration  
✅ Preserve data in mounted Azure Files storage  
✅ Maintain existing managed identities and role assignments  
✅ Keep the same public URLs  

**Example:**
```bash
# First deployment
Prefix: smartlib-acme
Creates: smartlib-acme-plan, smartlib-acme-web, smartlib-acme-worker

# Second deployment (same prefix)
Prefix: smartlib-acme
Updates: smartlib-acme-plan, smartlib-acme-web, smartlib-acme-worker
Result: ✅ Idempotent deployment - resources updated, no duplicates
```

### Different Prefix = New Resources ⚠️

Using a **different prefix** will:

⚠️ Create completely new App Service Plan  
⚠️ Create new Web and Worker Apps  
⚠️ Leave old resources running (incurring costs)  
⚠️ Require manual cleanup of old resources  
⚠️ Require re-configuration of Azure AD redirect URI  
⚠️ Create separate data storage (won't share with old deployment)  

**Example:**
```bash
# First deployment
Prefix: smartlib-acme
Creates: smartlib-acme-plan, smartlib-acme-web, smartlib-acme-worker

# Second deployment (different prefix)
Prefix: smartlib-contoso
Creates: smartlib-contoso-plan, smartlib-contoso-web, smartlib-contoso-worker
Result: ⚠️ New resources created, old resources still running
Action needed: Manually delete old resources to avoid charges
```

---

## Best Practices

### 1. Plan Ahead
- Choose your prefix carefully before first deployment
- Consider future scaling and environment needs
- Document your naming convention

### 2. Document Your Choice
Record your chosen prefix in:
- Team documentation
- Azure resource group tags
- Deployment runbooks

### 3. Use Consistent Naming
- Use the same prefix for all related deployments
- Follow your organization's naming standards
- Include environment indicators if deploying multiple instances

### 4. Cleanup Old Resources
If you need to change your prefix:
1. Deploy with new prefix
2. Verify new deployment works
3. Migrate data if needed
4. Delete old resources to avoid costs

### 5. Multiple Environments
Use different prefixes for each environment:
```
Development:  smartlib-acme-dev
Staging:      smartlib-acme-staging
Production:   smartlib-acme-prod
```

---

## Troubleshooting

### ❌ Deployment Fails: "Resource Already Exists"

**Cause**: Another deployment is using the same prefix in your subscription

**Solution**: 
1. Check existing resources in Azure Portal
2. Choose a different, more unique prefix
3. Or update existing deployment with same prefix

**Check command:**
```bash
az resource list --query "[?contains(name, 'smartlib')]" -o table
```

### ❌ Cannot Find Resources After Redeployment

**Cause**: Used a different prefix, creating new resources

**Solution**:
1. Check Azure Portal for resources with both old and new prefixes
2. Decide whether to:
   - Use old prefix to update existing resources, OR
   - Keep new resources and delete old ones

**List all SmartLib resources:**
```bash
az resource list \
  --resource-group YOUR_RESOURCE_GROUP \
  --query "[?contains(name, 'smartlib')]" \
  -o table
```

### ❌ Redirect URI Not Working

**Cause**: Azure AD App Registration still points to old resource name

**Solution**: Update redirect URI in Azure AD:
1. Go to Azure Portal → Azure Active Directory
2. App registrations → Your SmartLib app
3. Authentication → Web → Redirect URIs
4. Update to new URL: `https://{new-prefix}-web.azurewebsites.net/auth/callback`
5. Save

### ❌ Validation Error: "Invalid Prefix Format"

**Common mistakes:**
```
Smartlib       ❌ Uppercase not allowed → use: smartlib
smartlib_test  ❌ Underscore not allowed → use: smartlib-test
smart lib      ❌ Space not allowed → use: smartlib
-smartlib      ❌ Cannot start with hyphen → use: smartlib
smartlib-      ❌ Cannot end with hyphen → use: smartlib
```

---

## Security Considerations

### Resource Name Exposure

⚠️ **Important**: Resource names are publicly visible in URLs

**Avoid including:**
- Customer names (if multi-tenant)
- Sensitive project names
- Internal identifiers
- Personally identifiable information

**Safe examples:**
```
✅ smartlib-prod
✅ smartlib-region-east
✅ smartlib-app001
```

**Unsafe examples:**
```
❌ smartlib-client-acmecorp
❌ smartlib-project-secret
❌ smartlib-john-smith
```

### Naming Conflicts

**Potential attack**: Malicious users could squat on common names

**Protection**:
- Use organization-specific prefixes
- Add unique identifiers
- Monitor for unauthorized resource creation

---

## Migration Guide

### For Existing Deployments Using uniqueString()

⚠️ **Breaking Change**: This naming improvement changes how resources are named.

#### Current Naming (with uniqueString):
```
smartlib-basic-r73slbyxlsa6m-plan
smartlib-basic-r73slbyxlsa6m-web
smartlib-basic-r73slbyxlsa6m-worker
```

#### Option 1: Keep Existing Resources (Recommended)

**Steps:**
1. Find your current resource names in Azure Portal
2. Extract the full name including suffix (e.g., `smartlib-basic-r73slbyxlsa6m`)
3. Use this as your `appPrefix` in redeployment
4. Resources will be updated, not recreated

**Example:**
```bash
# Current resources
smartlib-basic-r73slbyxlsa6m-web

# Use as prefix in redeployment
appPrefix: smartlib-basic-r73slbyxlsa6m

# Result: Existing resources updated
✅ No new resources created
✅ No migration needed
✅ Same URLs maintained
```

#### Option 2: Migrate to Clean Names

**Steps:**
1. Deploy with new clean prefix (e.g., `smartlib-acme`)
2. New resources created alongside old ones
3. Test new deployment thoroughly
4. Migrate data from old storage to new (if needed)
5. Update Azure AD redirect URI to new URL
6. Switch traffic to new deployment
7. Delete old resources

**Migration checklist:**
- [ ] Deploy new instance with clean prefix
- [ ] Test all functionality on new deployment
- [ ] Migrate user data and configurations
- [ ] Update Azure AD redirect URI
- [ ] Update documentation and runbooks  
- [ ] Test authentication and file uploads
- [ ] Verify worker tasks processing correctly
- [ ] Switch DNS/traffic to new deployment
- [ ] Monitor new deployment for 24-48 hours
- [ ] Delete old resources

---

## Frequently Asked Questions

### Q: Can I change the prefix after deployment?

**A**: Changing the prefix creates new resources. If you want to update existing resources, use the same prefix.

### Q: What happens if I forget my prefix?

**A**: Check Azure Portal → Resource Groups → Your resource group. Look for resources named `*-plan`, `*-web`, `*-worker` to identify your prefix.

### Q: Can I use uppercase letters?

**A**: No. Azure App Service names must be lowercase. The validation will reject uppercase letters.

### Q: How long should my prefix be?

**A**: Recommended: 10-30 characters. This provides good balance between readability and Azure's 60-character limit for App Service names.

### Q: Can multiple people use the same prefix?

**A**: Not in the same Azure subscription. Each prefix must be unique within a subscription to avoid conflicts.

### Q: Will my old deployment stop working?

**A**: No. If you deploy with a different prefix, old resources continue running until you manually delete them.

---

## Quick Reference

### Validation Checklist

Before deploying, verify your prefix:

- [ ] 3-40 characters in length
- [ ] Lowercase letters and numbers only
- [ ] Hyphens allowed (but not at start/end)
- [ ] Starts with alphanumeric character
- [ ] Ends with alphanumeric character
- [ ] Unique within your Azure subscription
- [ ] Doesn't contain sensitive information
- [ ] Follows your organization's naming standards

### Resource Names Preview

Use this formula to preview your resource names:

```
{prefix}-plan      → App Service Plan
{prefix}-web       → Web Application
{prefix}-worker    → Worker Application
```

**Example with prefix `smartlib-acme`:**
```
smartlib-acme-plan      → App Service Plan
smartlib-acme-web       → Web Application  
smartlib-acme-worker    → Worker Application

URL: https://smartlib-acme-web.azurewebsites.net
Redirect URI: https://smartlib-acme-web.azurewebsites.net/auth/callback
```

---

## Additional Resources

- [SHARED_PLAN_GUIDE.md](SHARED_PLAN_GUIDE.md) - Deployment architecture
- [RESOURCE_NAMING_IMPROVEMENT_PLAN.md](RESOURCE_NAMING_IMPROVEMENT_PLAN.md) - Technical implementation details
- [Azure App Service Naming Guidelines](https://docs.microsoft.com/azure/azure-resource-manager/management/resource-name-rules)

---

## Support

If you encounter naming issues:
1. Verify your prefix meets all requirements
2. Check Azure Portal for existing resources
3. Review this guide's troubleshooting section
4. Contact support with your resource group name and prefix

**Remember**: Choose your prefix carefully - it affects your resource URLs and redeployment behavior!