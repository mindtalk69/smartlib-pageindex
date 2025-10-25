# 🎯 QUICK START - Deploy Your Fixed Templates

## ✅ All Templates Fixed and Ready!

**What was done:**
- Fixed 3 templates that had Docker Compose configuration
- All templates now use correct single Docker container setup
- Added missing settings (alwaysOn, DOCKER_ENABLE_CI, etc.)
- Verified consistency across all templates

---

## 🚀 Recommended Deployment Path

### Option 1: Production Deployment (RECOMMENDED)

**Use this if you have existing Redis and Key Vault**

**Template:** `flask_appservice_template_conditional_kv.json` ✅ (Already correct, no changes made)

```bash
# Step 1: Deploy Web App
az deployment group create \
  --resource-group YOUR_RG \
  --template-file ARMtemplate/flask_appservice_template_conditional_kv.json \
  --parameters \
    tenantId=YOUR_TENANT_ID \
    existingRedisName=YOUR_REDIS \
    existingKeyVaultName=YOUR_KV \
    azureOpenAIKey=YOUR_KEY \
    azureOpenAIEndpoint=YOUR_ENDPOINT \
    azureOpenAIDeployment=YOUR_DEPLOYMENT \
    openAIAzureName=YOUR_OPENAI_RESOURCE \
    APP_CLIENT_ID=YOUR_CLIENT_ID \
    APP_CLIENT_SECRET=YOUR_SECRET \
    appServicePlanSkuName=B1 \
    createRoleAssignment=true

# Step 2: Deploy Celery Worker
az deployment group create \
  --resource-group YOUR_RG \
  --template-file ARMtemplate/celery_worker_appservice.json \
  --parameters \
    existingRedisName=YOUR_REDIS \
    existingKeyVaultName=YOUR_KV \
    azureOpenAIKey=YOUR_KEY \
    azureOpenAIEndpoint=YOUR_ENDPOINT \
    azureOpenAIDeployment=YOUR_DEPLOYMENT \
    acrPassword=YOUR_ACR_PASSWORD \
    APP_CLIENT_ID=YOUR_CLIENT_ID \
    APP_CLIENT_SECRET=YOUR_SECRET \
    appServicePlanSkuName=B1
```

---

### Option 2: All-in-One Deployment

**Use this for new environment (creates everything)**

**Template:** `flask_appservice_template.json` ✅ (Just fixed!)

```bash
# Deploy everything at once
az deployment group create \
  --resource-group YOUR_RG \
  --template-file ARMtemplate/flask_appservice_template.json \
  --parameters \
    tenantId=YOUR_TENANT_ID \
    azureOpenAIKey=YOUR_KEY \
    azureOpenAIEndpoint=YOUR_ENDPOINT \
    azureOpenAIDeployment=YOUR_DEPLOYMENT \
    openAIAzureName=YOUR_OPENAI_RESOURCE \
    APP_CLIENT_ID=YOUR_CLIENT_ID \
    APP_CLIENT_SECRET=YOUR_SECRET \
    appServicePlanSkuName=B1

# Then deploy worker separately
az deployment group create \
  --resource-group YOUR_RG \
  --template-file ARMtemplate/celery_worker_appservice.json \
  --parameters \
    existingRedisName=flaskrag3-app-redis \
    existingKeyVaultName=YOUR_KEYVAULT_NAME \
    azureOpenAIKey=YOUR_KEY \
    azureOpenAIEndpoint=YOUR_ENDPOINT \
    azureOpenAIDeployment=YOUR_DEPLOYMENT \
    acrPassword=YOUR_ACR_PASSWORD \
    APP_CLIENT_ID=YOUR_CLIENT_ID \
    APP_CLIENT_SECRET=YOUR_SECRET \
    appServicePlanSkuName=B1
```

---

## ⚡ Quick Verification (30 seconds)

```bash
# 1. Check Web App Status
az webapp show \
  --name flaskrag3-app \
  --resource-group YOUR_RG \
  --query state
# Expected: "Running"

# 2. Check Logs (Look for Docker, NOT PHP!)
az webapp log tail \
  --name flaskrag3-app \
  --resource-group YOUR_RG
# Should see: "Starting container..." "Flask app running..."
# Should NOT see: "PHP version" or "oryx"

# 3. Check Worker Status
az webapp show \
  --name flaskrag3-worker \
  --resource-group YOUR_RG \
  --query state
# Expected: "Running"

# 4. Check Worker Logs
az webapp log tail \
  --name flaskrag3-worker \
  --resource-group YOUR_RG
# Should see: "celery@hostname ready" "Connected to redis"
```

---

## 📋 Pre-Deployment Checklist

Before deploying, make sure you have:

- [ ] Azure subscription with sufficient permissions
- [ ] Docker image pushed to ACR (`atgmpnregistry.azurecr.io/smarthing-app:latest`)
- [ ] Existing Redis Cache (or will create new one)
- [ ] Existing Key Vault (or will create new one)
- [ ] Azure OpenAI resource with deployment
- [ ] App Registration with Client ID and Secret
- [ ] ACR credentials (username and password)

---

## 🔍 What Changed in Each Template

### Templates That Were Fixed:

#### 1. `flask_appservice_template.json` ✅
**Changes:**
- ❌ Removed: Docker Compose configuration
- ✅ Added: `linuxFxVersion: DOCKER|...`
- ✅ Added: `appCommandLine: ./docker-entrypoint.sh web`
- ✅ Added: `alwaysOn: true`
- ✅ Added: `WEBSITES_ENABLE_APP_SERVICE_STORAGE: false`
- ✅ Added: `DOCKER_ENABLE_CI: true`

#### 2. `flask_appservice_template_existing_redis.json` ✅
**Changes:** Same as above

#### 3. `flask_appservice_template_existing_redis_kv.json` ✅
**Changes:** Same as above

### Templates Already Correct:

#### 4. `flask_appservice_template_conditional_kv.json` ✅
**Status:** No changes needed - already had correct configuration

#### 5. `celery_worker_appservice.json` ✅
**Status:** No changes needed - already had correct configuration

---

## 💰 Cost Estimate (B1 SKU)

| Resource | SKU | Monthly Cost |
|----------|-----|--------------|
| Web App Service Plan | B1 | ~$13 |
| Worker App Service Plan | B1 | ~$13 |
| Azure Cache for Redis | C0 Basic | ~$17 |
| **Total** | | **~$43/month** |

**B1 Specs:**
- 1 vCPU
- 1.75 GB RAM
- 10 GB Storage
- ✅ Supports alwaysOn
- ✅ Good for dev/test and small production

---

## 🎨 Architecture Overview

```
Internet
   │
   ▼
[Web App - B1]
   │ Flask (Port 8000)
   │ ./docker-entrypoint.sh web
   │
   ▼
[Redis Cache - C0]
   │ Task Queue
   │ Results Store
   │
   ▼
[Worker - B1]
   │ Celery Worker
   │ ./docker-entrypoint.sh worker
   │ No public endpoint
```

**Both Apps:**
- Same Docker image
- Same Redis connection
- Same environment variables
- Different startup commands

---

## 🐛 Common Issues & Quick Fixes

### Issue: "Still seeing PHP messages"
```bash
# Solution: Verify Docker config
az webapp config show \
  --name flaskrag3-app \
  --resource-group YOUR_RG \
  --query linuxFxVersion

# Should return: "DOCKER|atgmpnregistry.azurecr.io/smarthing-app:latest"
# If not, redeploy using fixed template
```

### Issue: "Worker not processing tasks"
```bash
# Solution: Check Redis connection
az webapp config appsettings list \
  --name flaskrag3-app \
  --resource-group YOUR_RG \
  --query "[?name=='CELERY_BROKER_URL'].value" -o tsv

az webapp config appsettings list \
  --name flaskrag3-worker \
  --resource-group YOUR_RG \
  --query "[?name=='CELERY_BROKER_URL'].value" -o tsv

# Both should be identical
```

### Issue: "Container not starting"
```bash
# Solution: Check ACR access
az acr repository show \
  --name atgmpnregistry \
  --repository smarthing-app

# Verify image exists
```

---

## 📚 Documentation Reference

Detailed guides available in `/ARMtemplate/docs/`:

1. **`arm_template_guide.md`** - Overview of all templates
2. **`redis_and_celery_deployment.md`** - Celery deployment guide
3. **`docker_configuration_fix.md`** - Technical details

Additional docs in `/ARMtemplate/`:

4. **`TEMPLATES_FIXED_SUMMARY.md`** - Complete fix summary (this file)
5. **`BEFORE_AFTER_COMPARISON.md`** - Visual before/after comparison

---

## ✅ Testing Checklist

After deployment:

1. **Web App Health Check**
   ```bash
   curl https://flaskrag3-app.azurewebsites.net/health
   # Should return 200 OK
   ```

2. **Check Docker (not PHP)**
   ```bash
   az webapp log tail --name flaskrag3-app --resource-group YOUR_RG | grep -i "docker\|flask"
   # Should see Docker/Flask messages, NOT PHP
   ```

3. **Worker Connected**
   ```bash
   az webapp log tail --name flaskrag3-worker --resource-group YOUR_RG | grep -i "celery\|redis"
   # Should see Celery ready and Redis connected
   ```

4. **Redis Clients**
   ```bash
   az redis show --name YOUR_REDIS --resource-group YOUR_RG
   # Check connected clients (should be 2: web + worker)
   ```

5. **Test Task Processing**
   - Trigger a background task from web app
   - Check worker logs for task processing
   - Verify task completes successfully

---

## 🎯 Priority Actions

### Priority 1: Test Latest Template ✅
You mentioned testing `flask_appservice_template_conditional_kv.json` first.

**Good news:** This template was already correct and didn't need fixes!

```bash
# Deploy it now
az deployment group create \
  --resource-group YOUR_RG \
  --template-file ARMtemplate/flask_appservice_template_conditional_kv.json \
  --parameters @your-parameters.json
```

### Priority 2: Ensure Celery Runs Smoothly ✅
Deploy the worker after web app is running:

```bash
# Deploy worker
az deployment group create \
  --resource-group YOUR_RG \
  --template-file ARMtemplate/celery_worker_appservice.json \
  --parameters @your-worker-parameters.json

# Verify worker is processing
az webapp log tail --name flaskrag3-worker --resource-group YOUR_RG
```

### Priority 3: Verify Consistency ✅
All templates now have the same webapp configuration:
- ✅ Same `linuxFxVersion` format
- ✅ Same `appCommandLine` (web vs worker)
- ✅ Same app settings (DOCKER_ENABLE_CI, etc.)
- ✅ Same Redis connection setup

---

## 🚀 You're Ready to Deploy!

**Summary:**
- ✅ All 5 templates reviewed
- ✅ 3 templates fixed (Docker Compose → Single Container)
- ✅ 2 templates already correct
- ✅ All templates now consistent
- ✅ Documentation updated
- ✅ Deployment guides ready
- ✅ Testing checklists prepared

**Start with:** `flask_appservice_template_conditional_kv.json` (your latest template)

**Then deploy:** `celery_worker_appservice.json` (for Celery)

**Total time to deploy:** ~10-15 minutes

**Monthly cost (B1):** ~$43/month

---

**Questions? Issues?** Check the documentation in `/ARMtemplate/docs/` or the new comparison guide at `BEFORE_AFTER_COMPARISON.md`.

**Good luck with your deployment! 🎉**
