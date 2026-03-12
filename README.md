# Dynamic Quotation System

A modern, responsive, and dual-language (English/Arabic) web application for generating, managing, and exporting professional quotations. Built with React, TypeScript, TailwindCSS, and a lightweight Node/Express/SQLite backend.

---

## ✨ Core Features

*   **Dual-Language Support**: Seamlessly input data in English and automatically generate Arabic translations using Google Translate API. Both languages are rendered side-by-side on the quote.
*   **Dynamic Quote Builder**:
    *   Add, remove, and reorder quotation items (products/services) with auto-calculating totals and VAT.
    *   Customizable Terms & Conditions sections (Note, Payment, Warranty, Manpower, Mobilization, Duration, Bank Details).
    *   Dynamic multiple "Custom Fields" to add any extra terms or rows you need.
    *   All sections support hiding/showing based on what the specific quote requires.
*   **High-Quality PDF Export**: Advanced generation of strict A4-sized PDF documents through `html2canvas` and `jsPDF`. The print layout is highly optimized for clean borders, professional spacing, and accurate fonts.
*   **Email Integration**: Built-in SMTP configuration to directly email the generated PDF quotes to clients from within the application.
*   **Excel Export**: Export the quotation items and totals directly into a formatted `.xlsx` file.
*   **Database Management & Backups**: Securely store all generated quotes and customer profiles in an SQLite database. Easily download full database backups directly from the admin settings.
*   **Customizable Branding**: Upload your company logo and footer image (supports local file storage) to personalize the quotation documents.

---

## 🚀 Tech Stack

**Frontend**:
*   React 18 + TypeScript
*   Vite
*   TailwindCSS v4 (for rapid, responsive styling)
*   Lucide React (Icons)
*   html2canvas & jspdf (PDF Generation)
*   xlsx-js-style (Excel Generation)

**Backend**:
*   Node.js & Express
*   SQLite3 (via `better-sqlite3`)
*   Nodemailer (for SMTP emailing)
*   Multer (for image uploads)

---

## 🛠️ Deployment Instructions

### Prerequisites
*   Node.js (v18 or higher recommended)
*   NPM or Yarn

### 1. Local Development
To run the server and frontend concurrently for development:

```bash
# Install dependencies
npm install

# Start the development environment (Frontend on port 5173, Backend on port 3000)
npm run dev
```

### 2. Production Deployment
To build the application for production and serve it:

```bash
# 1. Install dependencies
npm install

# 2. Build the frontend (Vite builds to /dist)
npm run build

# 3. Start the production Node server
npm start
```

**Environment Variables**:
You can customize the ports and host by configuring an `.env` file if needed, but the default configuration is set to run out of the box.

**Database Persistence Warning**:
The database is stored locally inside the project folder at `quotes.db`. If you are deploying via Docker or similar containerized systems, **you must mount a persistent volume** to ensure `quotes.db` and the `/uploads` folder (for logos) are not wiped out when the container restarts.

---

## 🎨 Customization Guide

> This section is written for **novice developers**. Every item below tells you exactly which file to open and what to search for to make a change.

### 🏢 Company Name & App Branding

| What to change | File | What to search for |
|---|---|---|
| Company name in the top header | `src/App.tsx` | `AJ Network Solutions` |
| Header icon color | `src/App.tsx` | `bg-indigo-600 p-2 rounded-lg` |
| Fallback logo text (when no image is uploaded) | `src/components/QuoteForm.tsx` | `text-green-600 font-bold text-2xl` |
| Logo size (default) | Admin Settings UI → Logo Size slider | n/a (stored in database) |
| Company logo / footer image | Admin Settings UI → Upload Logo / Footer Image | n/a (uploaded via browser) |

---

### 🎨 Colors

All colors in this project use **Tailwind CSS class names** in the format: `bg-{color}-{shade}`.

Example shades: `50` (lightest) → `100`, `200`, `300` … `900`, `950` (darkest).

Available color names: `gray`, `red`, `orange`, `amber`, `yellow`, `lime`, `green`, `emerald`, `teal`, `cyan`, `sky`, `blue`, `indigo`, `violet`, `purple`, `fuchsia`, `pink`, `rose`.

| What to change | File | What to search for |
|---|---|---|
| Active navigation tab color | `src/App.tsx` | `bg-indigo-600 text-white` (in `NavItem`) |
| Navigation hover color | `src/App.tsx` | `hover:bg-gray-100` (in `NavItem`) |
| Page background color | `src/App.tsx` | `bg-gray-50 flex flex-col` |
| **Items table header row background** | `src/components/QuoteForm.tsx` | `backgroundColor: '#dcfce7'` |
| **Items table & customer box border color** | `src/components/QuoteForm.tsx` | `borderColor: '#1f2937'` |
| Customer Info header bar background | `src/components/QuoteForm.tsx` | `bg-gray-100 px-4 pt-0 pb-3` |
| **TOTAL PACKAGE row background** | `src/components/QuoteForm.tsx` | `bg-green-100` |
| **TOTAL PACKAGE row text color** | `src/components/QuoteForm.tsx` | `text-green-800` |
| Record button color | `src/components/QuoteForm.tsx` | `bg-indigo-600 hover:bg-indigo-700` (Record button) |
| Export PDF button color | `src/components/QuoteForm.tsx` | `bg-blue-600 hover:bg-blue-700` |
| Export Excel button color | `src/components/QuoteForm.tsx` | `bg-green-600 hover:bg-green-700` |
| Print button color | `src/components/QuoteForm.tsx` | `bg-emerald-600 hover:bg-emerald-700` |
| Email button color | `src/components/QuoteForm.tsx` | `bg-sky-500 hover:bg-sky-600` |

**How to change a color**: Replace the color name in the class, for example:
```diff
- className="... bg-green-100 ..."
+ className="... bg-blue-100 ..."
```

---

### 📝 Default Text Values (Terms & Conditions)

These defaults appear on every **new** quote. To change them permanently, open `src/components/QuoteForm.tsx` and find the `useState` calls. They all appear between roughly **lines 73–92**.

| Section | What to search for in the file |
|---|---|
| Default VAT rate | `useState(15)` — change `15` to your country's rate |
| Note / Remarks | `useState('Any additional work\|device...')` |
| Payment terms | `useState('Full Payment in ADVANCE')` |
| Warranty | `useState("2 YEARS limited warranty...")` |
| Manpower | `useState('2 Technicians, 1 Supervisor')` |
| Mobilization | `useState('3-4 days upon confirmation...')` |
| Duration | `useState('1-2 Working Days')` |
| **Bank details** ⚠️ | `useState('ALINMA BANK - Account:...')` — **Change this to your own bank!** |
| Footer thank-you message | `useState('Thank you for your business!')` |

After editing, **save the file** and the dev server will hot-reload automatically.

---

### 📐 Sizes & Layout

| What to change | File | What to search for |
|---|---|---|
| Document title font size | `src/components/QuoteForm.tsx` | `text-3xl md:text-4xl` (on the `<h1>`) |
| Totals box width | `src/components/QuoteForm.tsx` | `w-full md:w-64` (the totals `<div>`) — `w-64` = 256 px |
| ITEM column width | `src/components/QuoteForm.tsx` | `grid-cols-[44px_1fr_64px_64px_110px_110px_36px]` — first number |
| QTY / UNIT column width | `src/components/QuoteForm.tsx` | same grid template — 3rd/4th numbers (`64px`) |
| UNIT PRICE / NET PRICE column width | `src/components/QuoteForm.tsx` | same grid template — 5th/6th numbers (`110px`) |
| Footer image max height | `src/components/QuoteForm.tsx` | `maxHeight: '100px'` in the footer `<img>` |
| Print page margin | `src/index.css` | `@page { margin: 1cm; }` |

---

### 📄 PDF Export Quality

Open `src/components/QuoteForm.tsx` and search for `handleExportPDF`.

| Setting | What to change | Effect |
|---|---|---|
| **Resolution / sharpness** | `scale: 2` in the `html2canvas` call | Higher = sharper but bigger file. Try `3` for very crisp output. |
| **Image quality** | `'image/jpeg', 0.8` in `canvas.toDataURL(...)` | Second number is quality (0.0–1.0). `1.0` = lossless. Change first arg to `'image/png'` for PNG format. |

---

### 🎨 Adding a Custom Color

If you need a completely new color that isn't in Tailwind's palette, open `src/index.css` and add a line inside the `@theme { }` block:

```css
@theme {
  /* ... existing colors ... */
  --color-brand-500: #d4a017;   /* ← your custom gold color */
  --color-brand-600: #b8880e;   /* ← slightly darker shade for hover */
}
```

Then use it in any component:
```tsx
<button className="bg-brand-500 hover:bg-brand-600 text-white ...">
  My Button
</button>
```

---

## 🔮 Future Features & Roadmap Ideas

*   **Authentication & Authorization**: Implement user login (Admin vs. Sales roles) to restrict who can edit settings or delete quotes.
*   **Dashboard & Analytics**: A visual home page showing monthly quotation metrics, acceptance rates, and revenue projections.
*   **Inventory Integration**: Link the product dropdowns to an active inventory tracking system to pull real-time pricing and stock.
*   **Multi-Currency Support**: Allow users to switch between SAR, USD, EUR, etc., with automatic conversion rates.
*   **Invoice Conversion**: A one-click button to convert an accepted "Quotation" into a formal "Tax Invoice" with corresponding sequential invoice numbers.
*   **Dark Mode UI**: Add a dark theme toggle for the application interface (while keeping the PDF export cleanly styled for print).
