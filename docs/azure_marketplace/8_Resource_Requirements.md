# Resource Requirements Documentation for Azure Marketplace

## 1. Introduction

This document outlines the Azure resource requirements for deploying and running the SmartLib application from the Azure Marketplace. It provides detailed specifications for compute, storage, networking, and other Azure resources required for optimal performance and functionality.

## 2. Resource Overview

SmartLib is deployed using the following core Azure resources:

| Resource Type | Purpose | Minimum SKU | Recommended SKU |
|--------------|---------|-------------|-----------------|
| App Service Plan | Hosts the web application | B1 | P1v2 |
| App Service Plan | Hosts the worker service | B1 | P1v2 |
| Azure Cache for Redis | Task queue and results storage | Basic C0 | Standard C1 |
| Azure Storage Account | Document storage and shared data | Standard LRS | Standard GRS |
| Azure Key Vault | Secret management | Standard | Standard |
| Azure OpenAI Service | AI model access | Standard | Standard |
| Application Insights | Monitoring and diagnostics | N/A | N/A |
| Azure Database for PostgreSQL | Vector database for PGVector (optional) | Basic Gen 5, 2 vCores | General Purpose Gen 5, 4 vCores |

## 3. Deployment Options and Resource Requirements

### 3.1 Basic Deployment (B1 SKU with SQLite)

**Suitable for:** Development, testing, small teams (up to 20 users)

| Resource | SKU | Specifications | Monthly Cost* |
|----------|-----|----------------|---------------|
| Web App Service Plan | B1 | 1 vCPU, 1.75GB RAM | ~$13 |
| Worker App Service Plan | B1 | 1 vCPU, 1.75GB RAM | ~$13 |
| Azure Cache for Redis | Basic C0 | 250MB, 1Gbps network | ~$17 |
| Azure Storage Account | Standard LRS | 100GB storage | ~$2 |
| Azure Key Vault | Standard | 0.03/10,000 transactions | ~$0.5 |
| Azure OpenAI Service | Standard | Pay-per-use | Variable |
| **Total Estimated Cost** | | | **~$45.5/month + OpenAI usage** |

*Cost estimates are approximate and subject to change. Actual costs will depend on usage patterns and Azure pricing changes.

### 3.2 Standard Deployment (P1v2 SKU with Optional PGVector)

**Suitable for:** Production environments, medium teams (20-100 users)

| Resource | SKU | Specifications | Monthly Cost* |
|----------|-----|----------------|---------------|
| Web App Service Plan | P1v2 | 1 vCPU, 3.5GB RAM | ~$80 |
| Worker App Service Plan | P1v2 | 1 vCPU, 3.5GB RAM | ~$80 |
| Azure Cache for Redis | Standard C1 | 1GB, 1Gbps network | ~$42 |
| Azure Storage Account | Standard GRS | 100GB storage | ~$5 |
| Azure Key Vault | Standard | 0.03/10,000 transactions | ~$1 |
| Azure OpenAI Service | Standard | Pay-per-use | Variable |
| Azure Database for PostgreSQL** | General Purpose, 4 vCores | 4 vCPU, 20GB RAM, 100GB storage | ~$220 |
| **Total Estimated Cost** | | | **~$208/month + OpenAI usage** |
| **Total with PostgreSQL** | | | **~$428/month + OpenAI usage** |

*Cost estimates are approximate and subject to change. Actual costs will depend on usage patterns and Azure pricing changes.
**PostgreSQL is optional and only required if choosing PGVector as the vector store. The default deployment uses ChromaDB which stores vectors in the file system on Azure Files.

### 3.3 Cost-Optimized Shared Plan Deployment (SQLite)

**Suitable for:** Development, testing, small teams with budget constraints

| Resource | SKU | Specifications | Monthly Cost* |
|----------|-----|----------------|---------------|
| Shared App Service Plan | B1 | 1 vCPU, 1.75GB RAM | ~$13 |
| Azure Cache for Redis | Basic C0 | 250MB, 1Gbps network | ~$17 |
| Azure Storage Account | Standard LRS | 100GB storage | ~$2 |
| Azure Key Vault | Standard | 0.03/10,000 transactions | ~$0.5 |
| Azure OpenAI Service | Standard | Pay-per-use | Variable |
| **Total Estimated Cost** | | | **~$32.5/month + OpenAI usage** |

*Cost estimates are approximate and subject to change. Actual costs will depend on usage patterns and Azure pricing changes.

## 4. Compute Resources

### 4.1 Web Application (App Service)

| SKU | vCPU | Memory | Instances | Use Case |
|-----|------|--------|-----------|----------|
| B1 | 1 | 1.75GB | 1-3 | Development, small teams |
| S1 | 1 | 1.75GB | 1-10 | Small production, improved SLA |
| P1v2 | 1 | 3.5GB | 1-20 | Production, better performance |
| P2v2 | 2 | 7GB | 1-20 | Production, high traffic |

**Key Features Required:**
- Always On (B1 and above)
- Custom domains (B1 and above)
- Auto-scaling (S1 and above)
- VNet integration (S1 and above)

**Performance Characteristics:**
- Main bottleneck: Memory usage during peak loads
- Recommended instance count: 1 instance per 20 concurrent users
- Auto-scaling trigger: >70% memory utilization or >80% CPU utilization

### 4.2 Worker Application (App Service)

| SKU | vCPU | Memory | Instances | Use Case |
|-----|------|--------|-----------|----------|
| B1 | 1 | 1.75GB | 1-3 | Development, small document volumes |
| S1 | 1 | 1.75GB | 1-5 | Small production, moderate document volumes |
| P1v2 | 1 | 3.5GB | 1-10 | Production, large document volumes |
| P2v2 | 2 | 7GB | 1-10 | Production, very large document volumes |

**Key Features Required:**
- Always On (B1 and above)
- Background processing
- Auto-scaling (S1 and above)
- VNet integration (S1 and above)

**Performance Characteristics:**
- Main bottleneck: Memory usage during document processing
- Recommended instance count: 1 instance per 50,000 documents
- Auto-scaling trigger: >60% memory utilization or >70% CPU utilization or queue depth >100

## 5. Storage Resources

### 5.1 Azure Storage Account

| SKU | Redundancy | Use Case | Minimum Capacity |
|-----|------------|----------|------------------|
| Standard LRS | Locally redundant | Development, testing | 100GB |
| Standard ZRS | Zone redundant | Production, regional | 100GB |
| Standard GRS | Geo-redundant | Production, critical data | 100GB |

**Key Features Required:**
- Blob Storage for document storage
- Azure Files for shared storage (/home/data)
- Private endpoints for secure access (production)

**Performance Characteristics:**
- Document storage growth: ~5MB per document on average
- I/O patterns: Write-heavy during uploads, read-heavy during queries
- Recommended maximum documents: 10,000 per 100GB

### 5.2 Database Options

#### 5.2.1 SQLite (Default)

| Feature | Specification | Notes |
|---------|---------------|-------|
| Location | Azure Files (/home/data/app.db) | Mounted to both web and worker containers |
| Size | Scales with usage, typically <5GB | Suitable for small to medium deployments |
| Performance | Limited by Azure Files I/O | Good for development and small production |
| Backup | Handled by Azure Files snapshots | Automated backup support |

#### 5.2.2 Azure Database for PostgreSQL (Optional for PGVector)

| SKU | vCores | Memory | Storage | Use Case |
|-----|--------|--------|---------|----------|
| Basic, Gen 5, 2 vCores | 2 | 10GB | 50GB | Development, small vector databases |
| General Purpose, Gen 5, 4 vCores | 4 | 20GB | 100GB | Production, medium vector databases |
| General Purpose, Gen 5, 8 vCores | 8 | 40GB | 250GB | Production, large vector databases |

**Key Features Required:**
- PGVector extension support
- Connection pooling
- Private endpoints for secure access (production)

**Performance Characteristics:**
- Vector database growth: ~2KB per vector
- Query patterns: Read-heavy with complex vector similarity searches
- Recommended maximum vectors: 1 million per 50GB

## 6. Networking Resources

### 6.1 Azure Cache for Redis

| SKU | Memory | Throughput | Use Case |
|-----|--------|------------|----------|
| Basic C0 | 250MB | Low | Development, testing |
| Basic C1 | 1GB | Medium | Small production |
| Standard C1 | 1GB | Medium | Production, replication |
| Premium P1 | 6GB | High | Production, high volume |

**Key Features Required:**
- SSL connections
- Redis persistence (Standard or Premium)
- VNet support (Premium only)

**Performance Characteristics:**
- Task queue size: ~1KB per task
- Queue depth: Typically 10-100 tasks
- Response caching: ~10KB per cached response
- Recommended memory allocation: 250MB per 100 concurrent users

### 6.2 Virtual Network (Optional)

| Resource | SKU | Use Case |
|----------|-----|----------|
| Virtual Network | Standard | All deployments with enhanced security |
| Subnet (Web) | /24 (254 IPs) | App Service VNet integration |
| Subnet (Data) | /24 (254 IPs) | Private endpoints for data services |
| Network Security Groups | Standard | Security rules for subnets |

**Key Features Required:**
- Service endpoints for Azure services
- Private DNS zones for private endpoints
- Network security groups for traffic control

## 7. Security Resources

### 7.1 Azure Key Vault

| SKU | Features | Use Case |
|-----|----------|----------|
| Standard | Secrets, keys, certificates | All deployments |

**Key Features Required:**
- Managed identities for access
- RBAC for access control
- Private endpoints (production)

### 7.2 Azure Active Directory (Optional)

| SKU | Features | Use Case |
|-----|----------|----------|
| Free | Basic authentication | Development, small teams |
| Premium P1 | Conditional access, MFA | Production, enterprise |

**Key Features Required:**
- Application registration
- User authentication
- Role-based access control

## 8. AI Resources

### 8.1 Azure OpenAI Service

| Model | Purpose | Token Usage (Estimated) |
|-------|---------|-------------------------|
| GPT-4 / GPT-3.5 Turbo | Chat interface, query responses | 2K-4K tokens per query |
| text-embedding-3-small | Document embeddings | 1K tokens per document chunk |

**Key Features Required:**
- Model deployments for chat and embeddings
- Throughput capacity for concurrent users
- Token quota for expected usage

**Usage Patterns:**
- Chat completions: ~10-20 queries per user per day
- Embedding generations: ~100 chunks per document
- Monthly token usage (10 users): ~1-2M tokens

## 9. Monitoring and Management Resources

### 9.1 Application Insights

| Feature | Purpose |
|---------|---------|
| Application monitoring | Track performance, errors, and usage |
| Distributed tracing | Track requests across components |
| Availability tests | Monitor application health |

**Key Features Required:**
- Live metrics
- Transaction monitoring
- Custom dashboards

### 9.2 Azure Monitor

| Feature | Purpose |
|---------|---------|
| Resource metrics | Monitor resource utilization |
| Activity logs | Track administrative actions |
| Alerts | Notification of issues |

**Key Features Required:**
- Custom metrics
- Alert rules
- Action groups for notifications

## 10. Scaling Considerations

### 10.1 Vertical Scaling

| Component | Scaling Factor | When to Scale |
|-----------|---------------|---------------|
| Web App | Memory | >70% memory utilization |
| Worker App | Memory, CPU | >60% memory utilization, >70% CPU utilization |
| Redis | Memory | >80% memory utilization |
| PostgreSQL (if used) | CPU, IOPS | >70% CPU utilization, >80% IOPS utilization |

### 10.2 Horizontal Scaling

| Component | Scaling Factor | When to Scale |
|-----------|---------------|---------------|
| Web App | Concurrent users | >20 concurrent users per instance |
| Worker App | Queue depth | Queue depth >100 tasks |
| PostgreSQL (if used) | Connection count | >80% of maximum connections |

### 10.3 Auto-Scaling Rules

| Resource | Metric | Threshold | Scale-Out | Scale-In |
|----------|--------|-----------|-----------|----------|
| Web App | CPU | >80% | +1 instance | -1 instance after 10 minutes below 60% |
| Web App | Memory | >70% | +1 instance | -1 instance after 10 minutes below 50% |
| Worker App | CPU | >70% | +1 instance | -1 instance after 15 minutes below 50% |
| Worker App | Memory | >60% | +1 instance | -1 instance after 15 minutes below 40% |
| Worker App | Queue depth | >100 | +1 instance | -1 instance after 20 minutes below 50 |

## 11. Resource Allocation by Usage Pattern

### 11.1 Document-Heavy Usage (ChromaDB)

For deployments focusing on document storage and retrieval:

| Resource | Recommended SKU | Notes |
|----------|-----------------|-------|
| Web App | B1 or S1 | Lower compute needs |
| Worker App | P1v2 | Higher memory for document processing |
| Storage | Standard GRS | Higher storage capacity and redundancy |
| Redis | Basic C1 | Moderate caching needs |

### 11.2 Query-Heavy Usage (ChromaDB)

For deployments focusing on interactive querying and chat:

| Resource | Recommended SKU | Notes |
|----------|-----------------|-------|
| Web App | P1v2 | Higher compute for concurrent users |
| Worker App | S1 | Moderate compute needs |
| Storage | Standard ZRS | Moderate storage needs |
| Redis | Standard C1 | Higher caching needs |

### 11.3 PGVector Usage (Optional)

For deployments using PostgreSQL-based vector storage:

| Resource | Recommended SKU | Notes |
|----------|-----------------|-------|
| Web App | S1 | Balanced compute |
| Worker App | S1 | Balanced compute |
| Storage | Standard ZRS | Balanced storage |
| PostgreSQL | General Purpose, 4 vCores | Vector storage database |
| Redis | Standard C0 | Balanced caching |

## 12. Resource Provisioning Timeline

| Deployment Phase | Resources Provisioned | Estimated Duration |
|------------------|----------------------|-------------------|
| Initial Deployment | App Service Plans, Web App, Worker App | 5-7 minutes |
| Data Services | Redis Cache, Key Vault, Storage Account | 5-10 minutes |
| Database (Optional) | Azure Database for PostgreSQL | 10-15 minutes |
| Networking (Optional) | VNet, Private Endpoints, NSGs | 10-15 minutes |
| Configuration | App settings, connection strings | 2-3 minutes |
| **Total Deployment Time** | | **30-50 minutes** |

## 13. Resource Quota Requirements

Ensure your Azure subscription has sufficient quota for the following:

| Resource | Minimum Quota Required |
|----------|------------------------|
| App Service | 2 instances of selected SKU |
| Redis Cache | 1 instance of selected SKU |
| Storage Accounts | 1 account |
| OpenAI Service | 1 service with GPT and embedding models |
| vCPUs | 2-4 vCPUs (Basic), 4-8 vCPUs (Standard) |
| PostgreSQL Databases | 1 database (optional, only if using PGVector) |

## 14. Conclusion

This resource requirements document provides comprehensive guidance on the Azure resources needed to deploy and run the SmartLib application. Use these specifications as a baseline for planning your deployment, adjusting resources based on your specific usage patterns and performance requirements.

The application is designed to run with SQLite by default, which is stored on the Azure Files share and provides good performance for most use cases. PostgreSQL is only required if you specifically choose to use the PGVector vector store option instead of the default ChromaDB.

For the most cost-effective deployment, consider the Shared App Service Plan option, which provides a balanced approach for development and small production environments. For larger deployments or production environments with higher performance requirements, use the Standard Deployment option with appropriate scaling rules.

Regular monitoring and adjustment of resources based on actual usage patterns will help optimize both performance and cost.