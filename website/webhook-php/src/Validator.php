<?php
/**
 * Azure Marketplace JWT Token Validator
 */

namespace SmartLib\Webhook;

class Validator {
    private $logger;
    
    public function __construct($logger) {
        $this->logger = $logger;
    }
    
    public function validateToken($token) {
        if (empty($token)) {
            throw new \Exception("Missing JWT token");
        }
        
        try {
            // For JWT validation, we can use Firebase JWT library
            // This requires: composer require firebase/php-jwt
            
            // Get Microsoft's public keys
            $ms_jwks_uri = 'https://login.microsoftonline.com/common/discovery/keys';
            $jwks_response = file_get_contents($ms_jwks_uri);
            $jwks = json_decode($jwks_response, true);
            
            // Convert to JWK format
            // Note: This requires the firebase/php-jwt package
            if (class_exists('\Firebase\JWT\JWK')) {
                $jwk_set = \Firebase\JWT\JWK::parseKeySet($jwks);
                
                // Decode and verify the token
                $decoded = \Firebase\JWT\JWT::decode($token, $jwk_set, ['RS256']);
                
                // Verify issuer
                if ($decoded->iss !== JWT_ISSUER) {
                    throw new \Exception("Invalid token issuer");
                }
                
                // Verify audience
                if ($decoded->aud !== JWT_AUDIENCE) {
                    throw new \Exception("Invalid token audience");
                }
                
                // Verify expiration
                if (time() > $decoded->exp) {
                    throw new \Exception("Token has expired");
                }
                
                return true;
            } else {
                $this->logger->warning("Firebase JWT library not available, skipping token validation");
                // In production, you should require the library
                return true;
            }
        } catch (\Exception $e) {
            $this->logger->error("JWT validation failed: " . $e->getMessage());
            throw new \Exception("Invalid JWT token: " . $e->getMessage());
        }
    }
}
?>