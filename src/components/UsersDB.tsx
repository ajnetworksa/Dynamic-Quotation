import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Save, X, Shield, User } from 'lucide-react';

interface AppUser {
  id: number;
  username: string;
  role: string;
}

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
      body: JSON.stringify(editForm),
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
      body: JSON.stringify(editForm),
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
    setEditForm({ username: user.username, role: user.role });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
        <div className="flex items-center gap-3">
          <Shield className="text-indigo-600" />
          <h2 className="text-xl font-semibold text-gray-800">User Management</h2>
        </div>
        <button
          onClick={() => { setIsAdding(true); setEditForm({ role: 'user' }); setError(''); }}
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

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 text-gray-600 text-sm uppercase tracking-wider">
              <th className="p-4 border-b">ID</th>
              <th className="p-4 border-b">Username</th>
              <th className="p-4 border-b">Role</th>
              <th className="p-4 border-b">Password</th>
              <th className="p-4 border-b text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {isAdding && (
              <tr className="bg-indigo-50">
                <td className="p-4 text-gray-500">New</td>
                <td className="p-4">
                  <input
                    type="text"
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="Username"
                    value={editForm.username || ''}
                    onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                  />
                </td>
                <td className="p-4">
                  <select
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={editForm.role || 'user'}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
                <td className="p-4">
                  <input
                    type="password"
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="Password"
                    value={editForm.password || ''}
                    onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                  />
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={handleAdd} className="p-2 text-green-600 hover:bg-green-50 rounded">
                      <Save size={18} />
                    </button>
                    <button onClick={() => setIsAdding(false)} className="p-2 text-red-600 hover:bg-red-50 rounded">
                      <X size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            )}
            
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                <td className="p-4 text-gray-500">{user.id}</td>
                <td className="p-4">
                  {isEditing === user.id ? (
                    <input
                      type="text"
                      className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={editForm.username || ''}
                      onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                    />
                  ) : (
                    <div className="flex items-center gap-2 font-medium text-gray-900">
                      <User size={16} className="text-gray-400" />
                      {user.username}
                    </div>
                  )}
                </td>
                <td className="p-4">
                  {isEditing === user.id ? (
                    <select
                      className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={editForm.role || 'user'}
                      onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  ) : (
                    <span className={`px-2 py-1 rounded text-xs font-medium ${user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}`}>
                      {user.role}
                    </span>
                  )}
                </td>
                <td className="p-4">
                  {isEditing === user.id ? (
                    <input
                      type="password"
                      className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="New password (optional)"
                      value={editForm.password || ''}
                      onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                    />
                  ) : (
                    <span className="text-gray-400 italic">••••••••</span>
                  )}
                </td>
                <td className="p-4 text-right">
                  {isEditing === user.id ? (
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleUpdate(user.id)} className="p-2 text-green-600 hover:bg-green-50 rounded">
                        <Save size={18} />
                      </button>
                      <button onClick={() => setIsEditing(null)} className="p-2 text-gray-600 hover:bg-gray-100 rounded">
                        <X size={18} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-2">
                      <button onClick={() => startEdit(user)} className="p-2 text-blue-600 hover:bg-blue-50 rounded">
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => handleDelete(user.id)} className="p-2 text-red-600 hover:bg-red-50 rounded">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  )}
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
