#!/bin/bash
# Check managed application deployment error

RESOURCE_GROUP="smarteams"
APP_NAME="atgesmartlib"

echo "================================================"
echo "Checking Managed Application Error Details"
echo "================================================"
echo ""

echo "1. Managed App Status:"
az managedapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_NAME" \
  --query "{Name:name, Status:provisioningState, ManagedRG:managedResourceGroupId}" \
  --output table

echo ""
echo "2. Managed App Provisioning Error (if any):"
az managedapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_NAME" \
  --query "properties.provisioningError" \
  --output json

echo ""
echo "3. Getting Managed Resource Group details..."
MANAGED_RG=$(az managedapp show \
  --resource-group "$RESOURCE_GROUP" \
  --name "$APP_NAME" \
  --query "managedResourceGroupId" \
  --output tsv 2>/dev/null | cut -d'/' -f5)

if [ -z "$MANAGED_RG" ]; then
  echo "⚠️  No managed resource group found (deployment may not have started)"
else
  echo "Managed RG: $MANAGED_RG"
  echo ""

  echo "4. Resources in Managed RG:"
  az resource list \
    --resource-group "$MANAGED_RG" \
    --query "[].{Name:name, Type:type, Status:provisioningState}" \
    --output table

  echo ""
  echo "5. Failed Deployments in Managed RG:"
  az deployment group list \
    --resource-group "$MANAGED_RG" \
    --query "[?properties.provisioningState=='Failed'].{Name:name, Timestamp:properties.timestamp}" \
    --output table

  echo ""
  echo "6. Getting detailed error from latest failed deployment..."
  FAILED_DEPLOYMENT=$(az deployment group list \
    --resource-group "$MANAGED_RG" \
    --query "[?properties.provisioningState=='Failed'] | [0].name" \
    --output tsv)

  if [ ! -z "$FAILED_DEPLOYMENT" ]; then
    echo "Failed Deployment: $FAILED_DEPLOYMENT"
    echo ""
    echo "Detailed Error:"
    az deployment group show \
      --resource-group "$MANAGED_RG" \
      --name "$FAILED_DEPLOYMENT" \
      --query "properties.error" \
      --output json

    echo ""
    echo "Failed Operations:"
    az deployment operation group list \
      --resource-group "$MANAGED_RG" \
      --name "$FAILED_DEPLOYMENT" \
      --query "[?properties.provisioningState=='Failed'].{Resource:properties.targetResource.resourceName, Type:properties.targetResource.resourceType, Error:properties.statusMessage.error}" \
      --output json
  fi
fi

echo ""
echo "================================================"
echo "Next Steps:"
echo "================================================"
echo "- Check if Storage Account 'smarteamsb88f' exists in RG 'smarteams'"
echo "- Check if Key Vault exists in RG 'smarteams'"
echo "- Verify deploying identity has permissions on both RGs"
echo "- Check for resource naming conflicts"
echo ""
