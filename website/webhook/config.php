<?php
/**
 * Azure Marketplace Webhook Configuration
 */

namespace SmartLib\Webhook;

// Base paths
define('WEBHOOK_BASE_PATH', __DIR__);
define('WEBHOOK_LOGS_PATH', WEBHOOK_BASE_PATH . '/logs');

// Microsoft API configuration
define('MS_API_BASE_URL', 'https://marketplaceapi.microsoft.com/api/saas/subscriptions/');
define('MS_API_VERSION', '2018-08-31');

// Your SaaS application configuration
define('PUBLISHER_ID', 'your-publisher-id');
define('OFFER_ID', 'your-offer-id');

// JWT validation configuration
define('JWT_ISSUER', 'https://sts.windows.net/common/');
define('JWT_AUDIENCE', 'your-audience-id'); // Usually your app ID

// Microsoft API credentials (store securely in production)
define('MS_CLIENT_ID', 'your-client-id');
define('MS_CLIENT_SECRET', 'your-client-secret');
define('MS_TENANT_ID', 'your-tenant-id');

// Database connection (if using SmartLib's database)
// define('USE_SMARTLIB_DB', true);
?>