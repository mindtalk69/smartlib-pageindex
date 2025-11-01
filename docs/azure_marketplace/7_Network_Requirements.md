# Network Requirements Documentation for Azure Marketplace

## 1. Introduction

This document outlines the network architecture, requirements, and configuration options for the SmartLib application when deployed through the Azure Marketplace. It provides detailed information about network connectivity, security configurations, and best practices to ensure optimal performance and security.

## 2. Network Architecture Overview

### 2.1 Basic Network Architecture

SmartLib uses a multi-tier network architecture:

```
Internet
    ↓
Azure Front Door / Application Gateway (optional)
    ↓
Web App Service (public endpoint)
    ↓
Internal Services:
  - Worker App Service (no public endpoint)
  - Redis Cache
  - Azure Database for PostgreSQL (optional)
  - Azure Storage Account
  - Azure Key Vault
  - Azure OpenAI Service
```

### 2.2 Network Flow

1. **User Traffic**
   - External users → Web App Service (HTTPS, ports 80/443)
   - Authentication traffic → Azure AD (if enabled)

2. **Internal Traffic**
   - Web App → Redis Cache (SSL, port 6380)
   - Web App → Azure Storage (HTTPS, port 443)
   - Web App → Key Vault (HTTPS, port 443)
   - Web App → Azure OpenAI (HTTPS, port 443)
   - Worker App → Redis Cache (SSL, port 6380)
   - Worker App → Azure Storage (HTTPS, port 443)
   - Worker App → Key Vault (HTTPS, port 443)
   - Worker App → Azure OpenAI (HTTPS, port 443)

## 3. Inbound Network Requirements

### 3.1 Web Application

| Protocol | Port | Source | Destination | Purpose |
|----------|------|--------|-------------|---------|
| HTTP | 80 | Internet | Web App Service | HTTP traffic (redirected to HTTPS) |
| HTTPS | 443 | Internet | Web App Service | Secure web traffic |
| HTTPS | 443 | Azure Front Door | Web App Service | If using Azure Front Door |

### 3.2 Worker Application

The Worker App Service does not require direct inbound internet access. It operates as a background service processing tasks from the Redis queue.

### 3.3 Management Access

| Protocol | Port | Source | Destination | Purpose |
|----------|------|--------|-------------|---------|
| HTTPS | 443 | Administrators | Azure Portal | Management access |
| SSH | 22 | Administrators | App Service SCM | Advanced troubleshooting (if enabled) |

## 4. Outbound Network Requirements

### 4.1 Web Application

| Protocol | Port | Source | Destination | Purpose |
|----------|------|--------|-------------|---------|
| HTTPS | 443 | Web App | Azure Storage | Document storage access |
| SSL | 6380 | Web App | Redis Cache | Task queue and results |
| HTTPS | 443 | Web App | Key Vault | Secret retrieval |
| HTTPS | 443 | Web App | Azure OpenAI | AI model access |
| HTTPS | 443 | Web App | PostgreSQL (optional) | Database access (if using PGVector) |

### 4.2 Worker Application

| Protocol | Port | Source | Destination | Purpose |
|----------|------|--------|-------------|---------|
| HTTPS | 443 | Worker App | Azure Storage | Document processing |
| SSL | 6380 | Worker App | Redis Cache | Task queue access |
| HTTPS | 443 | Worker App | Key Vault | Secret retrieval |
| HTTPS | 443 | Worker App | Azure OpenAI | AI model access |
| HTTPS | 443 | Worker App | PostgreSQL (optional) | Vector database access (if using PGVector) |

## 5. Network Security Configuration

### 5.1 Virtual Network Integration

SmartLib supports VNet integration for enhanced security:

1. **Regional VNet Integration**
   - Web App Service → VNet
   - Worker App Service → VNet

2. **Private Endpoints**
   - Redis Cache → Private Endpoint
   - Azure Storage → Private Endpoint
   - Azure Database → Private Endpoint
   - Key Vault → Private Endpoint
   - Azure OpenAI → Private Endpoint

### 5.2 Network Security Groups (NSGs)

Recommended NSG configurations for VNet-integrated deployments:

1. **App Service Subnet NSG**
   - Allow outbound to Azure Storage, Redis, Key Vault, and Azure OpenAI
   - Allow outbound to Azure SQL/PostgreSQL
   - Deny all other outbound traffic

2. **Data Services Subnet NSG**
   - Allow inbound from App Service subnet
   - Deny all other inbound traffic
   - Deny all outbound traffic

### 5.3 Web Application Firewall (WAF)

When using Azure Front Door or Application Gateway:

1. **Recommended WAF Rules**
   - OWASP 3.2 ruleset (default)
   - Custom rules for specific application needs
   - Bot protection

2. **IP Restrictions**
   - Admin portal access restrictions
   - Geographic restrictions (if applicable)

## 6. Deployment Network Options

### 6.1 Public Deployment (Default)

The standard deployment uses public endpoints with security measures:

```
Internet → Web App (public) → Backend Services (public endpoints with access restrictions)
```

Security features:
- HTTPS enforcement
- IP restrictions for admin interface
- Managed identities for service authentication
- Key Vault for secret management

### 6.2 Private Deployment (Enhanced Security)

For enhanced security, deploy with VNet integration and private endpoints:

```
Internet → Application Gateway (WAF) → Web App (VNet integrated) → Backend Services (private endpoints)
```

Security features:
- All public deployment features
- VNet integration for all services
- Private endpoints for all backend services
- NSGs for traffic control
- WAF for enhanced protection

### 6.3 Hybrid Deployment (Balanced)

A balanced approach with public frontend and private backend:

```
Internet → Web App (public) → Backend Services (private endpoints)
```

Security features:
- Public frontend for user access
- VNet integration for backend connectivity
- Private endpoints for critical services
- Service endpoints for Azure services

## 7. Network Configuration Steps

### 7.1 VNet Integration Configuration

1. **Create Virtual Network**
   ```bash
   az network vnet create \
     --resource-group <resource-group-name> \
     --name smartlib-vnet \
     --address-prefix 10.0.0.0/16 \
     --subnet-name web-subnet \
     --subnet-prefix 10.0.0.0/24
   ```

2. **Create Backend Subnet**
   ```bash
   az network vnet subnet create \
     --resource-group <resource-group-name> \
     --vnet-name smartlib-vnet \
     --name backend-subnet \
     --address-prefix 10.0.1.0/24 \
     --service-endpoints Microsoft.Storage Microsoft.KeyVault Microsoft.AzureCosmosDB
   ```

3. **Enable VNet Integration for Web App**
   ```bash
   az webapp vnet-integration add \
     --resource-group <resource-group-name> \
     --name <web-app-name> \
     --vnet smartlib-vnet \
     --subnet web-subnet
   ```

4. **Enable VNet Integration for Worker App**
   ```bash
   az webapp vnet-integration add \
     --resource-group <resource-group-name> \
     --name <worker-app-name> \
     --vnet smartlib-vnet \
     --subnet web-subnet
   ```

### 7.2 Private Endpoint Configuration

1. **Create Private Endpoint for Redis Cache**
   ```bash
   az network private-endpoint create \
     --resource-group <resource-group-name> \
     --name redis-private-endpoint \
     --vnet-name smartlib-vnet \
     --subnet backend-subnet \
     --private-connection-resource-id <redis-resource-id> \
     --group-ids redisCache \
     --connection-name redis-connection
   ```

2. **Create Private Endpoint for Storage Account**
   ```bash
   az network private-endpoint create \
     --resource-group <resource-group-name> \
     --name storage-private-endpoint \
     --vnet-name smartlib-vnet \
     --subnet backend-subnet \
     --private-connection-resource-id <storage-resource-id> \
     --group-ids blob \
     --connection-name storage-connection
   ```

3. **Create Private Endpoint for Key Vault**
   ```bash
   az network private-endpoint create \
     --resource-group <resource-group-name> \
     --name kv-private-endpoint \
     --vnet-name smartlib-vnet \
     --subnet backend-subnet \
     --private-connection-resource-id <keyvault-resource-id> \
     --group-ids vault \
     --connection-name kv-connection
   ```

### 7.3 Private DNS Configuration

1. **Create Private DNS Zone for Redis**
   ```bash
   az network private-dns zone create \
     --resource-group <resource-group-name> \
     --name privatelink.redis.cache.windows.net
   ```

2. **Link Private DNS Zone to VNet**
   ```bash
   az network private-dns link vnet create \
     --resource-group <resource-group-name> \
     --zone-name privatelink.redis.cache.windows.net \
     --name redis-dns-link \
     --virtual-network smartlib-vnet \
     --registration-enabled false
   ```

3. **Create DNS Records for Private Endpoints**
   ```bash
   az network private-endpoint dns-zone-group create \
     --resource-group <resource-group-name> \
     --endpoint-name redis-private-endpoint \
     --name redis-dns-group \
     --private-dns-zone privatelink.redis.cache.windows.net \
     --zone-name redis
   ```

## 8. Network Performance Optimization

### 8.1 Azure Front Door Configuration

For global deployments, use Azure Front Door:

1. **Route Configuration**
   - Route traffic to the nearest point of presence
   - Health probes to detect backend issues
   - Configure caching for static assets

2. **Caching Policy**
   - Cache static assets (JS, CSS, images)
   - Configure cache TTL based on content type
   - Use cache purge for deployments

### 8.2 Content Delivery Network (CDN)

Optimize content delivery with Azure CDN:

1. **Static Content Caching**
   - Configure Azure CDN for static assets
   - Set appropriate cache-control headers
   - Use versioned URLs for cache busting

2. **Dynamic Content Acceleration**
   - Use dynamic site acceleration for API responses
   - Configure compression for text-based content
   - Optimize origin connection with persistent connections

### 8.3 Connection Optimization

Optimize connections between services:

1. **Redis Connection Pooling**
   - Configure appropriate connection pool size
   - Set connection timeouts and retry policies
   - Use persistent connections where possible

2. **Database Connection Management**
   - Configure connection pooling for databases
   - Set appropriate connection limits
   - Monitor and optimize query performance

## 9. Network Monitoring and Troubleshooting

### 9.1 Monitoring Configuration

1. **Azure Monitor**
   - Configure network metrics collection
   - Set up alerts for network performance issues
   - Create dashboards for network monitoring

2. **Application Insights**
   - Enable network dependency tracking
   - Monitor service-to-service communication
   - Track network-related exceptions

### 9.2 Network Diagnostics

1. **Network Watcher**
   - Enable Network Watcher for VNet
   - Use Connection Monitor for connectivity testing
   - Configure packet capture for advanced troubleshooting

2. **Application Logging**
   - Configure detailed network-related logging
   - Monitor connection errors and timeouts
   - Track performance metrics for network operations

### 9.3 Common Networking Issues

1. **Connectivity Issues**
   - Verify NSG rules and firewall settings
   - Check private endpoint configurations
   - Validate DNS resolution for private endpoints

2. **Performance Issues**
   - Monitor network latency between services
   - Check for connection limits or throttling
   - Analyze connection pooling efficiency

## 10. Network Security Best Practices

### 10.1 Encryption in Transit

All communication should be encrypted:

1. **HTTPS Enforcement**
   - Configure HTTPS-only for Web App
   - Use TLS 1.2+ for all communications
   - Implement HSTS for web traffic

2. **Service-to-Service Encryption**
   - Use SSL/TLS for Redis connections
   - Ensure HTTPS for all Azure service connections
   - Validate certificate validation is enabled

### 10.2 Network Isolation

Implement network isolation for critical components:

1. **Service Endpoints**
   - Enable service endpoints for Azure services
   - Restrict access to trusted networks only
   - Configure firewall rules for Azure services

2. **Subnet Isolation**
   - Separate subnets for different application tiers
   - Use NSGs to control traffic between subnets
   - Implement just-in-time access for administrative tasks

### 10.3 Network Security Monitoring

Implement security monitoring for network traffic:

1. **Azure Security Center**
   - Enable network recommendations
   - Monitor for suspicious connections
   - Track compliance with security policies

2. **Azure Sentinel**
   - Collect network flow logs
   - Configure alerts for suspicious patterns
   - Implement security automation for incidents

## 11. Multi-Region Deployment Considerations

### 11.1 Global Network Architecture

For multi-region deployments:

1. **Traffic Manager / Front Door**
   - Configure global routing policies
   - Set up health probes for each region
   - Implement failover strategies

2. **Region Connectivity**
   - Use Global VNet Peering for region connections
   - Implement cross-region replication for data
   - Configure consistent private DNS across regions

### 11.2 Disaster Recovery

Network considerations for disaster recovery:

1. **Network Failover**
   - Configure automatic failover for traffic routing
   - Test network path changes during failovers
   - Monitor DNS propagation during failover events

2. **Connection Resiliency**
   - Implement retry policies for all connections
   - Configure timeout settings appropriately
   - Use circuit breakers for degraded services

## 12. Conclusion

This network requirements document provides a comprehensive guide to configuring and optimizing the network architecture for SmartLib deployments on Azure. Following these guidelines will ensure secure, reliable, and efficient network communication for your application.

For deployment-specific networking requirements, refer to the deployment guide and ARM template documentation. Adjust the network configuration based on your security requirements, performance needs, and compliance considerations.
