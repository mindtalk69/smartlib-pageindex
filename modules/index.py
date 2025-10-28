import os
from pathlib import Path

from flask import render_template, session, jsonify, send_from_directory, abort, current_app
from extensions import db
# Import rewritten functions and MessageHistory model
from .database import count_user_messages, count_user_documents, get_libraries, get_user_messages, MessageHistory
from collections import defaultdict
from datetime import datetime
from flask_login import current_user, login_required
from modules.llm_utils import get_active_language_name

def init_index(app):
    @app.route('/')
    def index():
        # Use last N messages from database for conversation (for persistent chat)
        from modules.database import get_user_messages_serialized
        user_id = current_user.get_id() if current_user.is_authenticated else None
        if user_id:
            conversation = get_user_messages_serialized(user_id, limit=20)
        else:
            conversation = []
        # Get actual counts from database
        message_count = count_user_messages(user_id) if user_id else 0
        uploaded_docs_count = count_user_documents(user_id) if user_id else 0
        libraries = get_libraries() # Fetch libraries
        library_options = [
            {
                "library_id": library.library_id,
                "name": getattr(library, "name", ""),
            }
            for library in libraries
        ]

        # --- Fetch and process history ---
        history_by_date = defaultdict(list)
        if user_id:
            try:
                # Use the rewritten SQLAlchemy function
                user_messages = get_user_messages(user_id) # Returns list of MessageHistory objects

                for msg in user_messages:
                    # SQLAlchemy handles timestamp conversion
                    ts_obj = msg.timestamp
                    if ts_obj: # Check if timestamp is not None
                        date_key = ts_obj.date() # Group by date object
                        history_by_date[date_key].append({
                            'message_text': msg.message_text, # Access attribute
                            'timestamp': ts_obj # Keep the datetime object
                        })
                    else:
                        print(f"Warning: Message {msg.message_id} has no timestamp.")
            except Exception as e:
                print(f"Error fetching message history for user {user_id}: {e}")
                # Optionally flash a message to the user
                # flash("Could not load message history.", "warning")
        # --- End history processing ---

        # Fetch vector store mode from AppSettings
        from modules.database import AppSettings, UserGroup, Knowledge, Group
        setting = None
        vector_store_mode = 'user'
        knowledges = []
        try:
            setting = AppSettings.query.filter(
                (AppSettings.key == 'vector_store_mode') |
                (AppSettings.key == 'VECTOR_STORE_MODE')
            ).first()
            if setting:
                vector_store_mode = setting.value
        except Exception as e:
            print(f"Error fetching vector store mode: {e}")

        # If knowledge mode, get knowledges for user's groups
        knowledge_libraries_map = {}
        knowledges_list = []
        if vector_store_mode == 'knowledge':
            try:
                if current_user.is_authenticated and getattr(current_user, "is_admin", False):
                    # Admin: load all knowledges
                    knowledges = Knowledge.query.order_by(Knowledge.name).all()
                    print(f"[DEBUG] User is admin. Loaded {len(knowledges)} knowledges.")
                else:
                    # Non-admin: load only knowledges for user's groups
                    user_id = current_user.get_id() if current_user.is_authenticated else None
                    knowledges = []
                    if user_id:
                        user_group_ids = [ug.group_id for ug in UserGroup.query.filter_by(user_id=user_id).all()]
                        print(f"[DEBUG] User is NOT admin. user_id={user_id}, user_group_ids={user_group_ids}")
                        if user_group_ids:
                            knowledges = Knowledge.query.join(Knowledge.groups).filter(
                                Group.group_id.in_(user_group_ids)
                            ).distinct().order_by(Knowledge.name).all()
                            print(f"[DEBUG] Loaded {len(knowledges)} knowledges for user's groups.")
                        else:
                            print("[DEBUG] User has no group associations.")
                # Build mapping: {knowledge_id: {name: knowledge_name, libraries: [...]}}
                for k in knowledges:
                    knowledges_list.append({"id": k.id, "name": k.name})
                    knowledge_libraries_map[str(k.id)] = {
                        "name": k.name,
                        "libraries": [
                            {"library_id": lib.library_id, "name": lib.name}
                            for lib in k.libraries
                        ]
                    }

                print(f"[DEBUG] Final knowledges list length: {len(knowledges)}")
                for k in knowledges:
                    print(f"[DEBUG] Knowledge ID: {k.id}, Name: {k.name}")
                
                print(f"[DEBUG] knowledge_libraries_map: {knowledge_libraries_map}")
            except Exception as e:
                print(f"Error fetching knowledges in knowledge mode: {e}")
        
        active_language = get_active_language_name()

        return render_template(
            'index.html',
            conversation=conversation,
            message_count=message_count,
            uploaded_docs_count=uploaded_docs_count,
            libraries=libraries,
            library_options=library_options,
            history_by_date=history_by_date,
            vector_store_mode=vector_store_mode,
            knowledges=knowledges_list,
            knowledge_libraries_map=knowledge_libraries_map,
            active_language=active_language,
        )

    @app.route('/generated-maps/<path:filename>')
    def serve_generated_map(filename: str):
        """Serve generated map files stored outside the static directory."""
        map_dir = Path(current_app.config.get('MAP_PUBLIC_DIR', os.path.join(current_app.root_path, 'static', 'maps')))
        requested_path = (map_dir / filename).resolve()
        try:
            map_dir_resolved = map_dir.resolve()
        except FileNotFoundError:
            map_dir_resolved = map_dir
        if not str(requested_path).startswith(str(map_dir_resolved)) or not requested_path.is_file():
            abort(404)
        relative_path = requested_path.relative_to(map_dir_resolved)
        return send_from_directory(str(map_dir_resolved), relative_path.as_posix())

    @app.route('/api/history')
    @login_required
    def api_history():
        """API endpoint to fetch user message history."""
        user_id = current_user.get_id()
        history_by_date = defaultdict(list)
        
        try:
            user_messages = get_user_messages(user_id)
            
            for msg in user_messages:
                ts_obj = msg.timestamp
                if ts_obj:
                    date_key = ts_obj.strftime('%Y-%m-%d')  # Format date as string
                    history_by_date[date_key].append({
                        'message_id': getattr(msg, 'message_id', None),
                        'role': getattr(msg, 'role', None),
                        'message_text': msg.message_text,
                        'timestamp': ts_obj.strftime('%H:%M:%S'),
                        # Optionally include citations, usage_metadata, suggested_questions if available
                        'citations': getattr(msg, 'citations', None),
                        'usage_metadata': getattr(msg, 'usage_metadata', None),
                        'suggested_questions': getattr(msg, 'suggested_questions', None)
                    })
            
            # Convert defaultdict to dict for JSON serialization
            history_dict = {date: messages for date, messages in history_by_date.items()}
            return jsonify({"success": True, "history": history_dict})
        
        except Exception as e:
            app.logger.error(f"Error fetching message history for user {user_id}: {e}")
            return jsonify({"success": False, "error": str(e)}), 500

    @app.route('/api/counters')
    def api_counters():
        user_id = current_user.get_id() if current_user.is_authenticated else None
        message_count = count_user_messages(user_id) if user_id else 0
        uploaded_docs_count = count_user_documents(user_id) if user_id else 0
        # No need to import jsonify again
        return jsonify({
            "message_count": message_count,
            "uploaded_docs_count": uploaded_docs_count
        })
