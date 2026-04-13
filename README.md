# 🚀 Dynamic Quotation System

A professional, dual-language (English/Arabic) quotation and invoice management system. Built with modern web technologies and AI-powered intelligence.

**Tech Stack**: React 19 + TypeScript + Vite + TailwindCSS v4 + Node/Express + SQLite.

---

## ✨ Key Features

- **Dual-Language Support**: Complete English and Arabic localization for documents.
- **AI Data Assistant**: Query your database using natural language (powered by Gemini/OpenRouter).
- **Automated Translation**: Instant translation of product descriptions into Arabic.
- **Smart Search**: Multi-word fuzzy search for products (handles out-of-order keywords).
- **Pricing Analysis Sidebar**: Real-time margin tracking and cost analysis while building quotes.
- **Revision Tracking**: Create and compare multiple versions of the same quote.
- **Export Options**: Professional PDF and Excel exports with localized formatting.
- **User Roles**: Advanced permissions (Admin vs. Standard User).
- **Security**: Password hashing (Bcrypt), secure sessions, and rate limiting.

---

## 🛠️ Installation

### Prerequisites
- **Node.js**: v18 or higher.
- **npm**: v9 or higher.

### Step 1: Clone & Install
```bash
git clone https://github.com/your-repo/dynamic-quotation.git
cd dynamic-quotation
npm install
```

### Step 2: Environment Setup
Create a `.env` file in the root directory:
```env
GEMINI_API_KEY="your-gemini-key"
OPENROUTER_API_KEY="your-openrouter-key"
APP_URL="http://localhost:3000"
PORT=3000
```

### Step 3: Run
**Development Mode:**
```bash
npm run dev
```
**Production Mode (Local):**
```bash
npm run build
npm start
```

---

## 🔄 Update Process

Keeping your app up-to-date is simple:

1. **Pull Latest Changes**: `git pull origin main`
2. **Update Dependencies**: `npm install`
3. **Rebuild Frontend**: `npm run build`
4. **Restart Server**: `npm start` (or `pm2 restart all`)

> [!NOTE]
> **Automatic Migrations**: The backend automatically handles database schema updates on startup. No manual SQL scripts are required.

---

## 🚢 Deployment Guides

### 🐳 Docker (Recommended)
Containerization ensures identical behavior across all environments.

1. **Build and Start**:
   ```bash
   docker-compose up -d --build
   ```
2. **Persistence**: The database (`quotes.db`) and `uploads/` are mapped to your host machine for safety.

### 🐧 Linux (VPS/Server) via PM2
1. **Install PM2**: `npm install -g pm2`
2. **Build**: `npm run build`
3. **Start**: `pm2 start server.ts --interpreter npx --interpreter-args tsx`
4. **Save**: `pm2 save && pm2 startup`

### 🖥️ Windows Server
1. **Setup**: Install Node.js and Git.
2. **Run**: Use the "Production Mode" steps above.
3. **Persistence**: Ensure the user running the process has write permissions to the project folder.

### ☁️ Vercel
1. **Deploy**: Push your code to GitHub and connect it to Vercel.
2. **Settings**:
   - Framework Preset: **Vite**
   - Output Directory: `dist`
   - Install Command: `npm install`
   - Build Command: `npm run build`
3. **Environmental Variables**: Add your keys in the Vercel Dashboard.

> [!CAUTION]
> **SQLite on Vercel**: Vercel's filesystem is ephemeral. Data saved to `quotes.db` will be **lost** when the function restarts. It is highly recommended to use a persistent VPS or connect to an external PostgreSQL database for Vercel deployments.

---

## 🎨 Customization Modules

### Module 1 — Branding
- **Company Name**: Edit `src/App.tsx` (AJ Network Solutions).
- **Logo**: Settings → Upload Logo (Admin only).

### Module 2 — Defaults (Terms & Conditions)
- Edit `src/components/QuoteForm.tsx` (around line 90) to change default VAT, payment terms, and bank details.

---

## 🔐 Security & Maintenance
- **Backups**: Download `quotes.db` regularly via **Settings → Download Database Backup**.
- **Logs**: Monitor system errors via **Settings → System Logs**.

---

## 🔮 Roadmap
- Integrated Inventory Management
- Multi-currency Conversion
- Dashboard Analytics Upgrade
- Dark Mode Themes
