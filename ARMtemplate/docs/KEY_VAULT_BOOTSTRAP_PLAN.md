# Automating Key Vault Bootstrap

## Overview
Automating the Key Vault bootstrap ensures Marketplace customers can provision all SmartLib secrets before launching the ARM templates. This document outlines recommended approaches, scripts, and validation steps so deployments stay compliant with Azure marketplace requirements and avoid manual secret setup.

## Goals
- Ensure every SmartLib deployment has a Key Vault seeded with required secrets before template execution.
- Reduce manual steps for end users by providing reusable automation.
- Keep sensitive values out of ARM parameter files by relying on secret URIs.
- Support both standalone deployments and Azure Marketplace listings.

## Secret Inventory
| Secret Name | Purpose | Notes |
|-------------|---------|-------|
| `AZURE_OPENAI_API_KEY` | Azure OpenAI API key used by web/worker apps | Required |
| `AZURE_OPENAI_ENDPOINT` | (Optional) Stores endpoint URL if you prefer to reference it | Optional (can be plain parameter) |
| `AZURE_OPENAI_DEPLOYMENT` | (Optional) Chat deployment name | Optional |
| `AZURE_EMBEDDING_DEPLOYMENT` | Embedding deployment name | Optional |
| `doc-intelligence-key` | Azure Document Intelligence key | Required when OCR is enabled |
| `admin-email` | Admin bootstrap email | Optional |
| `admin-password` | Admin bootstrap password | Optional |

## Automation Patterns
1. **Bootstrap Script (Recommended)**
   - Provide a Bash/PowerShell script customers run before ARM deployment.
   - Script responsibilities:
     - Create or reuse Key Vault.
     - Upload required secrets.
     - Output secret URIs for template parameters.
   - Publish as part of the Marketplace package and reference in documentation.

2. **Azure Deployment Scripts**
   - Embed a `Microsoft.Resources/deploymentScripts` resource inside the ARM template.
   - Script runs during deployment, creates/updates secrets, and emits outputs.
   - Pros: single deployment flow. Cons: raw secrets still pass through template parameters.

3. **Bicep Module**
   - Create a reusable Bicep module handling Key Vault provisioning and secret creation.
   - Web/worker templates call the module and consume its outputs.
   - Ideal for long-term maintainability if you already maintain Bicep sources.

4. **Managed Identity Binding**
   - Regardless of automation, ensure the App Service managed identity receives access to Key Vault secrets (e.g., `get`, `list`).
   - Bootstrap script can add access policies or assign role-based access to `App Configuration Data Reader` or custom roles.

## Reference CLI Script (Bash)
```bash
#!/usr/bin/env bash
set -euo pipefail

# Usage: ./bootstrap-smartlib-kv.sh \
#   --kv-name <name> --resource-group <rg> --location <region> \
#   --doc-int-key <value> --openai-key <value>

while [[ $# -gt 0 ]]; do
  case "$1" in
    --kv-name) kv_name="$2"; shift 2 ;;
    --resource-group) rg="$2"; shift 2 ;;
    --location) location="$2"; shift 2 ;;
    --doc-int-key) doc_key="$2"; shift 2 ;;
    --openai-key) openai_key="$2"; shift 2 ;;
    --openai-endpoint) openai_endpoint="$2"; shift 2 ;;
    --openai-deployment) openai_deployment="$2"; shift 2 ;;
    --embedding-deployment) embedding_deployment="$2"; shift 2 ;;
    --admin-email) admin_email="$2"; shift 2 ;;
    --admin-password) admin_password="$2"; shift 2 ;;
    *) echo "Unknown argument: $1"; exit 1 ;;
  esac
done

if [[ -z "${kv_name:-}" || -z "${rg:-}" || -z "${location:-}" || -z "${doc_key:-}" || -z "${openai_key:-}" ]]; then
  echo "Missing required arguments" >&2
  exit 1
fi

# Create resource group if it does not exist
if ! az group show --name "$rg" >/dev/null 2>&1; then
  az group create --name "$rg" --location "$location"
fi

# Create or reuse Key Vault
if ! az keyvault show --name "$kv_name" --resource-group "$rg" >/dev/null 2>&1; then
  az keyvault create --name "$kv_name" --resource-group "$rg" --location "$location"
fi

# Upload required secrets
az keyvault secret set --vault-name "$kv_name" --name doc-intelligence-key --value "$doc_key" --only-show-errors
az keyvault secret set --vault-name "$kv_name" --name azure-openai-api-key --value "$openai_key" --only-show-errors

# Optional secrets
if [[ -n "${openai_endpoint:-}" ]]; then
  az keyvault secret set --vault-name "$kv_name" --name azure-openai-endpoint --value "$openai_endpoint" --only-show-errors
fi
if [[ -n "${openai_deployment:-}" ]]; then
  az keyvault secret set --vault-name "$kv_name" --name azure-openai-deployment --value "$openai_deployment" --only-show-errors
fi
if [[ -n "${embedding_deployment:-}" ]]; then
  az keyvault secret set --vault-name "$kv_name" --name azure-embedding-deployment --value "$embedding_deployment" --only-show-errors
fi
if [[ -n "${admin_email:-}" ]]; then
  az keyvault secret set --vault-name "$kv_name" --name admin-email --value "$admin_email" --only-show-errors
fi
if [[ -n "${admin_password:-}" ]]; then
  az keyvault secret set --vault-name "$kv_name" --name admin-password --value "$admin_password" --only-show-errors
fi

# Output URIs for ARM parameters
cat <<EOF
Key Vault bootstrap complete.
Use the following URIs in your ARM templates:
- doc-intelligence-key: https://$kv_name.vault.azure.net/secrets/doc-intelligence-key
- azure-openai-api-key: https://$kv_name.vault.azure.net/secrets/azure-openai-api-key
$( [[ -n "${openai_endpoint:-}" ]] && echo "- azure-openai-endpoint: https://$kv_name.vault.azure.net/secrets/azure-openai-endpoint" )
$( [[ -n "${openai_deployment:-}" ]] && echo "- azure-openai-deployment: https://$kv_name.vault.azure.net/secrets/azure-openai-deployment" )
$( [[ -n "${embedding_deployment:-}" ]] && echo "- azure-embedding-deployment: https://$kv_name.vault.azure.net/secrets/azure-embedding-deployment" )
EOF
```

## Deployment Flow
1. Run the bootstrap script (or equivalent automation) to prepare Key Vault and capture URIs.
2. Supply the URIs to the ARM template parameters (`docIntelligenceKeySecretUri`, `azureOpenAIKey`, etc.).
3. Deploy web and worker templates.
4. Confirm managed identities have access to Key Vault secrets.

## Validation Checklist
- [ ] Key Vault exists in target resource group/location.
- [ ] Required secrets appear in `az keyvault secret list` output.
- [ ] ARM parameters reference the secret URIs rather than raw keys.
- [ ] App Services can resolve Key Vault references after deployment.
- [ ] Documentation updated to link buyers to the bootstrap script and usage instructions.

## Next Steps
- Package the script with Marketplace artifacts and reference it from the “Before you begin” section.
- Consider converting the script into a deployment script resource for fully automated flows.
- Keep the secret inventory synchronized with application requirements (update when new secrets are introduced).
