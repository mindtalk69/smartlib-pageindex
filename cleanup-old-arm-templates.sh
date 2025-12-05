#!/bin/bash
set -e

echo "🗑️  Cleaning up old ARM templates and documentation..."
echo ""

# Backup first (optional)
echo "Creating backup..."
mkdir -p /tmp/smartlib-arm-backup
cp -r /home/mlk/smartlib/ARMtemplate /tmp/smartlib-arm-backup/

echo "✅ Backup created at: /tmp/smartlib-arm-backup/"
echo ""

# Remove old ARM templates from root
echo "Removing old ARM templates..."
rm -f /home/mlk/smartlib/ARMtemplate/celery_worker_appservice.json
rm -f /home/mlk/smartlib/ARMtemplate/flask_appservice_template.json
rm -f /home/mlk/smartlib/ARMtemplate/flask_appservice_template_conditional_kv.json
rm -f /home/mlk/smartlib/ARMtemplate/flask_appservice_template_shared_plan.json
rm -f /home/mlk/smartlib/ARMtemplate/parameters.json

# Remove backup/old files from catalog
echo "Removing backup files..."
rm -f /home/mlk/smartlib/ARMtemplate/catalog/createUiDefinition.json.backup-resource-selector
rm -f /home/mlk/smartlib/ARMtemplate/catalog/identityStep_updated.json

# Remove outdated documentation
echo "Removing outdated documentation..."
rm -f /home/mlk/smartlib/ARMtemplate/docs/BUGS_*.md
rm -f /home/mlk/smartlib/ARMtemplate/docs/DEPLOYMENT_ERROR_FIX_*.md
rm -f /home/mlk/smartlib/ARMtemplate/docs/KEYVAULT_*.md
rm -f /home/mlk/smartlib/ARMtemplate/docs/RESOURCE_SELECTOR_UPGRADE.md
rm -f /home/mlk/smartlib/ARMtemplate/docs/STORAGE_KEYVAULT_IDENTITY_FIX_*.md
rm -f /home/mlk/smartlib/ARMtemplate/docs/VALIDATION_*.md
rm -f /home/mlk/smartlib/ARMtemplate/docs/EXECUTIVE_SUMMARY.md
rm -f /home/mlk/smartlib/ARMtemplate/docs/REDIS_AUTHORIZATION_FIX.md
rm -f /home/mlk/smartlib/ARMtemplate/docs/HYBRID_VALIDATION_*.md
rm -f /home/mlk/smartlib/ARMtemplate/docs/EXISTING_RESOURCE_VALIDATION_GUIDE.md
rm -f /home/mlk/smartlib/ARMtemplate/docs/CRITICAL_BUGS_ANALYSIS.md
rm -f /home/mlk/smartlib/ARMtemplate/docs/KEY_VAULT_BOOTSTRAP_PLAN.md
rm -f /home/mlk/smartlib/ARMtemplate/docs/MARKETPLACE_DEPLOYMENT_FIX_SUMMARY.md
rm -f /home/mlk/smartlib/ARMtemplate/docs/STORAGE_MOUNT_VERIFICATION_TROUBLESHOOTING_GUIDE.md
rm -f /home/mlk/smartlib/ARMtemplate/docs/DOCKER_SPLIT_OPTIMIZATION.md

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "📋 Remaining files:"
echo ""
echo "ARM Templates:"
ls -lh /home/mlk/smartlib/ARMtemplate/catalog/*.json 2>/dev/null | grep -v "test-deployment"
echo ""
echo "Documentation:"
ls -lh /home/mlk/smartlib/ARMtemplate/docs/*.md
echo ""
echo "Backup location: /tmp/smartlib-arm-backup/"
