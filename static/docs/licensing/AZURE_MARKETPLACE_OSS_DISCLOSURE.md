# Azure Marketplace Open-Source Disclosure

SmartLib packages published to the Azure Marketplace include the following open-
source components. This disclosure satisfies the marketplace certification
requirements and should be referenced in the offer description and supporting
materials.

## SmartLib License

- **License**: MIT
- **Repository**: https://github.com/smartlib-ai/smartlib (example; update with
  live repository URL)

## Key Third-Party Components

| Component | License | Notes |
|-----------|---------|-------|
| PyMuPDF | AGPL-3.0 | Source code for SmartLib releases is provided to satisfy AGPL.
| Docling | Apache-2.0 | Document conversion pipeline. |
| LangChain / LangGraph | MIT | Retrieval-augmented generation orchestration. |
| ChromaDB | Apache-2.0 | Vector database storing embeddings. |
| Torch | BSD-3-Clause | Machine learning runtime used by the worker tier. |
| Azure SDKs | MIT | Azure Document Intelligence, Identity, and storage libraries. |

## Customer Access to Source

Customers can obtain the SmartLib source package through the following channels:

1. Git repository URL listed in the offer collateral.
2. Direct request to SmartLib support at `support@smartlib.ai`.
3. Automated download link included in deployment documentation.

## Compliance Checklist

- [x] Include `NOTICE.txt` and license inventory files in deployment artifacts.
- [x] Publish the full SmartLib source tree for every Marketplace build.
- [x] Document licensing obligations in the customer onboarding guide.
- [x] Provide instructions for requesting updated inventories when releases
      change dependency lists.
