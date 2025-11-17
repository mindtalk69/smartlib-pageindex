# Dataflow Diagram Document for Azure Marketplace

## 1. Introduction

This document provides detailed dataflow diagrams illustrating how information moves through the SmartLib application. These diagrams help visualize the system architecture, component interactions, and data processing flows.

## 2. System Overview Dataflow

```mermaid
flowchart TD
    User[User] <--> WebInterface[Web Interface]
    WebInterface <--> AuthService[Authentication Service]
    WebInterface <--> AppService[App Service - Web]
    AppService <--> Redis[Redis Cache]
    Redis <--> WorkerService[App Service - Worker]
    AppService <--> VectorDB[Vector Store]
    AppService <--> SQLite[(SQLite Database)]
    WorkerService <--> DocumentProcessor[Document Processor]
    DocumentProcessor <--> BlobStorage[(Document Storage)]
    DocumentProcessor <--> VectorDB
    AppService <--> LLMService[LLM Service]
    LLMService <--> AzureOpenAI[Azure OpenAI]
    
    subgraph Azure
        AppService
        WorkerService
        Redis
        DocumentProcessor
        SQLite
        VectorDB
        BlobStorage
        LLMService
        AzureOpenAI
    end
```

## 3. Authentication Flow

```mermaid
sequenceDiagram
    participant User
    participant WebApp as Web Application
    participant Auth as Auth Service
    participant AzureAD as Azure AD (Optional)
    participant DB as Database
    
    User->>WebApp: Access application
    WebApp->>User: Request credentials
    User->>WebApp: Provide credentials
    alt Local Authentication
        WebApp->>Auth: Validate credentials
        Auth->>DB: Check user record
        DB->>Auth: Return user data
        Auth->>WebApp: Authentication result
    else Azure AD Authentication
        WebApp->>AzureAD: Redirect to login
        AzureAD->>User: Request credentials
        User->>AzureAD: Provide credentials
        AzureAD->>WebApp: Send auth token
        WebApp->>Auth: Validate token
        Auth->>DB: Update/verify user record
        DB->>Auth: Confirm user data
        Auth->>WebApp: Authentication result
    end
    WebApp->>User: Grant access or deny
```

## 4. Document Upload and Processing Flow

```mermaid
flowchart TD
    User[User] -->|Uploads document| WebUI[Web Interface]
    WebUI -->|Forwards document| AppService[App Service - Web]
    AppService -->|Saves document| Storage[(Blob Storage)]
    AppService -->|Creates metadata record| DB[(SQLite Database)]
    AppService -->|Queues processing task| TaskQueue[Redis Task Queue]
    
    TaskQueue -->|Processes task| Worker[Worker Service]
    Storage -->|Reads document| Worker
    Worker -->|Extracts text| Worker
    Worker -->|Creates chunks| Worker
    Worker -->|Generates embeddings| Embeddings[Embedding Service]
    Embeddings -->|Returns vectors| Worker
    Worker -->|Stores vectors| VectorStore[(Vector Store)]
    Worker -->|Updates status| DB
    
    subgraph Document Processing
        TaskQueue
        Worker
        Embeddings
    end
    
    subgraph Data Storage
        Storage
        DB
        VectorStore
    end
```

## 5. Search and Retrieval Flow

```mermaid
sequenceDiagram
    participant User
    participant WebApp as Web Application
    participant Search as Search Service
    participant VectorDB as Vector Store
    participant DocDB as Document Storage
    participant DB as SQLite Database
    
    User->>WebApp: Submit search query
    WebApp->>Search: Forward query
    Search->>Search: Process and tokenize query
    Search->>Search: Generate query embedding
    Search->>VectorDB: Perform similarity search
    VectorDB->>Search: Return relevant vector IDs
    Search->>DB: Retrieve document metadata
    DB->>Search: Return metadata
    Search->>DocDB: Retrieve document chunks
    DocDB->>Search: Return content
    Search->>Search: Rank and format results
    Search->>WebApp: Return search results
    WebApp->>User: Display results
```

## 6. Chat Interaction Flow

```mermaid
sequenceDiagram
    participant User
    participant WebApp as Web Application
    participant Chat as Chat Service
    participant Search as Search Service
    participant VectorDB as Vector Store
    participant LLM as Language Model Service
    participant Azure as Azure OpenAI
    
    User->>WebApp: Submit chat message
    WebApp->>Chat: Forward message
    Chat->>Chat: Process message
    
    Chat->>Search: Search for relevant context
    Search->>VectorDB: Query vector store
    VectorDB->>Search: Return relevant vectors
    Search->>Chat: Return context
    
    Chat->>LLM: Generate response with context
    LLM->>Azure: Send prompt to Azure OpenAI
    Azure->>LLM: Return generated text
    LLM->>Chat: Return formatted response
    
    Chat->>WebApp: Stream response
    WebApp->>User: Display response with citations
```

## 7. User Management Flow

```mermaid
flowchart TD
    Admin[Administrator] -->|Manages users| AdminUI[Admin Interface]
    AdminUI -->|Creates/updates users| UserService[User Service]
    UserService -->|Stores user data| DB[(SQLite Database)]
    
    AdminUI -->|Creates/manages groups| GroupService[Group Service]
    GroupService -->|Stores group data| DB
    
    AdminUI -->|Assigns permissions| PermissionService[Permission Service]
    PermissionService -->|Updates permissions| DB
    
    DB -->|Auth data| AuthService[Auth Service]
    AuthService -->|Validates| WebApp[Web Application]
```

## 8. Default Deployment Architecture (ChromaDB)

```mermaid
flowchart TD
    User[User] <--> FD[Azure Front Door]
    FD <--> WAF[Web Application Firewall]
    WAF <--> WebApp[Web App Service]
    WebApp <--> KV[Key Vault]
    WebApp <--> Redis[Azure Cache for Redis]
    WebApp <--> Storage[Azure Storage]
    WebApp <--> SQLite[(SQLite DB)]
    WebApp <--> ChromaDB[(ChromaDB)]
    WebApp <--> OAI[Azure OpenAI]
    Redis <--> Worker[Worker App Service]
    Storage <--> Worker
    SQLite <--> Worker
    ChromaDB <--> Worker
    Worker <--> KV
    Worker <--> OAI
    
    subgraph Azure Resources
        FD
        WAF
        WebApp
        Worker
        Redis
        KV
        Storage
        SQLite
        ChromaDB
        OAI
    end
    
    subgraph Azure Files
        SQLite
        ChromaDB
    end
```

## 9. Optional PGVector Deployment Architecture

```mermaid
flowchart TD
    User[User] <--> FD[Azure Front Door]
    FD <--> WAF[Web Application Firewall]
    WAF <--> WebApp[Web App Service]
    WebApp <--> KV[Key Vault]
    WebApp <--> Redis[Azure Cache for Redis]
    WebApp <--> Storage[Azure Storage]
    WebApp <--> SQLite[(SQLite DB)]
    WebApp <--> PSQL[(PostgreSQL DB)]
    WebApp <--> OAI[Azure OpenAI]
    Redis <--> Worker[Worker App Service]
    Storage <--> Worker
    SQLite <--> Worker
    PSQL <--> Worker
    Worker <--> KV
    Worker <--> OAI
    
    subgraph Azure Resources
        FD
        WAF
        WebApp
        Worker
        Redis
        KV
        Storage
        SQLite
        PSQL
        OAI
    end
    
    subgraph Azure Files
        SQLite
    end
```

## 10. Split Architecture Model

```mermaid
flowchart TD
    subgraph "Web Container (250MB)"
        WebFlask[Flask Web Framework]
        OpenAI[OpenAI API Client]
        CeleryClient[Celery Client]
        RedisClient[Redis Client]
        BasicUtils[Basic Utilities]
    end
    
    subgraph "Worker Container (650MB)"
        WorkerFlask[Flask Framework]
        PyTorch[PyTorch]
        SentenceTransformers[Sentence-Transformers]
        SciPy[SciPy]
        ScikitLearn[Scikit-Learn]
        Docling[Docling]
        DocProcessing[Document Processing]
    end
    
    User[User] --> WebFlask
    WebFlask --> OpenAI
    WebFlask --> CeleryClient
    CeleryClient --> Redis[Redis Cache]
    Redis --> WorkerFlask
    WorkerFlask --> PyTorch
    WorkerFlask --> SentenceTransformers
    WorkerFlask --> DocProcessing
```

## 11. Azure Resource Deployment Model

```mermaid
flowchart TD
    ARMTemplate[ARM Template]
    
    subgraph "Resource Creation"
        ARMTemplate --> ASP[App Service Plan]
        ARMTemplate --> Redis[Azure Cache for Redis]
        ARMTemplate --> KV[Key Vault]
        ARMTemplate --> Storage[Azure Storage]
        ARMTemplate --> AI[Application Insights]
    end
    
    subgraph "Web Application"
        ASP --> WebApp[Web App Service]
        WebApp --> WebDockerImage[Web Docker Image]
        WebApp --> WebConfig[Web Configuration]
        WebConfig --> WebEnvVars[Environment Variables]
        WebConfig --> WebStartup[Startup Command]
    end
    
    subgraph "Worker Application"
        ASP --> WorkerApp[Worker App Service]
        WorkerApp --> WorkerDockerImage[Worker Docker Image]
        WorkerApp --> WorkerConfig[Worker Configuration]
        WorkerConfig --> WorkerEnvVars[Environment Variables]
        WorkerConfig --> WorkerStartup[Startup Command]
    end
    
    subgraph "Shared Resources"
        Redis --> WebApp
        Redis --> WorkerApp
        KV --> WebApp
        KV --> WorkerApp
        Storage --> AzureFiles[Azure Files]
        AzureFiles --> SharedData[Shared Data Volume]
        SharedData --> SQLite[(SQLite DB)]
        SharedData --> ChromaDB[(ChromaDB Files)]
        WebApp --> AzureFiles
        WorkerApp --> AzureFiles
        AI --> WebApp
    end
```

## 12. Cost-Optimized Shared Plan Architecture

```mermaid
flowchart TD
    subgraph "Traditional Architecture"
        WebPlan[Web App Plan B1 - $13/month]
        WebApp[smartlib-web]
        WorkerPlan[Worker App Plan B1 - $13/month]
        WorkerApp[smartlib-worker]
        Redis1[Redis Cache C0 - $17/month]
        
        WebPlan --> WebApp
        WorkerPlan --> WorkerApp
        Redis1 --> WebApp
        Redis1 --> WorkerApp
    end
    
    subgraph "Shared Plan Architecture"
        SharedPlan[Shared App Service Plan B1 - $13/month]
        SharedWebApp[smartlib-basic-web]
        SharedWorkerApp[smartlib-basic-worker]
        Redis2[Redis Cache C0 - $17/month]
        
        SharedPlan --> SharedWebApp
        SharedPlan --> SharedWorkerApp
        Redis2 --> SharedWebApp
        Redis2 --> SharedWorkerApp
    end
    
    Cost1[Total: $43/month]
    Cost2[Total: $30/month]
    
    WebPlan --> Cost1
    WorkerPlan --> Cost1
    Redis1 --> Cost1
    
    SharedPlan --> Cost2
    Redis2 --> Cost2
```

## 13. Vector Store Provider Options

```mermaid
flowchart TD
    subgraph "Default: ChromaDB"
        ChromaDB[(ChromaDB Vector Store)]
        ChromaFiles[File System Storage]
        ChromaMemory[In-Memory Index]
        
        ChromaDB --> ChromaFiles
        ChromaDB --> ChromaMemory
        ChromaFiles --> AzureFiles1[Azure Files]
    end
    
    subgraph "Optional: PGVector"
        PGVector[(PGVector Extension)]
        PostgreSQL[(PostgreSQL Database)]
        PGVectorAPI[Vector Similarity API]
        
        PGVector --> PostgreSQL
        PGVector --> PGVectorAPI
    end
    
    WebApp1[Web App] --> ChromaDB
    Worker1[Worker] --> ChromaDB
    
    WebApp2[Web App] --> PGVector
    Worker2[Worker] --> PGVector
    
    ChromaConfig[Vector Store Provider: chromadb]
    PGVectorConfig[Vector Store Provider: pgvector]
    
    ChromaConfig --> ChromaDB
    PGVectorConfig --> PGVector
```

## 14. Conclusion

These dataflow diagrams illustrate the key components, interactions, and data movement patterns within the SmartLib application. They provide a visual reference to understand the system architecture, deployment model, and resource interactions when deployed to Azure through the Azure Marketplace.

The diagrams highlight the following key aspects:
- The default deployment uses SQLite as the database and ChromaDB as the vector store, both stored on Azure Files
- An optional configuration allows using PostgreSQL with PGVector for the vector store
- The split architecture approach separates web and worker responsibilities
- The cost-optimized shared plan option reduces costs while maintaining functionality
- The various data processing flows that enable the core RAG functionality of the application
