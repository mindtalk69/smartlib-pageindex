import os

admin_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static', 'admin-react')
path = 'images/favicon.svg'
full_path = os.path.join(admin_dir, path)
print("Admin dir:", admin_dir)
print("Full path:", full_path)
print("Exists?", os.path.exists(full_path))
print("Is file?", os.path.isfile(full_path))
