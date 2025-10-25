# Flask Admin Backend Modularization Guide

This document describes the modular structure of the Flask admin backend, how each module is organized, and how to extend or maintain the admin area. Use this as a reference for development and onboarding.

---

## Overview

The admin backend is split into focused modules, each responsible for a specific group of features. This modularization improves maintainability, clarity, and scalability.

**Key Principles:**
- Each admin area (users, content, AI, settings, etc.) is encapsulated in its own module.
- Each module defines its own Flask Blueprint.
- All blueprints are registered centrally in `modules/admin.py`.
- Shared utilities, forms, and context processors are placed in a common location.

---

## Module Structure

| Module File                | Blueprint Name   | URL Prefix           | Main Features/Routes Handled                |
|----------------------------|------------------|----------------------|---------------------------------------------|
| admin.py                   | admin            | /admin               | Blueprint registration, context processors, access control |
| admin_dashboard.py         | dashboard_bp     | /admin               | Dashboard, statistics                       |
| admin_users.py             | users_bp         | /admin/users         | User management (list, toggle, admin, etc.) |
| admin_user_groups.py       | user_groups_bp   | /admin/user_groups   | User group management                       |
| admin_content.py           | content_bp       | /admin/content       | Files, downloads, catalogs, categories, libraries, knowledges, messages |
| admin_ai.py                | ai_bp            | /admin/ai            | Vector references, vector store, visual grounding, LLM language, description generation |
| admin_settings.py          | settings_bp      | /admin/settings      | OCR, vector store, visual grounding, admin settings forms/routes |
| admin_utils.py (optional)  | —                | —                    | Shared forms, context processors, decorators |

---

## Blueprint Registration

All blueprints are registered in `modules/admin.py` (or a dedicated `init_admin` function):

```python
from modules.admin_dashboard import dashboard_bp
from modules.admin_users import users_bp
from modules.admin_user_groups import user_groups_bp
from modules.admin_content import content_bp
from modules.admin_ai import ai_bp
from modules.admin_settings import settings_bp

def init_admin(app):
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(users_bp)
    app.register_blueprint(user_groups_bp)
    app.register_blueprint(content_bp)
    app.register_blueprint(ai_bp)
    app.register_blueprint(settings_bp)
```

- Ensure each blueprint uses a unique name and `url_prefix` to avoid conflicts.

---

## Adding a New Admin Module

1. **Create a new file** in `modules/` (e.g., `admin_newfeature.py`).
2. **Define a Blueprint**:
    ```python
    from flask import Blueprint
    newfeature_bp = Blueprint('newfeature_bp', __name__, url_prefix='/admin/newfeature')
    ```
3. **Add routes** to the blueprint.
4. **Register the blueprint** in `init_admin` in `admin.py`.
5. **Document the new module** in this file.

---

## Guidelines for Route and Feature Placement

- **User management**: `admin_users.py`
- **Content/data (files, catalogs, etc.)**: `admin_content.py`
- **AI/vector/LLM**: `admin_ai.py`
- **Settings (OCR, vector store, etc.)**: `admin_settings.py`
- **Dashboard/statistics**: `admin_dashboard.py`
- **Shared forms/utilities**: `admin_utils.py` (if needed)

---

## Example: Creating a New Route

```python
# In modules/admin_content.py
@content_bp.route('/files')
def file_management():
    # Route logic here
    pass
```

---

## Context Processors and Access Control

- Global context processors (e.g., theme, OCR flag) are defined in `admin.py` or `admin_utils.py`.
- Admin access control is enforced via `@login_required` and a `before_request` handler in `admin.py`.

---

## Extending the Admin Area

- Follow the module structure and guidelines above.
- Update this documentation when adding new modules or major features.
- Use clear docstrings and comments in code for maintainability.

---

## Contact

For questions or suggestions, contact the project maintainer or refer to this document.
