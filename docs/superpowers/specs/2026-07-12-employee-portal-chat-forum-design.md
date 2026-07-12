# Employee Portal, Internal Chat & Forum — Design Spec

**Date:** 2026-07-12
**Status:** Approved
**Project:** server-access-portal (add-on modules)
**Scope:** 3 new modules integrated into existing React + Express + SQLite application

---

## Overview

Add three modules to the existing `server-access-portal` to transform it into an all-in-one office intranet platform:

1. **Employee Portal (Pengumuman)** — Admin posts announcements, targets specific divisions, pin/unpin; users read and leave simple comments.
2. **Internal Chat** — Real-time group chat per division + general room, WebSocket-based, text + file sharing.
3. **Forum Discussion** — Threaded topics by category, replies with 2-level nesting, admin moderation (pin/lock).

**Target users:** 20–50 concurrent users in a small-to-medium office.

---

## Architecture

All three modules integrate directly into the existing `server-access-portal` monolith. No new services or databases — the existing SQLite database and Express backend are extended with new tables, routes, and a Socket.IO server.

```
server-access-portal/
├── backend/
│   ├── routes/
│   │   ├── announcements.js    ← NEW
│   │   ├── chat.js             ← NEW
│   │   └── forum.js            ← NEW
│   ├── socket/
│   │   └── chatHandler.js      ← NEW: Socket.IO event handlers
│   ├── services/
│   │   └── chatService.js      ← NEW: chat business logic
│   └── server.js               ← MODIFIED: http.Server + Socket.IO init
├── src/
│   ├── pages/
│   │   ├── announcements/      ← NEW: AnnouncementsPage, AnnouncementDetailPage
│   │   ├── chat/               ← NEW: ChatPage
│   │   └── forum/              ← NEW: ForumPage, ForumTopicPage
│   ├── components/
│   │   ├── chat/               ← NEW: ChatWindow, MessageBubble, RoomList, ChatInput, TypingIndicator
│   │   ├── forum/              ← NEW: TopicCard, ReplyThread, ReplyForm
│   │   └── announcements/      ← NEW: AnnouncementCard, AnnouncementModal
│   └── contexts/
│       └── SocketContext.jsx    ← NEW: Socket.IO client context provider
```

**Integration principles:**
- **Database:** Same SQLite file (`portal.db`), new tables via migration in `database.js`.
- **Auth:** All endpoints reuse existing `authenticate` JWT middleware. Admin endpoints reuse `authorize('admin')`.
- **Activity logs:** New actions log to the existing `activity_logs` table.
- **File upload:** Reuse existing `multer` infrastructure in `backend/routes/upload.js`.
- **UI primitives:** Reuse existing `Button`, `Card`, `Modal`, `Input`, `Select`, `Badge` components from `src/components/ui/`.
- **Sidebar:** Extend existing `AppLayout` / `Sidebar` with 3 new navigation items.

---

## Database Schema

### New Table: `announcements`

| Column       | Type     | Notes                        |
|-------------|----------|------------------------------|
| id           | INTEGER PK |                              |
| title        | TEXT NOT NULL |                            |
| content      | TEXT NOT NULL | Supports basic Markdown    |
| author_id    | INTEGER FK → users |                       |
| division_id  | INTEGER FK → divisions, nullable | NULL = all divisions |
| is_pinned    | INTEGER DEFAULT 0 |                          |
| created_at   | TEXT DEFAULT datetime('now') |                |
| updated_at   | TEXT         |                            |

### New Table: `chat_messages`

| Column       | Type     | Notes                        |
|-------------|----------|------------------------------|
| id           | INTEGER PK |                              |
| room         | TEXT NOT NULL | e.g. `general`, `division-1` |
| sender_id    | INTEGER FK → users |                       |
| message      | TEXT, nullable | Nullable when file-only    |
| file_url     | TEXT, nullable | Uploaded file path          |
| file_name    | TEXT, nullable | Original filename           |
| created_at   | TEXT DEFAULT datetime('now') |                |

Room names are derived from divisions: a `general` room always exists, plus one room per division (`division-{id}`). No separate `chat_rooms` table is needed.

### New Table: `forum_categories`

| Column       | Type     | Notes                        |
|-------------|----------|------------------------------|
| id           | INTEGER PK |                              |
| name         | TEXT NOT NULL |                            |
| description  | TEXT         |                            |
| sort_order   | INTEGER      | Display order               |

Seed with defaults: "Umum", "Teknis", "HR & Administrasi", "Saran & Feedback".

### New Table: `forum_topics`

| Column       | Type     | Notes                        |
|-------------|----------|------------------------------|
| id           | INTEGER PK |                              |
| category_id  | INTEGER FK → forum_categories |                   |
| title        | TEXT NOT NULL |                            |
| content      | TEXT NOT NULL |                            |
| author_id    | INTEGER FK → users |                       |
| is_pinned    | INTEGER DEFAULT 0 |                          |
| is_locked    | INTEGER DEFAULT 0 | No new replies            |
| reply_count  | INTEGER DEFAULT 0 | Cached counter              |
| created_at   | TEXT DEFAULT datetime('now') |                |
| updated_at   | TEXT         |                            |

### New Table: `forum_replies`

| Column       | Type     | Notes                        |
|-------------|----------|------------------------------|
| id           | INTEGER PK |                              |
| topic_id     | INTEGER FK → forum_topics |                     |
| content      | TEXT NOT NULL |                            |
| author_id    | INTEGER FK → users |                       |
| parent_id    | INTEGER FK → forum_replies, nullable | NULL = direct reply to topic |
| created_at   | TEXT DEFAULT datetime('now') |                |

Replies support max 2 nesting levels (reply to topic, reply to reply). `parent_id = NULL` means a direct reply to the topic. `parent_id` pointing to another reply is a sub-reply. No deeper nesting is allowed — the UI caps at 2 levels.

---

## API Design

All endpoints prefixed with `/api/`, all require `authenticate` JWT middleware.

### Module 1: Announcements

| Method | Endpoint                          | Auth  | Description              |
|--------|-----------------------------------|-------|--------------------------|
| GET    | /api/announcements                | all   | List (query: `?division=`, `?pinned=`, `?page=`, `?limit=`) |
| GET    | /api/announcements/:id            | all   | Detail                   |
| POST   | /api/announcements                | admin | Create                   |
| PUT    | /api/announcements/:id            | admin | Update                   |
| DELETE | /api/announcements/:id            | admin | Delete                   |
| PATCH  | /api/announcements/:id/pin        | admin | Toggle pin               |

### Module 2: Chat (REST + Socket.IO)

**REST endpoints:**

| Method | Endpoint                              | Auth | Description              |
|--------|---------------------------------------|------|--------------------------|
| GET    | /api/chat/rooms                       | all  | List available rooms     |
| GET    | /api/chat/rooms/:room/messages        | all  | History (query: `?limit=50&before=id`) |
| POST   | /api/chat/rooms/:room/upload          | all  | Upload file, return URL  |
| DELETE | /api/chat/messages/:id                | all  | Delete own msg (admin can delete any) |

**Socket.IO events:**

| Event              | Direction     | Payload                                      |
|--------------------|---------------|-----------------------------------------------|
| `chat:join`        | client → server | `{ room }`                                  |
| `chat:leave`       | client → server | `{ room }`                                  |
| `chat:message`     | client → server | `{ room, message, file_url?, file_name? }`  |
| `chat:new-message` | server → client | `{ id, room, sender: {id,name}, message, file_url, file_name, created_at }` |
| `chat:typing`      | client → server | `{ room }`                                  |
| `chat:user-typing` | server → client | `{ room, user_name }`                       |

Authentication for Socket.IO is handled via JWT token passed in the handshake `auth.token` field.

### Module 3: Forum

| Method | Endpoint                          | Auth      | Description              |
|--------|-----------------------------------|-----------|--------------------------|
| GET    | /api/forum/categories             | all       | List categories          |
| POST   | /api/forum/categories             | admin     | Create category          |
| PUT    | /api/forum/categories/:id         | admin     | Update category          |
| DELETE | /api/forum/categories/:id         | admin     | Delete category          |
| GET    | /api/forum/topics                 | all       | List (query: `?category=`, `?page=`, `?sort=latest\|popular`) |
| GET    | /api/forum/topics/:id             | all       | Detail + replies         |
| POST   | /api/forum/topics                 | all       | Create topic             |
| DELETE | /api/forum/topics/:id             | author/admin | Delete topic         |
| POST   | /api/forum/topics/:id/replies     | all       | Reply (body: `?parent=reply_id` for sub-reply) |
| DELETE | /api/forum/replies/:id            | author/admin | Delete reply         |
| PATCH  | /api/forum/topics/:id/lock        | admin     | Toggle lock              |
| PATCH  | /api/forum/topics/:id/pin         | admin     | Toggle pin               |

Total: **22 new REST endpoints** + **6 Socket.IO events**.

---

## Frontend Design

### Sidebar Navigation

Add 3 items between Dashboard and Servers:

```
📊 Dashboard
📢 Pengumuman        ← NEW
💬 Chat              ← NEW
📋 Forum             ← NEW
───
🖥️ Servers
👥 Online Users
─── Admin ───
...
```

### Page: Pengumuman (`/announcements`)

- List of announcement cards, paginated.
- Pinned announcements appear first with a "📌 Pinned" badge.
- Filter by division dropdown.
- Search by title.
- Admin: "Buat Pengumuman" button opens modal with title + content (textarea, basic Markdown hint) + division selector.
- Each card: title, truncated content (first 150 chars), author, time ago, division badge.
- Click card → detail page or expand inline.

**Components:**
- `AnnouncementsPage` — main list page with pagination, filters, admin create button
- `AnnouncementCard` — single announcement summary (title, excerpt, author, timestamp, badges for pinned/division)
- `AnnouncementModal` — create/edit form (reuses existing `Modal`, `Input`, `Select` UI primitives)

### Page: Chat (`/chat`)

- Split layout: room list (left sidebar, ~200px) + chat window (right).
- Room list auto-populated: `# general` always first, then rooms for each division the user belongs to.
- Chat window: scrollable message area, messages grouped by date, auto-scroll to bottom on new message.
- Each message bubble: sender name, timestamp, message text (or file link with icon), different color for own vs others.
- Typing indicator: "X is typing..." at bottom of message area.
- Input area: text input + attach file button + send button.
- Clicking a file opens it in a new tab (or downloads).

**Components:**
- `ChatPage` — layout container, manages room selection state
- `RoomList` — sidebar list of rooms, highlight active, unread indicator (future)
- `ChatWindow` — message list + input, handles scroll and auto-scroll
- `MessageBubble` — single message display (text/file, own/other styling)
- `ChatInput` — text input + file attach + send button
- `TypingIndicator` — animated "X is typing..." label

**State management:** `SocketContext` wraps the app (at `AppLayout` level), provides:
- `socket` instance (auto-connect on login, disconnect on logout)
- `messages` map keyed by room
- `sendMessage(room, text, file?)` function
- `typing` state per room
- `onlineUsers` per room (future)

### Page: Forum (`/forum`)

- List view: category filter dropdown, "Buat Topik" button.
- Topic cards in a table/list: title, category badge, author, reply count, last activity timestamp.
- Pin/lock icons shown when applicable.
- Click topic → detail page.

**Detail page (`/forum/topics/:id`):**
- Original post at top (author, timestamp, full content).
- Replies below with 2-level nesting:
  - Level 1: direct replies to topic.
  - Level 2: replies to a level-1 reply (indented, smaller).
- "Balas" button on each reply and on the main topic.
- Reply form: textarea + submit.
- Admin buttons: lock/unlock, pin/unpin, delete (inline, small icons).

**Components:**
- `ForumPage` — category filter + topic list with pagination
- `ForumTopicPage` — single topic detail with threaded replies
- `TopicCard` — topic row (title, category, author, reply count, last activity, pin/lock status)
- `ReplyThread` — recursive-ish reply tree (max 2 levels), renders `ReplyCard` children
- `ReplyCard` — single reply display (author, timestamp, content, reply button)
- `ReplyForm` — textarea + submit, can be inline below the item being replied to

---

## Real-Time Chat Flow (Socket.IO)

1. User logs in → `SocketContext` connects to server with JWT token.
2. User navigates to `/chat` → `ChatPage` mounts → emits `chat:join` for `general` room.
3. User selects a division room → emits `chat:join` for `division-{id}` and `chat:leave` for previous room.
4. User types → debounced `chat:typing` event emitted to current room.
5. User sends message → `chat:message` emitted → server validates, saves to DB, broadcasts `chat:new-message` to all clients in that room.
6. Server-side: `chatHandler.js` verifies JWT on handshake, authorizes room access (user must be in that division or room is `general`), persists message, emits.
7. Chat is ephemeral in the sense that there is no editing — only delete (soft-delete not implemented: hard delete, message row removed).

---

## Error Handling

All endpoints follow existing patterns:
- `400` — Validation error (missing fields, invalid input).
- `401` — No token / invalid token (handled by `authenticate` middleware).
- `403` — Insufficient role (handled by `authorize` middleware).
- `404` — Resource not found.
- `500` — Server error (caught by Express error handler).

Socket.IO errors:
- Invalid token on handshake → connection refused with `auth_error`.
- Unauthorized room join → server silently ignores (does not add to room).
- Message save failure → server emits `chat:error` to sender only.

---

## Testing Strategy

| Layer     | Approach                                           |
|-----------|---------------------------------------------------|
| Database  | Verify table creation via `initDb()` with fresh DB |
| API       | REST endpoint tests with supertest, JWT injection  |
| Socket.IO | Integration tests: connect, join room, send message, verify broadcast |
| Frontend  | Component smoke tests (render with mock contexts)  |
| E2E       | Manual walkthrough: login → pengumuman → chat → forum |

Existing project does not have an automated test suite. New modules should include at least:
- Backend API tests for announcements and forum CRUD (no Socket.IO tests initially beyond manual).
- Manual chat smoke test across two browsers.

---

## Migration Notes

- `database.js`: Add new table creation in `initDb()` (5 new `CREATE TABLE IF NOT EXISTS` statements).
- `server.js`: Wrap Express app with `http.createServer(app)`, attach `socket.io` server, export for `chatHandler.js`.
- `AuthContext.jsx`: On login, emit event so `SocketContext` can connect; on logout, disconnect socket.
- `AppLayout.jsx`: Wrap content tree with `SocketContext.Provider`.
- Sidebar component: Add 3 new navigation items with lucide-react icons (`Megaphone`, `MessageCircle`, `MessagesSquare`).
- Existing files modified: `server.js`, `database.js`, `AppLayout.jsx` (or `Sidebar.jsx`), `AuthContext.jsx`.
- No existing files deleted or significantly refactored.

---

## Out of Scope (Future)

- Chat: unread badges, message editing, typing indicator debounce tuning, online user list per room
- Forum: rich text editor, attachments, reactions/likes, full-text search
- Announcements: rich text editor, email notifications, scheduled posts
- Real-time notifications (e.g., toast when new announcement is posted)
- WebSocket scaling beyond single-process (not needed at 50 users)
