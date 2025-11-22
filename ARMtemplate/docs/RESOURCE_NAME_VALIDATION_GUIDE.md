# Azure Resource Name Validation Implementation Guide

## Overview

This document describes the Azure resource name availability validation implementation in the SmartLib ARM template deployment. The solution prevents deployment conflicts by validating resource names in real-time during the Azure Portal deployment wizard.

## Problem Statement

### Original Issue
Deployment failed with error code 54001 (Conflict) when derived resource names already existed:
```
Website with given name smartlib-teams-worker already exists.
```

### Root Cause
- Users enter only a prefix (e.g., "smartlib-teams")
- System automatically appends suffixes: `-web`, `-worker`, `-plan`
- No pre-deployment validation for derived names
- Conflicts only detected during deployment, causing failures

## Solution Architecture

### Technology: Microsoft.Solutions.ArmApiControl

The solution uses Azure's `Microsoft.Solutions.ArmApiControl` element to call ARM APIs synchronously during form interaction.

### API Used: Web App Name Availability Check

**Endpoint:**
```
POST https://management.azure.com/subscriptions/{subscriptionId}/providers/Microsoft.Web/checknameavailability?api-version=2023-01-01
```

**Request:**
```json
{
  "name": "app-name-to-check",
  "type": "Microsoft.Web/sites"
}
```

**Response:**
```json
{
  "nameAvailable": true,
  "reason": "AlreadyExists",
  "message": "Site name already exists"
}
```

## Implementation Details

### 1. Validation Controls (Lines 640-682)

Two `ArmApiControl` elements validate the derived resource names:

#### Web App Validation
```json
{
  "name": "webAppAvailabilityApi",
  "type": "Microsoft.Solutions.ArmApiControl",
  "request": {
    "method": "POST",
    "path": "[concat(subscription().id, '/providers/Microsoft.Web/checknameavailability?api-version=2023-01-01')]",
    "body": {
      "name": "[concat(steps('deploymentStep').appPrefix, '-web')]",
      "type": "Microsoft.Web/sites"
    }
  }
}
```

#### Worker App Validation
```json
{
  "name": "workerAppAvailabilityApi",
  "type": "Microsoft.Solutions.ArmApiControl",
  "request": {
    "method": "POST",
    "path": "[concat(subscription().id, '/providers/Microsoft.Web/checknameavailability?api-version=2023-01-01')]",
    "body": {
      "name": "[concat(steps('deploymentStep').appPrefix, '-worker')]",
      "type": "Microsoft.Web/sites"
    }
  }
}
```

**Key Features:**
- Automatically re-executes when `appPrefix` value changes
- Returns `nameAvailable` boolean and error `message`
- Validates within 1-2 seconds of input change

### 2. Visual Feedback Elements

#### Success Indicator
Shows when both names are available:
```json
{
  "name": "nameAvailabilitySuccess",
  "type": "Microsoft.Common.InfoBox",
  "visible": "[and(steps('deploymentStep').webAppAvailabilityApi.nameAvailable, steps('deploymentStep').workerAppAvailabilityApi.nameAvailable)]",
  "options": {
    "icon": "Info",
    "text": "[concat('✅ Resource names are available:\n• Web App: ', steps('deploymentStep').appPrefix, '-web\n• Worker App: ', steps('deploymentStep').appPrefix, '-worker')]",
    "style": "Success"
  }
}
```

#### Conflict Warning
Shows when any name conflicts exist:
```json
{
  "name": "nameAvailabilityConflict",
  "type": "Microsoft.Common.InfoBox",
  "visible": "[or(not(steps('deploymentStep').webAppAvailabilityApi.nameAvailable), not(steps('deploymentStep').workerAppAvailabilityApi.nameAvailable))]",
  "options": {
    "icon": "Error",
    "text": "[concat('❌ DEPLOYMENT WILL FAIL - Resource name conflicts detected...')]",
    "style": "Error"
  }
}
```

### 3. Form Validation (Lines 627-649)

Enhanced `appPrefix` element with validation enforcement:

```json
{
  "name": "appPrefix",
  "type": "Microsoft.Common.TextBox",
  "validations": [
    {
      "isValid": "[and(steps('deploymentStep').webAppAvailabilityApi.nameAvailable, steps('deploymentStep').workerAppAvailabilityApi.nameAvailable)]",
      "message": "Resource names conflict with existing App Services. Choose a different prefix to avoid deployment errors."
    }
  ]
}
```

**Behavior:**
- Displays red error border when validation fails
- Shows validation message below the input
- **Disables "Create" button** until resolved
- Clears automatically when user enters valid prefix

## User Experience Flow

```
1. User enters prefix (e.g., "smartlib-acme")
   ↓
2. API calls trigger automatically (1-2 sec)
   ↓
3a. Names available → Green success message
    → "Create" button enabled
   ↓
3b. Names conflict → Red error message
    → Specific conflicts listed
    → "Create" button disabled
   ↓
4. User changes prefix
   ↓
5. Validation re-runs automatically
```

## Testing Guide

### Test Case 1: Available Names (Success Path)

**Steps:**
1. Open Azure Portal → Create SmartLib deployment
2. Navigate to "Container & Deployment Settings" step
3. Enter a unique prefix: `smartlib-test-xyz123`

**Expected Results:**
- ✅ Green success InfoBox appears
- Shows available names: `smartlib-test-xyz123-web`, `smartlib-test-xyz123-worker`
- "Create" button remains enabled
- Can proceed to next step

### Test Case 2: Existing Names (Conflict Path)

**Steps:**
1. Enter prefix of existing deployment: `smartlib-teams`
2. Wait 2 seconds for API response

**Expected Results:**
- ❌ Red error InfoBox appears
- Lists specific conflicts:
  - "Web App: smartlib-teams-web (Already exists)"
  - "Worker App: smartlib-teams-worker (Already exists)"
- Red border on appPrefix input
- Validation message below input
- "Create" button is **disabled**
- Cannot proceed until resolved

### Test Case 3: Partial Conflict

**Steps:**
1. Deploy only web app with prefix `smartlib-partial`
2. Attempt new deployment with same prefix

**Expected Results:**
- Red error shows only web app conflict
- Guidance to choose different prefix
- Validation blocks deployment

### Test Case 4: Real-time Re-validation

**Steps:**
1. Enter conflicting prefix → see error
2. Modify prefix to unique value
3. Observe validation update

**Expected Results:**
- Error clears immediately (within 2 seconds)
- Success message replaces error
- "Create" button becomes enabled
- No manual refresh needed

### Test Case 5: Network Failure Handling

**Steps:**
1. Simulate network error (disable internet briefly)
2. Enter prefix

**Expected Results:**
- API call fails gracefully
- `nameAvailable` defaults to `true` (fail open)
- No hard error blocking deployment
- Warning message may appear (optional enhancement)

## Validation Behavior Details

### Trigger Mechanism
- **Auto-trigger**: Changes to `steps('deploymentStep').appPrefix`
- **Debouncing**: Native Azure Portal handling (typically 500ms)
- **Re-execution**: Automatic on every change

### API Rate Limits
- **Azure Limit**: 12,000 requests/hour per subscription
- **Impact**: Minimal for manual entry (1-2 requests per change)
- **Risk**: Low for production use

### Error Handling
- **API Failure**: Defaults to `nameAvailable: true`
- **Invalid Response**: No validation error shown
- **Network Timeout**: Falls through without blocking

### Performance
- **Initial Load**: No validation (awaits user input)
- **Per Keystroke**: 2 API calls after debounce
- **Response Time**: 1-2 seconds typical
- **User Impact**: Minimal, feels real-time

## Deployment Instructions

### Prerequisites
1. Backup current `createUiDefinition.json`
2. Azure Portal access with Contributor role
3. Test subscription for validation

### Deployment Steps

1. **Validate JSON Syntax**
   ```bash
   # Use Azure CreateUIDefinition sandbox
   # https://portal.azure.com/#view/Microsoft_Azure_CreateUIDef/SandboxBlade
   ```

2. **Upload to Azure Storage**
   ```bash
   az storage blob upload \
     --account-name <storage> \
     --container-name templates \
     --name createUiDefinition.json \
     --file ARMtemplate/catalog/createUiDefinition.json
   ```

3. **Test in Portal**
   - Navigate to Azure Portal
   - Home → Create a resource
   - Search for SmartLib (or use direct link)
   - Test validation behavior

4. **Monitor API Calls**
   - Open Browser DevTools (F12)
   - Network tab
   - Filter: `checknameavailability`
   - Verify API calls on input change

### Rollback Procedure

If issues arise:

1. Restore backup `createUiDefinition.json`
2. Remove lines 640-689 (validation controls)
3. Remove `validations` array from `appPrefix` (lines 640-645)
4. Redeploy template

## Troubleshooting

### Issue: Validation Never Triggers

**Symptoms:**
- No API calls in Network tab
- No success/error messages appear

**Solution:**
1. Check browser console for JavaScript errors
2. Verify createUiDefinition.json syntax
3. Test in Azure Portal Sandbox
4. Clear browser cache

### Issue: Always Shows "Available" Despite Conflicts

**Symptoms:**
- Shows success for known conflicting names
- API returns 200 but incorrect data

**Solution:**
1. Verify API path syntax
2. Check subscription ID in request
3. Confirm user has Reader permissions
4. Test API directly via Postman:
   ```bash
   POST https://management.azure.com/subscriptions/{sub}/providers/Microsoft.Web/checknameavailability?api-version=2023-01-01
   Body: {"name":"smartlib-test-web","type":"Microsoft.Web/sites"}
   ```

### Issue: "Create" Button Always Disabled

**Symptoms:**
- Cannot proceed even with available names
- Validation message persists

**Solution:**
1. Check API response format
2. Verify `nameAvailable` boolean value
3. Test visibility logic:
   ```json
   [and(steps('deploymentStep').webAppAvailabilityApi.nameAvailable, ...)]
   ```
4. Remove `validations` array temporarily for debugging

### Issue: Performance Problems

**Symptoms:**
- Slow API responses
- Portal freezes on input

**Solution:**
1. Check Azure service health
2. Verify API throttling limits
3. Add debouncing (future enhancement)
4. Contact Azure support if persistent

## Future Enhancements

### 1. App Service Plan Validation

Currently validates only web/worker apps. Consider adding:

```json
{
  "name": "planAvailabilityApi",
  "type": "Microsoft.Solutions.ArmApiControl",
  "request": {
    "method": "POST",
    "path": "[concat(subscription().id, '/providers/Microsoft.Web/checknameavailability?api-version=2023-01-01')]",
    "body": {
      "name": "[concat(steps('deploymentStep').appPrefix, '-plan')]",
      "type": "Microsoft.Web/serverfarms"
    }
  }
}
```

### 2. Storage Account Validation

If template creates storage:

```json
{
  "name": "storageAvailabilityApi",
  "type": "Microsoft.Solutions.ArmApiControl",
  "request": {
    "method": "POST",
    "path": "[concat(subscription().id, '/providers/Microsoft.Storage/checkNameAvailability?api-version=2023-01-01')]",
    "body": {
      "name": "[concat(replace(steps('deploymentStep').appPrefix, '-', ''), 'storage')]",
      "type": "Microsoft.Storage/storageAccounts"
    }
  }
}
```

### 3. Cross-Region Validation

Validate names across all regions (currently subscription-scoped):

```json
{
  "name": "globalAvailabilityWarning",
  "type": "Microsoft.Common.InfoBox",
  "options": {
    "icon": "Warning",
    "text": "⚠️ App Service names are globally unique across ALL Azure regions. Choose a highly unique prefix."
  }
}
```

### 4. Debouncing Enhancement

Reduce API calls with custom debouncing:
- Currently: Native Azure debouncing (~500ms)
- Future: Custom logic to wait for user to finish typing
- Benefit: Reduced API load

### 5. Loading Indicator

Add visual feedback during validation:

```json
{
  "name": "validationInProgress",
  "type": "Microsoft.Common.InfoBox",
  "visible": "[steps('deploymentStep').webAppAvailabilityApi.loading]",
  "options": {
    "icon": "Info",
    "text": "⏳ Checking name availability..."
  }
}
```

## Security Considerations

### API Permissions
- Uses user's authenticated session
- Requires Reader permission on subscription
- No additional RBAC setup needed

### Data Privacy
- No sensitive data in API calls
- Resource names are not PII
- API responses cached locally in browser

### Rate Limiting
- Azure enforces 12,000 requests/hour
- Current implementation well within limits
- No DOS risk from validation

## References

- [Azure CreateUIDefinition Elements](https://learn.microsoft.com/azure/azure-resource-manager/managed-applications/create-uidefinition-elements)
- [Microsoft.Solutions.ArmApiControl](https://learn.microsoft.com/azure/azure-resource-manager/managed-applications/microsoft-solutions-armapicontrol)
- [Azure App Service Name Availability API](https://learn.microsoft.com/rest/api/appservice/check-name-availability)
- [Azure Portal CreateUIDefinition Sandbox](https://portal.azure.com/#view/Microsoft_Azure_CreateUIDef/SandboxBlade)

## Support

For issues or questions:
1. Check this guide's Troubleshooting section
2. Review Azure Portal console logs
3. Test in CreateUIDefinition Sandbox
4. Contact SmartLib support team

## Version History

- **v1.0.0** (2024-01-22): Initial implementation
  - Web app validation
  - Worker app validation
  - Real-time feedback
  - Form validation enforcement