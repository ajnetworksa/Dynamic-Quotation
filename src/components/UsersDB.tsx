import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Save, X, Shield, User, Bot, FileSearch, Settings as SettingsIcon, Database, Users } from 'lucide-react';

interface Permissions {
  canUseRFQ?: boolean;
  canUseAI?: boolean;
  canManageUsers?: boolean;
  canManageSettings?: boolean;
  canDeleteData?: boolean;
  canDatabaseMaintenance?: boolean;
  canOverridePrice?: boolean;
  canViewRevenue?: boolean;
}

interface AppUser {
  id: number;
  username: string;
  role: string;
  permissions: Permissions;
}

const ALL_PERMISSIONS: { key: keyof Permissions; label: string; icon: React.ReactNode; description: string }[] = [
  {
    key: 'canManageUsers',
    label: 'Manage Users',
    icon: <Shield size={14} />,
    description: 'Can create, edit, and delete other user accounts',
  },
  {
    key: 'canManageSettings',
    label: 'Manage Settings',
    icon: <SettingsIcon size={14} />, // Need to import Settings as SettingsIcon from lucide-react
    description: 'Can change company info, SMTP, and view system logs',
  },
  {
    key: 'canDeleteData',
    label: 'Delete Records',
    icon: <Trash2 size={14} />,
    description: 'Can delete quotes, products, and customers',
  },
  {
    key: 'canDatabaseMaintenance',
    label: 'DB Maintenance',
    icon: <Database size={14} />,
    description: 'Can export/import database and create backups',
  },
  {
    key: 'canOverridePrice',
    label: 'Price Analysis',
    icon: <Bot size={14} />,
    description: 'Can use the analysis sidebar to override costs and markups',
  },
  {
    key: 'canViewRevenue',
    label: 'View Revenue',
    icon: <Users size={14} />,
    description: 'Can see total revenue and financial charts on Dashboard',
  },
  {
    key: 'canUseRFQ',
    label: 'Import from RFQ',
    icon: <FileSearch size={14} />,
    description: 'Can upload and auto-parse RFQ documents into the quote form',
  },
  {
    key: 'canUseAI',
    label: 'AI Data Assistant',
    icon: <Bot size={14} />,
    description: 'Can access the AI chatbot to query the database',
  },
];

export default function UsersDB() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<AppUser & { password?: string }>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const res = await fetch('/api/users');
    if (res.ok) {
      const data = await res.json();
      setUsers(data);
    }
  };

  const handleAdd = async () => {
    if (!editForm.username || !editForm.password || !editForm.role) return;
    setError('');
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...editForm, permissions: editForm.permissions || {} }),
    });
    if (res.ok) {
      setIsAdding(false);
      setEditForm({});
      fetchUsers();
    } else {
      const data = await res.json();
      setError(data.error || 'Failed to add user');
    }
  };

  const handleUpdate = async (id: number) => {
    setError('');
    const res = await fetch(`/api/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...editForm, permissions: editForm.permissions || {} }),
    });
    if (res.ok) {
      setIsEditing(null);
      setEditForm({});
      fetchUsers();
    } else {
      const data = await res.json();
      setError(data.error || 'Failed to update user');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    setError('');
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
    if (res.ok) {
      fetchUsers();
    } else {
      const data = await res.json();
      setError(data.error || 'Failed to delete user');
    }
  };

  const startEdit = (user: AppUser) => {
    setIsEditing(user.id);
    setEditForm({ username: user.username, role: user.role, permissions: { ...user.permissions } });
  };

  const togglePermission = (key: keyof Permissions) => {
    setEditForm(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [key]: !(prev.permissions as Permissions)?.[key],
      },
    }));
  };

  const PermissionBadges = ({ perms, role }: { perms: Permissions; role: string }) => {
    if (role === 'admin') {
      return (
        <span className="px-2 py-1 rounded text-[10px] font-bold bg-purple-100 text-purple-700 uppercase">
          All Access
        </span>
      );
    }
    const granted = ALL_PERMISSIONS.filter(p => perms?.[p.key]);
    if (granted.length === 0) {
      return <span className="text-xs text-gray-400 italic">No extras granted</span>;
    }
    return (
      <div className="flex flex-wrap gap-1">
        {granted.map(p => (
          <span key={p.key} className="flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full">
            {p.icon} {p.label}
          </span>
        ))}
      </div>
    );
  };

  const PermissionToggles = () => {
    const isAdmin = editForm.role === 'admin';
    return (
      <div className="flex flex-col gap-2 mt-1">
        {isAdmin ? (
          <span className="text-xs text-purple-600 font-semibold italic flex items-center gap-1">
            <Shield size={12} /> Admins have full access — no extra permissions needed
          </span>
        ) : (
          <>
            <p className="text-xs text-gray-500 font-medium mb-1">Feature Access:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {ALL_PERMISSIONS.map(p => {
                const checked = !!(editForm.permissions as Permissions)?.[p.key];
                return (
                  <label
                    key={p.key}
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${checked ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePermission(p.key)}
                      className="mt-0.5 accent-indigo-600"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-800">
                        {p.icon} {p.label}
                      </div>
                      <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{p.description}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
        <div className="flex items-center gap-3">
          <Shield className="text-indigo-600" />
          <h2 className="text-xl font-semibold text-gray-800">User Management</h2>
        </div>
        <button
          onClick={() => { setIsAdding(true); setEditForm({ role: 'user', permissions: {} }); setError(''); }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus size={18} />
          Add User
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 text-sm font-medium border-b border-red-100">
          {error}
        </div>
      )}

      {/* Add User Panel */}
      {isAdding && (
        <div className="p-5 border-b border-indigo-100 bg-indigo-50">
          <h3 className="text-sm font-bold text-indigo-800 mb-3">New User</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <input
              type="text"
              className="p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="Username"
              value={editForm.username || ''}
              onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
            />
            <input
              type="password"
              className="p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="Password"
              value={editForm.password || ''}
              onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
            />
            <select
              className="p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
              value={editForm.role || 'user'}
              onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
            >
              <option value="user">User</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <PermissionToggles />
          <div className="flex gap-2 mt-3">
            <button onClick={handleAdd} className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">
              <Save size={15} /> Save User
            </button>
            <button onClick={() => setIsAdding(false)} className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-100 text-sm">
              <X size={15} /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Edit User Panel */}
      {isEditing !== null && (
        <div className="p-5 border-b border-blue-100 bg-blue-50">
          <h3 className="text-sm font-bold text-blue-800 mb-3">Editing: {users.find(u => u.id === isEditing)?.username}</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
            <input
              type="text"
              className="p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
              value={editForm.username || ''}
              onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
            />
            <input
              type="password"
              className="p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
              placeholder="New password (leave blank to keep)"
              value={editForm.password || ''}
              onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
            />
            <select
              className="p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
              value={editForm.role || 'user'}
              onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
            >
              <option value="user">User</option>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <PermissionToggles />
          <div className="flex gap-2 mt-3">
            <button onClick={() => handleUpdate(isEditing)} className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium">
              <Save size={15} /> Save Changes
            </button>
            <button onClick={() => setIsEditing(null)} className="flex items-center gap-1.5 px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-100 text-sm">
              <X size={15} /> Cancel
            </button>
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 text-gray-600 text-sm uppercase tracking-wider">
              <th className="p-4 border-b">ID</th>
              <th className="p-4 border-b">Username</th>
              <th className="p-4 border-b">Role</th>
              <th className="p-4 border-b">Permissions</th>
              <th className="p-4 border-b text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                <td className="p-4 text-gray-500">{user.id}</td>
                <td className="p-4">
                  <div className="flex items-center gap-2 font-medium text-gray-900">
                    <User size={16} className="text-gray-400" />
                    {user.username}
                  </div>
                </td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 
                    user.role === 'editor' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td className="p-4">
                  <PermissionBadges perms={user.permissions} role={user.role} />
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => startEdit(user)} className="flex items-center gap-1.5 px-3 py-1.5 text-blue-600 hover:bg-blue-50 rounded-lg text-sm border border-blue-200">
                      <Edit2 size={14} /> Edit
                    </button>
                    <button onClick={() => handleDelete(user.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-sm border border-red-200">
                      <Trash2 size={14} /> Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && !isAdding && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
