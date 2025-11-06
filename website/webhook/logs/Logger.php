<?php
/**
 * Azure Marketplace Webhook Logger
 */

namespace SmartLib\Webhook;

class Logger {
    private $logPath;
    
    public function __construct($logPath) {
        $this->logPath = $logPath;
        
        // Create logs directory if it doesn't exist
        if (!file_exists($this->logPath)) {
            mkdir($this->logPath, 0755, true);
        }
    }
    
    public function info($message, $context = []) {
        $this->log('INFO', $message, $context);
    }
    
    public function error($message, $context = []) {
        $this->log('ERROR', $message, $context);
    }
    
    public function warning($message, $context = []) {
        $this->log('WARNING', $message, $context);
    }
    
    public function debug($message, $context = []) {
        $this->log('DEBUG', $message, $context);
    }
    
    private function log($level, $message, $context = []) {
        $timestamp = date('Y-m-d H:i:s');
        $logFile = $this->logPath . '/webhook_' . date('Y-m-d') . '.log';
        
        // Format context as JSON, but limit depth for large objects
        $contextString = empty($context) ? '' : ' ' . $this->formatContext($context);
        
        $logEntry = "[$timestamp] [$level] $message$contextString" . PHP_EOL;
        
        file_put_contents($logFile, $logEntry, FILE_APPEND);
        
        // If SmartLib has a central logging system, you could also log there
        // \SmartLib\Log::write($level, "Azure Webhook: $message", $context);
    }
    
    private function formatContext($context, $depth = 0) {
        // Prevent infinite recursion or huge logs
        if ($depth > 3) {
            return '"[nested data]"';
        }
        
        if (is_array($context)) {
            $output = [];
            foreach ($context as $key => $value) {
                if (is_array($value) || is_object($value)) {
                    $output[$key] = json_decode($this->formatContext($value, $depth + 1), true);
                } else {
                    $output[$key] = $value;
                }
            }
            return json_encode($output);
        } elseif (is_object($context)) {
            return json_encode(get_object_vars($context));
        } else {
            return json_encode($context);
        }
    }
}
?>
```

## Web Server Configuration

### Apache Configuration (.htaccess in webhook directory)
```
# Redirect all webhook requests to index.php
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule ^ index.php [QSA,L]
</IfModule>

# Security headers
<IfModule mod_headers.c>
    Header set X-Content-Type-Options "nosniff"
    Header set X-Frame-Options "DENY"
    Header set X-XSS-Protection "1; mode=block"
</IfModule>

# Prevent directory listing
Options -Indexes