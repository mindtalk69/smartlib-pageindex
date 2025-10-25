from modules.database import User, db
user = User.query.filter_by(username='admin').first()
if user:
    user.is_admin = True
    db.session.commit()
    print(f"User '{user.username}' promoted to admin.")
else:
    print("User not found.")
exit()