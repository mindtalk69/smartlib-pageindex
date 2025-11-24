#!/bin/bash
# Deployment Diagnostics Script
# Run this to get detailed error information

RESOURCE_GROUP="smarteams"
DEPLOYMENT_NAME="altrovisteknoglobalpt1729927195533.smartlib-azure-20251124130654"

echo "================================================"
echo "ARM Template Deployment Diagnostics"
echo "================================================"
echo ""

echo "1. Getting deployment operations..."
az deployment group operation list \
  --resource-group "$RESOURCE_GROUP" \
  --name "$DEPLOYMENT_NAME" \
  --query "[?properties.provisioningState=='Failed'].{Resource:properties.targetResource.resourceName, Type:properties.targetResource.resourceType, Error:properties.statusMessage.error.message}" \
  --output table

echo ""
echo "2. Getting detailed error from managed application..."
az managedapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name atgesmartlib \
  --query "{Status:provisioningState, Error:provisioningError}" \
  --output json

echo ""
echo "3. Checking managed resource group..."
MANAGED_RG=$(az managedapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name atgesmartlib \
  --query managedResourceGroupId \
  --output tsv | cut -d'/' -f5)

echo "Managed Resource Group: $MANAGED_RG"

if [ ! -z "$MANAGED_RG" ]; then
  echo ""
  echo "4. Checking resources in managed RG..."
  az resource list \
    --resource-group "$MANAGED_RG" \
    --query "[].{Name:name, Type:type, State:provisioningState}" \
    --output table

  echo ""
  echo "5. Checking failed deployments in managed RG..."
  az deployment group list \
    --resource-group "$MANAGED_RG" \
    --query "[?properties.provisioningState=='Failed'].{Name:name, Timestamp:properties.timestamp, Error:properties.error.message}" \
    --output table
fi

echo ""
echo "================================================"
echo "Common Issues to Check:"
echo "================================================"
echo "1. Storage account 'smarteamsb88f' exists in RG 'smarteams'"
echo "2. Key Vault has required secrets (OPENAI-API-KEY, etc.)"
echo "3. Deploying identity has permissions on all resource groups"
echo "4. Redis connection string format is correct"
echo "5. App Service names are unique (no conflicts)"
echo ""
