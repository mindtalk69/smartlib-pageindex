# Guide: Using Azure Managed Identity to Access Key Vault from Azure Container

This guide explains how to securely access Azure Key Vault from your containerized app in Azure using a managed identity, so you never need to store client secrets in your code or environment.

---

## 1. Enable Managed Identity for Your Azure Container

**For Azure Container Apps, Azure App Service, or Azure Container Instances:**

- Go to your resource in the Azure Portal.
- In the left menu, find **Identity** (sometimes under "Settings").
- Under **System assigned**, switch the status to **On** and click **Save**.
- Note: This creates a managed identity (a service principal) for your resource.

---

## 2. Grant Key Vault Access to the Managed Identity

- Go to your **Azure Key Vault** in the Azure Portal.
- In the left menu, select **Access policies** (or "Access control (IAM)" for RBAC).
- Click **+ Add Access Policy**.
- Choose the permissions your app needs (at minimum: "Get" for secrets).
- Under **Principal**, click **None selected** and search for your container's managed identity by name.
- Select it, then click **Add**.
- Click **Save** to apply the new access policy.

**If using RBAC:**
- Go to **Access control (IAM)**.
- Click **+ Add > Add role assignment**.
- Choose a role like "Key Vault Secrets User".
- Assign it to your managed identity.

---

## 3. Set the Key Vault URL as an Environment Variable

- In your Azure deployment configuration (Container App, App Service, etc.), set:
  ```
  AZURE_KEYVAULT_URL=https://<your-keyvault-name>.vault.azure.net/
  ```
- This can be set in the Azure Portal under "Configuration" or in your deployment YAML/ARM template.

---

## 4. Application Code

- Your app should use `DefaultAzureCredential` (already implemented in your get_secret.py).
- No need to set AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, or AZURE_TENANT_ID for managed identity.

---

## 5. Deploy and Test

- Deploy your container/app to Azure.
- The app will use the managed identity to authenticate to Key Vault and fetch secrets.
- If you see authentication errors, double-check:
  - Managed identity is enabled.
  - Key Vault access policy or RBAC is assigned to the managed identity.
  - AZURE_KEYVAULT_URL is set correctly.

---

## 6. Security Notes

- Managed identity credentials are never exposed to your code or environment.
- You can rotate Key Vault secrets and permissions without redeploying your app.
- This is the most secure and recommended way to access Azure resources from Azure-hosted apps.

---

**References:**
- [Azure Managed Identity Documentation](https://docs.microsoft.com/en-us/azure/active-directory/managed-identities-azure-resources/overview)
- [Key Vault Access Policies](https://docs.microsoft.com/en-us/azure/key-vault/general/assign-access-policy-portal)
- [DefaultAzureCredential](https://learn.microsoft.com/en-us/python/api/overview/azure/identity-readme?view=azure-python#defaultazurecredential)
