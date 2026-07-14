# Marketing & Sales Hub — Phase 4 Implementation Plan

> Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** ROI Calculator (public), Battle Cards, Short Links + UTM.

**Prerequisites:** Phase 1-3 completed. Content calendar, campaigns data used for analytics.

**Tech Stack:** React 19, Tailwind 4, lucide-react, jsPDF (already installed), Express + better-sqlite3.

---

## Global Constraints
- Reuse: MarketingContext, Modal, Card, Button, Input, Select, Badge, ConfirmModal
- Dark mode, Toast, auth middleware
- ROI Calculator page = **public** (no auth required)
- No breaking changes

---

## File Structure
```
backend/
├── database.js         # MODIFY: add short_links table
├── routes/
│   └── marketing.js    # MODIFY: add short links CRUD + click tracking

src/
├── App.jsx             # MODIFY: add routes (public ROI + battle cards + short links)
├── contexts/
│   └── MarketingContext.jsx  # MODIFY: add battle cards + short links state
├── components/
│   └── marketing/
│       ├── ROICalculator.jsx      # NEW: interactive form with live calc
│       ├── BattleCardGrid.jsx     # NEW: competitor cards grid
│       └── ShortLinkForm.jsx      # NEW: generate link + UTM modal
├── pages/
│   └── marketing/
│       ├── ROICalculator.jsx      # NEW: public page, no sidebar, standalone layout
│       ├── BattleCards.jsx        # NEW: competitor intel grid
│       └── ShortLinks.jsx         # NEW: link management table
├── services/
│   └── api.js           # MODIFY: add short links + battle cards API
```

---

## Task 1: Database — Short Links Table + Battle Cards

**Structure note:** Battle cards stored as JSON file or simple table. Short links need click tracking.

- [ ] **Step 1: Add tables to database.js**

```sql
CREATE TABLE IF NOT EXISTS short_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  original_url TEXT NOT NULL,
  short_code TEXT NOT NULL UNIQUE,
  utm_source TEXT DEFAULT '',
  utm_medium TEXT DEFAULT '',
  utm_campaign TEXT DEFAULT '',
  utm_content TEXT DEFAULT '',
  utm_term TEXT DEFAULT '',
  clicks INTEGER DEFAULT 0,
  created_by INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS battle_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  competitor_name TEXT NOT NULL,
  logo_url TEXT DEFAULT '',
  strengths TEXT DEFAULT '[]',
  weaknesses TEXT DEFAULT '[]',
  pricing TEXT DEFAULT '',
  market_share TEXT DEFAULT '',
  differentiators TEXT DEFAULT '[]',
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS link_clicks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  link_id INTEGER REFERENCES short_links(id),
  clicked_at TEXT NOT NULL DEFAULT (datetime('now')),
  user_agent TEXT DEFAULT '',
  ip_address TEXT DEFAULT '',
  referer TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_short_links_code ON short_links(short_code);
CREATE INDEX IF NOT EXISTS idx_link_clicks_link ON link_clicks(link_id);
```

- [ ] **Step 2: Add routes to marketing.js**

Short links CRUD + click tracking endpoint + public redirect endpoint. Battle cards CRUD.

```javascript
// Short Links
router.get('/short-links', authenticate, (req, res) => {
  const links = getDb().prepare('SELECT sl.*, u.name as creator_name FROM short_links sl LEFT JOIN users u ON sl.created_by = u.id ORDER BY sl.created_at DESC').all();
  res.json({ links });
});

router.post('/short-links', authenticate, (req, res) => {
  const { original_url, utm_source, utm_medium, utm_campaign, utm_content, utm_term } = req.body;
  if (!original_url) return res.status(400).json({ error: 'original_url wajib diisi' });
  const short_code = Math.random().toString(36).substring(2, 8);
  const result = getDb().prepare('INSERT INTO short_links (original_url, short_code, utm_source, utm_medium, utm_campaign, utm_content, utm_term, created_by) VALUES (?,?,?,?,?,?,?,?)').run(original_url, short_code, utm_source || '', utm_medium || '', utm_campaign || '', utm_content || '', utm_term || '', req.user.id);
  res.status(201).json({ link: getDb().prepare('SELECT * FROM short_links WHERE id = ?').get(result.lastInsertRowid) });
});

router.delete('/short-links/:id', authenticate, (req, res) => {
  getDb().prepare('DELETE FROM short_links WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

router.get('/short-links/:id/clicks', authenticate, (req, res) => {
  const clicks = getDb().prepare('SELECT * FROM link_clicks WHERE link_id = ? ORDER BY clicked_at DESC LIMIT 100').all(req.params.id);
  res.json({ clicks });
});

// Public redirect — NO AUTH, registered by server.js directly (see step 3)

// Battle Cards
router.get('/battle-cards', authenticate, (req, res) => {
  const cards = getDb().prepare('SELECT * FROM battle_cards ORDER BY competitor_name ASC').all();
  res.json({ cards: cards.map(c => ({ ...c, strengths: JSON.parse(c.strengths), weaknesses: JSON.parse(c.weaknesses), differentiators: JSON.parse(c.differentiators) })) });
});

router.post('/battle-cards', authenticate, (req, res) => {
  const { competitor_name, logo_url, strengths, weaknesses, pricing, market_share, differentiators, notes } = req.body;
  if (!competitor_name) return res.status(400).json({ error: 'competitor_name wajib diisi' });
  const result = getDb().prepare('INSERT INTO battle_cards (competitor_name, logo_url, strengths, weaknesses, pricing, market_share, differentiators, notes) VALUES (?,?,?,?,?,?,?,?)').run(competitor_name, logo_url || '', JSON.stringify(strengths || []), JSON.stringify(weaknesses || []), pricing || '', market_share || '', JSON.stringify(differentiators || []), notes || '');
  res.status(201).json({ card: getDb().prepare('SELECT * FROM battle_cards WHERE id = ?').get(result.lastInsertRowid) });
});

router.patch('/battle-cards/:id', authenticate, (req, res) => { /* standard PATCH pattern — same as other routes */ });
router.delete('/battle-cards/:id', authenticate, (req, res) => { /* standard DELETE pattern */ });
```

- [ ] **Step 3: Register public redirect in server.js**

```javascript
// Public redirect — NO auth
app.get('/s/:code', (req, res) => {
  const link = getDb().prepare('SELECT * FROM short_links WHERE short_code = ?').get(req.params.code);
  if (!link) return res.redirect('/');
  getDb().prepare('UPDATE short_links SET clicks = clicks + 1 WHERE id = ?').run(link.id);
  getDb().prepare('INSERT INTO link_clicks (link_id, user_agent, ip_address, referer) VALUES (?,?,?,?)').run(link.id, req.get('user-agent') || '', req.ip || '', req.get('referer') || '');
  const url = new URL(link.original_url);
  if (link.utm_source) url.searchParams.set('utm_source', link.utm_source);
  if (link.utm_medium) url.searchParams.set('utm_medium', link.utm_medium);
  if (link.utm_campaign) url.searchParams.set('utm_campaign', link.utm_campaign);
  if (link.utm_content) url.searchParams.set('utm_content', link.utm_content);
  if (link.utm_term) url.searchParams.set('utm_term', link.utm_term);
  res.redirect(url.toString());
});
```

- [ ] **Step 4: Register API routes**

```javascript
app.use('/api/short-links', marketingRoutes);
app.use('/api/battle-cards', marketingRoutes);
```

- [ ] **Step 5: Commit**

```bash
git add backend/ && git commit -m "feat: add short_links, battle_cards, link_clicks tables + routes (Phase 4)"
```

---

## Task 2: API Methods + Context Update

- [ ] **Step 1: Add to api.js**

```javascript
getShortLinks: () => request('/short-links'),
createShortLink: (data) => request('/short-links', { method: 'POST', body: JSON.stringify(data) }),
deleteShortLink: (id) => request(`/short-links/${id}`, { method: 'DELETE' }),
getLinkClicks: (id) => request(`/short-links/${id}/clicks`),
getBattleCards: () => request('/battle-cards'),
createBattleCard: (data) => request('/battle-cards', { method: 'POST', body: JSON.stringify(data) }),
updateBattleCard: (id, data) => request(`/battle-cards/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
deleteBattleCard: (id) => request(`/battle-cards/${id}`, { method: 'DELETE' }),
```

- [ ] **Step 2: Add to MarketingContext**

```javascript
const [shortLinks, setShortLinks] = useState([]);
const [battleCards, setBattleCards] = useState([]);
// fetch, create, delete for both; add to provider value + useEffect
```

- [ ] **Step 3: Commit**

```bash
git add src/services/api.js src/contexts/MarketingContext.jsx
git commit -m "feat: add short links and battle cards API + context state (Phase 4)"
```

---

## Task 3: ROI Calculator (Public Page)

**Special:** No auth, no sidebar, standalone layout. Accessible at `/roi` or `/roi-calculator`.

- [ ] **Step 1: Create ROICalculator.jsx component**

```javascript
import { useState, useMemo } from 'react';
import { Download, TrendingUp } from 'lucide-react';
import { jsPDF } from 'jspdf';

export default function ROICalculator() {
  const [inputs, setInputs] = useState({
    monthlyVisitors: 10000,
    conversionRate: 2,
    avgDealSize: 5000000,
    marketingSpend: 15000000,
    salesCost: 25000000,
  });

  const update = (k, v) => setInputs(prev => ({ ...prev, [k]: parseFloat(v) || 0 }));

  const results = useMemo(() => {
    const { monthlyVisitors, conversionRate, avgDealSize, marketingSpend, salesCost } = inputs;
    const leads = Math.round(monthlyVisitors * (conversionRate / 100));
    const revenue = leads * avgDealSize;
    const totalCost = marketingSpend + salesCost;
    const profit = revenue - totalCost;
    const roi = totalCost > 0 ? ((profit / totalCost) * 100) : 0;
    const cpl = leads > 0 ? Math.round(marketingSpend / leads) : 0;
    const cpa = leads > 0 ? Math.round(totalCost / leads) : 0;
    return { leads, revenue, totalCost, profit, roi, cpl, cpa };
  }, [inputs]);

  const formatRupiah = (v) => {
    if (Math.abs(v) >= 1e9) return `Rp ${(v/1e9).toFixed(1)}B`;
    if (Math.abs(v) >= 1e6) return `Rp ${(v/1e6).toFixed(1)}M`;
    return `Rp ${v.toLocaleString('id-ID')}`;
  };

  const downloadPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text('ROI Calculator Report', 14, 20);
    doc.setFontSize(11);
    let y = 35;
    [['Monthly Visitors', inputs.monthlyVisitors.toLocaleString()], ['Conversion Rate', `${inputs.conversionRate}%`], ['Avg Deal Size', formatRupiah(inputs.avgDealSize)], ['Marketing Spend', formatRupiah(inputs.marketingSpend)], ['Sales Cost', formatRupiah(inputs.salesCost)], ['', ''], ['Leads/Month', results.leads], ['Revenue', formatRupiah(results.revenue)], ['Profit', formatRupiah(results.profit)], ['ROI', `${results.roi.toFixed(1)}%`], ['Cost per Lead', formatRupiah(results.cpl)], ['Cost per Acquisition', formatRupiah(results.cpa)]].forEach(([label, value]) => {
      if (!label) { y += 4; return; }
      doc.text(`${label}:`, 14, y);
      doc.text(String(value), 100, y);
      y += 7;
    });
    doc.save('roi-calculator-report.pdf');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl"><TrendingUp className="w-6 h-6 text-blue-600" /></div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">ROI Calculator</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Hitung return on investment marketing & sales</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          {[{ label: 'Monthly Visitors', key: 'monthlyVisitors', fmt: v => v.toLocaleString() },
            { label: 'Conversion Rate (%)', key: 'conversionRate' },
            { label: 'Avg Deal Size (IDR)', key: 'avgDealSize', fmt: v => formatRupiah(v) },
            { label: 'Marketing Spend (IDR)', key: 'marketingSpend', fmt: v => formatRupiah(v) },
            { label: 'Sales Cost (IDR)', key: 'salesCost', fmt: v => formatRupiah(v) }].map(f => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{f.label}</label>
              <input type="number" value={inputs[f.key]} onChange={e => update(f.key, e.target.value)} className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm" />
            </div>
          ))}
        </div>

        {/* Results */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          {[{ label: 'Leads/Month', value: results.leads, format: v => v.toLocaleString() },
            { label: 'Revenue', value: results.revenue, format: v => formatRupiah(v) },
            { label: 'Profit', value: results.profit, format: v => formatRupiah(v), color: results.profit >= 0 ? 'text-green-600' : 'text-red-600' },
            { label: 'ROI %', value: results.roi, format: v => `${v.toFixed(1)}%`, color: results.roi >= 0 ? 'text-green-600' : 'text-red-600' },
            { label: 'Cost/Lead', value: results.cpl, format: v => formatRupiah(v) },
            { label: 'Cost/Acq.', value: results.cpa, format: v => formatRupiah(v) }].map(r => (
            <div key={r.label} className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{r.label}</p>
              <p className={`text-lg font-bold ${r.color || 'text-gray-900 dark:text-white'}`}>{r.format(r.value)}</p>
            </div>
          ))}
        </div>

        <button onClick={downloadPDF} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors">
          <Download className="w-4 h-4" /> Download Report PDF
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Register public route in App.jsx**

```javascript
// Public route — outside auth, outside WorkspaceLayout
<Route path="/roi" element={<ROICalculator />} />
```

- [ ] **Step 3: Commit**

```bash
git add src/components/marketing/ROICalculator.jsx src/App.jsx
git commit -m "feat: add public ROI Calculator page (Phase 4)"
```

---

## Task 4: Battle Cards + Short Links Pages

- [ ] **Step 1: Create BattleCards.jsx**

Grid layout, 2-3 cards per row. Each card: competitor logo (or placeholder), name, strengths list (green bullets), weaknesses list (red bullets), pricing, differentiators. Expandable detail view. Add/edit via Modal form. Form fields: competitor_name, logo_url, strengths (textarea, one per line), weaknesses, pricing, market_share, differentiators, notes.

- [ ] **Step 2: Create ShortLinks.jsx**

Table: short_code, original_url (truncated), UTM params summary, clicks count, created date, actions. Generate modal: original_url field, UTM fields (source, medium, campaign, content, term). Generated link shown with copy button. Click detail expandable row.

- [ ] **Step 3: Update App.jsx**

```javascript
<Route path="/marketing/battle-cards" element={<BattleCards />} />
<Route path="/marketing/short-links" element={<ShortLinks />} />
```

- [ ] **Step 4: Update marketing navigation**

```javascript
{ to: '/roi', icon: 'Calculator', label: 'ROI Calc', external: true },
{ to: '/marketing/battle-cards', icon: 'Swords', label: 'Battle Cards' },
{ to: '/marketing/short-links', icon: 'Link2', label: 'Short Links' },
```

- [ ] **Step 5: Build + test**

```bash
npm run build 2>&1
# Test: /roi (public, no auth), /marketing/battle-cards, /marketing/short-links
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/marketing/ src/components/marketing/ src/App.jsx src/workspaces/marketing/
git commit -m "feat: add Battle Cards, Short Links, ROI Calculator pages (Phase 4)"
```

---

## Self-Review Checklist

| Acceptance Criterion | Task |
|---|---|
| ROI calculator form interaktif | Task 3 (ROICalculator) |
| Kalkulasi real-time | Task 3 (useMemo with inputs) |
| Download PDF | Task 3 (downloadPDF via jsPDF) |
| Public access (no auth) | Task 3 Step 2 (route outside auth) |
| Battle cards grid | Task 4 (BattleCards) |
| Expandable detail | Task 4 (expand card) |
| Short link generation | Task 4 (ShortLinks modal) |
| UTM parameters | Task 4 (UTM fields in form) |
| Click tracking | Task 1 (link_clicks table + /s/:code redirect) |
