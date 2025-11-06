"""About page blueprint for SmartLib."""

from __future__ import annotations

from typing import List

from flask import Blueprint, render_template

ABOUT_BLUEPRINT_NAME = "about"
STATIC_LICENSING_PREFIX = "docs/licensing"

about_bp = Blueprint(ABOUT_BLUEPRINT_NAME, __name__)


def init_about(app) -> None:
    """Register the about blueprint with the provided Flask application."""
    app.register_blueprint(about_bp)


@about_bp.route("/about", methods=["GET"])
def about() -> str:
    """Render the SmartLib About page with licensing resources."""
    licensing_docs: List[dict[str, str]] = [
        {
            "title": "MIT License",
            "filename": f"{STATIC_LICENSING_PREFIX}/LICENSE",
        },
        {
            "title": "Notices",
            "filename": f"{STATIC_LICENSING_PREFIX}/NOTICE.txt",
        },
        {
            "title": "Licensing Guidelines",
            "filename": f"{STATIC_LICENSING_PREFIX}/LICENSING_INFO.md",
        },
        {
            "title": "Dependency Licenses",
            "filename": f"{STATIC_LICENSING_PREFIX}/DEPENDENCIES_LICENSES.md",
        },
        {
            "title": "Dependency Inventory CSV",
            "filename": f"{STATIC_LICENSING_PREFIX}/LICENSE_INVENTORY.csv",
        },
        {
            "title": "Azure Marketplace OSS Disclosure",
            "filename": f"{STATIC_LICENSING_PREFIX}/AZURE_MARKETPLACE_OSS_DISCLOSURE.md",
        },
        {
            "title": "AGPL Reference (PyMuPDF)",
            "filename": f"{STATIC_LICENSING_PREFIX}/license_texts/AGPL-3.0.txt",
        },
    ]

    return render_template(
        "about/about.html",
        licensing_docs=licensing_docs,
    )
