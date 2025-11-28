## Testing Value Deploy

### Basics
Subscription
Microsoft Partner Network
Resource group : smartlib-dev
Region: Southeast Asia
Application Name : smartlibteams1
Managed Resource Group Name : 

### Identity & Authentication
Azure AD Tenant ID :    69a01d04-ea91-4c91-b46e-8369667541c0

Application (Client) ID :   03b2d25d-887e-4644-89d4-d8ab50bef0f9

Application Client Secret :     tyP8Q~poXP8X8Dj59IAcw_H01WIYHE1sNlGmqdeo
****************************************

### Infrastructure Services
Key Vault name :    smartlib-kv

Key Vault resource group : ssmartlib-dev

Deployment Type : New Installation (Step 1)

### Redis Connectivity

Redis connection string secret URI (RECOMMENDED) : https://smartlib-kv.vault.azure.net/secrets/REDIS-CONNECTION-STRING


### Storage Services 
Storage account name : smartlib

Azure Files share name : data

Storage account access key : bvILPNS+x3bk/m30Ax1DFEMyFi28b9sap3mKwsIWYfQhMdDy9HX+C6DWHDClbe9v+IHd/VqXmRT3+AStnO6Ywg==

Storage account key secret URI https://smartlib-kv.vault.azure.net/secrets/STORAGE-ACCOUNT-KEY


Storage account resource group : smartlib

### AI & Cognitive Services

Azure OpenAI resource name : smartlib-oai

Azure OpenAI API version : 2024-10-21

Default embedding model identifier

text-embedding-3-small

key : 9L8vlAj7GGveBJ4MaL5k7uznQkLdLUuU83zt20exxMmLymgbnjv0JQQJ99BKACYeBjFXJ3w3AAABACOGHZDO

Azure OpenAI endpoint : https://smartlib-oai.openai.azure.com/

Azure OpenAI key secret URI  : https://smartlib-kv.vault.azure.net/secrets/OPENAI-API-KEY


### Document Intelligence

key : EpbTVsJB1uz288Hjx7kUpWQcDgm6P0TU8DWh1S1aY9RPTYsdVqtsJQQJ99BKACYeBjFXJ3w3AAALACOGHoIQ

Document Intelligence endpoint : https://smartlib-doci.cognitiveservices.azure.com/

Document Intelligence key secret URI : https://smartlib-kv.vault.azure.net/secrets/DOC-INTELLIGENCE-API-KEY

### Container & Deployment Settings

Deployment region
Southeast Asia
Resource name prefix : smartlib-teams 
App Service plan SKU : B1 - Basic

### Administrator Account

Admin username : admin

Admin password
**********

Admin password secret URI
-

Admin email
mwullur@live.com

Admin email secret URI
-


WEB_PRINCIPAL_ID=$(az webapp identity show \
    --name  smartlib-acme-web \
    --resource-group smartlib-test \
    --query principalId -o tsv)

WORKER_PRINCIPAL_ID=$(az webapp identity show \
    --name  smartlib-acme-worker \
    --resource-group smartlib-test \
    --query principalId -o tsv)

az role assignment create \
    --assignee "$WEB_PRINCIPAL_ID" \
    --role "Key Vault Secrets User" \
    --scope "/subscriptions/ece64599-3625-4c2e-a805-6f64d9ac1c8c/resourceGroups/smartlib-dev/providers/Microsoft.KeyVault/vaults/smartlib-kv"

az role assignment create \
    --assignee "$WORKER_PRINCIPAL_ID" \
    --role "Key Vault Secrets User" \
    --scope "/subscriptions/ece64599-3625-4c2e-a805-6f64d9ac1c8c/resourceGroups/smartlib-dev/providers/Microsoft.KeyVault/vaults/smartlib-kv"