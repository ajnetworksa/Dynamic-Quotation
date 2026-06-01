// =============================================================================
// App.tsx — Root Application Layout
// =============================================================================
import React, { useState, useEffect, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import {
  FileText, Database, Users, History,
  Settings as SettingsIcon, LogOut, Shield,
  LayoutDashboard, KeyRound, X, ChevronDown,
  User, CheckCircle2, Lock, Eye, EyeOff,
  Moon, Sun, Kanban, Truck
} from 'lucide-react';
import KanbanBoard from './components/KanbanBoard';
import QuoteForm from './components/QuoteForm';
import Dashboard from './components/Dashboard';
import ProductDB from './components/ProductDB';
import CustomerDB from './components/CustomerDB';
import SupplierDB from './components/SupplierDB';
import Tracking from './components/Tracking';
import Settings from './components/Settings';
import Login from './components/Login';
import UsersDB from './components/UsersDB';
import AIAssistant from './components/AIAssistant';
import { motion, AnimatePresence } from 'framer-motion';

// Global fetch interceptor for auth token
const originalFetch = window.fetch;
Object.defineProperty(window, 'fetch', {
  value: async (input: RequestInfo | URL, init?: RequestInit) => {
    const token = localStorage.getItem('token');
    if (token) {
      init = init || {};
      init.headers = { ...init.headers, 'Authorization': `Bearer ${token}` };
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
  configurable: true,
});

// ── NavItem ───────────────────────────────────────────────────────────────────
function NavItem({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link
      to={to}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
        isActive ? 'bg-indigo-600 text-white' : 'text-gray-600 hover:bg-gray-100'
      }`}
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
    </Link>
  );
}

// ── Permission labels map ─────────────────────────────────────────────────────
const PERM_LABELS: Record<string, string> = {
  canManageUsers: 'Manage Users',
  canManageSettings: 'Manage Settings',
  canDeleteData: 'Delete Records',
  canDatabaseMaintenance: 'DB Maintenance',
  canOverridePrice: 'Price Analysis',
  canViewRevenue: 'View Revenue',
  canUseRFQ: 'Import from RFQ',
  canUseAI: 'AI Assistant',
  canViewAllQuotes: 'View All Quotes',
  canViewCreatedBy: 'View Creator Info',
  canViewHistory: 'View Quote History',
  canChangePassword: 'Change Password',
  canConvertInvoice: 'Convert to Invoice',
  canSaveTemplate: 'Save Template',
  canEmailQuote: 'Email Quote',
  canPrintQuote: 'Print Quote',
  canViewFeatureAccess: 'View Own Feature Access',
  canUsePriceSync: 'AI Price Sync',
};

const PERM_DESCRIPTIONS: Record<string, string> = {
  canManageUsers: 'Create, edit, and delete system users and their permissions.',
  canManageSettings: 'Access global system settings, backup, and branding.',
  canDeleteData: 'Permanently remove quotation and customer records.',
  canDatabaseMaintenance: 'Perform database cleanup and administrative tasks.',
  canOverridePrice: 'View cost base and apply manual price overrides in the analysis sidebar.',
  canViewRevenue: 'View total revenue and profit summaries on the dashboard.',
  canUseRFQ: 'Upload PDF/Images to automatically parse items using AI.',
  canUseAI: 'Access the AI Data Assistant for natural language querying.',
  canViewAllQuotes: 'View and edit quotations created by other team members.',
  canViewCreatedBy: 'See who created a specific quote in the tracking table.',
  canViewHistory: 'Access the revision history and audit logs for quotations.',
  canChangePassword: 'Change own login password from the profile menu.',
  canConvertInvoice: 'Convert an existing Quotation into a Tax Invoice.',
  canSaveTemplate: 'Save document terms and conditions as reusable templates.',
  canEmailQuote: 'Send documents directly to customers via email.',
  canPrintQuote: 'Generate and print PDF versions of documents.',
  canViewFeatureAccess: 'See the "Feature Access" list in your profile menu.',
  canUsePriceSync: 'Bulk update product prices using AI to extract data from supplier lists (PDF/Excel).',
};

// ── Profile Modal ─────────────────────────────────────────────────────────────
function ProfileModal({ user, onClose }: { user: any; onClose: () => void }) {
  const [name, setName] = useState(user?.name || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/me/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const data = await res.json();
        // Update local user object
        const updatedUser = { ...user, name: data.name };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        window.location.reload();
      } else {
        setError('Failed to update profile.');
      }
    } catch {
      setError('Network error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 rounded-lg"><User size={18} className="text-indigo-600" /></div>
            <h2 className="text-lg font-semibold text-gray-800">Edit Profile</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          {error && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">{error}</div>}
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Username (Read-Only)</label>
            <input type="text" value={user?.username || ''} disabled className="w-full px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-gray-500 cursor-not-allowed outline-none" />
            <p className="text-[10px] text-gray-400 mt-1">Username can only be changed by an administrator.</p>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. John Doe" className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all" />
          </div>

          <div className="pt-2">
            <button type="submit" disabled={loading} className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-medium transition-colors shadow-lg shadow-indigo-200">
              {loading ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Change Password Modal ─────────────────────────────────────────────────────
function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const strength = (() => {
    if (!newPw) return 0;
    let s = 0;
    if (newPw.length >= 8) s++;
    if (/[A-Z]/.test(newPw)) s++;
    if (/[0-9]/.test(newPw)) s++;
    if (/[^A-Za-z0-9]/.test(newPw)) s++;
    return s;
  })();
  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength];
  const strengthColor = ['', 'bg-red-400', 'bg-yellow-400', 'bg-blue-400', 'bg-green-500'][strength];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPw !== confirm) { setError('New passwords do not match.'); return; }
    if (newPw.length < 4) { setError('New password must be at least 4 characters.'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/me/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (res.ok) setSuccess(true);
      else setError(data.error || 'Failed to change password.');
    } catch { setError('Network error.'); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-gray-200">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 rounded-lg"><KeyRound size={18} className="text-indigo-600" /></div>
            <h2 className="text-lg font-semibold text-gray-800">Change Password</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"><X size={18} /></button>
        </div>

        {success ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={32} className="text-green-500" />
            </div>
            <p className="text-lg font-semibold text-gray-800">Password Changed!</p>
            <p className="text-sm text-gray-500 mt-1">Your password has been updated successfully.</p>
            <button onClick={onClose} className="mt-5 px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 text-sm font-medium transition-colors">Done</button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl border border-red-200 flex items-center gap-2">
                <X size={14} /> {error}
              </div>
            )}
            {/* Current Password */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  required
                  className="w-full p-2.5 pr-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  placeholder="Enter current password"
                  value={currentPw}
                  onChange={e => setCurrentPw(e.target.value)}
                />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" onClick={() => setShowCurrent(v => !v)}>
                  {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
            {/* New Password */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">New Password</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  required
                  className="w-full p-2.5 pr-10 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                  placeholder="Enter new password"
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" onClick={() => setShowNew(v => !v)}>
                  {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {/* Strength bar */}
              {newPw && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1,2,3,4].map(i => (
                      <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= strength ? strengthColor : 'bg-gray-200'}`} />
                    ))}
                  </div>
                  <p className={`text-[10px] font-medium ${['','text-red-500','text-yellow-600','text-blue-600','text-green-600'][strength]}`}>{strengthLabel}</p>
                </div>
              )}
            </div>
            {/* Confirm Password */}
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1.5">Confirm New Password</label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  required
                  className={`w-full p-2.5 pr-10 border rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-sm ${confirm && confirm !== newPw ? 'border-red-400 bg-red-50' : 'border-gray-300'}`}
                  placeholder="Repeat new password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                />
                <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" onClick={() => setShowConfirm(v => !v)}>
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {confirm && confirm !== newPw && <p className="text-[10px] text-red-500 mt-1">Passwords don't match</p>}
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={loading} className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 text-sm font-semibold disabled:opacity-60 transition-colors">
                {loading ? 'Saving…' : 'Update Password'}
              </button>
              <button type="button" onClick={onClose} className="px-4 py-2.5 border border-gray-300 text-gray-600 rounded-xl hover:bg-gray-100 text-sm transition-colors">Cancel</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ── Profile Dropdown ──────────────────────────────────────────────────────────
function ProfileDropdown({ user, handleLogout }: { user: any; handleLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);
  const [globalShowFeatureAccess, setGlobalShowFeatureAccess] = useState(true);
  const [inspectionProtection, setInspectionProtection] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    fetch('/api/settings/workflowVisibility')
      .then(res => res.json())
      .then(data => {
        if (data.value) {
          const config = JSON.parse(data.value);
          if (config.showFeatureAccess !== undefined) {
            setGlobalShowFeatureAccess(config.showFeatureAccess);
          }
          if (config.inspectionProtection !== undefined) {
            setInspectionProtection(config.inspectionProtection);
          }
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!inspectionProtection) return;

    const handleContextMenu = (e: MouseEvent) => e.preventDefault();
    const handleKeyDown = (e: KeyboardEvent) => {
      // Disable F12
      if (e.keyCode === 123) e.preventDefault();
      // Disable Ctrl+Shift+I (Inspect)
      if (e.ctrlKey && e.shiftKey && e.keyCode === 73) e.preventDefault();
      // Disable Ctrl+Shift+J (Console)
      if (e.ctrlKey && e.shiftKey && e.keyCode === 74) e.preventDefault();
      // Disable Ctrl+U (View Source)
      if (e.ctrlKey && e.keyCode === 85) e.preventDefault();
    };

    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [inspectionProtection]);

  const displayName = user?.name || user?.username;
  const initials = (displayName || 'U').slice(0, 2).toUpperCase();
  const roleColors: Record<string, string> = {
    admin: 'bg-purple-100 text-purple-700',
    editor: 'bg-blue-100 text-blue-700',
    user: 'bg-gray-100 text-gray-600',
  };
  const roleColor = roleColors[user?.role] || roleColors.user;

  const grantedPerms = user?.role === 'admin'
    ? [{ label: 'Full System Access', desc: 'Unlimited access to all system features and administrative tools.' }]
    : Object.entries(user?.permissions || {})
        .filter(([, v]) => v)
        .map(([k]) => ({
          label: PERM_LABELS[k] || k,
          desc: PERM_DESCRIPTIONS[k] || 'No description available.'
        }));

  return (
    <>
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-xl hover:bg-gray-100 transition-colors"
          title="Profile"
        >
          {/* Avatar */}
          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
            {initials}
          </div>
          <div className="hidden md:flex flex-col items-start leading-tight">
            <span className="text-sm font-semibold text-gray-800">{displayName}</span>
            <span className={`text-[10px] font-medium px-1.5 rounded ${roleColor}`}>{user?.role}</span>
          </div>
          <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown panel */}
        {open && (
          <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-gray-200 z-40 overflow-hidden">
            {/* Header */}
            <div className="p-4 bg-gradient-to-br from-indigo-600 to-indigo-700 text-white">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center text-lg font-bold">
                  {initials}
                </div>
                <div>
                  <p className="font-bold text-base">{displayName}</p>
                  <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full font-medium capitalize">{user?.role}</span>
                </div>
              </div>
            </div>

            {/* Feature Access summary */}
            {globalShowFeatureAccess && (user?.role === 'admin' || user?.permissions?.canViewFeatureAccess) && (
              <div className="px-4 pt-3 pb-2">
                <button
                  onClick={() => setShowPermissions(v => !v)}
                  className="w-full flex items-center justify-between text-xs font-semibold text-gray-500 uppercase tracking-wider hover:text-indigo-600 transition-colors"
                >
                  <span>Feature Access ({user?.role === 'admin' ? 'All' : grantedPerms.length})</span>
                  <ChevronDown size={12} className={`transition-transform ${showPermissions ? 'rotate-180' : ''}`} />
                </button>
                {showPermissions && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {grantedPerms.length === 0 ? (
                      <span className="text-xs text-gray-400 italic">No extra access</span>
                    ) : (
                      grantedPerms.map(p => (
                        <span 
                          key={p.label} 
                          title={p.desc}
                          className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[10px] font-semibold rounded-full border border-indigo-100 cursor-help"
                        >
                          {p.label}
                        </span>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="border-t border-gray-100 mx-4" />

            {/* Actions */}
            <div className="p-2">
              <button
                onClick={() => { setOpen(false); setShowProfile(true); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-indigo-50 transition-colors text-left group"
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
                  <User size={15} className="text-indigo-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-800">Profile</p>
                  <p className="text-[10px] text-gray-400">Update your name</p>
                </div>
              </button>

              {(user?.role === 'admin' || user?.permissions?.canChangePassword) && (
                <button
                  onClick={() => { setOpen(false); setShowChangePw(true); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-indigo-50 transition-colors text-left group mt-1"
                >
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
                    <KeyRound size={15} className="text-indigo-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Change Password</p>
                    <p className="text-[10px] text-gray-400">Update your login credentials</p>
                  </div>
                </button>
              )}

              <button
                onClick={() => { setOpen(false); handleLogout(); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-red-50 transition-colors text-left group mt-1"
              >
                <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center group-hover:bg-red-200 transition-colors">
                  <LogOut size={15} className="text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-red-600">Sign Out</p>
                  <p className="text-[10px] text-gray-400">End your current session</p>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>

      {showProfile && <ProfileModal user={user} onClose={() => setShowProfile(false)} />}
      {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}
    </>
  );
}

// ── Main Layout ───────────────────────────────────────────────────────────────
function MainLayout({ user, handleLogout, isDarkMode, setIsDarkMode }: { user: any; handleLogout: () => void; isDarkMode: boolean; setIsDarkMode: (v: boolean) => void }) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-300 flex flex-col">
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10 transition-colors duration-300">
        <div className="max-w-[98%] mx-auto px-2 sm:px-4 lg:px-5">
          <div className="flex flex-col md:flex-row justify-between items-center h-auto md:h-16 py-4 md:py-0 gap-4">
            <div className="flex items-center gap-2">
              <div className="bg-indigo-600 p-2 rounded-lg">
                <FileText className="text-white" size={24} />
              </div>
              <h1 className="text-xl font-bold text-gray-900">AJ Network Solutions</h1>
            </div>
            <div className="flex items-center gap-4 w-full md:w-auto">
              <nav className="flex gap-2 overflow-x-auto flex-1 md:flex-none pb-2 md:pb-0 scrollbar-hide items-center">
                <NavItem to="/" icon={LayoutDashboard} label="Dashboard" />
                <NavItem to="/quote" icon={FileText} label="Docs" />
                <NavItem to="/products" icon={Database} label="Product DB" />
                <NavItem to="/customers" icon={Users} label="Customer DB" />
                <NavItem to="/suppliers" icon={Truck} label="Supplier DB" />
                <NavItem to="/tracking" icon={History} label="Tracking" />
                {(user?.role === 'admin' || user?.permissions?.canUseKanban) && (
                  <NavItem to="/kanban" icon={Kanban} label="Kanban" />
                )}
                {(user?.role === 'admin' || user?.permissions?.canManageUsers) && (
                  <NavItem to="/users" icon={Shield} label="Users" />
                )}
                {(user?.role === 'admin' || user?.permissions?.canManageSettings) && (
                  <NavItem to="/settings" icon={SettingsIcon} label="Settings" />
                )}
              </nav>
              {/* Theme Toggle */}
              <button
                onClick={() => setIsDarkMode(!isDarkMode)}
                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
                title={isDarkMode ? 'Light Mode' : 'Dark Mode'}
              >
                {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
              </button>
              {/* Profile Dropdown — outside of overflow-x-auto nav so it doesn't clip */}
              <div className="shrink-0">
                <ProfileDropdown user={user} handleLogout={handleLogout} />
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[98%] mx-auto px-2 sm:px-4 lg:px-5 py-4 w-full">
        <div style={location.pathname === '/quote' ? { display: 'block' } : { display: 'block', height: 0, overflow: 'hidden', visibility: 'hidden' }}>
          <QuoteForm />
        </div>
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <Routes location={location}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/products" element={<ProductDB />} />
              <Route path="/customers" element={<CustomerDB />} />
              <Route path="/suppliers" element={<SupplierDB />} />
              <Route path="/tracking" element={<Tracking />} />
              {(user?.role === 'admin' || user?.permissions?.canUseKanban) && (
                <Route path="/kanban" element={<KanbanBoard />} />
              )}
              <Route path="/quote" element={null} />
              {(user?.role === 'admin' || user?.permissions?.canManageUsers) && (
                <Route path="/users" element={<UsersDB />} />
              )}
              {(user?.role === 'admin' || user?.permissions?.canManageSettings) && (
                <Route path="/settings" element={<Settings />} />
              )}
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>
      <AIAssistant />
    </div>
  );
}

// ── App Root ──────────────────────────────────────────────────────────────────
export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));
  const [user, setUser] = useState<any>(JSON.parse(localStorage.getItem('user') || 'null'));
  const [isDarkMode, setIsDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDarkMode]);

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
    try { await fetch('/api/logout', { method: 'POST' }); } catch (e) {}
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUser(null);
  };

  if (!isAuthenticated) return <Login onLogin={handleLogin} />;

  return (
    <Router>
      <MainLayout user={user} handleLogout={handleLogout} isDarkMode={isDarkMode} setIsDarkMode={setIsDarkMode} />
    </Router>
  );
}
