<?php
/**
 * Azure Marketplace Webhook Action Processor
 */

namespace SmartLib\Webhook;

class Processor {
    private $logger;
    
    public function __construct($logger) {
        $this->logger = $logger;
    }
    
    public function processWebhook($payload) {
        // Extract action from payload
        $action = isset($payload['action']) ? $payload['action'] : null;
        $operationId = isset($payload['id']) ? $payload['id'] : null;
        
        if (!$action) {
            throw new \Exception("Missing 'action' in webhook payload");
        }
        
        $this->logger->info("Processing webhook action: $action", [
            'operationId' => $operationId
        ]);
        
        // Process based on action type
        switch ($action) {
            case 'ChangePlan':
                $this->handleChangePlan($payload);
                break;
                
            case 'ChangeQuantity':
                $this->handleChangeQuantity($payload);
                break;
                
            case 'Suspend':
                $this->handleSuspend($payload);
                break;
                
            case 'Unsubscribe':
                $this->handleUnsubscribe($payload);
                break;
                
            case 'Reinstate':
                $this->handleReinstate($payload);
                break;
                
            case 'Renew':
                $this->handleRenew($payload);
                break;
                
            default:
                $this->logger->warning("Unknown webhook action: $action");
                break;
        }
    }
    
    // For ChangePlan and ChangeQuantity, we need to make a PATCH request
    private function handleChangePlan($payload) {
        $this->processPatchRequest($payload);
    }
    
    private function handleChangeQuantity($payload) {
        $this->processPatchRequest($payload);
    }
    
    private function handleSuspend($payload) {
        // Update your database/system to mark subscription as suspended
        $subscriptionId = isset($payload['subscriptionId']) ? $payload['subscriptionId'] : null;
        $this->logger->info("Suspending subscription", ['subscriptionId' => $subscriptionId]);
        
        // Implement your suspension logic here
        // e.g., $this->updateSubscriptionStatus($subscriptionId, 'suspended');
    }
    
    private function handleUnsubscribe($payload) {
        // Update your database/system to mark subscription as terminated
        $subscriptionId = isset($payload['subscriptionId']) ? $payload['subscriptionId'] : null;
        $this->logger->info("Unsubscribing subscription", ['subscriptionId' => $subscriptionId]);
        
        // Implement your unsubscribe logic here
        // e.g., $this->updateSubscriptionStatus($subscriptionId, 'terminated');
    }
    
    private function handleReinstate($payload) {
        // Update your database/system to mark subscription as active
        $subscriptionId = isset($payload['subscriptionId']) ? $payload['subscriptionId'] : null;
        $this->logger->info("Reinstating subscription", ['subscriptionId' => $subscriptionId]);
        
        // Implement your reinstate logic here
        // e.g., $this->updateSubscriptionStatus($subscriptionId, 'active');
    }
    
    private function handleRenew($payload) {
        // Update your database/system to reflect subscription renewal
        $subscriptionId = isset($payload['subscriptionId']) ? $payload['subscriptionId'] : null;
        $this->logger->info("Renewing subscription", ['subscriptionId' => $subscriptionId]);
        
        // Implement your renewal logic here
        // e.g., $this->updateSubscriptionRenewalDate($subscriptionId);
    }
    
    private function processPatchRequest($payload) {
        $operationId = isset($payload['id']) ? $payload['id'] : null;
        
        if (!$operationId) {
            throw new \Exception("Missing operation ID in payload");
        }
        
        // Make an asynchronous PATCH request to Microsoft API
        // We use a non-blocking approach to ensure quick webhook response
        $this->makeNonBlockingPatchRequest($operationId);
        
        $this->logger->info("Initiated PATCH request for operation", [
            'operationId' => $operationId,
            'action' => $payload['action']
        ]);
    }
    
    private function makeNonBlockingPatchRequest($operationId) {
        // Get access token for Microsoft API
        $accessToken = $this->getAccessToken();
        
        // Create patch request data
        $url = MS_API_BASE_URL . 'operations/' . $operationId . '?api-version=' . MS_API_VERSION;
        $data = json_encode(['status' => 'Success']);
        
        // Prepare curl request
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PATCH');
        curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, [
            'Content-Type: application/json',
            'Content-Length: ' . strlen($data),
            'Authorization: Bearer ' . $accessToken
        ]);
        
        // Execute request
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        // Log the result
        $this->logger->info("PATCH request completed", [
            'operationId' => $operationId,
            'httpCode' => $httpCode,
            'response' => $response
        ]);
        
        return $httpCode >= 200 && $httpCode < 300;
    }
    
    private function getAccessToken() {
        // Implement Microsoft API authentication here
        $tokenEndpoint = 'https://login.microsoftonline.com/' . MS_TENANT_ID . '/oauth2/token';
        
        $postData = [
            'grant_type' => 'client_credentials',
            'client_id' => MS_CLIENT_ID,
            'client_secret' => MS_CLIENT_SECRET,
            'resource' => 'https://marketplaceapi.microsoft.com'
        ];
        
        $ch = curl_init($tokenEndpoint);
        curl_setopt($ch, CURLOPT_POST, 1);
        curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($postData));
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        
        $response = curl_exec($ch);
        curl_close($ch);
        
        $tokenData = json_decode($response, true);
        
        if (isset($tokenData['access_token'])) {
            return $tokenData['access_token'];
        } else {
            $this->logger->error("Failed to get access token", [
                'response' => $tokenData
            ]);
            throw new \Exception("Failed to get access token");
        }
    }
    
    // Additional helper methods for database integration with SmartLib
    private function updateSubscriptionStatus($subscriptionId, $status) {
        // Implement based on your SmartLib database structure
        // Example:
        // $db = \SmartLib\Database::getInstance();
        // $db->query("UPDATE subscriptions SET status = ? WHERE subscription_id = ?", [$status, $subscriptionId]);
    }
}
?>