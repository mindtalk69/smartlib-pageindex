<?php
/**
 * Azure Marketplace SaaS Webhook Handler
 * 
 * This file handles incoming webhook requests from Microsoft Azure Marketplace
 * for SaaS subscription lifecycle management.
 */

// Set response content type
header('Content-Type: application/json');

// Include the SmartLib autoloader if available, otherwise use direct requires
if (file_exists(__DIR__ . '/../autoload.php')) {
    require_once __DIR__ . '/../autoload.php';
} else {
    require_once __DIR__ . '/config.php';
    require_once __DIR__ . '/src/Validator.php';
    require_once __DIR__ . '/src/Processor.php';
    require_once __DIR__ . '/src/Logger.php';
}

// Initialize logger
$logger = new \SmartLib\Webhook\Logger(WEBHOOK_LOGS_PATH);

try {
    // Get request body
    $requestBody = file_get_contents('php://input');
    $payload = json_decode($requestBody, true);
    
    // Log incoming request
    $logger->info("Received webhook request", [
        'payload' => $payload,
        'headers' => getRequestHeaders()
    ]);
    
    // Validate request
    if (!$payload) {
        throw new Exception("Invalid JSON payload");
    }
    
    // Validate JWT token (in production)
    $headers = getRequestHeaders();
    $authHeader = isset($headers['Authorization']) ? $headers['Authorization'] : '';
    $token = '';
    
    if (preg_match('/Bearer\s(\S+)/', $authHeader, $matches)) {
        $token = $matches[1];
    }
    
    $validator = new \SmartLib\Webhook\Validator($logger);
    
    // In production, uncomment this:
    // $validator->validateToken($token);
    
    // Process webhook based on action
    $processor = new \SmartLib\Webhook\Processor($logger);
    $processor->processWebhook($payload);
    
    // Always respond with 200 OK
    respondSuccess();
    
} catch (Exception $e) {
    // Log the error but still return 200 OK
    $logger->error("Error processing webhook: " . $e->getMessage(), [
        'trace' => $e->getTraceAsString()
    ]);
    
    // Always respond with 200 OK, even on error
    respondSuccess();
}

// Helper functions
function getRequestHeaders() {
    $headers = [];
    foreach ($_SERVER as $key => $value) {
        if (substr($key, 0, 5) === 'HTTP_') {
            $headers[str_replace(' ', '-', ucwords(strtolower(str_replace('_', ' ', substr($key, 5)))))] = $value;
        }
    }
    return $headers;
}

function respondSuccess() {
    http_response_code(200);
    echo json_encode(['status' => 'received']);
    exit;
}
?>