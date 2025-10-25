from app import create_app
from modules.database import AppSettings, db

app = create_app()

with app.app_context():
    # Check for both lowercase and uppercase key variations
    setting = AppSettings.query.filter(
        (AppSettings.key == 'vector_store_mode') | 
        (AppSettings.key == 'VECTOR_STORE_MODE')
    ).first()
    
    if setting:
        print(f"Current vector store mode: {setting.value} (key: {setting.key})")
    else:
        print("Creating new VECTOR_STORE_MODE setting with value 'knowledge'")
        new_setting = AppSettings(key='VECTOR_STORE_MODE', value='knowledge')
        db.session.add(new_setting)
        db.session.commit()
        print("Successfully created VECTOR_STORE_MODE setting")
