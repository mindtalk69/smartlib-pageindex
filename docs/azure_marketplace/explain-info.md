

## Overview

### Summary
Smartlib is private library combination using AI to make it easier small scale company used their private document to do question and answer, and use analytic features when attach files or convert to text with image attach file.

Outcome: Private library of their private documents.

### Main SmartLib Application
 Main app URL: https://smartlib1-web.azurewebsites.net/ or https://app.smartlib.id (same resource in azure)
 user id: testuser
 password: Test12345 already assign as delegated as admin
As user with admin the admin panel will display on the top of navbar, it wont appear if user not as admin.
in login page,  new user can login with registered in entra Id to login. or register them self using local authetenticate (min. 8 Character with min 1 character with Upper case)

## Using or Test the application (user case)
- login , after login succes
- the home will display, check the options menu on the top , to use the features.
- click the self retriever question -> click button plus and new conversation. will be display of in options menu self retriever question is toggle on.
- start asking the question in example document after uploaded, you might see in 'admin panel ' -> files list document being uploaded
- in this case you can type : 'BYD M6' to search or 'KIMI K2' to search.
- the result will have response and provide citations and questions build from the answer with related document.

### Admin  (in regards in menu admin panel):
1. Should create library
2. Can customize catalog and categories depending their need
3. Can Customize Knowledge that related with library, categories and catalogs and group.
4. if group does not created it will ommited during upload and query.
5. admin can select vector store mode and this version will be using chroma in local vector store
6. Models , add model and change the default model to interaction. The option model for multi-modal to interaction with feature attach file : images, csv file and excel.
7. OCR : to change using OCR local or using api with azure doc intelligence
8. Visual Grounding : enable or disable will have feature display image as the document source (only PDF) , this feature only admin , and appears during upload and toggle to select or file upload using this feature.
8. LLM language will response with language their choose, and admin can add more language in here.
9. Embedding, default embedding is using azure open ai , we suggested using text-small-3, we support using local embedding  (came from hugging-face during activate):
- BAAI/bge-m3, need more resource(memory and space) but support multi language
- all-MiniLM-L6-v2, small enough for English and other language.
10. Reset menu will remove all transaction information in database.
11. logo setting will change on the top left corner of the logo smartlib
12. Users, list users and setting the user capability, user can be enabled/disabled and promote to be admin.


### Application framework and library:
- based on FLASK python
-	Database : sqlite
-   vector store : chroma
-	Most Library using langchain and open source
-	OCR library and ingest using docling, support azure intelligence (need to activate)
3rd party API
SERPER API KEY : using for agent search, if HIL during question and answer is yes. If not provided. It will error. User can add SERPER API KEY in app settings in web apps services. (optional)

### Pre-requisite before provision:
1. Azure Open Ai with model deployment if any , we can add more later in admin panel
2. azure keyvault with pre-define secret for :
- azure redis cache, for worker apps in background task
-openai-api-key
-openai-endpoint
-storage-account-key 
(where the storage save the data or db during processing)
- smartlib-admin-password (optional)
- doc-intelligence-key (if plan using azure doc intelligence) - optional

### SKU for web Apps
- can run in B1 but it to slow if using local embedding, minimum recomendation is B3 or Standard
- bot web and worker are runinng , with worker service used azure redis cache to provide background task


