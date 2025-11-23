# Azure Marketplace ARM Template Package

This directory contains the ARM templates for deploying SmartLib to Azure Marketplace.

## Files

- **createUiDefinition.json** - Azure Portal UI definition for the deployment experience
- **mainTemplate.json** - ARM template for Azure resource deployment
- **package-for-azure.sh** - Script to create a clean ZIP package for Azure Marketplace

## Packaging for Azure Marketplace

**IMPORTANT**: Do NOT use macOS Finder or Windows Explorer to create ZIP files, as they add hidden metadata files (`__MACOSX/._*`, `.DS_Store`) that cause Azure Marketplace validation to fail with:

```
InvalidTemplate The template '__MACOSX/._createUiDefinition.json' is not a valid json file
```

### Creating the Package

Use the provided script to create a clean package:

```bash
cd ARMtemplate/catalog
./package-for-azure.sh
```

This will create `smartlib-arm-template.zip` containing only:
- createUiDefinition.json
- mainTemplate.json

### Using the Package

1. Upload `smartlib-arm-template.zip` to Azure Marketplace Partner Center
2. The package will pass validation without metadata file errors

### Manual Packaging (Alternative)

If you need to create the package manually:

```bash
cd ARMtemplate/catalog
zip -r -X smartlib-arm-template.zip \
    createUiDefinition.json \
    mainTemplate.json \
    -x "*.DS_Store" \
    -x "__MACOSX/*"
```

The `-X` flag excludes extended attributes (macOS metadata).

## Verification

To verify the package contents:

```bash
unzip -l smartlib-arm-template.zip
```

You should see only these two files:
- createUiDefinition.json
- mainTemplate.json

No `__MACOSX` or `.DS_Store` files should be present.