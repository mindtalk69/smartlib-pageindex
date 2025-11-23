# OCR Configuration Options in SmartLib

## Overview

SmartLib provides flexible Optical Character Recognition (OCR) capabilities for extracting text from images and PDF documents. Administrators can choose between two OCR processing options:

1. **Local OCR Processing** - Built-in OCR functionality that runs within the application
2. **Azure Document Intelligence** - Cloud-based OCR using Azure's advanced document processing service

## Deployment Configuration

### ARM Template Parameters

When deploying SmartLib through the Azure Marketplace, the following parameters configure Azure Document Intelligence:

| Parameter | Description | Example |
|-----------|-------------|---------|
| docIntelligenceEndpoint | Azure Document Intelligence endpoint URL | https://your-resource.cognitiveservices.azure.com/ |
| docIntelligenceKeySecretUri | Key Vault secret URI containing the API key | https://your-keyvault.vault.azure.net/secrets/doc-intelligence-key |

These parameters are securely stored as environment variables:
- `DOC_INTELLIGENCE_ENDPOINT`: Directly from the parameter
- `DOC_INTELLIGENCE_KEY`: Referenced from Key Vault using the Key Vault References feature

### Pre-Deployment Requirements

Before deploying SmartLib with Azure Document Intelligence:

1. Create an Azure Document Intelligence resource in your subscription
2. Store the API key in your Azure Key Vault
3. Ensure your Key Vault is properly configured for access by the SmartLib application
4. Include the required parameters in your ARM template deployment

## Technical Implementation

### Local OCR Engine

**Technology Stack:**
- Built on Tesseract OCR 5.3.0 with LSTM neural networks
- Python bindings via pytesseract
- Image preprocessing via OpenCV
- PDF extraction via PyMuPDF
- Optimized for CPU-based processing in worker container

**Processing Pipeline:**
1. Document splitting (PDF) or direct processing (images)
2. Image preprocessing (deskewing, contrast enhancement, noise reduction)
3. OCR processing with language-specific models
4. Text extraction and post-processing
5. Result normalization and storage

**Resource Requirements:**
- Memory: 500MB-2GB depending on document complexity
- CPU: Single-threaded processing, one document at a time
- Storage: Temporary processing space in `/home/data/tmp_uploads`
- Worker container handles all processing

### Azure Document Intelligence

**Technology Stack:**
- Microsoft's AI-powered document understanding service
- REST API integration via Azure SDK for Python
- Cloud-based neural network processing
- Support for multiple document processing models

**Processing Pipeline:**
1. Document preprocessing in worker container
2. Secure transmission to Azure Document Intelligence service
3. Cloud-based advanced AI processing
4. JSON response with extracted content, layout, and metadata
5. Response processing and integration with SmartLib's vector storage

**Resource Requirements:**
- API access to Azure Document Intelligence service
- Network connectivity to Azure
- Minimal worker container resources (primarily for pre/post processing)
- Azure Document Intelligence capacity based on usage tier

## Feature Comparison Matrix

| Capability | Local OCR | Azure Document Intelligence |
|------------|-----------|---------------------------|
| **Text Extraction** | |
| Basic text recognition | ✓ | ✓ |
| Handwriting recognition | Limited | ✓ |
| Low-quality document handling | Limited | ✓ |
| Multiple languages per page | × | ✓ |
| Confidence scores per word | Limited | ✓ |
| **Layout Understanding** | |
| Paragraph detection | Basic | Advanced |
| Reading order preservation | Limited | ✓ |
| Multi-column detection | Basic | Advanced |
| Headings/titles detection | × | ✓ |
| Page numbers detection | × | ✓ |
| **Table Extraction** | |
| Basic table detection | Limited | ✓ |
| Complex table structures | × | ✓ |
| Merged cells support | × | ✓ |
| Table to structured data | × | ✓ |

## Administrator Configuration

After deployment, administrators can configure OCR settings:

1. Navigate to **Admin > OCR**
2. Choose between:
   - **Local OCR**: Uses the built-in OCR capabilities
   - **Azure Document Intelligence**: Uses the configured Azure service

## Performance Considerations

### Local OCR Performance Metrics

- Processing time: ~5-30 seconds per page (depends on complexity)
- CPU utilization: 80-100% of one core during processing
- Memory usage: 500MB-2GB during processing
- Throughput: 2-12 pages per minute per worker

### Azure Document Intelligence Performance Metrics

- Processing time: ~1-5 seconds per page
- Worker CPU utilization: 10-30% during preprocessing/postprocessing
- Memory usage: 100-500MB during processing
- Throughput: 20-60 pages per minute (limited by API quota)

## Recommended Usage

- **Local OCR**: Suitable for basic document processing, development, and testing environments
- **Azure Document Intelligence**: Recommended for production environments with complex document processing needs

## Security Considerations

- The Azure Document Intelligence API key is stored securely in Azure Key Vault
- The application uses managed identity to access Key Vault secrets
- Document processing in Azure Document Intelligence follows Azure's security and compliance standards

# DISCLAIMER

## Terms of Use

The documentation is provided "as-is" without warranties of any kind, express or implied, and users access and use the information at their own risk.

## Copyright Notices

All products, services, technologies, software, frameworks, libraries, tools, platforms, and trademarks mentioned throughout this documentation are the exclusive property of their respective owners, holders, and copyright claimants, and no ownership or affiliation is claimed or implied by this documentation.

## Patent Information

Mentioned products and technologies may be protected by patents, pending patents, trademarks, trade secrets, or other intellectual property rights held by their respective owners.

## Copyright Usage Guidelines

Any references to third-party products, services, or technologies are made for informational and educational purposes only, and users must obtain proper licenses, permissions, or authorizations directly from the rights holders before using any copyrighted materials, proprietary software, or protected technologies.

## Pricing and Cost Information

Any pricing information, cost estimates, subscription fees, or financial figures mentioned in this documentation may be inaccurate, outdated, or subject to change without notice, and users must verify current pricing directly with the official vendors, service providers, or product websites before making any purchasing decisions or financial commitments.

## Verification Requirements

Readers must visit the official websites, documentation repositories, legal pages, and licensing portals of each mentioned product, service, or technology to obtain accurate, current, and authoritative information regarding copyright details, licensing terms, patent information, usage restrictions, pricing structures, terms of service, privacy policies, and any other legal requirements specific to those products or services.

## User Responsibility

The content provided is for informational, educational, and reference purposes only, and users bear sole responsibility for independently verifying all information, conducting due diligence, ensuring compliance with all applicable intellectual property rights, adhering to terms of service, respecting licensing agreements, observing usage restrictions, and meeting all legal, regulatory, and contractual requirements associated with any third-party products, services, technologies, or materials referenced in or accessed through this documentation.
