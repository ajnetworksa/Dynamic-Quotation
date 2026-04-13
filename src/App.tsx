// =============================================================================
// App.tsx — Root Application Layout
// =============================================================================
// This file controls:
//   - The top navigation bar (header) with logo, nav links, logout button
//   - Routing between all pages (Dashboard, Docs, Product DB, etc.)
//   - Authentication state (login/logout)
//
// HOW TO CUSTOMISE:
//   • COMPANY NAME in the header  → search for "AJ Network Solutions" below
//   • ACTIVE NAV-ITEM COLOR       → search for 'bg-indigo-600' in NavItem
//   • HEADER BACKGROUND COLOR     → search for 'bg-white border-b'
//   • NAVIGATION ITEMS (add/remove pages) → edit the <NavItem> list ~line 70
// =============================================================================

import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { FileText, Database, Users, History, Settings as SettingsIcon, LogOut, Shield, LayoutDashboard } from 'lucide-react';
import QuoteForm from './components/QuoteForm';
import Dashboard from './components/Dashboard';
import ProductDB from './components/ProductDB';
import CustomerDB from './components/CustomerDB';
import Tracking from './components/Tracking';
import Settings from './components/Settings';
import Login from './components/Login';
import UsersDB from './components/UsersDB';
import AIAssistant from './components/AIAssistant';

// Global fetch interceptor for auth token
const originalFetch = window.fetch;
Object.defineProperty(window, 'fetch', {
  value: async (input: RequestInfo | URL, init?: RequestInit) => {
    const token = localStorage.getItem('token');
    if (token) {
      init = init || {};
      init.headers = {
        ...init.headers,
        'Authorization': `Bearer ${token}`
      };
    }
    const response = await originalFetch(input, init);
    if (response.status === 401 && window.location.pathname !== '/login') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.dispatchEvent(new Event('auth-change'));
    }
    return response;
  },
  writable: true,
  configurable: true
});

// NavItem renders a single navigation link in the top bar.
// The active page link is highlighted with a colored background.
//
// CHANGE ACTIVE LINK BACKGROUND COLOR: replace 'bg-indigo-600' below.
// CHANGE ACTIVE LINK TEXT COLOR:       replace 'text-white' below.
// CHANGE HOVER COLOR (inactive items): replace 'hover:bg-gray-100' below.
// ICON SIZE: change size={20} (pixels). Common values: 16, 18, 20, 24.
function NavItem({ to, icon: Icon, label }: { to: string, icon: any, label: string }) {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      // Active page: highlighted background / Inactive page: subtle hover highlight
      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${isActive
        ? 'bg-indigo-600 text-white'   // ← Change 'indigo-600' to recolor the active tab
        : 'text-gray-600 hover:bg-gray-100' // ← Change 'gray-100' to recolor the hover state
        }`}
    >
      {/* Icon size in pixels — change 20 to make icons bigger or smaller */}
      <Icon size={20} />
      <span className="font-medium">{label}</span>
    </Link>
  );
}

function MainLayout({ user, handleLogout }: { user: any, handleLogout: () => void }) {
  const location = useLocation();

  return (
    // Main page background color: bg-gray-50 = very light gray.
    // Change to e.g. bg-white (pure white) or bg-slate-50 (cool light gray).
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── TOP NAVIGATION HEADER ──────────────────────────────────────────────
          HEADER BACKGROUND: 'bg-white' — change to e.g. 'bg-indigo-900' for dark.
          HEADER BORDER:     'border-gray-200' — change to match brand.
          HEIGHT:            'md:h-16' = 64px tall on desktop. Change to md:h-20 etc.
      ────────────────────────────────────────────────────────────────── */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center h-auto md:h-16 py-4 md:py-0 gap-4">
            <div className="flex items-center gap-2">
              {/* ── LOGO ICON BOX ──────────────────────────────────────────────
                  Background color: 'bg-indigo-600'  — change to rebrand the icon.
                  Icon: FileText — replace with any Lucide icon (e.g. BriefcaseBusiness).
                  Icon size: 24px — change to make the icon bigger or smaller.
              */}
              <div className="bg-indigo-600 p-2 rounded-lg">
                <FileText className="text-white" size={24} />
              </div>
              {/* ── COMPANY / APP NAME ────────────────────────────────────────
                  Change 'AJ Network Solutions' to your company name.
                  Text size: 'text-xl'   — change to text-lg or text-2xl etc.
                  Text color: 'text-gray-900' — change to e.g. 'text-indigo-900'.
              */}
              <h1 className="text-xl font-bold text-gray-900">AJ Network Solutions</h1>
            </div>
            <nav className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-hide items-center">
              <NavItem to="/" icon={LayoutDashboard} label="Dashboard" />
              <NavItem to="/quote" icon={FileText} label="Docs" />
              <NavItem to="/products" icon={Database} label="Product DB" />
              <NavItem to="/customers" icon={Users} label="Customer DB" />
              <NavItem to="/tracking" icon={History} label="Tracking" />
              {user?.role === 'admin' && (
                <>
                  <NavItem to="/users" icon={Shield} label="Users" />
                  <NavItem to="/settings" icon={SettingsIcon} label="Settings" />
                </>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-red-600 hover:bg-red-50 ml-2"
                title="Logout"
              >
                <LogOut size={20} />
                <span className="font-medium hidden md:inline">Logout</span>
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Keep QuoteForm mounted to preserve state when switching tabs */}
        <div style={{ display: location.pathname === '/quote' ? 'block' : 'none' }}>
          <QuoteForm />
        </div>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/products" element={<ProductDB />} />
          <Route path="/customers" element={<CustomerDB />} />
          <Route path="/tracking" element={<Tracking />} />
          {user?.role === 'admin' && (
            <>
              <Route path="/users" element={<UsersDB />} />
              <Route path="/settings" element={<Settings />} />
            </>
          )}
        </Routes>
      </main>
      <AIAssistant />
    </div>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));
  const [user, setUser] = useState<any>(JSON.parse(localStorage.getItem('user') || 'null'));

  useEffect(() => {
    const handleAuthChange = () => {
      setIsAuthenticated(!!localStorage.getItem('token'));
      setUser(JSON.parse(localStorage.getItem('user') || 'null'));
    };
    window.addEventListener('auth-change', handleAuthChange);
    return () => window.removeEventListener('auth-change', handleAuthChange);
  }, []);

  const handleLogin = (token: string, userData: any) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setIsAuthenticated(true);
    setUser(userData);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch (e) { }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUser(null);
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Router>
      <MainLayout user={user} handleLogout={handleLogout} />
    </Router>
  );
}
