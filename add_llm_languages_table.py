import os
from flask import Flask
from extensions import db
from modules.database import LlmLanguage
from app import create_app

DEFAULT_LANGUAGES = [
    ('Indonesian', 'id'), ('English', 'en'), ('Chinese', 'lzh'),
    ('Japanese', 'ja'), ('Italian', 'it'), ('German', 'de'),
    ('Spanish', 'es'), ('Korean', 'ko'), ('Filipino', 'fil'),
    ('Vietnamese', 'vi'), ('French', 'fr'), ('Arabic', 'ar'),
    ('Malay', 'ms')
]

def seed_languages():
    """Seed default LLM languages using SQLAlchemy."""
    flask_app = create_app()
    with flask_app.app_context():
        inserted_count = 0
        
        for lang_name, lang_code in DEFAULT_LANGUAGES:
            # Check if language already exists
            existing = LlmLanguage.query.filter_by(language_code=lang_code).first()
            if not existing:
                is_active = (lang_code == 'en')  # Only English is active by default
                new_lang = LlmLanguage(
                    language_name=lang_name,
                    language_code=lang_code,
                    is_active=is_active
                )
                db.session.add(new_lang)
                inserted_count += 1
        
        # Update existing rows to set only English active
        LlmLanguage.query.update({LlmLanguage.is_active: False})
        LlmLanguage.query.filter_by(language_code='en').update({LlmLanguage.is_active: True})
        
        db.session.commit()
        print(f"Processed languages. Inserted {inserted_count} new default languages.")

if __name__ == '__main__':
    seed_languages()
