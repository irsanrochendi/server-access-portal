# Server Access Portal — Refactor Design

**Date:** 2025-07-05
**Status:** Approved Design

## Overview

Transform the Server Access Portal into a **dual-mode resource gateway** — a simple one-click access portal for regular staff and a full management panel for IT/admin. The core goal: staff can access all company resources (web apps, servers, portals, dashboards) without asking for URLs, IPs, or passwords.

## Users

- **Staff** — HR, Finance, Sales, BOD, and other non-IT staff. They need simple access to assigned resources and visibility into who's online.
- **Admin (IT/R&D)** — Full access to manage servers, users, resources, credentials, system settings, and activity logs.

## Features to Remove

- Health Monitoring & Alerts System (AlertBell, HealthHistoryModal, health status tracking)
- Connection History page (ConnectionHistory.jsx, `/connection-history`)
- Server Notes feature (ServerNotesModal, ServerNotesLogModal)

## New Features

### A. Role-Based Dashboard Views

- Detect user role on login
- **Staff view:** Simplified dashboard showing just assigned resources + online users widget
- **Admin view:** Full dashboard with access to all management tools

### B. Resource Assignment System

- Admin can assign resources to specific users or roles
- Each resource has: name, URL/IP, icon, category, connection type (web/RDP/SSH), optional credentials
- Staff only see resources assigned to them

### C. One-Click Connect

- Web resources: direct redirect to URL
- Resources with saved credentials: auto-login where technically possible
- RDP: generate `.rdp` file with pre-filled server info
- SSH: show connection command with copyable credentials

### D. Credential Management

- Admin-managed shared credentials per resource (encrypted)
- Staff can optionally save their own credentials (encrypted client-side)
- Periodic credential rotation reminders for admin

### E. Resource Categories & Search

- Resources organized by category (Internal Apps, Dev Servers, Client Portals, Monitoring, etc.)
- Filterable/searchable from dashboard

## Data Model

### Resources Table

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| name | string | Display name (e.g., "HR System", "Dev Server 01") |
| url | string | URL or IP address |
| type | enum | web / rdp / ssh |
| category | string | Internal Apps, Dev Servers, Client Portals, Monitoring |
| icon | string | Optional icon reference |
| shared_credentials | encrypted JSON | `{username, password}` for shared accounts |
| auto_login_enabled | boolean | Whether auto-login is configured |
| created_at | timestamp | |
| updated_at | timestamp | |

### Resource Assignments Table

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| resource_id | UUID | FK to resources |
| user_id | UUID | FK to users (null if role-based) |
| role | string | Role name (null if user-specific) |
| created_at | timestamp | |

### User Credentials Table (Phase 2+)

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | FK to users |
| resource_id | UUID | FK to resources |
| encrypted_credentials | encrypted JSON | User's personal credentials |
| created_at | timestamp | |

## User Roles

- **admin** — full access to all pages and management features
- **staff** — access to Dashboard (simplified), Profile, Online Users

## Page Structure

### Staff
- `/login` — Authentication
- `/dashboard` — Resource grid + Online Users widget
- `/profile` — User profile settings
- `/online-users` — Who's currently online

### Admin (existing + resource management)
- All staff pages
- `/admin/servers` — Server management
- `/admin/users` — User management
- `/admin/online-users` — Online users admin view
- `/admin/activity-logs` — Activity monitoring
- `/admin/roles` — Role management
- `/admin/db-browser` — Database browser
- `/admin/settings` — System settings
- `/admin/resources` — **New:** Resource & credential management

## Component Changes

### Remove
- `AlertBell.jsx`
- `HealthHistoryModal.jsx`
- `ServerNotesModal.jsx`
- `ServerNotesLogModal.jsx`
- `ConnectionHistory.jsx` (page)

### Modify
- **Dashboard.jsx** — Split view by role (staff: resource grid + online users; admin: full)
- **ServerCard.jsx** — Simplify to show name, icon, category, status. Click to connect. Lock icon if credentials saved.
- **Sidebar.jsx** — Staff: limited items (Dashboard, Profile, Online Users). Admin: full navigation.

### New
- **ResourceGrid.jsx** — Category-grouped resource cards with search/filter
- **ResourceConnectionModal.jsx** — Connection instructions, RDP download, SSH command, credential copy
- **ResourceManager.jsx** (admin) — CRUD for resources, assignment to users/roles, credential setup
- **OnlineUsersStaff.jsx** — Simplified online users widget for staff dashboard

## Auto-Login Strategy

- **Phase 1 (Simple):** Redirect to URL — staff manually login
- **Phase 2 (Auto-fill):** For web resources where feasible — use credential autofill via iframe/postMessage
- **Phase 3 (Future):** Backend SSO proxy for compatible internal apps
- **RDP:** Generate `.rdp` configuration file download
- **SSH:** Show command with copy-to-clipboard credentials

## Security

- All credentials encrypted at rest (AES-256)
- HTTPS required for deployment
- Session token expiry with auto-logout on idle
- Role-based access enforced at route and API level
- Audit logging for all resource access events
- Staff cannot access resources not assigned to them

## Implementation Phases

### Phase 1: Foundation
1. Remove Health Monitoring, Connection History, Server Notes
2. Implement role-based dashboard views
3. Create resource data model & CRUD backend API
4. Build ResourceGrid component for staff dashboard
5. Basic web redirect connection (no auto-login)

### Phase 2: Resource Management (Admin)
1. Admin panel for resource management (add/edit/delete/assign)
2. Resource assignment to users and roles
3. Resource categories and organization
4. Online users widget for staff dashboard
5. Sidebar role-based navigation

### Phase 3: Credentials & Auto-Connect
1. Shared credentials management (admin-managed, encrypted)
2. User personal credentials (optional, encrypted)
3. RDP file generation
4. SSH connection helper with copy-to-clipboard
5. Web auto-fill (where feasible)

### Phase 4: Polish & Deploy
1. Security hardening & encryption verification
2. User acceptance testing with staff from multiple departments
3. Bug fixes & performance optimization
4. Documentation & training materials
5. Production deployment
