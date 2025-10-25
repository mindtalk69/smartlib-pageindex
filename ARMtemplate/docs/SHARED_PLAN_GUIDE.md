# Shared App Service Plan Deployment Guide

## 🎯 Overview

The `flask_appservice_template_shared_plan.json` template provides a cost-optimized deployment for **smartlib-basic** that shares a single App Service Plan between both the web application and Celery worker.

**Cost Savings**: ~$30/month (30% reduction) vs ~$43/month for separate plans

---

## 📊 Architecture Comparison

### Traditional Approach (Separate Plans)
```
Resource Group
├── Web App Plan B1 (~$13/month)
│   └── smartlib-web
├── Worker App Plan B1 (~$13/month)  
│   └── smartlib-worker
└── Redis Cache C0 (~$17/month)
Total: ~$43/month
```

### Shared Plan Approach (Optimized)
```
Resource Group
├── Shared App Service Plan B1 (~$13/month)
│   ├── smartlib-basic-web
│   └── smartlib-basic-worker
└── Redis Cache C0 (~$17/month)
Total: ~$30/month
```

---

## 🚀 Quick Deployment

### Prerequisites
- ✅ Existing Azure Cache for Redis
- ✅ Existing Azure Key Vault with OpenAI secrets
- ✅ Azure Container Registry with Docker image
- ✅ App Registration with Client ID/Secret

### Step 1: Update Parameters

Edit `ARMtemplate/smartlib-basic.parameters.json`:

```json
{
  "parameters": {
    "tenantId": {
      "value": "YOUR_TENANT_ID"
    },
    "existingRedisName": {
      "value": "your-redis-cache"
    },
    "existingKeyVaultName": {
      "value": "your-keyvault"
    },
    "azureOpenAIKey": {
      "value": "your-openai-key"
    },
    "azureOpenAIEndpoint": {
      "value": "https://your-resource.openai.azure.com/"
    },
    "azureOpenAIDeployment": {
      "value": "your-deployment-name"
    },
    "APP_CLIENT_ID": {
      "value": "your-app-client-id"
    },
    "APP_CLIENT_SECRET": {
      "value": "your-app-client-secret"
    },
    "acrPassword": {
      "value": "your-acr-password"
    }
  }
}
```

### Step 2: Deploy

```bash
# Deploy smartlib-basic with shared plan
az deployment group create \
  --resource-group YOUR_RESOURCE_GROUP \
  --template-file ARMtemplate/flask_appservice_template_shared_plan.json \
  --parameters @ARMtemplate/smartlib-basic.parameters.json

# Expected deployment time: 8-10 minutes
```

### Step 3: Verify Deployment

```bash
# Check web app
az webapp show \
  --name smartlib-basic-web \
  --resource-group YOUR_RESOURCE_GROUP \
  --query state

# Check worker
az webapp show \
  --name smartlib-basic-worker \
  --resource-group YOUR_RESOURCE_GROUP \
  --query state

# Check shared plan
az appservice plan show \
  --name smartlib-basic-plan \
  --resource-group YOUR_RESOURCE_GROUP \
  --query sku
```

---

## 🔧 Configuration Details

### Resource Naming

| Resource | Name Pattern | Example |
|----------|-------------|---------|
| App Service Plan | `{appPrefix}-plan` | `smartlib-basic-plan` |
| Web App | `{appPrefix}-web` | `smartlib-basic-web` |
| Worker App | `{appPrefix}-worker` | `smartlib-basic-worker` |
| App Insights | `{appPrefix}-web-ai` | `smartlib-basic-web-ai` |

### Shared Resources

Both web and worker apps share:
- ✅ **App Service Plan** - Single B1 plan for cost efficiency
- ✅ **Docker Image** - Same `smarthing-app:cpu-latest` image
- ✅ **Environment Variables** - All OpenAI, Redis, Key Vault settings
- ✅ **Resource Access** - Both have Key Vault access via managed identity

### Differentiated Settings

| Setting | Web App | Worker App |
|---------|---------|------------|
| **Startup Command** | `./docker-entrypoint.sh web` | `./docker-entrypoint.sh worker` |
| **Public Endpoint** | Yes (port 8000) | No (background only) |
| **WEBSITES_PORT** | `8000` | Not set |
| **Purpose** | User interface | Background tasks |

---

## 💰 Cost Analysis

### Monthly Costs (B1 SKU)

| Resource | Traditional | Shared | Savings |
|----------|-------------|---------|---------|
| Web App Plan | $13 | - | $13 |
| Worker App Plan | $13 | - | $13 |
| **Shared Plan** | - | $13 | - |
| Redis Cache | $17 | $17 | $0 |
| **Total** | **$43** | **$30** | **$13 (30%)** |

### SKU Options

| SKU | Monthly Cost | Use Case |
|-----|--------------|----------|
| **B1** | $13 | ✅ Recommended for smartlib-basic |
| S1 | $55 | Higher traffic needs |
| P1v2 | $80 | Premium performance |

---

## 🔍 Monitoring & Troubleshooting

### Health Checks

```bash
# Check both apps are running
az webapp list \
  --resource-group YOUR_RESOURCE_GROUP \
  --query "[?contains(name, 'smartlib-basic')].{Name:name, State:properties.state}" \
  --output table

# Check shared plan utilization
az monitor metrics list \
  --resource $(az appservice plan show -g YOUR_RESOURCE_GROUP -n smartlib-basic-plan --query id -o tsv) \
  --metrics CPUPercentage MemoryPercentage \
  --interval PT1H \
  --output table
```

### Log Monitoring

```bash
# Web app logs
az webapp log tail --name smartlib-basic-web --resource-group YOUR_RESOURCE_GROUP

# Worker logs  
az webapp log tail --name smartlib-basic-worker --resource-group YOUR_RESOURCE_GROUP

# Look for:
# ✅ "Starting Flask application on port 8000"
# ✅ "celery@hostname ready"
# ❌ "PHP version" (indicates Docker config issue)
```

### Common Issues

#### Issue: Resource Contention
**Symptoms**: Slow response times, high CPU/memory
**Solutions**:
1. Monitor shared plan metrics
2. Upgrade to S1 SKU if needed
3. Consider separate plans for production

#### Issue: Worker Not Processing Tasks
**Symptoms**: Tasks queue but don't complete
**Solutions**:
1. Check worker logs for errors
2. Verify Redis connection (same for both apps)
3. Restart worker: `az webapp restart -n smartlib-basic-worker -g YOUR_RG`

#### Issue: Deployment Fails
**Symptoms**: ARM template deployment errors
**Solutions**:
1. Use `createRoleAssignment=false` on subsequent deployments
2. Verify all required resources exist (Redis, KeyVault)
3. Check parameter values are correct

---

## 📈 Scaling Considerations

### Vertical Scaling (Upgrade SKU)
```bash
# Upgrade shared plan to S1
az appservice plan update \
  --resource-group YOUR_RESOURCE_GROUP \
  --name smartlib-basic-plan \
  --sku S1
```

### When to Consider Separate Plans

**Upgrade to separate plans if:**
- High traffic (>100 requests/second)
- Resource contention between web and worker
- Need independent scaling
- Production workloads requiring isolation

**Migration path:**
1. Deploy new separate plans
2. Migrate web app to new plan
3. Migrate worker to new plan
4. Delete old shared plan

---

## 🔄 Deployment Updates

### Updating Docker Image

```bash
# Push new image to ACR
docker push atgmpnregistry.azurecr.io/smarthing-app:cpu-latest

# Restart both apps (DOCKER_ENABLE_CI=true handles this automatically)
az webapp restart --name smartlib-basic-web --resource-group YOUR_RESOURCE_GROUP
az webapp restart --name smartlib-basic-worker --resource-group YOUR_RESOURCE_GROUP
```

### Updating Configuration

```bash
# Update with new parameters
az deployment group create \
  --resource-group YOUR_RESOURCE_GROUP \
  --template-file ARMtemplate/flask_appservice_template_shared_plan.json \
  --parameters @ARMtemplate/smartlib-basic.parameters.json \
  --parameters createRoleAssignment=false
```

---

## 🎯 Marketplace Benefits

### For Customers

✅ **Cost Effective** - 30% savings vs traditional deployment  
✅ **Simple Deployment** - One template deploys complete solution  
✅ **Production Ready** - Based on proven infrastructure  
✅ **Easy Management** - Single plan to monitor and scale  

### For Provider

✅ **Competitive Pricing** - Lower monthly costs attract customers  
✅ **Reduced Support** - Simpler architecture = fewer issues  
✅ **Easy Updates** - Single template updates entire solution  
✅ **Scalable Path** - Clear upgrade to Enterprise versions  

---

## 📚 Related Documentation

- [EXECUTIVE_SUMMARY.md](EXECUTIVE_SUMMARY.md) - Complete template overview
- [QUICK_START_GUIDE.md](QUICK_START_GUIDE.md) - General deployment guide
- [redis_and_celery_deployment.md](redis_and_celery_deployment.md) - Celery configuration
- [docker_configuration_fix.md](docker_configuration_fix.md) - Docker setup details

---

## ✅ Success Criteria

Your shared plan deployment is successful when:

- [ ] Web app accessible at `https://smartlib-basic-web.azurewebsites.net`
- [ ] Worker app shows "celery@hostname ready" in logs
- [ ] Both apps use same App Service Plan (verify in Azure Portal)
- [ ] Total monthly cost ~$30 (B1 + Redis)
- [ ] Tasks process correctly from web to worker to Redis
- [ ] No resource contention issues

---

## 🎉 Conclusion

The shared App Service Plan template provides the **smartlib-basic** solution with:

- ✅ **30% cost reduction** compared to traditional deployment
- ✅ **Single template deployment** for complete solution
- ✅ **Production-ready architecture** based on proven templates
- ✅ **Marketplace-optimized** for competitive pricing
- ✅ **Clear upgrade path** to higher-tier versions

**Deploy now with confidence!** 🚀

```bash
az deployment group create \
  --resource-group YOUR_RESOURCE_GROUP \
  --template-file ARMtemplate/flask_appservice_template_shared_plan.json \
  --parameters @ARMtemplate/smartlib-basic.parameters.json
