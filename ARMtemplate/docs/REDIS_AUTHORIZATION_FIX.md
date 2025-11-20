# Redis Authorization Error Fix - ARM Template

## Problem Statement

During Azure Marketplace deployment, users encounter the following error:

```
The client '35cbcc06-defd-44d2-ace4-bc2bf2466970' with object id 'cdbabcfd-71f9-421e-9229-56b93557109d' 
does not have authorization to perform action 'Microsoft.Cache/Redis/listKeys/action' over scope 
'/subscriptions/dd34d465-3e61-4b47-9c20-156cbdf5150e/resourcegroups/smartlib-demo/providers/Microsoft.Cache/Redis/smartlib-demo-redis' 
or the scope is invalid. If access was recently granted, please refresh your credentials. (Code: AuthorizationFailed)
```

## Root Cause Analysis

### 1. Unused Redis Parameters
The ARM template collects `existingRedisName` and `existingRedisResourceGroup` parameters in [`createUiDefinition.json`](../catalog/createUiDefinition.json:217-239) but **never uses them** in [`mainTemplate.json`](../catalog/mainTemplate.json:18-30). This may trigger Azure's validation logic to attempt accessing the Redis resource using `listKeys()` action, which requires `Microsoft.Cache/Redis Contributor` role.

### 2. Missing Validation for Connection String
Both `redisConnectionString` and `redisConnectionStringSecretUri` are **optional** (required: false), which means:
- If user provides neither → both app settings get empty strings
- Application fails at runtime with Redis connection errors
- No upfront validation prevents this deployment issue

### 3. SSL Certificate Requirement
SmartLib requires Redis connections to include `?ssl_cert_reqs=none` at the end:
```
rediss://:PASSWORD@HOSTNAME:6380?ssl_cert_reqs=none
```

Current UI provides help text but no validation to enforce this format.

### 4. Consistent Celery Configuration
Both `CELERY_BROKER_URL` and `CELERY_RESULT_BACKEND` must use the **same source** (either direct string or KeyVault secret URI). Current implementation in [`mainTemplate.json`](../catalog/mainTemplate.json:341-347):

```json
{
  "name": "CELERY_BROKER_URL",
  "value": "[if(not(equals(parameters('redisConnectionStringSecretUri'), '')), 
           concat('@Microsoft.KeyVault(SecretUri=', parameters('redisConnectionStringSecretUri'), ')'), 
           parameters('redisConnectionString'))]"
},
{
  "name": "CELERY_RESULT_BACKEND",
  "value": "[if(not(equals(parameters('redisConnectionStringSecretUri'), '')), 
           concat('@Microsoft.KeyVault(SecretUri=', parameters('redisConnectionStringSecretUri'), ')'), 
           parameters('redisConnectionString'))]"
}
```

This is correct butneeds validation to ensure at least one parameter is provided.

## Solution

### Changes Required

#### 1. Remove Unused Redis Name/Resource Group Parameters

**In [`createUiDefinition.json`](../catalog/createUiDefinition.json:217-239):**
- Remove `existingRedisName` field (lines 217-224)
- Remove `redisHelp` InfoBox (lines 225-232)
- Remove `existingRedisResourceGroup` field (lines 233-239)

**In [`mainTemplate.json`](../catalog/mainTemplate.json:18-30):**
- Remove `existingRedisName` parameter (lines 18-23)
- Remove `existingRedisResourceGroup` parameter (lines 24-30)

#### 2. Add Validation for Redis Connection String

**In [`createUiDefinition.json`](../catalog/createUiDefinition.json:241-265):**

Update `redisConnectionString` field to include regex validation:
```json
{
  "name": "redisConnectionString",
  "type": "Microsoft.Common.PasswordBox",
  "label": "Redis connection string",
  "toolTip": "Redis connection string in format: rediss://:password@hostname:6380?ssl_cert_reqs=none. Required if Secret URI not provided.",
  "constraints": {
    "required": false,
    "regex": "^rediss://:.*@.*:6380\\?ssl_cert_reqs=none$",
    "validationMessage": "Connection string must match: rediss://:PASSWORD@HOSTNAME:6380?ssl_cert_reqs=none"
  }
}
```

Update `redisConnectionStringSecretUri` field to validate KeyVault URI:
```json
{
  "name": "redisConnectionStringSecretUri",
  "type": "Microsoft.Common.TextBox",
  "label": "Redis connection string secret URI (RECOMMENDED)",
  "toolTip": "Key Vault secret URI containing Redis connection string. This is more secure than providing the string directly above.",
  "constraints": {
    "required": false,
    "regex": "^https://.*vault.azure.net/secrets/.*$",
    "validationMessage": "Must be a valid Azure Key Vault secret URI"
  }
}
```

#### 3. Add Warning for Missing Parameters

Add a new InfoBox element after `redisConnectionStringSecretUri`:
```json
{
  "name": "redisConnectionValidation",
  "type": "Microsoft.Common.InfoBox",
  "options": {
    "icon": "Warning",
    "text": "[if(and(equals(steps('infrastructureStep').redisConnectionString, ''), equals(steps('infrastructureStep').redisConnectionStringSecretUri, '')), 'You must provide either a Redis connection string or a Key Vault secret URI containing the connection string.', '')]"
  }
}
```

## Implementation Steps

### Step 1: Update createUiDefinition.json

Replace lines 217-273 in [`createUiDefinition.json`](../catalog/createUiDefinition.json:217) with:

```json
{
  "name": "redisConnectionString",
  "type": "Microsoft.Common.PasswordBox",
  "label": "Redis connection string",
  "toolTip": "Redis connection string in format: rediss://:password@hostname:6380?ssl_cert_reqs=none. Required if Secret URI not provided.",
  "constraints": {
    "required": false,
    "regex": "^rediss://:.*@.*:6380\\?ssl_cert_reqs=none$",
    "validationMessage": "Connection string must match: rediss://:PASSWORD@HOSTNAME:6380?ssl_cert_reqs=none"
  }
},
{
  "name": "redisConnectionStringSecretUri",
  "type": "Microsoft.Common.TextBox",
  "label": "Redis connection string secret URI (RECOMMENDED)",
  "toolTip": "Key Vault secret URI containing Redis connection string. This is more secure than providing the string directly above.",
  "constraints": {
    "required": false,
    "regex": "^https://.*vault.azure.net/secrets/.*$",
    "validationMessage": "Must be a valid Azure Key Vault secret URI"
  }
},
{
  "name": "redisConnectionValidation",
  "type": "Microsoft.Common.InfoBox",
  "options": {
    "icon": "Warning",
    "text": "[if(and(equals(steps('infrastructureStep').redisConnectionString, ''), equals(steps('infrastructureStep').redisConnectionStringSecretUri, '')), 'You must provide either a Redis connection string or a Key Vault secret URI containing the connection string.', '')]"
  }
},
{
  "name": "redisConnectionStringHelp",
  "type": "Microsoft.Common.InfoBox",
  "options": {
    "icon": "Warning",
    "text": "⚠️ IMPORTANT: You must modify Azure's default connection string!\n\nHow to get Redis connection string:\n\n1. Azure Portal → Azure Cache for Redis → Your Redis Cache\n2. Click 'Access keys' (left sidebar)\n3. Copy 'Primary connection string (StackExchange.Redis)'\n\n4. MODIFY THE FORMAT (Azure's format won't work):\n\n   Azure gives you:\n   smartlib-redis.redis.cache.windows.net:6380,password=ABC123xyz==,ssl=True,abortConnect=False\n\n   You MUST change to:\n   rediss://:ABC123xyz==@smartlib-redis.redis.cache.windows.net:6380?ssl_cert_reqs=none\n\n   Pattern: rediss://:PASSWORD@HOSTNAME:6380?ssl_cert_reqs=none\n\n⚠️ Don't forget: ?ssl_cert_reqs=none at the end!\n\n💡 RECOMMENDED: Store in Key Vault (see Secret URI field below)"
  }
},
{
  "name": "redisSecretUriHelp",
  "type": "Microsoft.Common.InfoBox",
  "options": {
    "icon": "Info",
    "text": "How to store Redis connection in Key Vault (RECOMMENDED):\n\n1. Get connection string from Azure (see above)\n2. Convert to SmartLib format (see example above)\n   ⚠️ Make sure it ends with: ?ssl_cert_reqs=none\n\n3. Azure Portal → Key Vault → Secrets → + Generate/Import\n4. Name: REDIS-CONNECTION-STRING\n5. Value: rediss://:PASSWORD@HOSTNAME:6380?ssl_cert_reqs=none\n6. Click 'Create'\n7. Click on the secret name\n8. Copy 'Secret Identifier' (full URL)\n9. Paste here\n\nExample Secret URI:\nhttps://your-keyvault.vault.azure.net/secrets/REDIS-CONNECTION-STRING/abc123def456"
  }
},
```

### Step 2: Update mainTemplate.json

Remove lines 18-30 in [`mainTemplate.json`](../catalog/mainTemplate.json:18):

```json
"existingRedisName": {
  "type": "string",
  "metadata": {
    "description": "The name of the existing Azure Cache for Redis instance."
  }
},
"existingRedisResourceGroup": {
  "type": "string",
  "defaultValue": "[resourceGroup().name]",
  "metadata": {
    "description": "The resource group of the existing Azure Cache for Redis instance. Defaults to the current resource group."
  }
},
```

Keep the existing `redisConnectionString` and `redisConnectionStringSecretUri` parameters (lines 31-44) as they are correctly defined.

## Testing Validation

After implementing these changes:

1. **Test with direct connection string:**
   - Provide Redis connection string with correct format
   - Leave Secret URI empty
   - Verify deployment succeeds

2. **Test with KeyVault Secret URI:**
   - Leave connection string empty
   - Provide valid KeyVault secret URI
   - Verify deployment succeeds

3. **Test validation errors:**
   - Try connection string without `?ssl_cert_reqs=none` → should fail validation
   - Try invalid KeyVault URI format → should fail validation
   - Leave both fields empty → should show warning message

4. **Verify CELERY settings:**
   - Check that both `CELERY_BROKER_URL` and `CELERY_RESULT_BACKEND` have identical values
   - Verify KeyVault reference format: `@Microsoft.KeyVault(SecretUri=...)`

## Benefits

1. **Eliminates Authorization Error:** Removing unused Redis name parameters prevents Azure from attempting `listKeys()` action
2. **Enforces Format:** Regex validation ensures connection strings include `?ssl_cert_reqs=none`
3. **Prevents Empty Configuration:** Warning message guides users to provide at least one parameter
4. **Maintains Security:** Continues supporting KeyVault secret references (recommended approach)
5. **Consistent Celery Config:** Both broker and backend use same Redis source

## Migration Notes

For existing deployments:
- This change is backward compatible
- Users who already provided valid connection strings will not be affected
- Users who provided Redis name but no connection string will now see clear validation errors

## References

- Azure ARM Template Documentation: https://docs.microsoft.com/en-us/azure/azure-resource-manager/templates/
- Azure Cache for Redis Connection Strings: https://docs.microsoft.com/en-us/azure/azure-cache-for-redis/cache-python-get-started
- Celery Redis Backend: https://docs.celeryproject.org/en/stable/getting-started/backends-and-brokers/redis.html