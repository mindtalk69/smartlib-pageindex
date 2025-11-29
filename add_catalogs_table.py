import os
from flask import Flask
from extensions import db
from modules.database import Catalog, User
from app import create_app

DEFAULT_CATALOGS = [
    ('Contracts', 'A contract is a legally binding agreement between two or more parties. These parties may include a business, employees, third parties, and other entities. It is a document which states the nature and terms of collaboration between those involved.'),
    ('Corporate Bylaws', 'Katalog \'Corporate Bylaws\' menyediakan kumpulan dokumen dan pedoman yang mengatur struktur, fungsi, dan prosedur operasional suatu perusahaan. Dalam katalog ini, Anda akan menemukan berbagai contoh anggaran dasar, ketentuan rapat, serta aturan mengenai kepemilikan saham dan tanggung jawab direksi. Katalog ini bertujuan untuk membantu perusahaan dalam memastikan kepatuhan hukum, transparansi, dan pengelolaan yang efektif, serta mendukung pengambilan keputusan yang strategis. Ideal untuk pengacara, pemilik bisnis, dan profesional di bidang corporate governance.'),
    ('Business Plan', '**Business Plan Catalog**\n\nUnlock the potential of your entrepreneurial vision with our comprehensive \'Business Plan\' catalog. This resource is designed to guide startups and established businesses alike in crafting effective business strategies. It features templates, sample plans, and expert insights on market analysis, financial projections, operational planning, and marketing strategies. Whether you\'re seeking funding, exploring new markets, or refining your business model, this catalog provides the essential tools and knowledge to help you articulate your goals and drive your business forward.'),
    ('Financial Documents', ''),
    ('Transactional Documents', ''),
    ('Business Reports', '**Business Reports Catalog**\n\nThe \'Business Reports\' catalog serves as a comprehensive resource for professionals seeking in-depth analyses and insights into various industries and market trends. Featuring a diverse collection of detailed reports, this catalog covers financial performance, operational assessments, consumer behavior studies, and strategic forecasts. Ideal for business leaders, analysts, and decision-makers, it aims to enhance understanding and facilitate informed decision-making by providing valuable data and expert commentary on current and emerging business landscapes.'),
    ('Minutes Of Business Meeting', ''),
    ('Letters And Memos', ''),
    ('HR Documents', ''),
    ('Marketing Materials', ''),
    ('Proposals And Bids', ''),
    ('Board Resolutions', '**Board Resolutions Catalog**: This catalog serves as a comprehensive collection of formal decisions made by a company\'s board of directors. It includes templates and examples of resolutions covering various topics such as approvals for financial transactions, policy implementations, and corporate governance matters. Designed for corporate secretaries, legal teams, and board members, this resource aims to streamline the documentation process, ensure compliance with legal requirements, and enhance organizational transparency.'),
    ('Business Pitch', '**Business Pitch Shorts Catalog Description:**\n\nThe "Business Pitch" shorts catalog is a curated collection designed to inspire and equip entrepreneurs with concise, impactful presentations. Each entry features innovative ideas, strategies, and success stories from various industries, showcasing effective pitching techniques and essential elements for capturing investor interest. Ideal for startups and seasoned businesses alike, this catalog serves as a valuable resource for anyone looking to refine their pitch and elevate their business proposals.'),
    ('Compliance And Regulatory Documents', ''),
    ('Operational Documents', ''),
    ('Project Management Documents', ''),
    ('Non-Business', ''),
    ('Others', ''),
    ('Sales and Marketing Documents', '**Sales & Marketing Documents Catalog**\n\nThis catalog serves as a comprehensive repository for essential sales and marketing resources. It includes a curated collection of documents designed to enhance marketing strategies, streamline sales processes, and improve customer engagement. Expect to find templates, brochures, case studies, presentations, and analytical reports that provide valuable insights and support for both sales teams and marketing professionals. Ideal for businesses seeking to optimize their outreach efforts and drive growth through effective communication and branding materials.'),
    ('Sample Catalog', '')
]

def seed_catalogs():
    """Seed default catalogs using SQLAlchemy."""
    flask_app = create_app()
    with flask_app.app_context():
        # Find or create a system user for seeding
        system_user = User.query.filter_by(username='admin').first()
        if not system_user:
            # If no admin user exists yet, use a placeholder
            # This will be replaced when the actual admin user is created
            print("Warning: No admin user found. Catalogs will be created without a creator.")
            print("Run promote_admin_sqlalchemy.py first to create an admin user.")
            return
        
        inserted_count = 0
        for name, description in DEFAULT_CATALOGS:
            # Check if catalog already exists
            existing = Catalog.query.filter_by(name=name).first()
            if not existing:
                new_catalog = Catalog(
                    name=name,
                    description=description,
                    created_by_user_id=system_user.user_id
                )
                db.session.add(new_catalog)
                inserted_count += 1
        
        db.session.commit()
        print(f"Inserted {inserted_count} new default catalogs.")

if __name__ == '__main__':
    seed_catalogs()
