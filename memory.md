# System Memory & Technical Documentation

This document records the architectural details, database structures, features implemented, and customization rules for the Dynamic Quotation system.

---

## 🛠️ Technology Stack
- **Frontend:** React, TypeScript, Vite, Tailwind CSS, Lucide icons.
- **Backend:** Express, Node.js, SQLite (`better-sqlite3` on `quotes.db`).
- **File Generation:** `exceljs` (Excel sheets), `@react-pdf/renderer` (PDF vector documents).

---

## 💾 Database Schema Details
Key database tables in `quotes.db`:
- **`quotes`**: Stores metadata (e.g., `quote_id`, `date`, `grand_total`, `status`, `type`, `draft_data`, `deleted_at`, `deleted_by`, `retain_forever`).
  - *Drafts*: Full drafts are stored as JSON strings in the `draft_data` column. Always check and parse `draft_data` to load items and metadata if root columns are empty.
- **`quote_items`**: Stores items for finalized/published quotes. Relates via `quote_id` string (e.g. `AJ-XXXXX`).
- **`settings`**: Configuration key-value pairs (e.g. `recycleBinDays`, `muFilters`).

---

## ✨ Core Features & Visual Customizations

### 1. Merged Excel Export (Tracking Dashboard)
- **Features:** Stacks multiple selected quotes vertically into a single Excel worksheet.
- **Visual Design Rules (Matching Screenshot):**
  - **No columns** for Arabic description (Columns are: ITEM, DESCRIPTION (EN), QTY, UNIT, UNIT PRICE, NET PRICE, ITEM CODE, SUPPLIER NAME, Gap, Markup %, Manual, BASE, TOTAL).
  - **Metadata:** Only `Quote ID` is rendered at the top of each quote block. The `QUOTATION` title header, `Date`, and `Valid For` rows are removed.
  - **Customer Info Box:**
    - Omit the gray `CUSTOMER INFO` header row and the blank row above it on all quotes.
    - **First Quote:** Display `Customer Name` and English `Subject` rows. Omit Address, Mobile, Contact, Email, etc.
    - **Subsequent Quotes:** Display English `Subject` row only.
    - **Arabic Subject:** The `subject_ar` row is completely omitted on all quotes.
    - Apply medium/thin border boxes around these customer info rows.
  - **Totals Layout:** `SUBTOTAL`, `DISCOUNT`, `VAT (15%)`, and `TOTAL PACKAGE` (bright green fill) align under Columns E & F. `B.TOTAL` and `TTL PROFIT` (yellow fill) align under Columns L & M.
  - **No Terms / Footer:** All Terms, Conditions, Warranty, and Footer rows are omitted.

### 2. Document Drag-and-Drop (QuoteForm.tsx)
- **Visual Feedback:**
  - **Dragged Row:** Shrunk to `scale-[0.995]`, opacity drops to `40%`, and gains a subtle border and inset shadow (`bg-gray-100 shadow-inner`).
  - **Hover Target Drop Zone:** Indicated by a thick `border-t-[4px] border-t-indigo-500` along with a soft background shading (`bg-indigo-50/50`) and shadow.

### 3. Recycle Bin & Soft Deletes
- **Permissions:** Restricted to users with `canManageRecycleBin` permission or Admin.
- **Logic:** Deleting a quote sets `deleted_at` and `deleted_by` fields rather than dropping rows.
- **Pruning:** A background worker runs every 24 hours to delete quotes older than `recycleBinDays` (configured in Settings) unless `retain_forever = 1` (pinned quotes).
