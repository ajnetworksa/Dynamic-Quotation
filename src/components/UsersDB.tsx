import React, { useState, useEffect, useMemo } from 'react';
import { confirmAsync } from '../lib/notify';
import { Plus, Trash2, Edit2, Save, X, Shield, User, Bot, FileSearch, Settings as SettingsIcon, Database, Users, Eye, UserCheck, Layers, FileText, Bookmark, Send, Printer, History, KeyRound, Search, ChevronDown, ChevronUp, Crown, PenLine, Check } from 'lucide-react';

interface Permissions {
  canUseRFQ?: boolean;
  canUseAI?: boolean;
  canManageUsers?: boolean;
  canManageSettings?: boolean;
  canDeleteData?: boolean;
  canDatabaseMaintenance?: boolean;
  canOverridePrice?: boolean;
  canViewRevenue?: boolean;
  canViewAllQuotes?: boolean;
  canViewQuotesFrom?: number[];
  canViewCreatedBy?: boolean;
  canViewHistory?: boolean;
  canChangePassword?: boolean;
  canConvertInvoice?: boolean;
  canSaveTemplate?: boolean;
  canEmailQuote?: boolean;
  canPrintQuote?: boolean;
  canViewFeatureAccess?: boolean;
  canUsePriceSync?: boolean;
  canUndoQuote?: boolean;
  canChangeAuthor?: boolean;
  canShareQuote?: boolean;
  canEditSharedQuote?: boolean;
  canUseKanban?: boolean;
  canManageRecycleBin?: boolean;
  canViewAuditLog?: boolean;
  canEditCatalog?: boolean;
}

type PermissionKey = Exclude<keyof Permissions, 'canViewQuotesFrom'>;

interface AppUser {
  id: number;
  username: string;
  role: string;
  permissions: Permissions;
}

interface PermissionGroup {
  id: number;
  name: string;
  description: string;
  permissions: Permissions;
  members: number[];
}

type CategoryId = 'quotes' | 'pricing' | 'ai' | 'data' | 'admin' | 'account';

const CATEGORIES: { id: CategoryId; label: string; description: string; icon: React.ReactNode }[] = [
  { id: 'quotes', label: 'Quotations & Documents', description: 'Working with quotes, invoices and sharing.', icon: <FileText size={15} /> },
  { id: 'pricing', label: 'Pricing & Catalog', description: 'Costs, revenue, prices and the product/customer lists.', icon: <Bot size={15} /> },
  { id: 'ai', label: 'AI Tools', description: 'AI-powered import and assistant.', icon: <FileSearch size={15} /> },
  { id: 'data', label: 'Data & Records', description: 'Deleting, Recycle Bin and database maintenance.', icon: <Database size={15} /> },
  { id: 'admin', label: 'Administration', description: 'Users, settings and the audit log.', icon: <Shield size={15} /> },
  { id: 'account', label: 'Own Account', description: 'What the user can do in their profile menu.', icon: <User size={15} /> },
];

const ALL_PERMISSIONS: { key: PermissionKey; label: string; icon: React.ReactNode; description: string; category: CategoryId }[] = [
  { key: 'canManageUsers', label: 'Manage Users', icon: <Shield size={14} />, description: 'Create, edit, and delete system users and their permissions.', category: 'admin' },
  { key: 'canManageSettings', label: 'Manage Settings', icon: <SettingsIcon size={14} />, description: 'Access global system settings, backup, and branding.', category: 'admin' },
  { key: 'canEditCatalog', label: 'Edit Catalog', icon: <Edit2 size={14} />, description: 'Add and edit customers, products and suppliers (and import them from CSV).', category: 'pricing' },
  { key: 'canViewAuditLog', label: 'Audit Log', icon: <History size={14} />, description: 'View the audit log of logins, user changes, exports and deletions.', category: 'admin' },
  { key: 'canManageRecycleBin', label: 'Recycle Bin', icon: <Trash2 size={14} />, description: 'View, restore and permanently delete quotations in the Recycle Bin.', category: 'data' },
  { key: 'canDeleteData', label: 'Delete Records', icon: <Trash2 size={14} />, description: 'Remove quotation and customer records (quotations go to the Recycle Bin).', category: 'data' },
  { key: 'canDatabaseMaintenance', label: 'DB Maintenance', icon: <Database size={14} />, description: 'Perform database cleanup and administrative tasks.', category: 'data' },
  { key: 'canOverridePrice', label: 'Price Analysis', icon: <Bot size={14} />, description: 'View cost base and apply manual price overrides in the analysis sidebar.', category: 'pricing' },
  { key: 'canViewRevenue', label: 'View Revenue', icon: <Users size={14} />, description: 'View total revenue and profit summaries on the dashboard.', category: 'pricing' },
  { key: 'canUseKanban', label: 'Use Kanban Board', icon: <Layers size={14} />, description: 'Access the interactive Kanban board for quotation stages.', category: 'quotes' },
  { key: 'canUseRFQ', label: 'Import from RFQ', icon: <FileSearch size={14} />, description: 'Upload PDF/Images to automatically parse items using AI.', category: 'ai' },
  { key: 'canUseAI', label: 'AI Data Assistant', icon: <Bot size={14} />, description: 'Access the AI Data Assistant for natural language querying.', category: 'ai' },
  { key: 'canViewAllQuotes', label: 'View All Quotes', icon: <Eye size={14} />, description: 'View and edit quotations created by other team members.', category: 'quotes' },
  { key: 'canViewCreatedBy', label: 'View Creator Info', icon: <UserCheck size={14} />, description: 'See who created a specific quote in the tracking table.', category: 'quotes' },
  { key: 'canViewHistory', label: 'View Quote History', icon: <History size={14} />, description: 'Access the revision history and audit logs for quotations.', category: 'quotes' },
  { key: 'canChangePassword', label: 'Change Password', icon: <KeyRound size={14} />, description: 'Change own login password from the profile menu.', category: 'account' },
  { key: 'canConvertInvoice', label: 'Convert to Invoice', icon: <FileText size={14} />, description: 'Convert an existing Quotation into a Tax Invoice.', category: 'quotes' },
  { key: 'canSaveTemplate', label: 'Save Template', icon: <Bookmark size={14} />, description: 'Save document terms and conditions as reusable templates.', category: 'quotes' },
  { key: 'canEmailQuote', label: 'Email Quote', icon: <Send size={14} />, description: 'Send documents directly to customers via email.', category: 'quotes' },
  { key: 'canPrintQuote', label: 'Print Quote', icon: <Printer size={14} />, description: 'Generate and print PDF versions of documents.', category: 'quotes' },
  { key: 'canViewFeatureAccess', label: 'Show Feature Access', icon: <Eye size={14} />, description: 'Allow the user to see their own granted feature access list in the profile menu.', category: 'account' },
  { key: 'canUsePriceSync', label: 'AI Price Sync', icon: <Bot size={14} />, description: 'Bulk update product prices using AI to extract data from supplier lists (PDF/Excel).', category: 'pricing' },
  { key: 'canUndoQuote', label: 'Undo Timeline Actions', icon: <History size={14} />, description: 'Allow restoring quotes to previous states via the timeline.', category: 'quotes' },
  { key: 'canChangeAuthor', label: 'Change Prepared By', icon: <UserCheck size={14} />, description: 'Allow modifying the "Prepared By" name on quotes.', category: 'quotes' },
  { key: 'canShareQuote', label: 'Share Quotes', icon: <Users size={14} />, description: 'Allow sharing specific quotes with selected users or groups.', category: 'quotes' },
  { key: 'canEditSharedQuote', label: 'Edit Shared Quotes', icon: <Eye size={14} />, description: 'Allow editing and saving quotes that were shared with this user (not just viewing).', category: 'quotes' },
];

const ROLES: { value: string; label: string; description: string; icon: React.ReactNode; badge: string }[] = [
  { value: 'user', label: 'User', description: 'Only what you tick below.', icon: <User size={16} />, badge: 'bg-gray-100 text-gray-700' },
  { value: 'editor', label: 'Editor', description: 'Same as User; label for content editors.', icon: <PenLine size={16} />, badge: 'bg-blue-100 text-blue-700' },
  { value: 'admin', label: 'Admin', description: 'Full access to everything.', icon: <Crown size={16} />, badge: 'bg-purple-100 text-purple-700' },
];
const roleBadge = (role: string) => ROLES.find(r => r.value === role)?.badge || 'bg-gray-100 text-gray-700';
const avatarColour = (role: string) => role === 'admin' ? 'bg-purple-600' : role === 'editor' ? 'bg-blue-600' : 'bg-indigo-500';

const grantedKeys = (perms: Permissions | undefined) => ALL_PERMISSIONS.filter(p => perms?.[p.key]);

// ── Permission editor, grouped by category ───────────────────────────────────
function PermissionToggles({
  perms,
  role,
  onChange,
  onSetMany,
  hideQuoteVis,
}: {
  perms: Permissions;
  role: string;
  onChange: (key: PermissionKey) => void;
  onSetMany: (keys: PermissionKey[], value: boolean) => void;
  hideQuoteVis?: boolean;
}) {
  const [query, setQuery] = useState('');
  if (role === 'admin') {
    return (
      <div className="flex items-center gap-2 p-4 rounded-xl border border-purple-200 bg-purple-50 text-sm text-purple-700 font-medium">
        <Shield size={16} /> Admins have full access. No extra permissions are needed.
      </div>
    );
  }
  const q = query.trim().toLowerCase();
  const available = ALL_PERMISSIONS.filter(p => !(hideQuoteVis && p.key === 'canViewAllQuotes'));
  const visible = available.filter(p => !q || p.label.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
  const grantedCount = available.filter(p => perms?.[p.key]).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
        <p className="text-sm text-gray-600"><span className="font-semibold text-gray-800">{grantedCount}</span> of {available.length} features allowed</p>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Find a permission…"
              aria-label="Find a permission"
              className="pl-8 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 outline-none w-48"
            />
          </div>
          <button type="button" onClick={() => onSetMany(available.map(p => p.key), true)} className="text-xs font-semibold text-indigo-600 hover:underline">All</button>
          <span className="text-gray-300">|</span>
          <button type="button" onClick={() => onSetMany(available.map(p => p.key), false)} className="text-xs font-semibold text-gray-500 hover:underline">None</button>
        </div>
      </div>

      {CATEGORIES.map(cat => {
        const items = visible.filter(p => p.category === cat.id);
        if (items.length === 0) return null;
        const all = available.filter(p => p.category === cat.id);
        const on = all.filter(p => perms?.[p.key]).length;
        return (
          <fieldset key={cat.id} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <legend className="sr-only">{cat.label}</legend>
            <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-indigo-600">{cat.icon}</span>
                <span className="text-sm font-semibold text-gray-800">{cat.label}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${on === all.length ? 'bg-emerald-100 text-emerald-700' : on > 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>{on}/{all.length}</span>
                <span className="text-xs text-gray-500 hidden lg:inline truncate">{cat.description}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0 text-xs">
                <button type="button" onClick={() => onSetMany(all.map(p => p.key), true)} className="font-semibold text-indigo-600 hover:underline" aria-label={`Allow all in ${cat.label}`}>All</button>
                <span className="text-gray-300">|</span>
                <button type="button" onClick={() => onSetMany(all.map(p => p.key), false)} className="font-semibold text-gray-500 hover:underline" aria-label={`Allow none in ${cat.label}`}>None</button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-gray-100">
              {items.map(p => {
                const checked = !!perms?.[p.key];
                return (
                  <label
                    key={p.key}
                    className={`flex items-start gap-3 p-3 cursor-pointer transition-colors ${checked ? 'bg-indigo-50' : 'bg-white hover:bg-gray-50'}`}
                  >
                    <input type="checkbox" checked={checked} onChange={() => onChange(p.key)} className="mt-0.5 w-4 h-4 accent-indigo-600 shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-sm font-medium text-gray-800"><span className="text-gray-400">{p.icon}</span>{p.label}</div>
                      <p className="text-xs text-gray-500 mt-0.5 leading-snug">{p.description}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </fieldset>
        );
      })}
      {visible.length === 0 && <p className="text-sm text-gray-400 italic p-3">No permission matches “{query}”.</p>}
    </div>
  );
}

// ── Quotation visibility badge (display only) ────────────────────────────────
function VisibilityBadge({ perms, allUsers }: { perms: Permissions; allUsers?: AppUser[] }) {
  if (perms?.canViewAllQuotes) {
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 text-[11px] font-semibold rounded-full" title="Can view all quotations across all users"><Eye size={12} /> All quotes</span>;
  }
  if (perms?.canViewQuotesFrom && perms.canViewQuotesFrom.length > 0) {
    const authorNames = perms.canViewQuotesFrom.map(id => allUsers?.find(u => u.id === id)?.username || `ID:${id}`).join(', ');
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-sky-100 text-sky-800 text-[11px] font-semibold rounded-full max-w-full truncate" title={`Can view quotations by: ${authorNames}`}><Users size={12} /> Quotes of: {authorNames}</span>;
  }
  return <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 text-gray-600 text-[11px] font-medium rounded-full" title="Can only view own quotations"><User size={12} /> Own quotes only</span>;
}

// ── Granted permissions, grouped (display only) ──────────────────────────────
function PermissionSummary({ perms, role, colour = 'indigo' }: { perms: Permissions; role: string; colour?: 'indigo' | 'green' }) {
  const [open, setOpen] = useState(false);
  if (role === 'admin') return <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-700 uppercase">All access</span>;
  const granted = grantedKeys(perms).filter(p => p.key !== 'canViewAllQuotes' || colour === 'green');
  if (granted.length === 0) return <span className="text-xs text-gray-400 italic">No extra features</span>;
  const chip = colour === 'green' ? 'bg-green-100 text-green-700' : 'bg-indigo-100 text-indigo-700';
  const shown = open ? granted : granted.slice(0, 5);
  return (
    <div className="flex flex-wrap gap-1 items-center">
      {shown.map(p => (
        <span key={p.key} title={p.description} className={`inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full ${chip}`}>{p.icon} {p.label}</span>
      ))}
      {granted.length > 5 && (
        <button type="button" onClick={() => setOpen(o => !o)} className="inline-flex items-center gap-0.5 px-2 py-0.5 text-[11px] font-semibold text-gray-600 rounded-full border border-gray-200 hover:bg-gray-50">
          {open ? <>Show less <ChevronUp size={12} /></> : <>+{granted.length - 5} more <ChevronDown size={12} /></>}
        </button>
      )}
    </div>
  );
}

function AccessMeter({ perms, role }: { perms: Permissions; role: string }) {
  const total = ALL_PERMISSIONS.length;
  const n = role === 'admin' ? total : grantedKeys(perms).length;
  return (
    <div className="flex items-center gap-2 min-w-[7rem]" title={`${n} of ${total} features`}>
      <div className="h-1.5 flex-1 rounded-full bg-gray-200 overflow-hidden">
        <div className={`h-full rounded-full ${role === 'admin' ? 'bg-purple-500' : 'bg-indigo-500'}`} style={{ width: `${Math.round((n / total) * 100)}%` }} />
      </div>
      <span className="text-[11px] text-gray-500 tabular-nums">{n}/{total}</span>
    </div>
  );
}

// ── Modal shell (Escape / focus handled globally by useDialogAccessibility) ──
function EditorModal({ title, subtitle, onClose, footer, children }: { title: string; subtitle?: string; onClose: () => void; footer: React.ReactNode; children: React.ReactNode }) {
  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-50 bg-black/50 flex items-stretch sm:items-center justify-center sm:p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white w-full sm:max-w-3xl sm:rounded-2xl shadow-2xl flex flex-col max-h-full sm:max-h-[92vh]">
        <div className="flex items-start justify-between gap-3 px-6 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">{children}</div>
        <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 sm:rounded-b-2xl">{footer}</div>
      </div>
    </div>
  );
}

function StepTitle({ n, title, hint }: { n: number; title: string; hint?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center shrink-0">{n}</span>
      <h4 className="text-sm font-semibold text-gray-800">{title}</h4>
      {hint && <span className="text-xs text-gray-500 hidden sm:inline">· {hint}</span>}
    </div>
  );
}

const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none';

// ─────────────────────────────────────────────────────────────────────────────
// ── User Form (kept as its own component so inputs keep focus on re-render) ──
// ─────────────────────────────────────────────────────────────────────────────
function UserFormPanel({
  title,
  onSave,
  onCancel,
  editForm,
  setEditForm,
  isEditing,
  groups,
  selectedGroupId,
  setSelectedGroupId,
  applyGroup,
  togglePerm,
  setManyPerms,
  allUsers,
  error,
}: {
  title: string;
  onSave: () => void;
  onCancel: () => void;
  editForm: Partial<AppUser & { password?: string }>;
  setEditForm: React.Dispatch<React.SetStateAction<Partial<AppUser & { password?: string }>>>;
  isEditing: number | null;
  groups: PermissionGroup[];
  selectedGroupId: string;
  setSelectedGroupId: (id: string) => void;
  applyGroup: (groupId: string, currentPerms: Permissions) => Permissions;
  togglePerm: (key: PermissionKey) => void;
  setManyPerms: (keys: PermissionKey[], value: boolean) => void;
  allUsers: AppUser[];
  error: string;
}) {
  const [specificModeSelected, setSpecificModeSelected] = useState(false);

  // Determine current visibility mode
  const currentVisMode: 'own' | 'all' | 'specific' = editForm.permissions?.canViewAllQuotes
    ? 'all'
    : (editForm.permissions?.canViewQuotesFrom && editForm.permissions.canViewQuotesFrom.length > 0)
      ? 'specific'
      : (specificModeSelected ? 'specific' : 'own');

  const otherUsers = allUsers.filter(u => u.id !== isEditing);
  const isAdmin = editForm.role === 'admin';
  const pwd = editForm.password || '';

  const setVisibility = (mode: 'own' | 'all' | 'specific') => {
    setSpecificModeSelected(mode === 'specific');
    setEditForm(prev => ({
      ...prev,
      permissions: mode === 'specific'
        ? { ...(prev.permissions || {}), canViewAllQuotes: false }
        : { ...(prev.permissions || {}), canViewAllQuotes: mode === 'all', canViewQuotesFrom: [] },
    }));
  };

  const visOptions: { mode: 'own' | 'all' | 'specific'; label: string; hint: string; icon: React.ReactNode }[] = [
    { mode: 'own', label: 'Only own quotes', hint: 'Sees what they created', icon: <User size={16} /> },
    { mode: 'all', label: 'All team quotes', hint: 'Sees every quotation', icon: <Users size={16} /> },
    { mode: 'specific', label: "Specific users' quotes", hint: 'Pick whose quotes', icon: <UserCheck size={16} /> },
  ];

  let step = 1;
  return (
    <EditorModal
      title={title}
      subtitle={isEditing !== null ? 'Change the account, role and what this person can do.' : 'Create an account and choose what this person can do.'}
      onClose={onCancel}
      footer={
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {error ? <p className="text-sm text-red-600 font-medium flex-1" role="alert">{error}</p> : <span className="flex-1" />}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onCancel} className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 text-sm"><X size={15} /> Cancel</button>
            <button type="button" onClick={onSave} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"><Save size={15} /> Save</button>
          </div>
        </div>
      }
    >
      {/* 1. Account */}
      <section>
        <StepTitle n={step++} title="Account" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-xs font-medium text-gray-600">Username</span>
            <input
              type="text"
              className={`${inputCls} mt-1`}
              placeholder="e.g. ahmed"
              autoComplete="off"
              value={editForm.username || ''}
              onChange={e => setEditForm(prev => ({ ...prev, username: e.target.value }))}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-600">{isEditing !== null ? 'New password (leave blank to keep)' : 'Password'}</span>
            <input
              type="password"
              className={`${inputCls} mt-1`}
              placeholder={isEditing ? 'New password (min 10 chars, blank = keep)' : 'Password (min 10 characters)'}
              autoComplete="new-password"
              minLength={isEditing ? undefined : 10}
              value={pwd}
              onChange={e => setEditForm(prev => ({ ...prev, password: e.target.value }))}
            />
            <span className={`text-[11px] mt-1 block ${pwd && pwd.length < 10 ? 'text-amber-600' : 'text-gray-400'}`}>
              {pwd ? (pwd.length < 10 ? `${10 - pwd.length} more character${10 - pwd.length === 1 ? '' : 's'} needed` : <span className="inline-flex items-center gap-1 text-emerald-600"><Check size={12} /> Long enough</span>) : 'At least 10 characters.'}
            </span>
          </label>
        </div>
        <div className="mt-3">
          <span className="text-xs font-medium text-gray-600">Role</span>
          <div role="radiogroup" aria-label="Role" className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-1">
            {ROLES.map(r => {
              const selected = (editForm.role || 'user') === r.value;
              return (
                <label key={r.value} className={`flex items-start gap-2.5 p-3 rounded-xl border-2 cursor-pointer transition-colors ${selected ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input type="radio" name={`role-${isEditing ?? 'new'}`} value={r.value} checked={selected} onChange={() => setEditForm(prev => ({ ...prev, role: r.value }))} className="sr-only" />
                  <span className={`mt-0.5 ${selected ? 'text-indigo-600' : 'text-gray-400'}`}>{r.icon}</span>
                  <span>
                    <span className="block text-sm font-semibold text-gray-800">{r.label}</span>
                    <span className="block text-xs text-gray-500">{r.description}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </section>

      {/* 2. Group preset */}
      {!isAdmin && groups.length > 0 && (
        <section>
          <StepTitle n={step++} title="Start from a group" hint="optional: copies the group's permissions below" />
          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <Layers size={16} className="text-amber-600 shrink-0" />
            <select
              aria-label="Apply group preset"
              className="flex-1 min-w-0 text-sm border border-amber-300 rounded-lg p-2 bg-white focus:ring-2 focus:ring-amber-400 outline-none"
              value={selectedGroupId}
              onChange={e => {
                setSelectedGroupId(e.target.value);
                if (e.target.value) {
                  setEditForm(prev => ({ ...prev, permissions: applyGroup(e.target.value, (prev.permissions || {}) as Permissions) }));
                }
              }}
            >
              <option value="">— Select a group to apply —</option>
              {groups.map(g => <option key={g.id} value={String(g.id)}>{g.name}</option>)}
            </select>
            {selectedGroupId && (
              <button type="button" className="text-xs font-semibold text-amber-700 hover:underline shrink-0" onClick={() => { setSelectedGroupId(''); setEditForm(prev => ({ ...prev, permissions: {} })); }}>Clear</button>
            )}
          </div>
        </section>
      )}

      {/* 3. Quotation visibility */}
      {!isAdmin && (
        <section>
          <StepTitle n={step++} title="Which quotations can they see?" />
          <div role="radiogroup" aria-label="Quotation visibility" className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {visOptions.map(o => {
              const selected = currentVisMode === o.mode;
              return (
                <label key={o.mode} className={`flex items-start gap-2.5 p-3 rounded-xl border-2 cursor-pointer transition-colors ${selected ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input type="radio" name={`quote-vis-${isEditing ?? 'new'}`} checked={selected} onChange={() => setVisibility(o.mode)} className="sr-only" />
                  <span className={`mt-0.5 ${selected ? 'text-indigo-600' : 'text-gray-400'}`}>{o.icon}</span>
                  <span>
                    <span className="block text-sm font-semibold text-gray-800">{o.label}</span>
                    <span className="block text-xs text-gray-500">{o.hint}</span>
                  </span>
                </label>
              );
            })}
          </div>

          {currentVisMode === 'specific' && (
            <div className="mt-3 p-3 bg-sky-50 border border-sky-200 rounded-xl">
              <div className="flex items-center justify-between gap-2 mb-2 text-xs">
                <span className="font-semibold text-sky-900">Whose quotations can this user view? <span className="text-sky-700">({editForm.permissions?.canViewQuotesFrom?.length ?? 0} selected)</span></span>
                <span className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setEditForm(prev => ({ ...prev, permissions: { ...(prev.permissions || {}), canViewAllQuotes: false, canViewQuotesFrom: otherUsers.map(u => u.id) } }))}
                    className="text-indigo-600 font-semibold hover:underline"
                  >Select All</button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={() => setEditForm(prev => ({ ...prev, permissions: { ...(prev.permissions || {}), canViewAllQuotes: false, canViewQuotesFrom: [] } }))}
                    className="text-gray-500 hover:underline"
                  >Clear All</button>
                </span>
              </div>
              {otherUsers.length > 0 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto pr-1">
                  {otherUsers.map(u => {
                    const isChecked = editForm.permissions?.canViewQuotesFrom?.includes(u.id) || false;
                    return (
                      <label key={u.id} className={`flex items-center gap-2 p-2 rounded-lg text-xs border cursor-pointer transition-colors ${isChecked ? 'bg-sky-100 border-sky-400 text-sky-950 font-semibold' : 'bg-white border-gray-200 hover:bg-gray-50 text-gray-700'}`}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={e => {
                            const cur = editForm.permissions?.canViewQuotesFrom || [];
                            const next = e.target.checked ? [...cur, u.id] : cur.filter(id => id !== u.id);
                            setEditForm(prev => ({ ...prev, permissions: { ...(prev.permissions || {}), canViewAllQuotes: false, canViewQuotesFrom: next } }));
                          }}
                          className="accent-sky-600"
                        />
                        <span className="truncate">{u.username}</span>
                        <span className="text-[9px] text-gray-400 uppercase ml-auto">({u.role})</span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-gray-400 italic">No other users exist to select from.</p>
              )}
            </div>
          )}
        </section>
      )}

      {/* 4. Feature access */}
      <section>
        <StepTitle n={step++} title="What can they do?" hint={isAdmin ? undefined : 'tick the features this user may use'} />
        <PermissionToggles perms={(editForm.permissions || {}) as Permissions} role={editForm.role || 'user'} onChange={togglePerm} onSetMany={setManyPerms} hideQuoteVis={true} />
      </section>
    </EditorModal>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── Users Tab ─────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
function UsersTab({ groups }: { groups: PermissionGroup[] }) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<AppUser & { password?: string }>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    const res = await fetch('/api/users');
    if (res.ok) setUsers(await res.json());
  };

  const applyGroup = (groupId: string, currentPerms: Permissions): Permissions => {
    const g = groups.find(g => String(g.id) === groupId);
    if (!g) return currentPerms;
    return { ...currentPerms, ...g.permissions };
  };

  const handleAdd = async () => {
    if (!editForm.username || !editForm.password || !editForm.role) {
      setError('Username, password and role are required.');
      return;
    }
    if (editForm.password.length < 10) {
      setError('Password must be at least 10 characters.');
      return;
    }
    setError('');
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...editForm, permissions: editForm.permissions || {} }),
    });
    if (res.ok) { setIsAdding(false); setEditForm({}); setSelectedGroupId(''); fetchUsers(); }
    else {
      const d = await res.json();
      const msg = d.details && Array.isArray(d.details) && d.details.length > 0
        ? `${d.error}: ${d.details.join(', ')}`
        : d.error || 'Failed to add user';
      setError(msg);
    }
  };

  const handleUpdate = async (id: number) => {
    setError('');
    const payload: any = { ...editForm, permissions: editForm.permissions || {} };
    if (!payload.password || payload.password.trim() === '') {
      delete payload.password;
    }
    const res = await fetch(`/api/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) { setIsEditing(null); setEditForm({}); setSelectedGroupId(''); fetchUsers(); }
    else {
      const d = await res.json();
      const msg = d.details && Array.isArray(d.details) && d.details.length > 0
        ? `${d.error}: ${d.details.join(', ')}`
        : d.error || 'Failed to update user';
      setError(msg);
    }
  };

  const handleDelete = async (id: number) => {
    if (!await confirmAsync('Are you sure you want to delete this user?')) return;
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
    if (res.ok) fetchUsers();
    else { const d = await res.json(); setError(d.error || 'Failed to delete user'); }
  };

  const startEdit = (user: AppUser) => {
    setIsAdding(false);
    setError('');
    setIsEditing(user.id);
    setSelectedGroupId('');
    setEditForm({ username: user.username, role: user.role, permissions: { ...user.permissions } });
  };

  const togglePerm = (key: PermissionKey) => {
    setEditForm(prev => ({ ...prev, permissions: { ...prev.permissions, [key]: !(prev.permissions as Permissions)?.[key] } }));
  };

  const setManyPerms = (keys: PermissionKey[], value: boolean) => {
    setEditForm(prev => {
      const next: Permissions = { ...(prev.permissions || {}) };
      keys.forEach(k => { (next as any)[k] = value; });
      return { ...prev, permissions: next };
    });
  };

  const groupsOf = (id: number) => groups.filter(g => Array.isArray(g.members) && g.members.includes(id));

  const q = search.trim().toLowerCase();
  const filtered = users.filter(u => (!roleFilter || u.role === roleFilter) && (!q || u.username.toLowerCase().includes(q)));
  const counts = useMemo(() => ({
    all: users.length,
    admin: users.filter(u => u.role === 'admin').length,
    editor: users.filter(u => u.role === 'editor').length,
    user: users.filter(u => u.role !== 'admin' && u.role !== 'editor').length,
  }), [users]);

  const modalOpen = isAdding || isEditing !== null;

  return (
    <>
      <div className="p-6 border-b border-gray-200 bg-gray-50 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-100 text-indigo-600"><Shield size={20} /></div>
            <div>
              <h2 className="text-xl font-semibold text-gray-800">User Management</h2>
              <p className="text-xs text-gray-500 mt-0.5">Accounts, roles and what each person is allowed to do.</p>
            </div>
          </div>
          <button onClick={() => { setIsEditing(null); setIsAdding(true); setEditForm({ role: 'user', permissions: {} }); setSelectedGroupId(''); setError(''); }} className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
            <Plus size={18} /> Add User
          </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <div className="relative flex-1 sm:max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users…" aria-label="Search users" className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-indigo-500 outline-none" />
          </div>
          <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Filter by role">
            {([['', 'All', counts.all], ['admin', 'Admins', counts.admin], ['editor', 'Editors', counts.editor], ['user', 'Users', counts.user]] as const).map(([value, label, n]) => (
              <button
                key={value || 'all'}
                type="button"
                role="tab"
                aria-selected={roleFilter === value}
                onClick={() => setRoleFilter(value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap border transition-colors ${roleFilter === value ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}
              >
                {label} <span className={roleFilter === value ? 'text-indigo-100' : 'text-gray-400'}>{n}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && !modalOpen && <div className="p-4 bg-red-50 text-red-600 text-sm font-medium border-b border-red-100" role="alert">{error}</div>}

      {isAdding && (
        <UserFormPanel
          title="New User"
          onSave={handleAdd}
          onCancel={() => { setIsAdding(false); setSelectedGroupId(''); setError(''); }}
          editForm={editForm}
          setEditForm={setEditForm}
          isEditing={isEditing}
          groups={groups}
          selectedGroupId={selectedGroupId}
          setSelectedGroupId={setSelectedGroupId}
          applyGroup={applyGroup}
          togglePerm={togglePerm}
          setManyPerms={setManyPerms}
          allUsers={users}
          error={error}
        />
      )}
      {isEditing !== null && (
        <UserFormPanel
          title={`Editing: ${users.find(u => u.id === isEditing)?.username}`}
          onSave={() => handleUpdate(isEditing)}
          onCancel={() => { setIsEditing(null); setSelectedGroupId(''); setError(''); }}
          editForm={editForm}
          setEditForm={setEditForm}
          isEditing={isEditing}
          groups={groups}
          selectedGroupId={selectedGroupId}
          setSelectedGroupId={setSelectedGroupId}
          applyGroup={applyGroup}
          togglePerm={togglePerm}
          setManyPerms={setManyPerms}
          allUsers={users}
          error={error}
        />
      )}

      <ul className="divide-y divide-gray-200">
        {filtered.map(user => {
          const memberOf = groupsOf(user.id);
          return (
            <li key={user.id} className="p-4 sm:px-6 hover:bg-gray-50 transition-colors">
              <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="flex items-center gap-3 lg:w-64 shrink-0 min-w-0">
                  <div className={`w-10 h-10 rounded-full ${avatarColour(user.role)} text-white flex items-center justify-center font-bold uppercase shrink-0`} aria-hidden="true">{user.username.slice(0, 1)}</div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900 truncate">{user.username}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${roleBadge(user.role)}`}>{user.role}</span>
                    </div>
                    <div className="text-[11px] text-gray-400">ID {user.id}{memberOf.length > 0 && <> · <Layers size={10} className="inline -mt-0.5" /> {memberOf.map(g => g.name).join(', ')}</>}</div>
                  </div>
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    {user.role !== 'admin' && <VisibilityBadge perms={user.permissions} allUsers={users} />}
                    <AccessMeter perms={user.permissions} role={user.role} />
                  </div>
                  <PermissionSummary perms={user.permissions} role={user.role} />
                </div>
                <div className="flex gap-2 shrink-0 lg:justify-end">
                  <button onClick={() => startEdit(user)} className="flex items-center gap-1.5 px-3 py-1.5 text-indigo-700 hover:bg-indigo-50 rounded-lg text-sm border border-indigo-200" aria-label={`Edit ${user.username}`}><Edit2 size={14} /> Edit</button>
                  <button onClick={() => handleDelete(user.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-sm border border-red-200" aria-label={`Delete ${user.username}`}><Trash2 size={14} /> Delete</button>
                </div>
              </div>
            </li>
          );
        })}
        {users.length === 0 && !isAdding && (
          <li className="p-8 text-center text-gray-500">No users found.</li>
        )}
        {users.length > 0 && filtered.length === 0 && (
          <li className="p-8 text-center text-gray-500">No user matches the search or filter.</li>
        )}
      </ul>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── Permission Groups Tab ─────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
function GroupsTab({ groups, onGroupsChange }: { groups: PermissionGroup[]; onGroupsChange: () => void }) {
  const [isAdding, setIsAdding] = useState(false);
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [form, setForm] = useState<{ name: string; description: string; permissions: Permissions; members: number[] }>({ name: '', description: '', permissions: {}, members: [] });
  const [error, setError] = useState('');
  const [allUsers, setAllUsers] = useState<{id: number; username: string; name: string}[]>([]);

  useEffect(() => {
    fetch('/api/users').then(r => r.ok ? r.json() : []).then(d => { if (Array.isArray(d)) setAllUsers(d); }).catch(() => {});
  }, []);

  const resetForm = () => setForm({ name: '', description: '', permissions: {}, members: [] });

  const togglePerm = (key: PermissionKey) =>
    setForm(prev => ({ ...prev, permissions: { ...prev.permissions, [key]: !prev.permissions[key] } }));

  const setManyPerms = (keys: PermissionKey[], value: boolean) =>
    setForm(prev => {
      const next: Permissions = { ...prev.permissions };
      keys.forEach(k => { (next as any)[k] = value; });
      return { ...prev, permissions: next };
    });

  const handleSave = async () => {
    setError('');
    if (!form.name.trim()) { setError('Group name is required.'); return; }
    const url = isEditing !== null ? `/api/permission-groups/${isEditing}` : '/api/permission-groups';
    const method = isEditing !== null ? 'PUT' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    if (res.ok) { resetForm(); setIsAdding(false); setIsEditing(null); onGroupsChange(); }
    else { const d = await res.json(); setError(d.error || 'Failed to save group'); }
  };

  const handleDelete = async (id: number) => {
    if (!await confirmAsync('Delete this permission group?')) return;
    await fetch(`/api/permission-groups/${id}`, { method: 'DELETE' });
    onGroupsChange();
  };

  const startEdit = (g: PermissionGroup) => {
    setError('');
    setIsEditing(g.id);
    setIsAdding(false);
    setForm({ name: g.name, description: g.description || '', permissions: { ...g.permissions }, members: Array.isArray(g.members) ? g.members : [] });
  };

  const close = () => { setIsAdding(false); setIsEditing(null); resetForm(); setError(''); };
  const modalOpen = isAdding || isEditing !== null;
  const userName = (id: number) => { const u = allUsers.find(x => x.id === id); return u ? (u.name || u.username) : `ID:${id}`; };

  return (
    <>
      <div className="p-6 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-100 text-amber-600"><Layers size={20} /></div>
          <div>
            <h2 className="text-xl font-semibold text-gray-800">Permission Groups</h2>
            <p className="text-xs text-gray-500 mt-0.5">Create named presets — apply them to users in one click instead of selecting permissions one by one.</p>
          </div>
        </div>
        <button onClick={() => { setIsAdding(true); setIsEditing(null); resetForm(); setError(''); }} className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
          <Plus size={18} /> New Group
        </button>
      </div>

      {error && !modalOpen && <div className="p-4 bg-red-50 text-red-600 text-sm font-medium border-b border-red-100" role="alert">{error}</div>}

      {modalOpen && (
        <EditorModal
          title={isEditing !== null ? 'Edit Group' : 'New Permission Group'}
          subtitle="A group is a reusable set of permissions. Applying it to a user copies these ticks."
          onClose={close}
          footer={
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              {error ? <p className="text-sm text-red-600 font-medium flex-1" role="alert">{error}</p> : <span className="flex-1" />}
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={close} className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 text-sm"><X size={15} /> Cancel</button>
                <button type="button" onClick={handleSave} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"><Save size={15} /> Save Group</button>
              </div>
            </div>
          }
        >
          <section>
            <StepTitle n={1} title="Name" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="block">
                <span className="text-xs font-medium text-gray-600">Group name</span>
                <input type="text" className={`${inputCls} mt-1`} placeholder="Group name (e.g. Sales Team)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-gray-600">Description</span>
                <input type="text" className={`${inputCls} mt-1`} placeholder="Description (optional)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </label>
            </div>
          </section>

          <section>
            <StepTitle n={2} title="Permissions in this group" />
            <PermissionToggles perms={form.permissions} role="user" onChange={togglePerm} onSetMany={setManyPerms} />
          </section>

          <section>
            <StepTitle n={3} title="Members" hint={`${form.members.length} selected`} />
            {allUsers.length === 0 ? (
              <p className="text-xs text-gray-400 italic">No users yet.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                {allUsers.map(u => (
                  <label key={u.id} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-sm transition-colors ${form.members.includes(u.id) ? 'border-amber-400 bg-amber-100' : 'border-gray-200 bg-white hover:bg-gray-50'}`}>
                    <input
                      type="checkbox"
                      checked={form.members.includes(u.id)}
                      onChange={() => setForm(prev => ({
                        ...prev,
                        members: prev.members.includes(u.id) ? prev.members.filter(id => id !== u.id) : [...prev.members, u.id],
                      }))}
                      className="accent-amber-600"
                    />
                    <span className="font-medium text-gray-800 truncate">{u.name || u.username}</span>
                    <span className="text-gray-400 text-[10px] truncate">@{u.username}</span>
                  </label>
                ))}
              </div>
            )}
          </section>
        </EditorModal>
      )}

      <div className="divide-y divide-gray-200">
        {groups.length === 0 && (
          <div className="p-10 text-center text-gray-400">
            <Layers size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">No permission groups yet.</p>
            <p className="text-xs mt-1">Create a group like "Sales Team" or "Read Only" and apply it to users quickly.</p>
          </div>
        )}
        {groups.map(g => {
          const count = grantedKeys(g.permissions).length;
          const members = Array.isArray(g.members) ? g.members : [];
          return (
            <div key={g.id} className="p-4 sm:px-6 hover:bg-gray-50 transition-colors">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">{g.name}</span>
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-[11px] font-semibold">{count} feature{count !== 1 ? 's' : ''}</span>
                    {members.length > 0 && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-[11px] font-semibold" title={members.map(userName).join(', ')}>{members.length} member{members.length !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                  {g.description && <p className="text-xs text-gray-500">{g.description}</p>}
                  <PermissionSummary perms={g.permissions} role="user" colour="green" />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => startEdit(g)} className="flex items-center gap-1.5 px-3 py-1.5 text-indigo-700 hover:bg-indigo-50 rounded-lg text-sm border border-indigo-200"><Edit2 size={14} /> Edit</button>
                  <button onClick={() => handleDelete(g.id)} aria-label={`Delete group ${g.name}`} className="flex items-center gap-1.5 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-sm border border-red-200"><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ── Root Export ───────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
export default function UsersDB() {
  const [tab, setTab] = useState<'users' | 'groups'>('users');
  const [groups, setGroups] = useState<PermissionGroup[]>([]);

  const fetchGroups = async () => {
    const res = await fetch('/api/permission-groups');
    if (res.ok) setGroups(await res.json());
  };

  useEffect(() => { fetchGroups(); }, []);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Tab Bar */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        <button
          onClick={() => setTab('users')}
          className={`flex items-center gap-2 px-6 py-3.5 text-sm font-medium transition-colors border-b-2 ${tab === 'users' ? 'border-indigo-600 text-indigo-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <Shield size={16} /> Users
        </button>
        <button
          onClick={() => setTab('groups')}
          className={`flex items-center gap-2 px-6 py-3.5 text-sm font-medium transition-colors border-b-2 ${tab === 'groups' ? 'border-indigo-600 text-indigo-700 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          <Layers size={16} /> Permission Groups
          {groups.length > 0 && <span className="ml-1 px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-[10px] font-bold">{groups.length}</span>}
        </button>
      </div>

      {tab === 'users' && <UsersTab groups={groups} />}
      {tab === 'groups' && <GroupsTab groups={groups} onGroupsChange={fetchGroups} />}
    </div>
  );
}
