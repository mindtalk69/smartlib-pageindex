import os
from flask import Flask
from extensions import db
from modules.database import Category, User
from app import create_app

DEFAULT_CATEGORIES = [
    ('Public Data', 'Kategori \'Data Publik\' mencakup informasi yang tersedia untuk umum dan dapat diakses tanpa batasan. Konten dalam kategori ini meliputi statistik pemerintah, laporan penelitian, data demografis, informasi lingkungan, serta data terkait kesehatan dan pendidikan. Tujuan utama dari data publik adalah untuk meningkatkan transparansi, mendukung penelitian, dan memberikan dasar untuk pengambilan keputusan yang informasional oleh masyarakat, peneliti, dan pembuat kebijakan. Ketersediaan data ini berkontribusi pada partisipasi publik yang lebih besar dan pengembangan kebijakan yang berbasis bukti.'),
    ('Private Data', 'The \'Private Data\' category encompasses sensitive and confidential information that is intended for restricted access and use. This may include personal identifiers, financial records, health information, and proprietary business data. The primary purpose of this category is to safeguard individual privacy and protect organizational integrity, ensuring that such information is handled responsibly and in compliance with relevant laws and regulations. Proper management and security protocols are essential to prevent unauthorized access and potential data breaches.'),
    ('Internal Data', 'Data for exclusive enterprise use.'),
    ('Confidential Data', 'Sersitive data needing protection from unauthorized access.'),
    ('Restricted data', 'Data with additional access Limitations beyond what is considered confidential due to legal obligations.'),
    ('Critical data', 'Data vital for business operations and strategic objectives.'),
    ('Regulatory data', 'Data subject to legal or regulatory requirements.')
]

def seed_categories():
    """Seed default categories using SQLAlchemy."""
    flask_app = create_app()
    with flask_app.app_context():
        # Find or create a system user for seeding
        system_user = User.query.filter_by(username='admin').first()
        if not system_user:
            # If no admin user exists yet, use a placeholder
            print("Warning: No admin user found. Categories will be created without a creator.")
            print("Run promote_admin_sqlalchemy.py first to create an admin user.")
            return
        
        inserted_count = 0
        for name, description in DEFAULT_CATEGORIES:
            # Check if category already exists
            existing = Category.query.filter_by(name=name).first()
            if not existing:
                new_category = Category(
                    name=name,
                    description=description,
                    created_by_user_id=system_user.user_id
                )
                db.session.add(new_category)
                inserted_count += 1
        
        db.session.commit()
        print(f"Inserted {inserted_count} new default categories.")

if __name__ == '__main__':
    seed_categories()
