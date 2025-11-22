# Resource Name Validation Testing Checklist

## Pre-Deployment Testing

### 1. JSON Syntax Validation

- [ ] Open Azure Portal CreateUIDefinition Sandbox
  - URL: https://portal.azure.com/#view/Microsoft_Azure_CreateUIDef/SandboxBlade
- [ ] Paste `createUiDefinition.json` content
- [ ] Verify no syntax errors
- [ ] Confirm JSON parses successfully

### 2. Visual Inspection

- [ ] Navigate to "Container & Deployment Settings" step
- [ ] Verify "Resource name prefix" field appears
- [ ] Check for naming guidance InfoBox
- [ ] Confirm validation controls are present (may not be visible initially)

### 3. Manual Testing Scenarios

#### Test A: Unique Name (Expected: Success)
- [ ] Enter unique prefix: `smartlib-test-[random-string]`
- [ ] Wait 2 seconds for API response
- [ ] ✅ Green success message appears
- [ ] ✅ Shows: "Resource names are available"
- [ ] ✅ Lists: `{prefix}-web` and `{prefix}-worker`
- [ ] ✅ "Next" button enabled

#### Test B: Existing Name (Expected: Conflict)
- [ ] Find existing SmartLib deployment
- [ ] Note its prefix (e.g., `smartlib-teams`)
- [ ] Enter same prefix in new deployment
- [ ] Wait 2 seconds for API response
- [ ] ❌ Red error message appears
- [ ] ❌ Shows: "DEPLOYMENT WILL FAIL - Resource name conflicts detected"
- [ ] ❌ Lists specific conflicts
- [ ] ❌ Red border on input field
- [ ] ❌ Cannot click "Next" (validation blocks)

#### Test C: Name Change (Expected: Dynamic Update)
- [ ] Start with conflicting prefix (from Test B)
- [ ] Verify error appears
- [ ] Change prefix to unique value
- [ ] Wait 2 seconds
- [ ] ✅ Error clears automatically
- [ ] ✅ Success message appears
- [ ] ✅ "Next" button re-enabled
- [ ] Verify no page reload needed

#### Test D: Multiple Changes (Expected: Stable)
- [ ] Rapidly type different prefixes
- [ ] Verify validation updates accordingly
- [ ] No crashes or freezes
- [ ] Last entered value validated correctly

#### Test E: Special Characters (Expected: Regex Validation)
- [ ] Enter prefix with uppercase: `SmartLib-Test`
- [ ] ⚠️ Regex error appears (before API check)
- [ ] Enter prefix with underscore: `smartlib_test`
- [ ] ⚠️ Regex error appears
- [ ] Enter valid prefix: `smartlib-test`
- [ ] ✅ Success (if unique)

### 4. Browser DevTools Inspection

- [ ] Open DevTools (F12)
- [ ] Switch to Network tab
- [ ] Clear network log
- [ ] Enter a prefix in the form
- [ ] Verify API calls appear:
  - [ ] POST to `checknameavailability`
  - [ ] Request count: 2 (one for web, one for worker)
  - [ ] Response status: 200 OK
  - [ ] Response body contains `nameAvailable` boolean
- [ ] Check Console tab:
  - [ ] No JavaScript errors
  - [ ] No unexpected warnings

### 5. API Response Verification

- [ ] In Network tab, click on API call
- [ ] View "Response" tab
- [ ] For available name:
  ```json
  {
    "nameAvailable": true
  }
  ```
- [ ] For conflicting name:
  ```json
  {
    "nameAvailable": false,
    "reason": "AlreadyExists",
    "message": "Site name already exists"
  }
  ```

### 6. Edge Cases

#### Edge Case A: Very Long Prefix
- [ ] Enter 40-character prefix (regex max)
- [ ] Verify validation still works
- [ ] Check for UI overflow issues

#### Edge Case B: Very Short Prefix
- [ ] Enter 3-character prefix (regex min)
- [ ] Verify validation works
- [ ] Check derived names display correctly

#### Edge Case C: Default Value
- [ ] Don't change default `smartlib-basic`
- [ ] Verify validation runs automatically
- [ ] Check if name conflicts (likely)
- [ ] If conflict, ensure error shows immediately

#### Edge Case D: Empty Field
- [ ] Clear the prefix field
- [ ] ⚠️ "Required" error should appear
- [ ] ⚠️ No API calls should trigger
- [ ] ⚠️ Cannot proceed to next step

### 7. Cross-Browser Testing

- [ ] Test in Chrome/Edge Chromium
- [ ] Test in Firefox
- [ ] Test in Safari (if available)
- [ ] Verify consistent behavior

### 8. Performance Testing

- [ ] Enter prefix
- [ ] Measure time to validation response (should be <3 seconds)
- [ ] Type rapidly and observe:
  - [ ] No lag or freezing
  - [ ] Validation updates smoothly
  - [ ] No double-validation issues

## Post-Deployment Testing

### 9. Actual Deployment Test

#### Scenario A: Deploy with Valid Name
- [ ] Enter unique prefix confirmed available by validation
- [ ] Complete all deployment steps
- [ ] Click "Create"
- [ ] ✅ Deployment succeeds without 54001 error
- [ ] ✅ Resources created with correct names

#### Scenario B: Override Warning (If Possible)
- [ ] If validation can be bypassed (shouldn't be possible)
- [ ] Try deploying with conflicting name
- [ ] ❌ Should fail at deployment with 54001 error
- [ ] Verify validation was accurate

### 10. Update Scenario Testing

- [ ] Re-deploy to existing resources
- [ ] Use same prefix as existing deployment
- [ ] Validation should show conflict (correct behavior)
- [ ] Note: This is expected for updates
- [ ] Deploy anyway (should update, not fail)
- [ ] Verify update succeeds

### 11. Multiple Subscriptions

- [ ] Test in different Azure subscription
- [ ] Verify validation checks correct subscription
- [ ] Confirm no cross-subscription false positives

## Troubleshooting Validation

### If Validation Doesn't Appear:
1. [ ] Check browser console for errors
2. [ ] Verify JSON syntax in sandbox
3. [ ] Confirm user has Reader role on subscription
4. [ ] Clear browser cache and retry

### If Always Shows "Available":
1. [ ] Check Network tab for API calls
2. [ ] Verify API response format
3. [ ] Confirm subscription ID in request is correct
4. [ ] Test API directly via Postman/curl

### If Always Shows "Conflict":
1. [ ] Check visibility logic in code
2. [ ] Verify boolean operations
3. [ ] Test with known unique name
4. [ ] Review API response structure

### If "Create" Button Always Disabled:
1. [ ] Check validation array logic
2. [ ] Verify all steps completed
3. [ ] Temporarily remove validations array
4. [ ] Check for other form validation errors

## Sign-Off Checklist

- [ ] All unique names show success message
- [ ] All conflicting names show error message
- [ ] Error message blocks deployment (Create button disabled)
- [ ] Success message allows deployment
- [ ] Real-time validation works (no manual refresh)
- [ ] API calls visible in Network tab
- [ ] No browser console errors
- [ ] Documentation updated
- [ ] Deployment guide includes validation notes

## Testing Sign-Off

| Tester Name | Date | Result | Notes |
|-------------|------|--------|-------|
| | | ✅ PASS / ❌ FAIL | |

## Known Issues

| Issue # | Description | Workaround | Status |
|---------|-------------|------------|--------|
| | | | |

## Test Results Summary

**Total Tests:** 11 major scenarios
**Passed:** ___
**Failed:** ___
**Blocked:** ___
**Notes:**

---

**Testing Completed By:** ________________
**Date:** ________________
**Version:** createUiDefinition.json v1.0
**Approved For Production:** YES / NO