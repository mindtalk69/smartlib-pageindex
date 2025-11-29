# Building Docker Images for Azure Deployment

This guide explains how to build and push Docker images for both Basic and Enterprise editions to Azure Container Registry (ACR).

## Overview

SmartLib has two editions with different build requirements:

| Edition | Vector Store | Database | ChromaDB | Build Time |
|---------|-------------|----------|----------|------------|
| **Basic** | ChromaDB | SQLite | ✅ Includes HNSW | Slower (~5-10 min) |
| **Enterprise** | pgvector | PostgreSQL | ❌ Excluded | Faster (~3-5 min) |

## Prerequisites

1. **Azure Container Registry (ACR)** created
2. **Docker** installed locally
3. **Azure CLI** installed and logged in (`az login`)

## Quick Start

### 1. Login to ACR

```bash
# Replace with your ACR name
ACR_NAME="yourregistryname"
az acr login --name $ACR_NAME
```

### 2. Build and Push Images

#### Basic Edition (SQLite + ChromaDB)

```bash
# Web container
docker build -f Dockerfile.web -t $ACR_NAME.azurecr.io/smartlib-web:basic-latest .
docker push $ACR_NAME.azurecr.io/smartlib-web:basic-latest

# Worker container
docker build -f Dockerfile.worker -t $ACR_NAME.azurecr.io/smartlib-worker:basic-latest .
docker push $ACR_NAME.azurecr.io/smartlib-worker:basic-latest
```

#### Enterprise Edition (PostgreSQL + pgvector)

```bash
# Web container (faster - no ChromaDB)
docker build -f Dockerfile.web.enterprise -t $ACR_NAME.azurecr.io/smartlib-web:enterprise-latest .
docker push $ACR_NAME.azurecr.io/smartlib-web:enterprise-latest

# Worker container (faster - no ChromaDB)
docker build -f Dockerfile.worker.enterprise -t $ACR_NAME.azurecr.io/smartlib-worker:enterprise-latest .
docker push $ACR_NAME.azurecr.io/smartlib-worker:enterprise-latest
```

## Build Scripts (Automated)

Use the provided build scripts for CI/CD pipelines:

### Basic Edition

```bash
./build-for-azure-basic.sh yourregistryname
```

### Enterprise Edition

```bash
./build-for-azure-enterprise.sh yourregistryname
```

## Image Tagging Strategy

We recommend using semantic versioning with edition tags:

```bash
# Version-specific tags
$ACR_NAME.azurecr.io/smartlib-web:basic-v1.0.0
$ACR_NAME.azurecr.io/smartlib-web:enterprise-v1.0.0

# Latest tags (for development)
$ACR_NAME.azurecr.io/smartlib-web:basic-latest
$ACR_NAME.azurecr.io/smartlib-web:enterprise-latest

# Stable tags (for production)
$ACR_NAME.azurecr.io/smartlib-web:basic-stable
$ACR_NAME.azurecr.io/smartlib-web:enterprise-stable
```

## ARM Template Configuration

Update your ARM template parameters to reference the correct images:

### Basic Edition (`mainTemplate.json`)

```json
{
  "webDockerImageName": {
    "value": "smartlib-web:basic-latest"
  },
  "workerDockerImageName": {
    "value": "smartlib-worker:basic-latest"
  }
}
```

### Enterprise Edition (`mainTemplate_enterprise.json`)

```json
{
  "webDockerImageName": {
    "value": "smartlib-web:enterprise-latest"
  },
  "workerDockerImageName": {
    "value": "smartlib-worker:enterprise-latest"
  }
}
```

## Build Time Comparison

Based on testing on a standard build machine:

| Component | Basic Edition | Enterprise Edition | Time Saved |
|-----------|--------------|-------------------|------------|
| Web container | ~5 min | ~3 min | 40% |
| Worker container | ~10 min | ~6 min | 40% |
| **Total** | **~15 min** | **~9 min** | **40%** |

The time savings come from excluding ChromaDB's HNSW library, which requires compilation.

## Verification

After pushing images, verify they exist in ACR:

```bash
# List all images
az acr repository list --name $ACR_NAME --output table

# Show tags for specific repository
az acr repository show-tags --name $ACR_NAME --repository smartlib-web --output table
az acr repository show-tags --name $ACR_NAME --repository smartlib-worker --output table
```

## Troubleshooting

### Build fails with "ChromaDB not found" (Enterprise)

**Cause**: Using wrong Dockerfile or requirements file

**Solution**: Ensure you're using:
- `Dockerfile.web.enterprise` (not `Dockerfile.web`)
- `requirements-web-enterprise.txt` (automatically used by enterprise Dockerfile)

### ARM template deployment fails with "Image not found"

**Cause**: Image name mismatch between ARM template and ACR

**Solution**: Verify image names match exactly:
```bash
# Check what's in ACR
az acr repository show --name $ACR_NAME --repository smartlib-web

# Update ARM template parameter to match
```

### Build is slow even for Enterprise edition

**Cause**: Docker cache is not being used

**Solution**: Build with BuildKit and cache:
```bash
DOCKER_BUILDKIT=1 docker build \
  --cache-from $ACR_NAME.azurecr.io/smartlib-web:enterprise-latest \
  -f Dockerfile.web.enterprise \
  -t $ACR_NAME.azurecr.io/smartlib-web:enterprise-latest \
  .
```

## CI/CD Integration

### Azure DevOps Pipeline Example

```yaml
trigger:
  branches:
    include:
      - main

variables:
  acrName: 'yourregistryname'
  edition: 'enterprise'  # or 'basic'

stages:
- stage: Build
  jobs:
  - job: BuildAndPush
    steps:
    - task: Docker@2
      inputs:
        containerRegistry: 'ACR-Connection'
        repository: 'smartlib-web'
        command: 'buildAndPush'
        Dockerfile: 'Dockerfile.web.$(edition)'
        tags: '$(edition)-$(Build.BuildId)'
```

### GitHub Actions Example

```yaml
name: Build and Push Docker Images

on:
  push:
    branches: [ main ]

jobs:
  build-enterprise:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Login to ACR
        run: az acr login --name ${{ secrets.ACR_NAME }}

      - name: Build and Push Web
        run: |
          docker build -f Dockerfile.web.enterprise \
            -t ${{ secrets.ACR_NAME }}.azurecr.io/smartlib-web:enterprise-${{ github.sha }} \
            .
          docker push ${{ secrets.ACR_NAME }}.azurecr.io/smartlib-web:enterprise-${{ github.sha }}
```

## Related Files

- `Dockerfile.web` - Basic edition web container
- `Dockerfile.worker` - Basic edition worker container
- `Dockerfile.web.enterprise` - Enterprise edition web container
- `Dockerfile.worker.enterprise` - Enterprise edition worker container
- `requirements-web.txt` - Basic edition web dependencies (includes ChromaDB)
- `requirements-worker.txt` - Basic edition worker dependencies (includes ChromaDB)
- `requirements-web-enterprise.txt` - Enterprise edition web dependencies (no ChromaDB)
- `requirements-worker-enterprise.txt` - Enterprise edition worker dependencies (no ChromaDB)
- `package-for-azure-basic.sh` - Package ARM templates for Basic edition
- `package-for-azure-enterprise.sh` - Package ARM templates for Enterprise edition
