import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Save, X, Shield, User, Bot, FileSearch, Settings as SettingsIcon, Database, Users, Eye, UserCheck, Layers, ChevronDown, FileText, Bookmark, Send, Printer, History, KeyRound } from 'lucide-react';

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
}

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

const ALL_PERMISSIONS: { key: keyof Permissions; label: string; icon: React.ReactNode; description: string }[] = [
  { key: 'canManageUsers', label: 'Manage Users', icon: <Shield size={14} />, description: 'Create, edit, and delete system users and their permissions.' },
  { key: 'canManageSettings', label: 'Manage Settings', icon: <SettingsIcon size={14} />, description: 'Access global system settings, backup, and branding.' },
  { key: 'canDeleteData', label: 'Delete Records', icon: <Trash2 size={14} />, description: 'Permanently remove quotation and customer records.' },
  { key: 'canDatabaseMaintenance', label: 'DB Maintenance', icon: <Database size={14} />, description: 'Perform database cleanup and administrative tasks.' },
  { key: 'canOverridePrice', label: 'Price Analysis', icon: <Bot size={14} />, description: 'View cost base and apply manual price overrides in the analysis sidebar.' },
  { key: 'canViewRevenue', label: 'View Revenue', icon: <Users size={14} />, description: 'View total revenue and profit summaries on the dashboard.' },
  { key: 'canUseKanban', label: 'Use Kanban Board', icon: <Layers size={14} />, description: 'Access the interactive Kanban board for quotation stages.' },
  { key: 'canUseRFQ', label: 'Import from RFQ', icon: <FileSearch size={14} />, description: 'Upload PDF/Images to automatically parse items using AI.' },
  { key: 'canUseAI', label: 'AI Data Assistant', icon: <Bot size={14} />, description: 'Access the AI Data Assistant for natural language querying.' },
  { key: 'canViewAllQuotes', label: 'View All Quotes', icon: <Eye size={14} />, description: 'View and edit quotations created by other team members.' },
  { key: 'canViewCreatedBy', label: 'View Creator Info', icon: <UserCheck size={14} />, description: 'See who created a specific quote in the tracking table.' },
  { key: 'canViewHistory', label: 'View Quote History', icon: <History size={14} />, description: 'Access the revision history and audit logs for quotations.' },
  { key: 'canChangePassword', label: 'Change Password', icon: <KeyRound size={14} />, description: 'Change own login password from the profile menu.' },
  { key: 'canConvertInvoice', label: 'Convert to Invoice', icon: <FileText size={14} />, description: 'Convert an existing Quotation into a Tax Invoice.' },
  { key: 'canSaveTemplate', label: 'Save Template', icon: <Bookmark size={14} />, description: 'Save document terms and conditions as reusable templates.' },
  { key: 'canEmailQuote', label: 'Email Quote', icon: <Send size={14} />, description: 'Send documents directly to customers via email.' },
  { key: 'canPrintQuote', label: 'Print Quote', icon: <Printer size={14} />, description: 'Generate and print PDF versions of documents.' },
  { key: 'canViewFeatureAccess', label: 'Show Feature Access', icon: <Eye size={14} />, description: 'Allow the user to see their own granted feature access list in the profile menu.' },
  { key: 'canUsePriceSync', label: 'AI Price Sync', icon: <Bot size={14} />, description: 'Bulk update product prices using AI to extract data from supplier lists (PDF/Excel).' },
  { key: 'canUndoQuote', label: 'Undo Timeline Actions', icon: <History size={14} />, description: 'Allow restoring quotes to previous states via the timeline.' },
  { key: 'canChangeAuthor', label: 'Change Prepared By', icon: <UserCheck size={14} />, description: 'Allow modifying the "Prepared By" name on quotes.' },
  { key: 'canShareQuote', label: 'Share Quotes', icon: <Users size={14} />, description: 'Allow sharing specific quotes with selected users or groups.' },
  { key: 'canEditSharedQuote', label: 'Edit Shared Quotes', icon: <Eye size={14} />, description: 'Allow editing and saving quotes that were shared with this user (not just viewing).' },
];

// ── Permission Toggles ────────────────────────────────────────────────────────
function PermissionToggles({
  perms,
  role,
  onChange,
}: {
  perms: Permissions;
  role: string;
  onChange: (key: keyof Permissions) => void;
}) {
  if (role === 'admin') {
    return (
      <span className="text-xs text-purple-600 font-semibold italic flex items-center gap-1">
        <Shield size={12} /> Admins have full access — no extra permissions needed
      </span>
    );
  }
  return (
    <div className="flex flex-col gap-2 mt-1">
      <p className="text-xs text-gray-500 font-medium mb-1">Feature Access:</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {ALL_PERMISSIONS.map(p => {
          const checked = !!perms?.[p.key];
          return (
            <label
              key={p.key}
              className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${checked ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
            >
              <input type="checkbox" checked={checked} onChange={() => onChange(p.key)} className="mt-0.5 accent-indigo-600" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">{p.icon} {p.label}</div>
                <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{p.description}</p>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}

// ── Permission Badges (display only) ─────────────────────────────────────────
function PermissionBadges({ perms, role }: { perms: Permissions; role: string }) {
  if (role === 'admin') return <span className="px-2 py-1 rounded text-[10px] font-bold bg-purple-100 text-purple-700 uppercase">All Access</span>;
  const granted = ALL_PERMISSIONS.filter(p => perms?.[p.key]);
  if (granted.length === 0) return <span className="text-xs text-gray-400 italic">No extras granted</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {granted.map(p => (
        <span
          key={p.key}
          title={p.description}
          className="flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full cursor-help"
        >
          {p.icon} {p.label}
        </span>
      ))}
    </div>
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
    if (!editForm.username || !editForm.password || !editForm.role) return;
    setError('');
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...editForm, permissions: editForm.permissions || {} }),
    });
    if (res.ok) { setIsAdding(false); setEditForm({}); setSelectedGroupId(''); fetchUsers(); }
    else { const d = await res.json(); setError(d.error || 'Failed to add user'); }
  };

  const handleUpdate = async (id: number) => {
    setError('');
    const res = await fetch(`/api/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...editForm, permissions: editForm.permissions || {} }),
    });
    if (res.ok) { setIsEditing(null); setEditForm({}); setSelectedGroupId(''); fetchUsers(); }
    else { const d = await res.json(); setError(d.error || 'Failed to update user'); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
    if (res.ok) fetchUsers();
    else { const d = await res.json(); setError(d.error || 'Failed to delete user'); }
  };

  const startEdit = (user: AppUser) => {
    setIsEditing(user.id);
    setSelectedGroupId('');
    setEditForm({ username: user.username, role: user.role, permissions: { ...user.permissions } });
  };

  const togglePerm = (key: keyof Permissions) => {
    setEditForm(prev => ({ ...prev, permissions: { ...prev.permissions, [key]: !(prev.permissions as Permissions)?.[key] } }));
  };

  const FormPanel = ({ title, onSave, onCancel, bg }: { title: string; onSave: () => void; onCancel: () => void; bg: string }) => (
    <div className={`p-5 border-b ${bg}`}>
      <h3 className="text-sm font-bold mb-3">{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        <input type="text" className="p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Username" value={editForm.username || ''} onChange={e => setEditForm({ ...editForm, username: e.target.value })} />
        <input type="password" className="p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none" placeholder={isEditing ? 'New password (leave blank to keep)' : 'Password'} value={editForm.password || ''} onChange={e => setEditForm({ ...editForm, password: e.target.value })} />
        <select className="p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none" value={editForm.role || 'user'} onChange={e => setEditForm({ ...editForm, role: e.target.value })}>
          <option value="user">User</option>
          <option value="editor">Editor</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      {/* Apply Permission Group */}
      {editForm.role !== 'admin' && groups.length > 0 && (
        <div className="flex items-center gap-2 mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
          <Layers size={14} className="text-amber-600 shrink-0" />
          <span className="text-xs font-semibold text-amber-700">Apply Group Preset:</span>
          <select
            className="flex-1 text-sm border border-amber-300 rounded p-1.5 bg-white focus:ring-2 focus:ring-amber-400 outline-none"
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
            <button className="text-xs text-amber-700 underline" onClick={() => { setSelectedGroupId(''); setEditForm(prev => ({ ...prev, permissions: {} })); }}>Clear</button>
          )}
        </div>
      )}

      <PermissionToggles perms={(editForm.permissions || {}) as Permissions} role={editForm.role || 'user'} onChange={togglePerm} />
      <div className="flex gap-2 mt-3">
        <button onClick={onSave} className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"><Save size={15} /> Save</button>
        <button onClick={onCancel} className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-100 text-sm"><X size={15} /> Cancel</button>
      </div>
    </div>
  );

  return (
    <>
      <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
        <div className="flex items-center gap-3">
          <Shield className="text-indigo-600" />
          <h2 className="text-xl font-semibold text-gray-800">User Management</h2>
        </div>
        <button onClick={() => { setIsAdding(true); setEditForm({ role: 'user', permissions: {} }); setError(''); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
          <Plus size={18} /> Add User
        </button>
      </div>

      {error && <div className="p-4 bg-red-50 text-red-600 text-sm font-medium border-b border-red-100">{error}</div>}

      {isAdding && <FormPanel title="New User" onSave={handleAdd} onCancel={() => { setIsAdding(false); setSelectedGroupId(''); }} bg="border-indigo-100 bg-indigo-50 text-indigo-800" />}
      {isEditing !== null && <FormPanel title={`Editing: ${users.find(u => u.id === isEditing)?.username}`} onSave={() => handleUpdate(isEditing)} onCancel={() => { setIsEditing(null); setSelectedGroupId(''); }} bg="border-blue-100 bg-blue-50 text-blue-800" />}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 text-gray-600 text-sm uppercase tracking-wider">
              <th className="p-4 border-b">ID</th>
              <th className="p-4 border-b">Username</th>
              <th className="p-4 border-b">Role</th>
              <th className="p-4 border-b">Feature Access</th>
              <th className="p-4 border-b text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.map(user => (
              <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                <td className="p-4 text-gray-500">{user.id}</td>
                <td className="p-4">
                  <div className="flex items-center gap-2 font-medium text-gray-900"><User size={16} className="text-gray-400" />{user.username}</div>
                </td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${user.role === 'admin' ? 'bg-purple-100 text-purple-700' : user.role === 'editor' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'}`}>{user.role}</span>
                </td>
                <td className="p-4"><PermissionBadges perms={user.permissions} role={user.role} /></td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => startEdit(user)} className="flex items-center gap-1.5 px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg text-sm border border-blue-200"><Edit2 size={14} /> Edit</button>
                    <button onClick={() => handleDelete(user.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-sm border border-red-200"><Trash2 size={14} /> Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && !isAdding && (
              <tr><td colSpan={5} className="p-8 text-center text-gray-500">No users found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
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
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [allUsers, setAllUsers] = useState<{id: number; username: string; name: string}[]>([]);

  useEffect(() => {
    fetch('/api/users').then(r => r.ok ? r.json() : []).then(d => { if (Array.isArray(d)) setAllUsers(d); }).catch(() => {});
  }, []);

  const resetForm = () => setForm({ name: '', description: '', permissions: {}, members: [] });

  const togglePerm = (key: keyof Permissions) =>
    setForm(prev => ({ ...prev, permissions: { ...prev.permissions, [key]: !prev.permissions[key] } }));

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
    if (!confirm('Delete this permission group?')) return;
    await fetch(`/api/permission-groups/${id}`, { method: 'DELETE' });
    onGroupsChange();
  };

  const startEdit = (g: PermissionGroup) => {
    setIsEditing(g.id);
    setIsAdding(false);
    setForm({ name: g.name, description: g.description || '', permissions: { ...g.permissions }, members: Array.isArray(g.members) ? g.members : [] });
  };

  const grantedCount = (perms: Permissions) => ALL_PERMISSIONS.filter(p => perms?.[p.key]).length;

  return (
    <>
      <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
        <div className="flex items-center gap-3">
          <Layers className="text-indigo-600" />
          <div>
            <h2 className="text-xl font-semibold text-gray-800">Permission Groups</h2>
            <p className="text-xs text-gray-500 mt-0.5">Create named presets — apply them to users in one click instead of selecting permissions one by one.</p>
          </div>
        </div>
        <button onClick={() => { setIsAdding(true); setIsEditing(null); resetForm(); setError(''); }} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
          <Plus size={18} /> New Group
        </button>
      </div>

      {error && <div className="p-4 bg-red-50 text-red-600 text-sm font-medium border-b border-red-100">{error}</div>}

      {(isAdding || isEditing !== null) && (
        <div className="p-5 border-b bg-amber-50 border-amber-100">
          <h3 className="text-sm font-bold text-amber-800 mb-3">{isEditing !== null ? 'Edit Group' : 'New Permission Group'}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <input type="text" className="p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Group name (e.g. Sales Team)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            <input type="text" className="p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Description (optional)" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          </div>
          <PermissionToggles perms={form.permissions} role="user" onChange={togglePerm} />

          {/* Members Section */}
          <div className="mt-4">
            <p className="text-xs font-semibold text-amber-800 mb-2">Group Members (users who belong to this group):</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-40 overflow-y-auto">
              {allUsers.map(u => (
                <label key={u.id} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer text-sm transition-colors ${
                  form.members.includes(u.id) ? 'border-amber-400 bg-amber-100' : 'border-gray-200 bg-white hover:bg-gray-50'
                }`}>
                  <input
                    type="checkbox"
                    checked={form.members.includes(u.id)}
                    onChange={() => setForm(prev => ({
                      ...prev,
                      members: prev.members.includes(u.id)
                        ? prev.members.filter(id => id !== u.id)
                        : [...prev.members, u.id]
                    }))}
                    className="accent-amber-600"
                  />
                  <span className="font-medium text-gray-800">{u.name || u.username}</span>
                  <span className="text-gray-400 text-[10px]">@{u.username}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex gap-2 mt-3">
            <button onClick={handleSave} className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"><Save size={15} /> Save Group</button>
            <button onClick={() => { setIsAdding(false); setIsEditing(null); resetForm(); }} className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-100 text-sm"><X size={15} /> Cancel</button>
          </div>
        </div>
      )}

      <div className="divide-y divide-gray-100">
        {groups.length === 0 && !isAdding && (
          <div className="p-10 text-center text-gray-400">
            <Layers size={32} className="mx-auto mb-2 opacity-40" />
            <p className="text-sm">No permission groups yet.</p>
            <p className="text-xs mt-1">Create a group like "Sales Team" or "Read Only" and apply it to users quickly.</p>
          </div>
        )}
        {groups.map(g => {
          const count = grantedCount(g.permissions);
          const isExpanded = expandedId === g.id;
          return (
            <div key={g.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">{g.name}</span>
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold">{count} Feature Access{count !== 1 ? 'es' : ''}</span>
                    {Array.isArray(g.members) && g.members.length > 0 && (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-bold">{g.members.length} Member{g.members.length !== 1 ? 's' : ''}</span>
                    )}
                    {g.description && <span className="text-xs text-gray-500">— {g.description}</span>}
                  </div>
                  {/* Badges */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {ALL_PERMISSIONS.filter(p => g.permissions?.[p.key]).map(p => (
                      <span
                        key={p.key}
                        title={p.description}
                        className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded-full cursor-help"
                      >
                        {p.icon} {p.label}
                      </span>
                    ))}
                    {count === 0 && <span className="text-xs text-gray-400 italic">No access selected</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => startEdit(g)} className="flex items-center gap-1.5 px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg text-sm border border-blue-200"><Edit2 size={14} /> Edit</button>
                  <button onClick={() => handleDelete(g.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-sm border border-red-200"><Trash2 size={14} /></button>
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
