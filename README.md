# Dynamic Quotation System

A modern, dual-language (English/Arabic) web app for generating professional quotations.  
Stack: **React 18 + TypeScript + Vite + TailwindCSS v4 + Node/Express/SQLite**.

---

## 🚀 Quick Start

```bash
npm install
npm run dev          # Dev: Frontend :5173, Backend :3000
```

```bash
npm run build && npm start   # Production
```

> **Database warning**: `quotes.db` and `/uploads` are stored in the project folder. Mount a persistent volume if using Docker.

---

## 📁 File Map

```
src/
├── App.tsx                   ← Navigation bar, routing, auth
├── index.css                 ← Tailwind v4 colour palette + print styles
└── components/
    ├── QuoteForm.tsx         ← Main quote builder (THIS IS THE BIG ONE)
    ├── Dashboard.tsx         ← Stats overview page
    ├── Tracking.tsx          ← Saved quotes list
    ├── CustomerDB.tsx        ← Customer database
    ├── ProductDB.tsx         ← Product/service database
    ├── Settings.tsx          ← Admin settings (logo, SMTP, etc.)
    ├── Login.tsx             ← Login screen
    └── UsersDB.tsx           ← User management (admin only)
server.ts                     ← Backend API (Express + SQLite)
```

---

## 🎨 Module 1 — Branding & Company Name

**File:** `src/App.tsx`

| What | Search for | Change to |
|---|---|---|
| Company name in header | `AJ Network Solutions` | Your company name |
| Header icon color | `bg-indigo-600 p-2 rounded-lg` | e.g. `bg-blue-700` |
| Header background | `bg-white border-b border-gray-200` | e.g. `bg-slate-900 border-slate-700` |
| Page background | `bg-gray-50 flex flex-col` | e.g. `bg-white` |
| Active nav link color | `bg-indigo-600 text-white` (in `NavItem`) | e.g. `bg-emerald-600 text-white` |
| Inactive nav hover | `hover:bg-gray-100` | e.g. `hover:bg-slate-100` |

---

## 📝 Module 2 — Default Text (Terms & Conditions)

**File:** `src/components/QuoteForm.tsx` — search for `useState(` around **line 90**

| Field | Search for | Notes |
|---|---|---|
| Default VAT % | `useState(15)` | Change `15` to your country's rate |
| Note header label | `useState('NOTE:')` | e.g. `'REMARKS:'` |
| Note body | `useState('Any additional work\|device...')` | Use `\n` for new lines |
| Payment terms | `useState('Full Payment in ADVANCE')` | |
| Warranty | `useState("2 YEARS limited warranty...")` | |
| Manpower | `useState('2 Technicians, 1 Supervisor')` | |
| Mobilization time | `useState('3-4 days upon...')` | |
| Project duration | `useState('1-2 Working Days')` | |
| ⚠️ Bank details | `useState('ALINMA BANK - Account:...')` | **Replace with your bank info!** |
| Footer message | `useState('Thank you for your business!')` | |

> Changes here affect every **new** quote. Existing saved quotes keep their own text.

---

## 🎨 Module 3 — Colors

All colors use Tailwind class names: `bg-{color}-{shade}` / `text-{color}-{shade}`.  
Shades: `50` (lightest) → `950` (darkest). Colors: `gray red orange amber yellow lime green emerald teal cyan sky blue indigo violet purple fuchsia pink rose`.

**File:** `src/components/QuoteForm.tsx`

### Action Bar Buttons

Search for the button's label text, then change `bg-*` and `hover:bg-*`:

| Button | Current color classes |
|---|---|
| Record / Save | `bg-indigo-600 hover:bg-indigo-700` |
| Clear | `bg-gray-100 hover:bg-gray-200` |
| Create Revision | `bg-orange-500 hover:bg-orange-600` |
| To Invoice | `bg-purple-600 hover:bg-purple-700` |
| Email | `bg-sky-500 hover:bg-sky-600` |
| Print | `bg-emerald-600 hover:bg-emerald-700` |
| Export Excel | `bg-green-600 hover:bg-green-700` |
| Export PDF | `bg-blue-600 hover:bg-blue-700` |

### Quote Document Colors

| Element | Search for | How to change |
|---|---|---|
| **Table header row bg** | `backgroundColor: '#dcfce7'` | Replace hex, e.g. `'#dbeafe'` = light blue |
| **Table/section border color** | `borderColor: '#1f2937'` | Replace hex, e.g. `'#1d4ed8'` = dark blue |
| Customer Info header bar bg | `bg-gray-100 px-4 pt-0 pb-3` | Change `bg-gray-100` to any color |
| **Total Package row bg** | `bg-green-100` (on the totals row `<div>`) | e.g. `bg-blue-100` |
| **Total Package text color** | `text-green-800` | e.g. `text-blue-800` |
| Warning price color (0 / below DB) | `text-amber-600` | e.g. `text-red-600` |

---

## 📐 Module 4 — Sizes & Layout

**File:** `src/components/QuoteForm.tsx`

| Element | Search for | How to change |
|---|---|---|
| Document title font size | `text-3xl md:text-4xl` on `<h1>` | `text-2xl`, `text-4xl`, `text-5xl` |
| Column widths (items table) | `grid-cols-[44px_1fr_64px_64px_110px_110px_36px]` | Change individual px values (see below) |
| Totals box width | `w-full md:w-64` | `w-72` = 288px, `w-80` = 320px |
| Footer image max height | `maxHeight: '100px'` | `'150px'`, `'200px'` |

**Column width reference** (`grid-cols-[A_B_C_D_E_F_G]`):

| Position | Column | Default |
|---|---|---|
| A | ITEM # | `44px` |
| B | DESCRIPTION | `1fr` (fills remaining space) |
| C | QTY | `64px` |
| D | UNIT | `64px` |
| E | UNIT PRICE | `110px` |
| F | NET PRICE | `110px` |
| G | Actions (hidden in PDF) | `36px` |

---

## 💰 Module 5 — Currency & Prices

**File:** `src/components/QuoteForm.tsx`

Search for `SAR` — there are 4 occurrences in the items table and 2 in the totals box.  
Replace all with your currency code (e.g. `USD`, `EUR`, `AED`).

| Setting | Search for | Notes |
|---|---|---|
| Currency label (items table) | `<span>SAR</span>` | 2 in items table (unit price & net price) |
| Currency label (totals box) | `<span>SAR</span>` | 2 in subtotal/total rows |
| Unit price decimal step | `step="0.01"` | `step="1"` for whole numbers only |
| Net price decimals | `.toFixed(2)` | `.toFixed(0)` for no decimals |
| Subtotal / tax decimals | `.toFixed(2)` | In the totals box `<div>` |
| Excel export currency | `SAR ${item.unit_price.toFixed(2)}` | In `handleExportExcel` function |

> **Font tip**: All price cells use `font-mono` (monospace) and `text-base` to keep "SAR" and the number perfectly aligned. Never remove `text-base` from `<input>` elements in the table — browsers don't auto-inherit font size.

---

## 📄 Module 6 — PDF Export

**File:** `src/components/QuoteForm.tsx` — search for `handleExportPDF`

| Setting | Search for | Effect |
|---|---|---|
| **Resolution / sharpness** | `scale: 3` | Higher = sharper PDF but larger file size. `1` = fast/small, `3–4` = print-crisp |
| **Image quality** | `canvas.toDataURL('image/jpeg', 0.8)` | Change `0.8` (0.0–1.0). Use `'image/png'` for lossless |
| **PDF filename** | `link.download = \`${customerName}-${quoteId}.pdf\`` | See format examples below |

**Filename format examples** (search `PDF FILENAME` in `QuoteForm.tsx`):

```js
// Current: CustomerName-QuoteID.pdf
link.download = `${customerName}-${quoteId}.pdf`;

// Quote ID only:
link.download = `${quoteId}.pdf`;

// Include date:
link.download = `${customerName}-${quoteId}-${date}.pdf`;

// Include document type (Quotation / Tax Invoice):
link.download = `${type}-${customerName}-${quoteId}.pdf`;
```

---

## 📊 Module 7 — Excel Export

**File:** `src/components/QuoteForm.tsx` — search for `handleExportExcel`

| Setting | Search for | Notes |
|---|---|---|
| Column widths (xlsx) | `ws['!cols'] = [` | `wch` = width in characters |
| Validity period | `'Valid For', '30 Days'` | Change `'30 Days'` to your policy |
| **Excel filename** | `link.download = \`${excelCustomerName}-${quoteId}.xlsx\`` | Same pattern as PDF — search `EXCEL FILENAME` |
| Font in cells | `font: { name: 'Arial', sz: 10` | Change name/size |

---

## 🖨️ Module 8 — Print Margins

**File:** `src/index.css` — at the very bottom

```css
@page {
  margin: 1cm;   /* ← change to 1.5cm for more whitespace, 0.5cm for tighter fit */
}
```

---

## 🎨 Module 9 — Adding a Custom Color

**File:** `src/index.css` — inside the `@theme { }` block

```css
--color-brand-500: #d4a017;   /* your custom color */
--color-brand-600: #b8880e;   /* slightly darker for hover */
```

Then use anywhere:

```tsx
<button className="bg-brand-500 hover:bg-brand-600 text-white ...">
```

---

## 🖼️ Module 10 — Logo & Footer Image

Use the **Admin Settings** page (Settings link in nav, admin only):

| Setting | Where |
|---|---|
| Company logo | Settings → Upload Logo |
| Logo size | Settings → Logo Size (slider) |
| Footer banner image | Settings → Upload Footer Image |

Logo is shown top-right of the quote. Footer image appears at the bottom of the quote.  
Max footer image height in code: search `maxHeight: '100px'` in `QuoteForm.tsx`.

---

## ⚙️ Module 11 — SMTP Email

**Via UI**: Settings → SMTP Configuration.  
Fields: Host, Port, Username, Password, From Name.

The email feature requires a saved quote (click **Record** first, then **Email**).

---

## 🔐 Module 12 — Users & Roles

**Via UI**: Users page (admin only, `Users` link in nav).

- `admin` role → full access to Settings, Users, all delete actions.
- Standard users → can create/edit quotes and view databases.

Default admin is created at first run. Change credentials via the Users page.

---

## 🗄️ Module 13 — Database Backup

**Via UI**: Settings → Download Database Backup.

The SQLite file (`quotes.db`) will be downloaded as-is. Keep periodic backups if running in production.

---

## 🔮 Roadmap

- Multi-currency with live conversion rates
- Invoice conversion from accepted quotes
- Dark mode UI
- Inventory integration (live stock & pricing)
- Dashboard analytics (revenue, acceptance rate)

---

## 📈 Module 14 — Pricing Analysis Sidebar

**File:** `src/components/QuoteForm.tsx`

The Pricing Analysis side-panel (visible only on `xl` screens) allows you to manage margins and track original database costs without affecting the public-facing document.

| Feature | Description |
|---|---|
| **M.U. %** | Global Markup Percentage. Changes to this value automatically scale the `UNIT PRICE` of all items (unless manually overridden). |
| **Manual Column** | Enter a price here to override the markup calculation for a specific row. |
| **BASE Column** | Displays the original database price (`original_price`) of the product at the time it was added. |
| **TOTAL Column** | Shows the base total cost (`base_price * qty`) for that row. |
| **B.Total** | Sum of all BASE totals (your cost). |
| **MU (Profit)** | The immediate profit margin (`Subtotal - B.Total`). |
| **TTL PROFIT** | Highlighted summary of the total markup gain. |

### Visual Warnings
- **Red Bold Price:** If you enter a `Manual` price that is **lower** than the `BASE` database price, the input text turns red to warn you that you are selling below cost.
- **Syncing Row Heights:** The side-panel uses a `ResizeObserver` to lock its row heights to the main table. This keeps the data aligned even if descriptions span multiple lines.
