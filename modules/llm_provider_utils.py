"""
Provider Testing and Model Discovery Functions

These functions support the admin provider management interface.
"""
import requests
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


def test_provider_connection(provider):
    """
    Test connectivity to an LLM provider and return health status.
    
    Args:
        provider: LLMProvider model instance
        
    Returns:
        dict with keys: status ('healthy', 'degraded', 'offline'), error (optional), models (optional)
    """
    try:
        if provider.provider_type == 'ollama':
            return test_ollama_connection(provider)
        elif provider.provider_type == 'azure_openai':
            return test_azure_openai_connection(provider)
        elif provider.provider_type == 'openai':
            return test_openai_connection(provider)
        else:
            return {
                'status': 'unknown',
                'error': f'Unknown provider type: {provider.provider_type}'
            }
    except Exception as e:
        logger.error(f"Error testing provider {provider.name}: {e}", exc_info=True)
        return {
            'status': 'offline',
            'error': str(e)
        }


def test_ollama_connection(provider):
    """Test Ollama provider connectivity"""
    try:
        base_url = provider.base_url or 'http://localhost:11434'
        
        # Test /api/tags endpoint to list models
        response = requests.get(f"{base_url}/api/tags", timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            models = data.get('models', [])
            
            return {
                'status': 'healthy',
                'models': [m.get('name') for m in models],
                'model_count': len(models),
                'message': f'Connected successfully. {len(models)} models available.'
            }
        else:
            return {
                'status': 'degraded',
                'error': f'HTTP {response.status_code}: {response.text}'
            }
            
    except requests.exceptions.Timeout:
        return {
            'status': 'offline',
            'error': 'Connection timeout. Is Ollama running?'
        }
    except requests.exceptions.ConnectionError:
        return {
            'status': 'offline',
            'error': f'Cannot connect to {base_url}. Is Ollama running?'
        }
    except Exception as e:
        return {
            'status': 'offline',
            'error': str(e)
        }


def test_azure_openai_connection(provider):
    """Test Azure OpenAI provider connectivity"""
    try:
        from langchain_openai import AzureChatOpenAI
        
        if not provider.api_key or not provider.base_url:
            return {
                'status': 'offline',
                'error': 'Missing API key or endpoint'
            }
        
        config = provider.config or {}
        
        # Determine test deployment
        test_deployment = config.get('test_deployment')
        if not test_deployment:
            # Try to grab a deployment name from an existing model
            first_model = provider.models.filter_by(provider='azure_openai').first() if hasattr(provider, 'models') else None
            if first_model and first_model.deployment_name:
                test_deployment = first_model.deployment_name
            else:
                test_deployment = 'gpt-4o-mini'

        api_version = config.get('api_version', '2024-02-15-preview')

        # Try to initialize a simple client
        # Azure OpenAI endpoint format: https://{resource-name}.openai.azure.com/
        llm = AzureChatOpenAI(
            azure_endpoint=provider.base_url,
            api_key=provider.api_key,
            api_version=api_version,
            azure_deployment=test_deployment,
            temperature=0.1,
            max_retries=1,
            timeout=10
        )
        
        # Test with a simple prompt
        response = llm.invoke("Say 'OK'")
        
        if response and hasattr(response, 'content'):
            return {
                'status': 'healthy',
                'message': 'Connected successfully',
                'test_response': response.content[:100]
            }
        else:
            return {
                'status': 'degraded',
                'error': 'Unexpected response format'
            }
            
    except Exception as e:
        error_msg = str(e)
        if 'authentication' in error_msg.lower() or 'unauthorized' in error_msg.lower():
            return {
                'status': 'offline',
                'error': 'Authentication failed. Check API key.'
            }
        elif 'not found' in error_msg.lower() or '404' in error_msg:
            return {
                'status': 'offline',
                'error': f"Deployment '{test_deployment}' not found. Please provide a valid 'test_deployment' in the provider config, or add a model first."
            }
        else:
            return {
                'status': 'offline',
                'error': error_msg
            }


def test_openai_connection(provider):
    """Test OpenAI provider connectivity"""
    try:
        from langchain_openai import ChatOpenAI
        
        if not provider.api_key:
            return {
                'status': 'offline',
                'error': 'Missing API key'
            }
        
        # Initialize OpenAI client
        llm = ChatOpenAI(
            api_key=provider.api_key,
            model=provider.config.get('model', 'gpt-3.5-turbo'),
            temperature=0.1,
            max_retries=1,
            timeout=10
        )
        
        # Test with a simple prompt
        response = llm.invoke("Say 'OK'")
        
        if response and hasattr(response, 'content'):
            return {
                'status': 'healthy',
                'message': 'Connected successfully',
                'test_response': response.content[:100]
            }
        else:
            return {
                'status': 'degraded',
                'error': 'Unexpected response format'
            }
            
    except Exception as e:
        error_msg = str(e)
        if 'authentication' in error_msg.lower() or 'unauthorized' in error_msg.lower():
            return {
                'status': 'offline',
                'error': 'Authentication failed. Check API key.'
            }
        else:
            return {
                'status': 'offline',
                'error': error_msg
            }


def discover_provider_models(provider):
    """
    Discover available models from a provider.
    
    Args:
        provider: LLMProvider model instance
        
    Returns:
        list of dicts with model information
    """
    try:
        if provider.provider_type == 'ollama':
            return discover_ollama_models(provider)
        elif provider.provider_type == 'azure_openai':
            return discover_azure_openai_models(provider)
        elif provider.provider_type == 'openai':
            return discover_openai_models(provider)
        else:
            raise ValueError(f'Model discovery not supported for provider type: {provider.provider_type}')
    except Exception as e:
        logger.error(f"Error discovering models for provider {provider.name}: {e}", exc_info=True)
        raise


def discover_ollama_models(provider):
    """Discover models from Ollama"""
    try:
        base_url = provider.base_url or 'http://localhost:11434'
        
        response = requests.get(f"{base_url}/api/tags", timeout=10)
        response.raise_for_status()
        
        data = response.json()
        models = data.get('models', [])
        
        result = []
        for model in models:
            result.append({
                'name': model.get('name'),
                'size': model.get('size'),
                'modified_at': model.get('modified_at'),
                'family': model.get('details', {}).get('family'),
                'parameter_size': model.get('details', {}).get('parameter_size'),
                'format': model.get('details', {}).get('format')
            })
        
        return result
        
    except Exception as e:
        logger.error(f"Error discovering Ollama models: {e}", exc_info=True)
        raise


def discover_azure_openai_models(provider):
    """
    Discover models from Azure OpenAI.
    
    Note: Azure OpenAI doesn't have a direct API to list deployments.
    This returns a list of common models that can be manually configured.
    """
    # Azure OpenAI requires manual configuration of deployments
    # Return common model families for reference
    return [
        {
            'name': 'gpt-4o',
            'family': 'gpt-4o',
            'description': 'GPT-4 Omni - Multimodal model',
            'note': 'Requires manual deployment configuration in Azure'
        },
        {
            'name': 'gpt-4o-mini',
            'family': 'gpt-4o',
            'description': 'GPT-4 Omni Mini - Cost-effective multimodal model',
            'note': 'Requires manual deployment configuration in Azure'
        },
        {
            'name': 'gpt-4',
            'family': 'gpt-4',
            'description': 'GPT-4 - Advanced language model',
            'note': 'Requires manual deployment configuration in Azure'
        },
        {
            'name': 'gpt-35-turbo',
            'family': 'gpt-3.5',
            'description': 'GPT-3.5 Turbo - Fast and efficient',
            'note': 'Requires manual deployment configuration in Azure'
        }
    ]


def discover_openai_models(provider):
    """Discover models from OpenAI"""
    try:
        import openai
        
        if not provider.api_key:
            raise ValueError('API key required for OpenAI model discovery')
        
        client = openai.OpenAI(api_key=provider.api_key)
        
        # List available models
        models = client.models.list()
        
        result = []
        for model in models.data:
            # Filter for chat models
            if 'gpt' in model.id.lower():
                result.append({
                    'name': model.id,
                    'created': model.created,
                    'owned_by': model.owned_by
                })
        
        return result
        
    except Exception as e:
        logger.error(f"Error discovering OpenAI models: {e}", exc_info=True)
        raise
