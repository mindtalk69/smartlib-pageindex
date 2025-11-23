## Testing Value Deploy

### Basics
Subscription
Microsoft Partner Network
Resource group : smarteams
Region: Southeast Asia
Application Name : smartlibteams1
Managed Resource Group Name : 

### Identity & Authentication
Azure AD Tenant ID :    69a01d04-ea91-4c91-b46e-8369667541c0

Application (Client) ID :   03b2d25d-887e-4644-89d4-d8ab50bef0f9

Application Client Secret :     tyP8Q~poXP8X8Dj59IAcw_H01WIYHE1sNlGmqdeo
****************************************

### Infrastructure Services
Key Vault name :    kv-malkysma756652505612

Key Vault resource group : smarteams

Deployment Type : New Installation (Step 1)

### Redis Connectivity

Redis connection string secret URI (RECOMMENDED) : https://kv-malkysma756652505612.vault.azure.net/secrets/REDIS-CONNECTION-STRING


### Storage Services 
Storage account name : smarteamsb88f

Azure Files share name : smartlib-data

Storage account key secret URI https://kv-malkysma756652505612.vault.azure.net/secrets/STORAGE-ACCOUNT-KEY/


Storage account resource group : smarteams

### AI & Cognitive Services

Azure OpenAI resource name : atgopenai2

Azure OpenAI API version : 2024-10-21

Default embedding model identifier

text-embedding-3-small

Password
-
Azure OpenAI key secret URI  : https://kv-malkysma756652505612.vault.azure.net/secrets/OPENAI-API-KEY/

Document Intelligence endpoint : https://atg-smarteam.cognitiveservices.azure.com/

Document Intelligence key secret URI : https://kv-malkysma756652505612.vault.azure.net/secrets/DOC-INTELLIGENCE-API-KEY

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