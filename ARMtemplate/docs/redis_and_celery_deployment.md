# Redis and Celery Worker Deployment Guide

## Do You Need Redis? **YES, ABSOLUTELY!**

### Why Redis is Required

**Celery CANNOT work without Redis (or another message broker).** Here's why:

1. **Message Broker (Task Queue)**
   - Your Flask app sends tasks to Redis queue
   - Celery worker picks up tasks from Redis queue
   - Without Redis, there's no way to communicate between web app and worker

2. **Result Backend (Task Results)**
   - Task results are stored in Redis
   - Your web app queries Redis to check task status
   - Users can see task progress through Redis

3. **Your docker-compose.yaml doesn't include Redis**
   - It only defines `web` and `worker` containers
   - Both containers connect to **external Azure Redis** (not local Redis)
   - Azure Cache for Redis is already configured in your ARM template

### Redis Connection Flow
```
Flask Web App → Sends Task → Redis (Azure Cache) → Celery Worker picks task
                                   ↕
                           Stores task results
                                   ↕
Flask Web App ← Checks Status ← Redis ← Celery Worker saves results
```

## Cost Optimization Options

### Current Setup (Recommended)
- **Web App**: Azure App Service B1 (~$13/month)
- **Worker**: Azure App Service B1 (~$13/month)  
- **Redis**: Azure Cache for Redis C0 Basic (~$17/month)
- **Total**: ~$43/month

### Cost Saving Options

#### Option 1: Shared App Service Plan ✅ Best for Cost
Deploy both web and worker on the **same App Service Plan** (B1):
- **Web App**: Uses port 8000 for HTTP traffic
- **Worker**: Runs in background (no port needed)
- **Total**: B1 plan (~$13/month) + Redis C0 (~$17/month) = **~$30/month**

**Limitation**: Both scale together, less isolation

#### Option 2: Separate Plans (Current Approach) ✅ Best for Isolation
Keep separate App Service Plans:
- Better isolation between web and worker
- Scale independently
- If web app crashes, worker keeps running
- **Total**: ~$43/month

#### Option 3: Use Smaller Redis Tier
- Redis C0 (250 MB): ~$17/month ✅ Good for development/testing
- Redis C1 (1 GB): ~$31/month (if you need more capacity)

**WARNING**: Do NOT try to save money by removing Redis - Celery won't work!

## Deployment Guide for Separate App Service

### Step 1: Create Parameters File for Worker

Create `ARMtemplate/celery_worker.parameters.json`:

```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "existingRedisName": {
      "value": "YOUR_REDIS_NAME"
    },
    "existingRedisResourceGroup": {
      "value": "YOUR_RESOURCE_GROUP"
    },
    "existingKeyVaultName": {
      "value": "YOUR_KEYVAULT_NAME"
    },
    "existingKeyVaultResourceGroup": {
      "value": "YOUR_RESOURCE_GROUP"
    },
    "azureOpenAIKey": {
      "value": "YOUR_OPENAI_KEY"
    },
    "azureOpenAIEndpoint": {
      "value": "YOUR_OPENAI_ENDPOINT"
    },
    "azureOpenAIDeployment": {
      "value": "YOUR_DEPLOYMENT_NAME"
    },
    "workerAppName": {
      "value": "flaskrag3-worker"
    },
    "acrPassword": {
      "value": "YOUR_ACR_PASSWORD"
    },
    "APP_CLIENT_ID": {
      "value": "YOUR_CLIENT_ID"
    },
    "APP_CLIENT_SECRET": {
      "value": "YOUR_CLIENT_SECRET"
    },
    "appServicePlanSkuName": {
      "value": "B1"
    }
  }
}
```

### Step 2: Deploy the Worker

```bash
# Deploy Celery Worker App Service
az deployment group create \
  --resource-group YOUR_RESOURCE_GROUP \
  --template-file ARMtemplate/celery_worker_appservice.json \
  --parameters @ARMtemplate/celery_worker.parameters.json
```

### Step 3: Verify Worker is Running

```bash
# Check worker logs
az webapp log tail --name flaskrag3-worker --resource-group YOUR_RESOURCE_GROUP

# You should see Celery worker starting:
# [2025-01-22 12:00:00,000: INFO/MainProcess] Connected to redis://...
# [2025-01-22 12:00:00,000: INFO/MainProcess] celery@hostname ready.
```

### Step 4: Test Task Processing

1. **From your web app**, trigger a background task
2. **Check worker logs** to see it processing
3. **Check Redis** (optional) to see queued tasks

## Important Configuration Notes

### Both Web and Worker Need:
- ✅ Same Docker image
- ✅ Same Redis connection (CELERY_BROKER_URL, CELERY_RESULT_BACKEND)
- ✅ Same environment variables (OpenAI keys, etc.)
- ✅ Access to same Key Vault (if using managed identity)

### Web App Only Needs:
- `WEBSITES_PORT: 8000` - For HTTP traffic
- Public endpoint

### Worker Only Needs:
- No WEBSITES_PORT (no HTTP endpoint)
- No public endpoint required
- `appCommandLine: "./docker-entrypoint.sh worker"` - Different startup command

## Monitoring Your Setup

### Check Web App Status
```bash
az webapp show --name flaskrag3-app --resource-group YOUR_RESOURCE_GROUP --query state
```

### Check Worker Status
```bash
az webapp show --name flaskrag3-worker --resource-group YOUR_RESOURCE_GROUP --query state
```

### Check Redis Connection
```bash
az redis show --name YOUR_REDIS_NAME --resource-group YOUR_RESOURCE_GROUP --query hostName
```

### View Real-time Logs
```bash
# Web app logs
az webapp log tail --name flaskrag3-app --resource-group YOUR_RESOURCE_GROUP

# Worker logs
az webapp log tail --name flaskrag3-worker --resource-group YOUR_RESOURCE_GROUP
```

## Troubleshooting

### Worker Not Processing Tasks
1. **Check Redis connection** in worker logs
2. **Verify same Redis URL** in both web and worker
3. **Check worker is actually running**: `az webapp show --name flaskrag3-worker --query state`
4. **Restart worker**: `az webapp restart --name flaskrag3-worker --resource-group YOUR_RESOURCE_GROUP`

### Tasks Failing
1. Check worker logs for error messages
2. Verify all environment variables are set correctly
3. Ensure worker has access to Key Vault (if using secrets)

### High Redis Memory Usage
- Upgrade to Redis C1 (1 GB) tier
- Configure task result expiration
- Clean up old task results periodically

## Architecture Diagram

```
┌─────────────────┐
│   Users/Clients │
└────────┬────────┘
         │ HTTP
         ↓
┌─────────────────────────┐
│  Web App (App Service)  │
│  - Flask App            │
│  - Port 8000            │
│  - Sends tasks →        │
└──────────┬──────────────┘
           │
           ↓
    ┌──────────────────┐
    │  Azure Redis     │
    │  (Message Broker)│
    │  - Task Queue    │
    │  - Results Store │
    └──────────┬───────┘
           ↑   │
           │   ↓
┌──────────┴──────────────┐
│ Celery Worker           │
│ (Separate App Service)  │
│ - No public endpoint    │
│ - Processes tasks       │
│ - Saves results to Redis│
└─────────────────────────┘
```

## Deployment Best Practices

### 1. Initial Deployment
```bash
# Deploy web app first
az deployment group create \
  --resource-group YOUR_RG \
  --template-file ARMtemplate/flask_appservice_template_conditional_kv.json \
  --parameters @ARMtemplate/your-web-parameters.json

# Wait for web app to be ready and verify it works

# Then deploy worker
az deployment group create \
  --resource-group YOUR_RG \
  --template-file ARMtemplate/celery_worker_appservice.json \
  --parameters @ARMtemplate/celery_worker.parameters.json
```

### 2. Updates and Redeployments
- Web and worker can be updated independently
- Update Docker image in ACR, then restart both services
- Or use `DOCKER_ENABLE_CI=true` for automatic updates

### 3. Scaling Considerations
- **Web App**: Scale based on HTTP traffic (CPU, memory)
- **Worker**: Scale based on task queue length (Redis monitoring)
- Consider using Azure Monitor alerts for auto-scaling

## Summary

✅ **YES, you need Redis** - It's essential for Celery  
✅ **Use separate App Service for worker** - Good for isolation  
✅ **B1 SKU is fine** - Sufficient for both web and worker  
✅ **Share same Redis instance** - Both connect to Azure Cache for Redis  
✅ **Monitor both services** - Use Azure Portal or CLI commands  

The separate App Service approach gives you better reliability and easier troubleshooting, worth the extra ~$13/month for production deployments!

## Related Documentation

- [arm_template_guide.md](./arm_template_guide.md) - Overview of all ARM templates
- [docker_configuration_fix.md](./docker_configuration_fix.md) - Technical details about Docker configuration
