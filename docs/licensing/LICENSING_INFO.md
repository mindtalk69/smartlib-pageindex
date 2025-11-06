# SmartLib Licensing Guidelines

This guide explains how SmartLib documents license obligations when shipping the
application to customers or partners.

## Overview

- SmartLib is distributed under the MIT License (`docs/licensing/LICENSE`).
- Third-party dependencies retain their original licenses; review
  `DEPENDENCIES_LICENSES.md` and `LICENSE_INVENTORY.csv` for the current list.
- PyMuPDF (AGPL-3.0) requires SmartLib to provide access to source code for any
  binaries that include its functionality. Publish source with every release.
- Azure Marketplace packages must reference the licensing disclosure at
  `AZURE_MARKETPLACE_OSS_DISCLOSURE.md`.

## Maintaining Compliance

1. **Update Inventory** – Whenever dependencies change, update both the Markdown
   and CSV inventory files and archive new license texts under
   `license_texts/`.
2. **Bundle Notices** – Include `NOTICE.txt`, the MIT License, and dependency
   inventory files in all distribution bundles (Docker images, virtual machine
   captures, install scripts, etc.).
3. **Key Vault References** – When the application accesses keys or credentials
   in Azure, ensure customers can examine the licensing docs before granting
   access to shared resources.
4. **Customer Documentation** – Link to `/static/docs/licensing/README.html` or
   similar resources from the SmartLib About page so operators can review
   licensing requirements post-deployment.

## Azure Marketplace Checklist

- Confirm Marketplace listing text references the MIT License and AGPL
  obligations.
- Provide download links for complete source packages when requested by
  customers in accordance with AGPL requirements.
- Store evidence of dependency evaluations in your compliance archive for at
  least the current and previous release cycles.

For questions, contact the SmartLib compliance team at `compliance@smartlib.ai`.
