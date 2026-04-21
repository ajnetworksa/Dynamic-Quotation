# 🚀 Dynamic Quotation System

A professional, dual-language (English/Arabic) quotation and invoice management system. Built with modern web technologies and AI-powered intelligence.

**Tech Stack**: React 19 + TypeScript + Vite + TailwindCSS v4 + Node/Express + SQLite.

---

## ✨ Key Features

- **Dual-Language Support**: Complete English and Arabic localization for documents.
- **AI Data Assistant**: Query your database using natural language (powered by Gemini/OpenRouter).
- **Automated Translation**: Instant translation of product descriptions into Arabic.
- **Smart Search**: Multi-word fuzzy search for products (handles out-of-order keywords).
- **Pricing Analysis Sidebar**: Real-time margin tracking with MU (Markup) calculation per row.
- **Configurable MU Filters**: Admin-defined Zero Markup and Excluded keyword rules via Settings.
- **Revision Tracking**: Create and compare multiple versions of the same quote.
- **RFQ Parsing**: Upload a PDF/image RFQ and AI extracts the line items automatically.
- **Export Options**: Professional PDF and Excel exports with localized formatting.
- **User Roles**: Advanced permissions (Admin vs. Standard User with granular overrides).
- **Security**: Password hashing (Bcrypt), JWT sessions, Helmet headers, and rate limiting.

---

## 🛠️ Installation

### Prerequisites
- **Node.js**: v18 or higher (v20 recommended — matches Docker image).
- **npm**: v9 or higher.
- **Python** *(Windows only)*: Required by `bcrypt` to compile native bindings.
  Install via `winget install Python.Python.3` or from [python.org](https://python.org).
- **Build Tools** *(Windows only)*: Run once in an **Administrator** PowerShell:
  ```powershell
  npm install -g windows-build-tools
  # OR (preferred on Windows 10/11):
  npm install -g node-gyp
  ```

> [!NOTE]
> `bcrypt` and `better-sqlite3` are **native Node.js modules** — they compile C++ bindings
> on install. On Linux/Mac this is automatic. On Windows you need Python + Build Tools above.

---

### Step 1: Clone & Install

```bash
git clone https://github.com/your-repo/dynamic-quotation.git
cd dynamic-quotation
npm install
```

`npm install` handles **all** dependencies automatically — no separate install commands needed.
Here is what gets installed and why:

| Package | Purpose |
|---|---|
| `react`, `react-dom`, `react-router-dom` | Frontend UI framework |
| `vite`, `@vitejs/plugin-react`, `@tailwindcss/vite` | Build tooling & styles |
| `express`, `helmet`, `express-rate-limit` | HTTP server & security middleware |
| `better-sqlite3` | SQLite database (native module — needs build tools) |
| `bcrypt` | Password hashing (native module — needs build tools) |
| `nodemailer` | Email sending (SMTP) for quote delivery |
| `multer` | File upload handling (logo, footer, RFQ) |
| `html2canvas`, `jspdf` | PDF export generation |
| `xlsx`, `xlsx-js-style` | Excel export with cell styling |
| `@google/genai` | Gemini AI integration (translation + AI assistant) |
| `openai` | OpenRouter API integration (RFQ parsing) |
| `puppeteer` | Headless browser PDF rendering fallback |
| `lucide-react` | Icon library |
| `motion` | Animation library |
| `dotenv` | Loads `.env` environment variables |
| `tsx`, `typescript` | Runs TypeScript server directly without pre-compiling |
| `vite-plugin-node-polyfills` | Polyfills Node.js built-ins (stream, buffer) for browser |
| `stream-browserify` | Browser-compatible stream polyfill (used by xlsx-js-style) |

> [!IMPORTANT]
> If `npm install` fails on **bcrypt** or **better-sqlite3** on Windows, run:
> ```powershell
> npm install --global --production windows-build-tools
> npm install
> ```
> Or use the official [node-gyp Windows setup guide](https://github.com/nodejs/node-gyp#on-windows).

---

### Step 2: Environment Setup

> [!CAUTION]
> **Never commit your `.env` file to git.** It contains secret API keys.
> Ensure `.env` is listed in your `.gitignore` before pushing.

Create a `.env` file in the root directory:

```env
# AI Features — get keys from Google AI Studio and OpenRouter
GEMINI_API_KEY="your-gemini-api-key-here"
OPENROUTER_API_KEY="your-openrouter-api-key-here"

# The public URL where the app is hosted (used for self-referencing links)
APP_URL="http://localhost:3000"

# Server port (default: 3000)
PORT=3000
```

| Variable | Required | Where to get it |
|---|---|---|
| `GEMINI_API_KEY` | ✅ Yes | [Google AI Studio](https://aistudio.google.com/app/apikey) |
| `OPENROUTER_API_KEY` | ✅ Yes (for RFQ parsing) | [OpenRouter](https://openrouter.ai/keys) |
| `APP_URL` | ✅ Yes | Your server's public URL or `http://localhost:3000` for local |
| `PORT` | Optional | Defaults to `3000` if not set |

---

### Step 3: Run

**Development Mode** (auto-reloads on file changes):
```bash
npm run dev
```

**Production Mode** (serve the pre-built frontend):
```bash
npm run build
npm start
```

---

## 🔄 Update Process

When you pull new code from git:

1. **Pull latest changes**: `git pull origin main`
2. **Update dependencies**: `npm install`
3. **Rebuild frontend**: `npm run build`
4. **Restart server**: `npm start` (or `pm2 restart all`)

> [!NOTE]
> **Automatic Migrations**: The backend automatically handles database schema updates on startup.
> No manual SQL scripts are required — just restart and the DB is updated.

---

## 🚢 Deployment Guides

### 🐳 Docker (Recommended)
Containerization ensures identical behavior across all environments and handles native module compilation automatically inside the container.

1. **Build and Start**:
   ```bash
   docker-compose up -d --build
   ```
2. **Persistence**: The database (`quotes.db`) is mapped to your host machine. Do not delete the volume.
3. **Update**:
   ```bash
   git pull
   docker-compose up -d --build
   ```

### 🐧 Linux VPS via PM2
1. **Install Node.js**: Use [nvm](https://github.com/nvm-sh/nvm) — `nvm install 20`
2. **Install PM2**: `npm install -g pm2`
3. **Clone & install**: `git clone ... && cd ... && npm install`
4. **Create `.env`**: See Step 2 above.
5. **Build**: `npm run build`
6. **Start**: `pm2 start server.ts --interpreter npx --interpreter-args tsx --name quotation`
7. **Persist across reboots**: `pm2 save && pm2 startup`

### 🖥️ Windows Server
1. **Setup**: Install Node.js v20, Git, and Python (for native modules).
2. **Clone & install**: Same as Step 1 above.
3. **Run**: Use the Production Mode steps above.
4. **Persistence**: Use [NSSM](https://nssm.cc/) or PM2 for Windows to keep the process alive.

### ☁️ Vercel
> [!CAUTION]
> **SQLite on Vercel is not recommended.** Vercel's filesystem is ephemeral — data in `quotes.db`
> will be **lost** on every cold start. Use Docker on a VPS for a persistent deployment.

If you still want to try Vercel (read-only/demo mode):
- Framework Preset: **Vite**
- Build Command: `npm run build`
- Output Directory: `dist`
- Add all `.env` variables in the Vercel Dashboard under Environment Variables.

---

## 🔐 First-Time Admin Setup

1. Navigate to `http://localhost:3000` and log in.
2. The **first registered user** is automatically granted the `admin` role.
3. Go to **Settings** (admin only) to configure:
   - Upload company logo and footer image.
   - Configure SMTP for email delivery.
   - Set MU Calculation Filters (Zero Markup and Excluded keywords).
   - Adjust theme colors and logo size.

---

## 🎨 Customization

### Branding
- **Company Name**: Edit `src/App.tsx` — search for `AJ Network Solutions`.
- **Logo**: Settings → Upload Logo (stored in the database, no file system needed).

### Default Terms & Conditions
Edit `src/components/QuoteForm.tsx` around line 220 to change the defaults for:
payment terms, warranty, bank details, VAT rate, and note text.

### MU Calculation Rules (Admin UI)
Go to **Settings → MU Calculation Filters** to configure which item descriptions:
- Contribute **zero markup** to the profit calculation (e.g., `Materials`).
- Are **excluded entirely** from the MU analysis (e.g., `Installation`).

---

## 🔐 Security & Maintenance

- **Backups**: Download `quotes.db` regularly via **Settings → Download Master File**.
- **Logs**: Monitor system errors via **Settings → System Logs** (Admin only).
- **API Keys**: Rotate `GEMINI_API_KEY` and `OPENROUTER_API_KEY` periodically.

---

## 🔮 Roadmap
- Integrated Inventory Management
- Multi-currency Conversion
- Dashboard Analytics Upgrade
- Dark Mode Themes
