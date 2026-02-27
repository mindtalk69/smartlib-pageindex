# Phase 4: Dashboard & User Management

**Phase:** 04
**Name:** Dashboard & User Management
**Status:** Planned
**Plans:** 4 (04-01 through 04-04)

---

## Phase Goal

Build system statistics dashboard and comprehensive user management capabilities including user CRUD operations and password reset request management.

## Success Criteria

1. Admin sees dashboard with stats cards (user/file/message counts) and interactive charts
2. Admin can search, view, enable/disable, grant/revoke admin, and delete users
3. Admin can view and manage password reset requests (approve/deny with notes)
4. Admin can switch between different chart views and refresh data in real-time

## Requirements Coverage

### Dashboard (DASH) - 5 requirements
| ID | Description | Plan | Status |
|----|-------------|------|--------|
| DASH-01 | Stats cards showing user count, file count, message count | 04-01 | Planned |
| DASH-02 | Statistics charts (Library Ref, Users per Library, File vs URL, Knowledge Stats) | 04-01 | Planned |
| DASH-03 | User reference statistics table | 04-01 | Planned |
| DASH-04 | Chart toggle buttons to switch between views | 04-01 | Planned |
| DASH-05 | Real-time data refresh capability | 04-01 | Planned |

### User Management (USER) - 10 requirements
| ID | Description | Plan | Status |
|----|-------------|------|--------|
| USER-01 | List all users with pagination (10 per page) | 04-02 | Planned |
| USER-02 | Search users by username or user_id | 04-02 | Planned |
| USER-03 | View user details (username, email, is_admin, is_disabled, created_at) | 04-02 | Planned |
| USER-04 | Toggle user admin status (grant/revoke admin) | 04-03 | Planned |
| USER-05 | Toggle user active status (enable/disable account) | 04-03 | Planned |
| USER-06 | Reset user password (generate temporary password) | 04-03 | Planned |
| USER-07 | Delete user (with confirmation) | 04-03 | Planned |
| USER-08 | View password reset requests (pending, completed, denied) | 04-04 | Planned |
| USER-09 | Approve password reset request (generate temp password) | 04-04 | Planned |
| USER-10 | Deny password reset request (with admin notes) | 04-04 | Planned |

**Total:** 15 requirements across 4 plans

---

## Plan Summary

### Plan 04-01: Dashboard Page with Stat Cards and Charts

**Wave:** 1
**Dependencies:** Phase 3 completion (03-01, 03-02, 03-03)

**Objective:** Build the main Dashboard page with system statistics cards and interactive charts.

**Components:**
- `StatCard.tsx` - Reusable stat card component
- `ChartSection.tsx` - Chart rendering with toggle controls
- `UserStatsTable.tsx` - Top users activity table
- `Dashboard.tsx` - Main dashboard page
- `useDashboardData.ts` - Data fetching hook

**API Endpoints:**
- `GET /api/v1/admin/stats` - System statistics

**Requirements:** DASH-01, DASH-02, DASH-03, DASH-04, DASH-05

---

### Plan 04-02: User Management List

**Wave:** 1 (parallel with 04-01)
**Dependencies:** Phase 3 completion (03-01, 03-02, 03-03)

**Objective:** Create user management list page with pagination, search, and user details view.

**Components:**
- `UserList.tsx` - User table with pagination and search
- `UserDialog.tsx` - User details view dialog
- `Users.tsx` - Main users management page
- `useUsers.ts` - User list management hook

**API Endpoints:**
- `GET /api/v1/admin/users?page=&per_page=&search=` - List users with pagination

**Requirements:** USER-01, USER-02, USER-03

---

### Plan 04-03: User Actions (Toggle Admin, Toggle Status, Reset Password, Delete)

**Wave:** 2
**Dependencies:** 04-02 completion

**Objective:** Implement user action operations with confirmation dialogs.

**Components:**
- `UserActions.tsx` - Action buttons with confirmation dialogs
- `UserDialog.tsx` (updated) - Dialog with integrated actions
- `useUsers.ts` (updated) - Hook with action functions

**API Endpoints:**
- `POST /api/v1/admin/users/:id/toggle-admin` - Grant/revoke admin
- `POST /api/v1/admin/users/:id/toggle-active` - Enable/disable user
- `POST /api/v1/admin/users/:id/reset-password` - Generate temp password
- `DELETE /api/v1/admin/users/:id` - Delete user

**Requirements:** USER-04, USER-05, USER-06, USER-07

---

### Plan 04-04: Password Reset Requests Management

**Wave:** 2
**Dependencies:** 04-01, 04-02, 04-03 completion

**Objective:** Create password reset requests management with approve/deny functionality.

**Components:**
- `PasswordResetRequestsList.tsx` - Request list with status filtering
- `PasswordResetRequestDialog.tsx` - Request details and actions dialog
- `PasswordResetRequests.tsx` - Main requests management page
- `usePasswordResetRequests.ts` - Request management hook
- `Sidebar.tsx` (updated) - Add navigation link

**API Endpoints:**
- `GET /api/v1/admin/password-reset-requests?status=` - List requests
- `POST /api/v1/admin/password-reset-requests/:id/approve` - Approve with temp password
- `POST /api/v1/admin/password-reset-requests/:id/deny` - Deny with notes

**Requirements:** USER-08, USER-09, USER-10

---

## Execution Order

```
Phase 3 (Complete)
    │
    ▼
┌─────────────────────────────────────┐
│  Wave 1 (Parallel Execution)        │
│  ┌─────────────┐  ┌───────────────┐ │
│  │ 04-01       │  │ 04-02         │ │
│  │ Dashboard   │  │ User List     │ │
│  └─────────────┘  └───────────────┘ │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│  Wave 2 (Depends on Wave 1)         │
│  ┌─────────────┐  ┌───────────────┐ │
│  │ 04-03       │  │ 04-04         │ │
│  │ User Actions│  │ Reset Requests│ │
│  └─────────────┘  └───────────────┘ │
└─────────────────────────────────────┘
    │
    ▼
Phase 5: LLM/Model/Language Management
```

---

## File Structure

```
frontend/src/admin-app/
  src/
    components/
      dashboard/
        StatCard.tsx
        ChartSection.tsx
        UserStatsTable.tsx
      users/
        UserList.tsx
        UserDialog.tsx
        UserActions.tsx
        PasswordResetRequests.tsx
        PasswordResetRequestDialog.tsx
      layout/
        Sidebar.tsx (updated)
    pages/
      Dashboard.tsx
      Users.tsx
      PasswordResetRequests.tsx
    hooks/
      useDashboardData.ts
      useUsers.ts
      usePasswordResetRequests.ts
    lib/
      apiClient.ts (existing)
```

---

## API Integration

All admin endpoints are already implemented in the FastAPI backend (Phase 1):

| Endpoint | Method | Plan | Purpose |
|----------|--------|------|---------|
| `/api/v1/admin/stats` | GET | 04-01 | Dashboard statistics |
| `/api/v1/admin/users` | GET | 04-02 | List users (paginated) |
| `/api/v1/admin/users/:id/toggle-admin` | POST | 04-03 | Toggle admin status |
| `/api/v1/admin/users/:id/toggle-active` | POST | 04-03 | Toggle active status |
| `/api/v1/admin/users/:id/reset-password` | POST | 04-03 | Reset password |
| `/api/v1/admin/users/:id` | DELETE | 04-03 | Delete user |
| `/api/v1/admin/password-reset-requests` | GET | 04-04 | List reset requests |
| `/api/v1/admin/password-reset-requests/:id/approve` | POST | 04-04 | Approve request |
| `/api/v1/admin/password-reset-requests/:id/deny` | POST | 04-04 | Deny request |

---

## Navigation Structure

Sidebar menu updates (from Plan 04-04):

```
Dashboard (already exists)
Users (already exists)
Password Resets (NEW - 04-04)
---
LLM Providers (already exists)
Models (already exists)
Languages (already exists)
Content (already exists)
Settings (already exists)
```

---

## Known Dependencies

### External Libraries
- **Chart.js** or **Recharts** - For chart rendering (04-01)
- **shadcn/ui components** - Already installed (Button, Dialog, AlertDialog, Table, Badge)

### Backend
- All API endpoints already exist from Phase 1
- No backend changes required

### Frontend Infrastructure
- React Router (already configured)
- API client (already exists)
- Auth context (already configured)

---

## Testing Checklist

### Dashboard (04-01)
- [ ] Stat cards display correct counts
- [ ] Charts render with data
- [ ] Chart toggle buttons switch views
- [ ] Refresh button reloads data
- [ ] Loading states work
- [ ] Error handling works

### User Management (04-02, 04-03)
- [ ] User list paginates (10 per page)
- [ ] Search filters by username/user_id
- [ ] User details dialog opens
- [ ] Toggle admin works with confirmation
- [ ] Toggle status works with confirmation
- [ ] Password reset generates temp password
- [ ] Delete user requires confirmation
- [ ] Success/error toasts appear

### Password Reset Requests (04-04)
- [ ] Status filter tabs work
- [ ] Approve generates temp password
- [ ] Deny accepts admin notes
- [ ] Request details show all fields
- [ ] Navigation link in sidebar

---

## Phase Completion Criteria

Phase 4 is complete when:
1. All 4 plans executed successfully
2. All 15 requirements implemented and tested
3. Dashboard displays real data from API
4. User CRUD operations functional
5. Password reset request management functional
6. No TypeScript errors
7. Build succeeds with `npm run build:admin`

---

## Next Phase

**Phase 5: LLM, Model & Language Management**
- Requirements: 20 (PROV-01 to PROV-08, MODEL-01 to MODEL-07, LANG-01 to LANG-05)
- Plans: 4 (05-01 through 05-04)
- Goal: Complete AI configuration interface

---

*Phase 4 Plan created: 2026-02-26*
*Last updated: 2026-02-26*
