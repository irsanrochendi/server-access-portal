# Marketing & Sales Hub — Phase 3 Implementation Plan

> Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Content Calendar, Campaign Tracker, Email Templates — full content marketing workflow.

**Prerequisites:** Phase 1-2 completed (tables exist: content_calendar, campaigns, quotes; MarketingContext ready).

**Tech Stack:** React 19, Tailwind 4, lucide-react, Express + better-sqlite3, react-calendar (npm install react-calendar).

---

## Global Constraints
- Reuse: MarketingContext, WorkspaceLayout, Modal, Badge, Card, Button, Input, Select, ConfirmModal
- Dark mode via `dark:` classes, Toast via `useToast()`
- No breaking changes

---

## File Structure
```
backend/
├── database.js         # MODIFY: add email_templates table
├── routes/
│   └── marketing.js    # MODIFY: add email templates CRUD

src/
├── App.jsx             # MODIFY: add content, campaign, email routes
├── contexts/
│   └── MarketingContext.jsx  # MODIFY: add templates state
├── components/
│   └── marketing/
│       ├── ContentCalendarView.jsx  # NEW: monthly calendar
│       ├── ContentForm.jsx          # NEW: add/edit content modal form
│       ├── CampaignForm.jsx         # NEW: add/edit campaign modal form
│       └── EmailPreview.jsx         # NEW: HTML email preview iframe
├── pages/
│   └── marketing/
│       ├── ContentCalendar.jsx      # NEW: calendar + list
│       ├── Campaigns.jsx            # NEW: campaign table + form
│       └── EmailTemplates.jsx       # NEW: template CRUD + preview
├── services/
│   └── api.js           # MODIFY: add email templates API
```

---

## Task 1: Database — Email Templates Table

- [ ] **Step 1: Add email_templates to database.js**

```sql
CREATE TABLE IF NOT EXISTS email_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL DEFAULT '',
  category TEXT DEFAULT 'General' CHECK(category IN ('Welcome','Nurture','Promo','Follow-up','Newsletter','Other')),
  variables TEXT DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

- [ ] **Step 2: Add email templates routes to marketing.js**

```javascript
// GET /api/email-templates
router.get('/email-templates', (req, res) => {
  const db = getDb();
  const templates = db.prepare('SELECT * FROM email_templates ORDER BY updated_at DESC').all();
  res.json({ templates });
});

// GET /api/email-templates/:id
router.get('/email-templates/:id', (req, res) => {
  const db = getDb();
  const template = db.prepare('SELECT * FROM email_templates WHERE id = ?').get(req.params.id);
  if (!template) return res.status(404).json({ error: 'Template tidak ditemukan' });
  res.json({ template });
});

// POST /api/email-templates
router.post('/email-templates', (req, res) => {
  const db = getDb();
  const { name, subject, body_html, category, variables } = req.body;
  if (!name || !subject) return res.status(400).json({ error: 'name dan subject wajib diisi' });
  const result = db.prepare('INSERT INTO email_templates (name, subject, body_html, category, variables) VALUES (?, ?, ?, ?, ?)').run(name, subject, body_html || '', category || 'General', JSON.stringify(variables || []));
  const template = db.prepare('SELECT * FROM email_templates WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ template });
});

// PATCH /api/email-templates/:id
router.patch('/email-templates/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM email_templates WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Template tidak ditemukan' });
  const allowed = ['name','subject','body_html','category','variables'];
  const updates = [];
  const params = [];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      updates.push(`${key} = ?`);
      params.push(key === 'variables' && typeof req.body[key] === 'object' ? JSON.stringify(req.body[key]) : req.body[key]);
    }
  }
  updates.push("updated_at = datetime('now')");
  params.push(req.params.id);
  db.prepare(`UPDATE email_templates SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  res.json({ template: db.prepare('SELECT * FROM email_templates WHERE id = ?').get(req.params.id) });
});

// DELETE /api/email-templates/:id
router.delete('/email-templates/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM email_templates WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Template tidak ditemukan' });
  db.prepare('DELETE FROM email_templates WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});
```

- [ ] **Step 3: Register routes in server.js**

```javascript
app.use('/api/email-templates', marketingRoutes);
```

- [ ] **Step 4: Verify + commit**

```bash
cd backend && node -e "const {getDb}=require('./database.js'); const db=getDb(); const t=db.prepare(\"SELECT name FROM sqlite_master WHERE type='table'\").all().map(r=>r.name); console.log(t.includes('email_templates')?'PASS':'FAIL');"
git add backend/ && git commit -m "feat: add email_templates table and CRUD routes (Phase 3)"
```

---

## Task 2: Install Dependencies + API Methods

- [ ] **Step 1: Install**

```bash
cd C:\Users\Administrator\server-access-portal-main
npm install react-calendar
```

- [ ] **Step 2: Add API methods to api.js**

```javascript
getEmailTemplates: () => request('/email-templates'),
getEmailTemplate: (id) => request(`/email-templates/${id}`),
createEmailTemplate: (data) => request('/email-templates', { method: 'POST', body: JSON.stringify(data) }),
updateEmailTemplate: (id, data) => request(`/email-templates/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
deleteEmailTemplate: (id) => request(`/email-templates/${id}`, { method: 'DELETE' }),
```

- [ ] **Step 3: Update MarketingContext — add templates state**

```javascript
const [templates, setTemplates] = useState([]);
const fetchTemplates = useCallback(async () => { const { templates: t } = await api.getEmailTemplates(); setTemplates(t); return t; }, []);
const createTemplate = useCallback(async (data) => { const { template } = await api.createEmailTemplate(data); setTemplates(prev => [template, ...prev]); return template; }, []);
const updateTemplate = useCallback(async (id, data) => { const { template } = await api.updateEmailTemplate(id, data); setTemplates(prev => prev.map(t => t.id === id ? template : t)); return template; }, []);
const deleteTemplate = useCallback(async (id) => { await api.deleteEmailTemplate(id); setTemplates(prev => prev.filter(t => t.id !== id)); }, []);
// Add to provider value + useEffect to fetchTemplates on mount
```

- [ ] **Step 4: Commit**

```bash
git add src/services/api.js src/contexts/MarketingContext.jsx package.json
git commit -m "feat: add email templates API methods and state (Phase 3)"
```

---

## Task 3: Content Calendar Page

**Files:** `ContentCalendar.jsx`, `ContentCalendarView.jsx`, `ContentForm.jsx`

- [ ] **Step 1: Create ContentCalendarView.jsx**

```javascript
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { useMemo } from 'react';

const channelColors = {
  Blog: 'bg-green-500', LinkedIn: 'bg-blue-500', Instagram: 'bg-pink-500',
  Twitter: 'bg-sky-500', Email: 'bg-amber-500', YouTube: 'bg-red-500', Other: 'bg-gray-500',
};

export default function ContentCalendarView({ items, onSelectDate, onSelectItem }) {
  const dateMap = useMemo(() => {
    const map = {};
    items.forEach(i => {
      if (i.scheduled_date) {
        const d = i.scheduled_date.split('T')[0];
        if (!map[d]) map[d] = [];
        map[d].push(i);
      }
    });
    return map;
  }, [items]);

  const tileContent = ({ date }) => {
    const key = date.toISOString().split('T')[0];
    const dayItems = dateMap[key];
    if (!dayItems) return null;
    return (
      <div className="flex flex-wrap gap-0.5 mt-0.5 justify-center">
        {dayItems.slice(0, 3).map((i, idx) => (
          <span key={idx} className={`w-2 h-2 rounded-full ${channelColors[i.channel] || 'bg-gray-400'}`} title={i.title} />
        ))}
        {dayItems.length > 3 && <span className="text-[9px] text-gray-500">+{dayItems.length-3}</span>}
      </div>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <style>{`
        .react-calendar { width: 100%; border: none; background: transparent; font-family: inherit; }
        .react-calendar__tile { padding: 0.75em 0.5em; border-radius: 0.5rem; }
        .react-calendar__tile--active { background: #3b82f6; color: white; }
        .dark .react-calendar { color: #e5e7eb; }
        .dark .react-calendar__tile:enabled:hover { background: #374151; }
        .dark .react-calendar__tile--active { background: #3b82f6; }
        .dark .react-calendar__navigation button { color: #e5e7eb; }
        .dark .react-calendar__month-view__weekdays { color: #9ca3af; }
      `}</style>
      <Calendar tileContent={tileContent} onClickDay={(date) => onSelectDate(date.toISOString().split('T')[0])} />
    </div>
  );
}
```

- [ ] **Step 2: Create ContentForm.jsx**

Simple form modal: title, channel select, status select, scheduled_date, content_url, notes. Reuse Modal component.

- [ ] **Step 3: Create ContentCalendar.jsx**

Combined page: left CalendarView (60%), right item list + form for selected date. Filters by channel + status at top. Add/edit modal opens via Modal component. Delete via ConfirmModal.

- [ ] **Step 4: Commit**

```bash
git add src/components/marketing/ src/pages/marketing/ContentCalendar.jsx
git commit -m "feat: add Content Calendar page with react-calendar (Phase 3)"
```

---

## Task 4: Campaigns + Email Templates Pages

**Files:** `Campaigns.jsx`, `CampaignForm.jsx`, `EmailTemplates.jsx`, `EmailPreview.jsx`

- [ ] **Step 1: Create Campaigns.jsx**

Table with columns: Name, Type, Status badge, Budget, Spent, Start/End, Actions. Filters by status. Add/edit via Modal + CampaignForm. Delete via ConfirmModal. CampaignForm: name, type select, start/end date, budget, notes.

- [ ] **Step 2: Create EmailPreview.jsx**

```javascript
export default function EmailPreview({ html, subject, variables = [] }) {
  let content = html;
  variables.forEach(v => {
    content = content.replace(new RegExp(`{{${v}}}`, 'g'), `[${v}]`);
  });
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div className="bg-gray-100 dark:bg-gray-700 px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
        Subject: <strong>{subject || '(No subject)'}</strong>
      </div>
      <iframe srcDoc={content} className="w-full h-96 border-0" title="Email Preview" />
    </div>
  );
}
```

- [ ] **Step 3: Create EmailTemplates.jsx**

Split layout: left sidebar (template list, search), right panel (editor + preview). Template form: name, subject, category select, body_html textarea, variables input (comma-separated). Preview tab shows rendered HTML with variable placeholders. Uses Modal for add/edit form, ConfirmModal for delete.

- [ ] **Step 4: Update App.jsx — add routes**

```javascript
<Route path="/marketing/content" element={<ContentCalendar />} />
<Route path="/marketing/campaigns" element={<Campaigns />} />
<Route path="/marketing/emails" element={<EmailTemplates />} />
```

- [ ] **Step 5: Build + manual test**

```bash
npm run build 2>&1
```

- [ ] Visit `/marketing/content` — calendar renders, click date shows items
- [ ] Visit `/marketing/campaigns` — table + add/edit/delete
- [ ] Visit `/marketing/emails` — template CRUD + HTML preview

- [ ] **Step 6: Commit**

```bash
git add src/pages/marketing/ src/components/marketing/ src/App.jsx
git commit -m "feat: add Content Calendar, Campaign Tracker, Email Templates (Phase 3)"
```

---

## Self-Review Checklist

| Acceptance Criterion | Task |
|---|---|
| Content calendar monthly view | Task 3 (react-calendar) |
| Filter by channel | Task 3 (ContentCalendar filter) |
| Add/edit content via modal | Task 3 (ContentForm) |
| Campaign table with status badge | Task 4 (Campaigns) |
| Budget vs spent display | Task 4 (Campaign table columns) |
| Email template CRUD | Task 4 (EmailTemplates) |
| HTML preview | Task 4 (EmailPreview iframe) |
| Dashboard charts update | Phase 1 dashboard auto-refetches on context change |
| Dark mode | All components use dark: |
