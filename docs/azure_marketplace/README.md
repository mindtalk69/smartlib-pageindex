# SmartLib Azure Marketplace Documentation

## Overview

This directory contains comprehensive documentation for deploying and operating SmartLib through the Azure Marketplace. These documents are designed to provide all the necessary information for successful deployment, configuration, security management, and day-to-day operations.

## Documentation Files

1. **[1_Solution_Architecture_Document.md](1_Solution_Architecture_Document.md)**
   - High-level architecture overview
   - Component descriptions
   - Azure resource requirements
   - Deployment architecture options
   - Integration points

2. **[2_Deployment_Guide.md](2_Deployment_Guide.md)**
   - Prerequisites
   - Deployment parameters
   - Step-by-step deployment instructions
   - Post-deployment configuration
   - Validation procedures

3. **[3_Security_Documentation.md](3_Security_Documentation.md)**
   - Security architecture
   - Data security controls
   - Identity and access management
   - Network security
   - Compliance information

4. **[4_Operations_Documentation.md](4_Operations_Documentation.md)**
   - Administrative tasks
   - Monitoring and maintenance
   - Backup and recovery
   - Troubleshooting procedures
   - Performance optimization

5. **[5_End_User_Documentation.md](5_End_User_Documentation.md)**
   - User interface overview
   - Search and chat functionality
   - Document upload and management
   - Collaboration features
   - User settings and customization

6. **[6_Dataflow_Diagram.md](6_Dataflow_Diagram.md)**
   - System dataflow diagrams
   - Authentication flow
   - Document processing flow
   - Search and retrieval flow
   - Chat interaction flow

7. **[7_Network_Requirements.md](7_Network_Requirements.md)**
   - Network architecture
   - Inbound and outbound requirements
   - Network security configuration
   - Performance optimization
   - Multi-region considerations

8. **[8_Resource_Requirements.md](8_Resource_Requirements.md)**
   - Detailed resource specifications
   - Scaling considerations
   - Cost estimates
   - Performance characteristics
   - Resource allocation by usage pattern

## Database and Vector Store Options

SmartLib offers flexible database and vector store options:

### Default Configuration
- **Application Database**: SQLite (stored on Azure Files shared volume)
- **Vector Store**: ChromaDB (file-based, stored on Azure Files shared volume)

This default configuration provides excellent performance for most use cases while minimizing costs and complexity.

### Optional PGVector Configuration
- **Application Database**: SQLite (unchanged)
- **Vector Store**: PGVector (requires Azure Database for PostgreSQL)

The PGVector option is available for users who need specific PostgreSQL vector capabilities or have existing PostgreSQL infrastructure.

## Deployment Options

SmartLib offers three primary deployment options in the Azure Marketplace:

### 1. Basic Deployment (B1 SKU)

- Suitable for development, testing, and small teams
- Separate App Service Plans for web and worker
- Uses SQLite and ChromaDB by default
- Estimated cost: ~$45.5/month + Azure OpenAI usage

### 2. Standard Deployment (P1v2 SKU)

- Suitable for production environments and medium-sized teams
- Enhanced performance and scalability
- Uses SQLite and ChromaDB by default
- Optional PGVector with PostgreSQL database
- Estimated cost: ~$208/month + Azure OpenAI usage
- With optional PostgreSQL: ~$428/month + Azure OpenAI usage

### 3. Cost-Optimized Shared Plan

- Suitable for development and small teams with budget constraints
- Single shared App Service Plan for web and worker
- Uses SQLite and ChromaDB by default
- Estimated cost: ~$32.5/month + Azure OpenAI usage

## Key Features

- **Split Architecture**: Optimized web and worker containers
- **Retrieval-Augmented Generation (RAG)**: Enhanced AI responses with document context
- **Multiple Vector Stores**: Support for ChromaDB (default) and PGVector (optional)
- **Azure OpenAI Integration**: Leverages Azure's AI capabilities
- **Flexible Authentication**: Local accounts and Azure AD integration
- **Group-Based Access Control**: Fine-grained content security
- **Document Processing**: Comprehensive document upload and indexing
- **Conversational AI**: Chat interface with document citations

## ARM Templates

The ARMtemplate directory contains deployment templates for various scenarios:

- **flask_appservice_template.json**: Complete deployment with new resources
- **flask_appservice_template_conditional_kv.json**: Deployment with conditional Key Vault access
- **flask_appservice_template_shared_plan.json**: Cost-optimized shared plan deployment
- **celery_worker_appservice.json**: Standalone worker deployment

## Support

For questions or issues with your deployment, please contact support@smartlib.example.com or open a support ticket through the Azure Portal.

## Version Information

- Documentation Version: 1.0.0
- SmartLib Version: 2025.10.1
- Last Updated: October 2025
