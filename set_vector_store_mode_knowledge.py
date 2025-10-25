from modules.database import AppSettings
from extensions import db

def set_vector_store_mode_to_knowledge():
    updated = False
    # Try both keys for compatibility
    for key in ['vector_store_mode', 'VECTOR_STORE_MODE']:
        setting = AppSettings.query.filter_by(key=key).first()
        if setting:
            if setting.value != 'knowledge':
                setting.value = 'knowledge'
                db.session.add(setting)
                updated = True
        else:
            # Create new entry
            new_setting = AppSettings(key=key, value='knowledge')
            db.session.add(new_setting)
            updated = True
    if updated:
        db.session.commit()
        print("AppSettings updated to vector_store_mode='knowledge'.")
    else:
        print("AppSettings already set to vector_store_mode='knowledge'.")

if __name__ == "__main__":
    # Import and create Flask app instance
    from app import create_app
    app = create_app()
    with app.app_context():
        set_vector_store_mode_to_knowledge()