# Marketing & Sales Hub — Phase 2 Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Pipeline Kanban board + Follow-up Reminder + Quote Generator — full sales workflow.

**Prerequisites:** Phase 1 completed (leads table exists, MarketingContext available, WorkspaceLayout works).

**Tech Stack:** React 19, Tailwind CSS 4, lucide-react, react-router-dom v7, Express.js, better-sqlite3, jsPDF (for quote PDF).

---

## Global Constraints

- Reuse components from Phase 1: `MarketingContext`, `WorkspaceLayout`, `Modal`, `Badge`, `Card`, `Button`, `Input`, `Select`, `ConfirmModal`
- Semua komponen baru support `dark:` variant
- Toast via `useToast()` dari `contexts/ToastContext.jsx`
- Auth via `authenticate` middleware
- No breaking changes ke existing code
- Install dependencies: `npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities jspdf`

---

## File Structure

```
backend/
├── database.js                    # MODIFY: add quotes table
├── routes/
│   └── marketing.js               # MODIFY: add quotes CRUD + bulk status update

src/
├── App.jsx                        # MODIFY: add pipeline + quote routes
├── contexts/
│   └── MarketingContext.jsx      # MODIFY: add quotes state + bulk update
├── components/
│   └── marketing/
│       ├── KanbanBoard.jsx       # NEW: drag-drop pipeline board
│       ├── KanbanColumn.jsx      # NEW: single pipeline column
│       ├── KanbanCard.jsx        # NEW: draggable lead card
│       ├── OverdueBadge.jsx      # NEW: sidebar badge indicator
│       └── QuoteForm.jsx         # NEW: quote generator form
├── pages/
│   └── marketing/
│       ├── Pipeline.jsx          # NEW: kanban board page
│       ├── FollowUps.jsx         # NEW: overdue leads list page
│       └── QuoteGenerator.jsx    # NEW: quote form + PDF download page
├── services/
│   └── api.js                    # MODIFY: add quotes API + bulk PATCH
```

---

## Task 1: Database — Quotes Table + Bulk Status Update

**Files:**
- Modify: `backend/database.js`
- Modify: `backend/routes/marketing.js`

**Interfaces:**
- Produces: Table `quotes`, bulk PATCH `/api/leads/bulk-status`

- [ ] **Step 1: Add quotes table**

```sql
CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lead_id INTEGER REFERENCES leads(id),
  title TEXT NOT NULL DEFAULT 'Untitled Quote',
  items TEXT NOT NULL DEFAULT '[]', -- JSON array of {item, description, qty, price}
  subtotal REAL DEFAULT 0,
  discount_percent REAL DEFAULT 0,
  discount_amount REAL DEFAULT 0,
  tax_percent REAL DEFAULT 11,
  tax_amount REAL DEFAULT 0,
  total REAL DEFAULT 0,
  valid_until TEXT,
  notes TEXT DEFAULT '',
  terms TEXT DEFAULT 'Pembayaran dalam 30 hari sejak tanggal invoice.',
  status TEXT NOT NULL DEFAULT 'Draft' CHECK(status IN ('Draft','Sent','Accepted','Rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

- [ ] **Step 2: Add bulk status update endpoint to marketing.js**

```javascript
// PATCH /api/leads/bulk-status — update multiple leads at once (for drag-drop)
router.patch('/bulk-status', (req, res) => {
  const db = getDb();
  const { ids, status } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids harus berupa array non-empty' });
  }
  if (!status) {
    return res.status(400).json({ error: 'status wajib diisi' });
  }

  const validStatuses = ['New','Contacted','Qualified','Demo','Proposal','Negotiation','Won','Lost'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Status tidak valid' });
  }

  const placeholders = ids.map(() => '?').join(',');
  const stmt = db.prepare(`UPDATE leads SET status = ?, updated_at = datetime('now') WHERE id IN (${placeholders})`);
  const result = stmt.run(status, ...ids);

  res.json({ success: true, updated: result.changes });
});
```

- [ ] **Step 3: Add quotes CRUD routes**

```javascript
// GET /api/quotes?lead_id=X
router.get('/quotes', (req, res) => {
  const db = getDb();
  const { lead_id } = req.query;

  let sql = 'SELECT * FROM quotes WHERE 1=1';
  const params = [];
  if (lead_id) { sql += ' AND lead_id = ?'; params.push(lead_id); }
  sql += ' ORDER BY created_at DESC';

  const quotes = db.prepare(sql).all(...params);
  res.json({ quotes });
});

// POST /api/quotes
router.post('/quotes', (req, res) => {
  const db = getDb();
  const { lead_id, title, items, subtotal, discount_percent, discount_amount, tax_percent, tax_amount, total, valid_until, notes, terms, status } = req.body;

  if (!lead_id) return res.status(400).json({ error: 'lead_id wajib diisi' });

  const result = db.prepare(`
    INSERT INTO quotes (lead_id, title, items, subtotal, discount_percent, discount_amount, tax_percent, tax_amount, total, valid_until, notes, terms, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(lead_id, title || 'Untitled Quote', JSON.stringify(items || []), subtotal || 0, discount_percent || 0, discount_amount || 0, tax_percent || 11, tax_amount || 0, total || 0, valid_until || null, notes || '', terms || 'Pembayaran dalam 30 hari sejak tanggal invoice.', status || 'Draft');

  const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ quote });
});

// PATCH /api/quotes/:id
router.patch('/quotes/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Quote tidak ditemukan' });

  const allowed = ['title','items','subtotal','discount_percent','discount_amount','tax_percent','tax_amount','total','valid_until','notes','terms','status'];
  const updates = [];
  const params = [];

  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      updates.push(`${key} = ?`);
      // items needs JSON.stringify if object/array
      params.push(key === 'items' && typeof req.body[key] === 'object' ? JSON.stringify(req.body[key]) : req.body[key]);
    }
  }

  if (updates.length === 0) return res.status(400).json({ error: 'Tidak ada field untuk diupdate' });

  updates.push("updated_at = datetime('now')");
  params.push(req.params.id);

  db.prepare(`UPDATE quotes SET ${updates.join(', ')} WHERE id = ?`).run(...params);
  const quote = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
  res.json({ quote });
});

// DELETE /api/quotes/:id
router.delete('/quotes/:id', (req, res) => {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM quotes WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Quote tidak ditemukan' });

  db.prepare('DELETE FROM quotes WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Export lead as quote template — GET /api/quotes/template/:leadId
router.get('/quotes/template/:leadId', (req, res) => {
  const db = getDb();
  const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.leadId);
  if (!lead) return res.status(404).json({ error: 'Lead tidak ditemukan' });

  res.json({
    company_name: lead.company_name,
    contact_name: lead.contact_name,
    contact_email: lead.contact_email,
    items: [],
    notes: '',
  });
});
```

- [ ] **Step 4: Register new quote routes in server.js**

```javascript
app.use('/api/quotes', marketingRoutes);
```

- [ ] **Step 5: Verify**

```bash
cd backend && node -e "const {getDb}=require('./database.js');const db=getDb();const t=db.prepare(\"SELECT name FROM sqlite_master WHERE type='table'\").all().map(r=>r.name);console.log(t.includes('quotes')?'PASS: quotes table exists':'FAIL')"
```

- [ ] **Step 6: Commit**

```bash
git add backend/database.js backend/routes/marketing.js backend/server.js
git commit -m "feat: add quotes table, bulk status update, and quotes CRUD routes"
```

---

## Task 2: Install Dependencies + API Methods

**Files:**
- Modify: `src/services/api.js`
- Execute: `npm install`

- [ ] **Step 1: Install dependencies**

```bash
cd C:\Users\Administrator\server-access-portal-main
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities jspdf
```

- [ ] **Step 2: Add API methods to api.js**

```javascript
// Bulk update leads (for drag-drop kanban)
bulkUpdateLeads: (ids, status) => request('/leads/bulk-status', { method: 'PATCH', body: JSON.stringify({ ids, status }) }),

// Quotes
getQuotes: (params = {}) => {
  const q = new URLSearchParams();
  if (params.lead_id) q.set('lead_id', params.lead_id);
  const qs = q.toString();
  return request(`/quotes${qs ? `?${qs}` : ''}`);
},
getQuoteTemplate: (leadId) => request(`/quotes/template/${leadId}`),
createQuote: (data) => request('/quotes', { method: 'POST', body: JSON.stringify(data) }),
updateQuote: (id, data) => request(`/quotes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
deleteQuote: (id) => request(`/quotes/${id}`, { method: 'DELETE' }),
```

- [ ] **Step 3: Commit**

```bash
git add src/services/api.js package.json package-lock.json
git commit -m "feat: add dnd-kit, jspdf, and quotes API methods"
```

---

## Task 3: Kanban Board Components

**Files:**
- Create: `src/components/marketing/KanbanBoard.jsx`
- Create: `src/components/marketing/KanbanColumn.jsx`
- Create: `src/components/marketing/KanbanCard.jsx`

**Interfaces:**
- Consumes: leads array from MarketingContext
- Produces: Drag-drop kanban board with columns per status, cards with lead info

- [ ] **Step 1: Create KanbanCard.jsx**

```javascript
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

const statusColors = {
  New: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  Contacted: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300',
  Qualified: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  Demo: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300',
  Proposal: 'bg-fuchsia-100 dark:bg-fuchsia-900/30 text-fuchsia-700 dark:text-fuchsia-300',
  Negotiation: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  Won: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  Lost: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
};

const formatCurrency = (v) => {
  if (!v) return '—';
  if (v >= 1e9) return `Rp ${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `Rp ${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `Rp ${(v / 1e3).toFixed(1)}K`;
  return `Rp ${v}`;
};

export default function KanbanCard({ lead }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 shadow-sm hover:shadow-md transition-shadow cursor-default"
    >
      <div className="flex items-start gap-2">
        <button {...attributes} {...listeners} className="mt-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-grab active:cursor-grabbing">
          <GripVertical className="w-4 h-4" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm text-gray-900 dark:text-white truncate">{lead.company_name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">{lead.contact_name}</p>
          <div className="flex items-center justify-between mt-2">
            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${statusColors[lead.status] || ''}`}>
              {lead.source}
            </span>
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">{formatCurrency(lead.value)}</span>
          </div>
          {lead.next_follow_up && (
            <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1.5">
              Follow-up: {new Date(lead.next_follow_up).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create KanbanColumn.jsx**

```javascript
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import KanbanCard from './KanbanCard';

const statusMeta = {
  New: { label: 'New', color: 'border-t-blue-500', bg: 'bg-blue-50/50 dark:bg-blue-950/20' },
  Contacted: { label: 'Contacted', color: 'border-t-amber-500', bg: 'bg-amber-50/50 dark:bg-amber-950/20' },
  Qualified: { label: 'Qualified', color: 'border-t-purple-500', bg: 'bg-purple-50/50 dark:bg-purple-950/20' },
  Demo: { label: 'Demo', color: 'border-t-pink-500', bg: 'bg-pink-50/50 dark:bg-pink-950/20' },
  Proposal: { label: 'Proposal', color: 'border-t-fuchsia-500', bg: 'bg-fuchsia-50/50 dark:bg-fuchsia-950/20' },
  Negotiation: { label: 'Negotiation', color: 'border-t-orange-500', bg: 'bg-orange-50/50 dark:bg-orange-950/20' },
  Won: { label: 'Won', color: 'border-t-green-500', bg: 'bg-green-50/50 dark:bg-green-950/20' },
  Lost: { label: 'Lost', color: 'border-t-red-500', bg: 'bg-red-50/50 dark:bg-red-950/20' },
};

const formatCurrency = (v) => {
  if (!v) return 'Rp 0';
  if (v >= 1e9) return `Rp ${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `Rp ${(v / 1e6).toFixed(1)}M`;
  return `Rp ${(v / 1e3).toFixed(1)}K`;
};

export default function KanbanColumn({ status, leads }) {
  const { setNodeRef } = useDroppable({ id: status });
  const meta = statusMeta[status] || { label: status, color: 'border-t-gray-500', bg: 'bg-gray-50/50' };

  const totalValue = leads.reduce((sum, l) => sum + (l.value || 0), 0);

  return (
    <div className={`flex-shrink-0 w-72 flex flex-col rounded-xl border border-gray-200 dark:border-gray-700 border-t-2 ${meta.color} ${meta.bg} max-h-full`}>
      {/* Column Header */}
      <div className="px-3 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-900 dark:text-white">{meta.label}</span>
          <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded-full tabular-nums">{leads.length}</span>
        </div>
        <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">{formatCurrency(totalValue)}</span>
      </div>

      {/* Cards */}
      <div ref={setNodeRef} className="flex-1 px-2 pb-2 space-y-2 overflow-y-auto min-h-[120px]">
        <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map(lead => <KanbanCard key={lead.id} lead={lead} />)}
        </SortableContext>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create KanbanBoard.jsx**

```javascript
import { useState, useCallback } from 'react';
import { DndContext, DragOverlay, closestCorners } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import KanbanColumn from './KanbanColumn';
import KanbanCard from './KanbanCard';
import { useMarketing } from '../../contexts/MarketingContext';
import { useToast } from '../../contexts/ToastContext';

const STATUSES = ['New', 'Contacted', 'Qualified', 'Demo', 'Proposal', 'Negotiation', 'Won', 'Lost'];

export default function KanbanBoard() {
  const { leads, updateLead, fetchLeads } = useMarketing();
  const [activeLead, setActiveLead] = useState(null);
  const toast = useToast();

  const grouped = STATUSES.reduce((acc, status) => {
    acc[status] = leads.filter(l => l.status === status);
    return acc;
  }, {});

  const findColumn = (id) => {
    // Check if id is a column
    if (STATUSES.includes(id)) return id;
    // It's a lead id — find which column it's in
    const lead = leads.find(l => l.id === id);
    return lead?.status || null;
  };

  const handleDragStart = (event) => {
    const { active } = event;
    const lead = leads.find(l => l.id === active.id);
    setActiveLead(lead);
  };

  const handleDragEnd = useCallback(async (event) => {
    const { active, over } = event;
    setActiveLead(null);

    if (!over) return;

    const activeCol = findColumn(active.id);
    const overCol = findColumn(over.id);

    if (!activeCol || !overCol) return;

    // If dropped on a different status column
    if (active.data.current?.type === 'lead' && STATUSES.includes(overCol)) {
      try {
        await updateLead(active.id, { status: overCol });
        toast.success(`Lead dipindahkan ke ${overCol}`);
      } catch (err) {
        toast.error('Gagal update lead');
      }
      return;
    }

    // Same column reorder (future: save order to DB)
    if (activeCol === overCol) {
      // For now, just fetch fresh data
      fetchLeads();
    }
  }, [leads, updateLead, toast, fetchLeads]);

  return (
    <DndContext collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex gap-4 overflow-x-auto pb-4 h-full" style={{ scrollbarWidth: 'thin' }}>
        {STATUSES.map(status => (
          <KanbanColumn key={status} status={status} leads={grouped[status] || []} />
        ))}
      </div>
      <DragOverlay>
        {activeLead && <KanbanCard lead={activeLead} />}
      </DragOverlay>
    </DndContext>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/components/marketing/
git commit -m "feat: add KanbanBoard, KanbanColumn, KanbanCard drag-drop components"
```

---

## Task 4: Pipeline + FollowUps + Quote Pages

**Files:**
- Create: `src/pages/marketing/Pipeline.jsx`
- Create: `src/pages/marketing/FollowUps.jsx`
- Create: `src/pages/marketing/QuoteGenerator.jsx`
- Create: `src/components/marketing/QuoteForm.jsx`
- Modify: `src/App.jsx` (add routes)
- Modify: `src/contexts/MarketingContext.jsx` (add quotes state)

- [ ] **Step 1: Create QuoteForm.jsx**

```javascript
import { useState, useEffect } from 'react';
import { Plus, Trash2, Download } from 'lucide-react';
import { jsPDF } from 'jspdf';

export default function QuoteForm({ lead, onSave, initialData }) {
  const [title, setTitle] = useState(initialData?.title || `Quote - ${lead?.company_name || ''}`);
  const [items, setItems] = useState(initialData?.items || [{ item: '', description: '', qty: 1, price: 0 }]);
  const [discountPercent, setDiscountPercent] = useState(initialData?.discount_percent || 0);
  const [taxPercent] = useState(11);
  const [validUntil, setValidUntil] = useState(initialData?.valid_until?.split('T')[0] || '');
  const [notes, setNotes] = useState(initialData?.notes || '');

  const addItem = () => setItems([...items, { item: '', description: '', qty: 1, price: 0 }]);
  const removeItem = (i) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i, field, value) => {
    const updated = [...items];
    updated[i] = { ...updated[i], [field]: field === 'price' || field === 'qty' ? parseFloat(value) || 0 : value };
    setItems(updated);
  };

  const subtotal = items.reduce((s, i) => s + (i.qty * i.price), 0);
  const discountAmount = (subtotal * discountPercent) / 100;
  const afterDiscount = subtotal - discountAmount;
  const taxAmount = (afterDiscount * taxPercent) / 100;
  const total = afterDiscount + taxAmount;

  const handleSave = () => {
    onSave({
      title,
      items: JSON.stringify(items),
      subtotal,
      discount_percent: discountPercent,
      discount_amount: discountAmount,
      tax_percent: taxPercent,
      tax_amount: taxAmount,
      total,
      valid_until: validUntil || null,
      notes,
    });
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('QUOTE', 14, 20);
    doc.setFontSize(12);
    doc.text(`Nomor: #${lead?.id}-${Date.now().toString(36)}`, 14, 30);
    doc.text(`Tanggal: ${new Date().toLocaleDateString('id-ID')}`, 14, 37);
    doc.text(`Kepada: ${lead?.company_name || ''}`, 14, 47);
    if (lead?.contact_name) doc.text(`Attn: ${lead.contact_name}`, 14, 54);

    // Items table
    let y = 70;
    doc.setFontSize(10);
    doc.text('Item', 14, y);
    doc.text('Deskripsi', 70, y);
    doc.text('Qty', 130, y);
    doc.text('Harga', 150, y);
    doc.text('Total', 175, y);
    y += 5;
    doc.line(14, y, 195, y);
    y += 7;

    items.forEach(it => {
      doc.text(it.item || '-', 14, y);
      doc.text((it.description || '-').substring(0, 25), 70, y);
      doc.text(String(it.qty || 1), 130, y);
      doc.text(`Rp ${(it.price || 0).toLocaleString('id-ID')}`, 150, y);
      doc.text(`Rp ${((it.qty || 1) * (it.price || 0)).toLocaleString('id-ID')}`, 175, y);
      y += 7;
    });

    y += 5;
    doc.line(14, y, 195, y);
    y += 7;
    doc.text(`Subtotal: Rp ${subtotal.toLocaleString('id-ID')}`, 130, y);
    y += 7;
    if (discountPercent > 0) doc.text(`Diskon (${discountPercent}%): -Rp ${discountAmount.toLocaleString('id-ID')}`, 130, y);
    y += 7;
    doc.text(`Pajak (${taxPercent}%): Rp ${taxAmount.toLocaleString('id-ID')}`, 130, y);
    y += 7;
    doc.setFontSize(12);
    doc.text(`TOTAL: Rp ${total.toLocaleString('id-ID')}`, 130, y);

    if (validUntil) {
      doc.setFontSize(10);
      doc.text(`Berlaku sampai: ${new Date(validUntil).toLocaleDateString('id-ID')}`, 14, y + 15);
    }
    if (notes) {
      doc.setFontSize(9);
      doc.text(`Catatan: ${notes}`, 14, y + 25);
    }

    doc.save(`quote-${lead?.company_name?.replace(/\s/g, '-').toLowerCase() || 'untitled'}.pdf`);
    return doc;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Judul Quote</label>
          <input value={title} onChange={e => setTitle(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Berlaku Sampai</label>
          <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm" />
        </div>
      </div>

      {/* Items */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Items</label>
          <button onClick={addItem} className="text-xs text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
            <Plus className="w-3 h-3" /> Tambah Item
          </button>
        </div>
        <div className="space-y-2">
          {items.map((it, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input placeholder="Nama item" value={it.item} onChange={e => updateItem(idx, 'item', e.target.value)} className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm" />
              <input placeholder="Deskripsi" value={it.description} onChange={e => updateItem(idx, 'description', e.target.value)} className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm" />
              <input type="number" placeholder="Qty" value={it.qty} onChange={e => updateItem(idx, 'qty', e.target.value)} className="w-16 px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-center" />
              <input type="number" placeholder="Harga" value={it.price} onChange={e => updateItem(idx, 'price', e.target.value)} className="w-28 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm" />
              <button onClick={() => removeItem(idx)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="flex justify-between items-start">
        <div className="w-40">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Diskon (%)</label>
          <input type="number" value={discountPercent} onChange={e => setDiscountPercent(parseFloat(e.target.value) || 0)} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm" />
        </div>
        <div className="text-right space-y-1">
          <div className="text-sm text-gray-500 dark:text-gray-400">Subtotal: <span className="font-medium text-gray-900 dark:text-white">Rp {subtotal.toLocaleString('id-ID')}</span></div>
          {discountPercent > 0 && <div className="text-sm text-gray-500 dark:text-gray-400">Diskon: <span className="font-medium text-red-500">-Rp {discountAmount.toLocaleString('id-ID')}</span></div>}
          <div className="text-sm text-gray-500 dark:text-gray-400">Pajak (11%): <span className="font-medium text-gray-900 dark:text-white">Rp {taxAmount.toLocaleString('id-ID')}</span></div>
          <div className="text-lg font-bold text-gray-900 dark:text-white">Total: Rp {total.toLocaleString('id-ID')}</div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Catatan</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm" />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3 pt-2 border-t border-gray-200 dark:border-gray-700">
        <button onClick={generatePDF} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors">
          <Download className="w-4 h-4" /> Download PDF
        </button>
        <button onClick={handleSave} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">
          Simpan Quote
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create Pipeline.jsx**

```javascript
import KanbanBoard from '../../components/marketing/KanbanBoard';

export default function Pipeline() {
  return (
    <div className="p-6 h-full flex flex-col">
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sales Pipeline</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Drag & drop leads antar status. Klik kartu untuk detail.</p>
      </div>
      <div className="flex-1 overflow-hidden">
        <KanbanBoard />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create FollowUps.jsx**

```javascript
import { useState, useEffect } from 'react';
import { useMarketing } from '../../contexts/MarketingContext';
import { useToast } from '../../contexts/ToastContext';
import { Phone, Mail, CalendarX, Clock } from 'lucide-react';

export default function FollowUps() {
  const { fetchLeads, updateLead } = useMarketing();
  const toast = useToast();
  const [overdue, setOverdue] = useState([]);
  const [dueToday, setDueToday] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeads().then(leads => {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const o = [];
      const t = [];
      leads.forEach(l => {
        if (!l.next_follow_up || ['Won','Lost'].includes(l.status)) return;
        if (l.next_follow_up < today) o.push(l);
        else if (l.next_follow_up === today) t.push(l);
      });
      setOverdue(o);
      setDueToday(t);
      setLoading(false);
    });
  }, [fetchLeads]);

  const handleMarkDone = async (lead) => {
    try {
      await updateLead(lead.id, { next_follow_up: new Date(Date.now() + 7 * 864e5).toISOString().split('T')[0] });
      toast.success(`Follow-up ${lead.company_name} dijadwalkan ulang ke minggu depan`);
      fetchLeads();
    } catch (err) {
      toast.error('Gagal update');
    }
  };

  if (loading) return <div className="p-6 text-gray-400">Memuat...</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Follow-up Reminder</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{overdue.length} overdue, {dueToday.length} hari ini</p>
      </div>

      {/* Overdue */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <CalendarX className="w-5 h-5 text-red-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Overdue ({overdue.length})</h2>
        </div>
        {overdue.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">Tidak ada follow-up yang overdue 🎉</p>
        ) : (
          <div className="space-y-2">
            {overdue.map(l => (
              <div key={l.id} className="flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{l.company_name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {new Date(l.next_follow_up).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })} — {l.contact_name}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded-full">Overdue</span>
                  <button onClick={() => handleMarkDone(l)} className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg">Reschedule</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Due Today */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Phone className="w-5 h-5 text-amber-500" />
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Hari Ini ({dueToday.length})</h2>
        </div>
        {dueToday.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">Tidak ada follow-up hari ini</p>
        ) : (
          <div className="space-y-2">
            {dueToday.map(l => (
              <div key={l.id} className="flex items-center justify-between bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">{l.company_name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    <Mail className="w-3 h-3 inline mr-1" />
                    {l.contact_email || 'Tidak ada email'} — {l.contact_name}
                  </p>
                </div>
                <button onClick={() => handleMarkDone(l)} className="px-3 py-1.5 text-xs font-medium bg-green-600 hover:bg-green-700 text-white rounded-lg">Selesai</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create QuoteGenerator.jsx**

```javascript
import { useState } from 'react';
import { useMarketing } from '../../contexts/MarketingContext';
import { useToast } from '../../contexts/ToastContext';
import { useParams, useNavigate } from 'react-router-dom';
import QuoteForm from '../../components/marketing/QuoteForm';

export default function QuoteGenerator() {
  const { leadId } = useParams();
  const { leads, createQuote } = useMarketing();
  const toast = useToast();
  const navigate = useNavigate();

  const [selectedLead, setSelectedLead] = useState(null);

  const lead = selectedLead || leads.find(l => l.id === parseInt(leadId)) || null;

  const handleSave = async (data) => {
    try {
      const quote = await createQuote({ ...data, lead_id: lead.id, status: 'Draft' });
      toast.success('Quote berhasil disimpan');
    } catch (err) {
      toast.error('Gagal menyimpan quote');
    }
  };

  if (!lead) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Quote Generator</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Pilih lead untuk membuat quote</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {leads.filter(l => !['Won','Lost'].includes(l.status)).map(l => (
            <button key={l.id} onClick={() => setSelectedLead(l)} className="text-left p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-blue-500 transition-colors">
              <p className="font-medium text-gray-900 dark:text-white">{l.company_name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{l.contact_name}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-5">
        <button onClick={() => { setSelectedLead(null); navigate('/marketing/quotes'); }} className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-2">&larr; Pilih lead lain</button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Quote Generator</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Untuk: <strong>{lead.company_name}</strong> — {lead.contact_name}
        </p>
      </div>
      <QuoteForm lead={lead} onSave={handleSave} />
    </div>
  );
}
```

- [ ] **Step 5: Update MarketingContext — add quotes state**

```javascript
// Add to MarketingContext.jsx:
const [quotes, setQuotes] = useState([]);

const fetchQuotes = useCallback(async (params = {}) => {
  const { quotes: data } = await api.getQuotes(params);
  setQuotes(data);
  return data;
}, []);

const createQuote = useCallback(async (data) => {
  const { quote } = await api.createQuote(data);
  setQuotes(prev => [quote, ...prev]);
  return quote;
}, []);

const updateLeadBulk = useCallback(async (ids, status) => {
  await api.bulkUpdateLeads(ids, status);
  fetchLeads();
}, [fetchLeads]);
```

- [ ] **Step 6: Update App.jsx — add routes**

```javascript
// Add to MarketingRoutes:
<Route path="/marketing/pipeline" element={<Pipeline />} />
<Route path="/marketing/followups" element={<FollowUps />} />
<Route path="/marketing/quotes" element={<QuoteGenerator />} />
<Route path="/marketing/quotes/:leadId" element={<QuoteGenerator />} />
```

- [ ] **Step 7: Add route to marketing navigation**

```javascript
// Add to marketing/navigation.js:
{ to: '/marketing/pipeline', icon: 'Layout', label: 'Pipeline', exact: true },
{ to: '/marketing/followups', icon: 'Bell', label: 'Follow-ups' },
{ to: '/marketing/quotes', icon: 'FileText', label: 'Quotes' },
```

- [ ] **Step 8: Build and verify**

```bash
cd C:\Users\Administrator\server-access-portal-main
npm run build 2>&1
```

Expected: No build errors.

- [ ] **Step 9: Manual test**
  - [ ] `/marketing/pipeline` — kanban board with 8 columns, drag & drop works
  - [ ] `/marketing/followups` — overdue and due today lists
  - [ ] `/marketing/quotes` — lead selector grid
  - [ ] Select lead → quote form, add items, download PDF
  - [ ] PDF opens with proper formatting

- [ ] **Step 10: Commit**

```bash
git add src/pages/marketing/ src/components/marketing/ src/contexts/MarketingContext.jsx src/App.jsx src/workspaces/marketing/
git commit -m "feat: add Pipeline kanban, Follow-ups, and Quote Generator (Phase 2)"
```

---

## Self-Review Checklist

| Acceptance Criterion | Task |
|---|---|
| Pipeline kanban dengan 8 kolom | Task 3, 4 |
| Drag-drop lead antar kolom | Task 3 (KanbanBoard + dnd-kit) |
| Status update via drag-drop | Task 3 (handleDragEnd → bulkUpdateLeads) |
| Follow-up reminder list | Task 4 (FollowUps.jsx) |
| Overdue badge | Task 4 (FollowUps.jsx overdue section) |
| Quote generator form | Task 4 (QuoteForm.jsx) |
| PDF download | Task 4 (QuoteForm generatePDF) |
| Item CRUD di form quote | Task 4 (QuoteForm items array) |
| Sidebar nav items | Task 4 Step 7 |
| Dark mode | All components use dark: classes |
