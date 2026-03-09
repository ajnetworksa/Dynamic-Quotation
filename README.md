# Dynamic Quotation System

A modern, responsive, and dual-language (English/Arabic) web application for generating, managing, and exporting professional quotations. Built with React, TypeScript, TailwindCSS, and a lightweight Node/Express/SQLite backend.

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

## 🚀 Tech Stack

**Frontend**:
*   React 18 + TypeScript
*   Vite
*   TailwindCSS (for rapid, responsive styling)
*   Lucide React (Icons)
*   html2canvas & jspdf (PDF Generation)
*   xlsx-js-style (Excel Generation)

**Backend**:
*   Node.js & Express
*   SQLite3 (via `better-sqlite3`)
*   Nodemailer (for SMTP emailing)
*   Multer (for image uploads)

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

**Database Persistance Warning**: 
The database is stored locally inside the project folder at `quotes.db`. If you are deploying via Docker or similar containerized systems, **you must mount a persistent volume** to ensure `quotes.db` and the `/uploads` folder (for logos) are not wiped out when the container restarts.

## 🔮 Future Features & Roadmap Ideas

*   **Authentication & Authorization**: Implement user login (Admin vs. Sales roles) to restrict who can edit settings or delete quotes.
*   **Dashboard & Analytics**: A visual home page showing monthly quotation metrics, acceptance rates, and revenue projections.
*   **Inventory Integration**: Link the product dropdowns to an active inventory tracking system to pull real-time pricing and stock.
*   **Multi-Currency Support**: Allow users to switch between SAR, USD, EUR, etc., with automatic conversion rates.
*   **Invoice Conversion**: A one-click button to convert an accepted "Quotation" into a formal "Tax Invoice" with corresponding sequential invoice numbers.
*   **Dark Mode UI**: Add a dark theme toggle for the application interface (while keeping the PDF export cleanly styled for print).
