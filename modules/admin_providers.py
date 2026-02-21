"""
Admin Provider Management Blueprint

Provides routes for managing LLM providers in the admin panel.
"""
from flask import Blueprint, render_template, request, jsonify, redirect, url_for, flash
from flask_login import login_required, current_user
from extensions import db
from modules.database import LLMProvider, ModelConfig
import logging
import json
from datetime import datetime

admin_providers_bp = Blueprint('admin_providers', __name__, url_prefix='/admin/providers')

logger = logging.getLogger(__name__)


def admin_required(f):
    """Decorator to require admin access"""
    @login_required
    def decorated_function(*args, **kwargs):
        if not current_user.is_admin:
            flash('Admin access required', 'danger')
            return redirect(url_for('index'))
        return f(*args, **kwargs)
    decorated_function.__name__ = f.__name__
    return decorated_function


@admin_providers_bp.route('/', methods=['GET'])
@admin_required
def list_providers():
    """List all LLM providers"""
    try:
        providers = LLMProvider.query.order_by(LLMProvider.priority, LLMProvider.name).all()
        return render_template('admin/providers/list.html', providers=providers)
    except Exception as e:
        logger.error(f"Error loading providers: {e}", exc_info=True)
        flash('Error loading providers', 'danger')
        return render_template('admin/providers/list.html', providers=[])


@admin_providers_bp.route('/api/providers', methods=['GET'])
@admin_required
def api_list_providers():
    """API endpoint to list all providers (JSON)"""
    try:
        providers = LLMProvider.query.order_by(LLMProvider.priority, LLMProvider.name).all()
        return jsonify({'providers': [p.to_dict() for p in providers]})
    except Exception as e:
        logger.error(f"Error fetching providers: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@admin_providers_bp.route('/add', methods=['GET', 'POST'])
@admin_required
def add_provider():
    """Add a new provider"""
    if request.method == 'GET':
        return render_template('admin/providers/add.html')
    
    try:
        data = request.form if request.form else request.get_json()
        
        # Validate required fields
        name = data.get('name', '').strip()
        provider_type = data.get('provider_type', '').strip()
        
        if not name or not provider_type:
            logger.error(f"Add provider failed: Missing name or provider type. Data: {data}")
            if request.is_json:
                return jsonify({'error': 'Name and provider type are required'}), 400
            flash('Name and provider type are required', 'danger')
            return redirect(url_for('admin_providers.add_provider'))
        
        # Check for duplicate name
        existing = LLMProvider.query.filter_by(name=name).first()
        if existing:
            logger.error(f"Add provider failed: Provider with name {name} already exists.")
            if request.is_json:
                return jsonify({'error': f'Provider with name "{name}" already exists'}), 400
            flash(f'Provider with name "{name}" already exists', 'danger')
            return redirect(url_for('admin_providers.add_provider'))
        
        # Parse config JSON if provided
        config = {}
        if data.get('config'):
            try:
                config = json.loads(data.get('config'))
            except json.JSONDecodeError as jde:
                logger.error(f"Add provider failed: Invalid JSON. Error: {jde}")
                if request.is_json:
                    return jsonify({'error': 'Invalid JSON in config field'}), 400
                flash('Invalid JSON in config field', 'danger')
                return redirect(url_for('admin_providers.add_provider'))
        
        # Create new provider
        provider = LLMProvider(
            name=name,
            provider_type=provider_type,
            base_url=data.get('base_url', '').strip() or None,
            api_key=data.get('api_key', '').strip() or None,
            is_active=data.get('is_active', 'true').lower() == 'true',
            priority=int(data.get('priority', 0)),
            config=config
        )
        
        db.session.add(provider)
        db.session.commit()
        
        logger.info(f"Created provider: {name} (ID: {provider.id})")
        
        if request.is_json:
            return jsonify({'success': True, 'provider': provider.to_dict()}), 201
        
        flash(f'Provider "{name}" created successfully', 'success')
        return redirect(url_for('admin_providers.list_providers'))
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error creating provider: {e}", exc_info=True)
        if request.is_json:
            return jsonify({'error': str(e)}), 500
        flash(f'Error creating provider: {str(e)}', 'danger')
        return redirect(url_for('admin_providers.add_provider'))


@admin_providers_bp.route('/<int:provider_id>/edit', methods=['GET', 'POST'])
@admin_required
def edit_provider(provider_id):
    """Edit an existing provider"""
    provider = LLMProvider.query.get_or_404(provider_id)
    
    if request.method == 'GET':
        return render_template('admin/providers/edit.html', provider=provider)
    
    try:
        data = request.form if request.form else request.get_json()
        
        # Update fields
        if 'name' in data:
            new_name = data['name'].strip()
            if new_name != provider.name:
                # Check for duplicate
                existing = LLMProvider.query.filter_by(name=new_name).first()
                if existing:
                    if request.is_json:
                        return jsonify({'error': f'Provider with name "{new_name}" already exists'}), 400
                    flash(f'Provider with name "{new_name}" already exists', 'danger')
                    return redirect(url_for('admin_providers.edit_provider', provider_id=provider_id))
                provider.name = new_name
        
        if 'provider_type' in data:
            provider.provider_type = data['provider_type'].strip()
        
        if 'base_url' in data:
            provider.base_url = data['base_url'].strip() or None
        
        if 'api_key' in data:
            api_key = data['api_key'].strip()
            if api_key:  # Only update if not empty
                provider.api_key = api_key
        
        if 'is_active' in data:
            provider.is_active = data['is_active'].lower() == 'true' if isinstance(data['is_active'], str) else bool(data['is_active'])
        
        if 'priority' in data:
            provider.priority = int(data['priority'])
        
        if 'config' in data and data['config']:
            try:
                provider.config = json.loads(data['config']) if isinstance(data['config'], str) else data['config']
            except json.JSONDecodeError:
                if request.is_json:
                    return jsonify({'error': 'Invalid JSON in config field'}), 400
                flash('Invalid JSON in config field', 'danger')
                return redirect(url_for('admin_providers.edit_provider', provider_id=provider_id))
        
        provider.updated_at = datetime.utcnow()
        db.session.commit()
        
        logger.info(f"Updated provider: {provider.name} (ID: {provider_id})")
        
        if request.is_json:
            return jsonify({'success': True, 'provider': provider.to_dict()})
        
        flash(f'Provider "{provider.name}" updated successfully', 'success')
        return redirect(url_for('admin_providers.list_providers'))
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating provider {provider_id}: {e}", exc_info=True)
        if request.is_json:
            return jsonify({'error': str(e)}), 500
        flash(f'Error updating provider: {str(e)}', 'danger')
        return redirect(url_for('admin_providers.edit_provider', provider_id=provider_id))


@admin_providers_bp.route('/<int:provider_id>/delete', methods=['POST', 'DELETE'])
@admin_required
def delete_provider(provider_id):
    """Delete a provider"""
    try:
        provider = LLMProvider.query.get_or_404(provider_id)
        
        # Check if provider has associated models
        model_count = provider.models.count()
        if model_count > 0:
            error_msg = f'Cannot delete provider: {model_count} associated models exist'
            if request.is_json:
                return jsonify({'error': error_msg}), 400
            flash(error_msg, 'danger')
            return redirect(url_for('admin_providers.list_providers'))
        
        name = provider.name
        db.session.delete(provider)
        db.session.commit()
        
        logger.info(f"Deleted provider: {name} (ID: {provider_id})")
        
        if request.is_json:
            return jsonify({'success': True, 'message': f'Provider "{name}" deleted'})
        
        flash(f'Provider "{name}" deleted successfully', 'success')
        return redirect(url_for('admin_providers.list_providers'))
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error deleting provider {provider_id}: {e}", exc_info=True)
        if request.is_json:
            return jsonify({'error': str(e)}), 500
        flash(f'Error deleting provider: {str(e)}', 'danger')
        return redirect(url_for('admin_providers.list_providers'))


@admin_providers_bp.route('/<int:provider_id>/test', methods=['POST'])
@admin_required
def test_provider(provider_id):
    """Test provider connectivity"""
    try:
        provider = LLMProvider.query.get_or_404(provider_id)
        
        # Import test function from llm_provider_utils
        from modules.llm_provider_utils import test_provider_connection
        
        result = test_provider_connection(provider)
        
        # Update provider health status
        provider.last_health_check = datetime.utcnow()
        provider.health_status = result.get('status', 'unknown')
        provider.error_message = result.get('error')
        db.session.commit()
        
        return jsonify(result)
        
    except Exception as e:
        logger.error(f"Error testing provider {provider_id}: {e}", exc_info=True)
        return jsonify({'status': 'error', 'error': str(e)}), 500


@admin_providers_bp.route('/<int:provider_id>/models', methods=['GET'])
@admin_required
def list_provider_models(provider_id):
    """List models for a specific provider"""
    try:
        provider = LLMProvider.query.get_or_404(provider_id)
        models = provider.models.filter_by(is_active=True).all()
        
        return jsonify({
            'provider': provider.to_dict(),
            'models': [m.to_dict() for m in models]
        })
        
    except Exception as e:
        logger.error(f"Error fetching models for provider {provider_id}: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@admin_providers_bp.route('/<int:provider_id>/discover-models', methods=['POST'])
@admin_required
def discover_models(provider_id):
    """Discover available models from provider"""
    try:
        provider = LLMProvider.query.get_or_404(provider_id)
        
        # Import discovery function from llm_provider_utils
        from modules.llm_provider_utils import discover_provider_models
        
        models = discover_provider_models(provider)
        
        return jsonify({
            'success': True,
            'provider': provider.to_dict(),
            'models': models
        })
        
    except Exception as e:
        logger.error(f"Error discovering models for provider {provider_id}: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@admin_providers_bp.route('/api/providers/priority', methods=['POST'])
@admin_required
def update_priorities():
    """Update provider priorities (for drag-and-drop reordering)"""
    try:
        data = request.get_json()
        priorities = data.get('priorities', [])  # List of {id: int, priority: int}
        
        for item in priorities:
            provider_id = item.get('id')
            priority = item.get('priority')
            
            if provider_id and priority is not None:
                provider = LLMProvider.query.get(provider_id)
                if provider:
                    provider.priority = priority
        
        db.session.commit()
        logger.info(f"Updated priorities for {len(priorities)} providers")
        
        return jsonify({'success': True, 'message': 'Priorities updated'})
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating priorities: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500
