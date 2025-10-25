# Admin Folder Upload with Scheduled Background Processing — Full Implementation Plan

## Overview

This document details the comprehensive plan to implement an **Admin Folder Upload** feature with scheduled background processing in the Smarthing app. The feature will allow admins to upload folders, filter file types, schedule background processing, and monitor job status, all via a new admin UI tab. The backend will use Celery with RabbitMQ for scalable, asynchronous processing, and Flower for real-time monitoring.

---

## Goals

- Add a new admin tab for folder upload with:
  - Folder selection (recursive, supports nested files)
  - File type filters (PDF, DOCX, XLSX, PPTX, Markdown, AsciiDoc, HTML, CSV, PNG, JPEG, TIFF, BMP)
  - Option to enable/disable background processing
  - Date/time picker to schedule processing if background is enabled
- Backend support for:
  - Receiving folder uploads and metadata
  - Scheduling background ingestion jobs
  - Tracking job status and logs
- Use RabbitMQ as the message broker and Celery for task queue management
- Provide admin UI for monitoring and managing scheduled jobs
- Ensure theme-aware UI consistent with existing admin interface
- Maintain security and access control for admin-only features

---

## Backend Structure

### Flask Blueprint

- **New module:** `modules/admin_folder_upload.py`
- **Blueprint:** `admin_folder_upload_bp` with `url_prefix='/admin/folder_upload'`
- **Routes:**
  - `GET /admin/folder_upload/` — Render folder upload page
  - `POST /admin/folder_upload/upload` — Handle folder upload, file type filters, background/schedule options
  - `GET /admin/folder_upload/jobs` — API endpoint to list jobs/status
  - `GET /admin/folder_upload/job/<job_id>` — API endpoint for job details/logs
- **Access Control:** All routes require admin login

### Database Model

- **New model:** `FolderUploadJob` in `modules/database.py`
  - `id` (primary key)
  - `created_by_user_id` (foreign key to User)
  - `created_at` (datetime)
  - `file_list` (JSON or text)
  - `file_types` (text/JSON)
  - `background_enabled` (boolean)
  - `scheduled_time` (nullable datetime)
  - `status` (enum: pending, scheduled, running, completed, failed, cancelled)
  - `log` (text)
- **Migration:** Alembic migration script to add the new table

### Celery & RabbitMQ Integration

- **Dependencies:** Add `celery` to requirements, configure to use RabbitMQ as broker
- **Celery Worker:**
  - Implement background tasks for processing uploaded folders
  - Support scheduled execution (using Celery's ETA/countdown)
  - Update job status/logs in the DB
- **Systemd/Supervisor:** Document how to run/manage Celery workers in production

---

## Flower Monitoring

**Flower** is a web-based tool for monitoring and administrating Celery clusters in real time.

- **Features:**
  - Live monitoring of running, scheduled, and completed Celery tasks
  - Displays task arguments, results, status, and runtime
  - Worker status (online/offline, system info)
  - Task control: revoke, retry, terminate tasks from UI
  - Statistics and charts for throughput, failures, and worker load
- **Setup:**
  1. Install: `pip install flower`
  2. Run: `celery -A your_celery_app flower`
  3. Access: Open browser to `http://localhost:5555`
  4. For production, set up authentication and restrict access
- **Why Use Flower?**
  - Makes debugging and monitoring background jobs much easier
  - Lets you see if tasks are stuck, failing, or running as expected
  - Useful for both development and production (with proper security)

---

## Frontend (Admin UI)

- **Admin Menu:** Add "Folder Upload" under "Content & Data" in `templates/admin/base.html`
- **New Page:** `templates/admin/folder_upload.html`
  - `<input type="file" webkitdirectory directory multiple>` for folder selection
  - File type filter checkboxes/multiselect
  - Checkbox for background processing
  - Date/time picker for scheduling (e.g., flatpickr)
  - Submit button, job status table, and log viewer
- **JS:** `static/js/admin/admin-folder-upload.js`
  - Handles folder selection, file filtering, and form submission
  - Polls job status/logs via API
  - UI updates for job progress

---

## Integration & Consistency

- **Theme:** Ensure new page/components are theme-aware and consistent with existing admin UI
- **Security:** All endpoints and admin UI are admin-only
- **No Disruption:** No changes to existing file upload logic; this is a new, parallel feature

---

## Testing & Monitoring

- **Testing:**
  - End-to-end tests for upload, scheduling, and job monitoring
  - Manual and automated tests for error cases (e.g., failed jobs)
- **Monitoring:**
  - Optionally integrate Flower for Celery monitoring
  - Document how to check job status/logs

---

## Documentation

- **Update README/docs:**
  - Add setup instructions for RabbitMQ, Celery, and the new admin feature
  - Document DB migration steps
  - Document Flower setup and security

---

## Next Steps & Review Checklist

1. Review this document and provide feedback or approval
2. Once confirmed, implementation will proceed in the following order:
   - Database/model/migration
   - Backend routes and Celery integration
   - Frontend UI and JS
   - Testing and documentation
3. No code will be written until you confirm or adjust this plan

---

**Prepared by:** Cline, Software Engineer  
**Date:** 2025-04-21
