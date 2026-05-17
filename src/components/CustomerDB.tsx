import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, X, Search, UserPlus, CheckSquare, Square } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Customer {
  id: number;
  name: string;
  address: string;
  contact: string;
  mobile: string;
  email: string;
}

export default function CustomerDB() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<Customer>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [stats, setStats] = useState<Record<number, { total_won: number, quote_count: number }>>({});
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const navigate = useNavigate();

  useEffect(() => {
    fetchCustomers();
    fetchStats();
  }, []);

  const fetchCustomers = async () => {
    try {
      const res = await fetch('/api/customers');
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setCustomers(data);
    } catch (e) {
      console.error('Failed to fetch customers', e);
    }
  };

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/customers/stats');
      const data = await res.json();
      const statsMap: Record<number, { total_won: number, quote_count: number }> = {};
      data.forEach((s: any) => { statsMap[s.customer_id] = s; });
      setStats(statsMap);
    } catch (e) { }
  };

  const handleAdd = async () => {
    if (!editForm.name) return;
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        const data = await res.json();
        alert('Failed to add customer: ' + (data.details ? data.details.join(', ') : data.error || 'Unknown error'));
        return;
      }
      setIsAdding(false);
      setEditForm({});
      fetchCustomers();
    } catch (e) {
      alert('Network error occurred while adding.');
    }
  };

  const handleUpdate = async (id: number) => {
    try {
      const res = await fetch(`/api/customers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        const data = await res.json();
        alert('Failed to update customer: ' + (data.details ? data.details.join(', ') : data.error || 'Unknown error'));
        return;
      }
      setIsEditing(null);
      setEditForm({});
      fetchCustomers();
    } catch (e) {
      alert('Network error occurred while updating.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this customer?')) return;
    await fetch(`/api/customers/${id}`, { method: 'DELETE' });
    fetchCustomers();
  };

  const startEdit = (customer: Customer) => {
    setIsEditing(customer.id);
    setEditForm(customer);
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === currentItems.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(currentItems.map(c => c.id)));
  };
  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} selected customer(s)? This cannot be undone.`)) return;
    for (const id of selectedIds) {
      await fetch(`/api/customers/${id}`, { method: 'DELETE' });
    }
    setSelectedIds(new Set());
    fetchCustomers();
  };

  const tokens = search.toLowerCase().split(/\s+/).filter(t => t.length > 0);
  const normalize = (s: string) => s ? s.toLowerCase().replace(/[^a-z0-9]/g, '') : '';

  const filtered = customers.filter(c => {
    if (tokens.length === 0) return true;
    
    const normName = normalize(c.name);
    const normAddress = normalize(c.address);
    const normMobile = normalize(c.mobile);

    return tokens.every(token => {
      const nToken = normalize(token);
      return (
        c.name?.toLowerCase().includes(token) ||
        c.address?.toLowerCase().includes(token) ||
        c.contact?.toLowerCase().includes(token) ||
        c.mobile?.toLowerCase().includes(token) ||
        c.email?.toLowerCase().includes(token) ||
        (nToken && (normName.includes(nToken) || normAddress.includes(nToken) || normMobile.includes(nToken)))
      );
    });
  });

  const totalPages = Math.ceil(filtered.length / rowsPerPage) || 1;
  const safePage = Math.min(currentPage, totalPages);
  const currentItems = filtered.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage);

  return (
    <>
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between px-6 py-3 bg-red-50 border-b border-red-200">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-red-700">{selectedIds.size} customer{selectedIds.size !== 1 && 's'} selected</span>
            <button onClick={() => setSelectedIds(new Set())} className="text-xs text-red-400 hover:text-red-600 underline">Clear</button>
          </div>
          {(user.role === 'admin' || user.permissions?.canDeleteData) && (
            <button onClick={handleBulkDelete}
              className="flex items-center gap-2 px-4 py-1.5 bg-red-600 text-white text-sm font-semibold rounded-lg hover:bg-red-700 transition-colors">
              <Trash2 size={15} /> Delete {selectedIds.size} Selected
            </button>
          )}
        </div>
      )}
      <div className="p-6 border-b border-gray-200 bg-gray-50">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-800">Customer Database</h2>
            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full">
              {filtered.length} / {customers.length}
            </span>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:flex-none">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search customers…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-full sm:w-56"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              )}
            </div>
            <button
              onClick={() => { setIsAdding(true); setEditForm({}); }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap"
            >
              <Plus size={18} /> Add Customer
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 text-gray-600 text-sm uppercase tracking-wider">
              <th className="p-4 border-b w-10">
                <button onClick={toggleSelectAll} className={selectedIds.size === currentItems.length && currentItems.length > 0 ? 'text-indigo-600' : 'text-gray-300 hover:text-indigo-400'}>
                  {selectedIds.size === currentItems.length && currentItems.length > 0 ? <CheckSquare size={16} /> : <Square size={16} />}
                </button>
              </th>
              <th className="p-4 border-b">ID</th>
              <th className="p-4 border-b">Name</th>
              <th className="p-4 border-b">Address</th>
              <th className="p-4 border-b">Contact</th>
              <th className="p-4 border-b">Mobile</th>
              <th className="p-4 border-b">Email</th>
              <th className="p-4 border-b">Total (Won)</th>
              <th className="p-4 border-b text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {currentItems.map((customer) => (
              <tr 
                key={customer.id} 
                className={`hover:bg-gray-50 even:bg-gray-50/50 transition-colors cursor-pointer ${selectedIds.has(customer.id) ? 'bg-indigo-50 even:bg-indigo-50' : ''}`}
                onDoubleClick={() => startEdit(customer)}
              >
                <td className="p-4">
                  <button onClick={e => { e.stopPropagation(); toggleSelect(customer.id); }}
                    className={selectedIds.has(customer.id) ? 'text-indigo-600' : 'text-gray-300 hover:text-indigo-400'}>
                    {selectedIds.has(customer.id) ? <CheckSquare size={16} /> : <Square size={16} />}
                  </button>
                </td>
                <td className="p-4 text-gray-500">{customer.id}</td>
                {(['name', 'address', 'contact', 'mobile', 'email'] as const).map(field => (
                  <td key={field} className="p-4">
                    <span className={field === 'name' ? 'font-medium text-gray-900' : 'text-gray-600'}>
                      {(customer as any)[field]}
                    </span>
                  </td>
                ))}
                <td className="p-4">
                  <div className="font-mono font-medium text-green-700">SAR {stats[customer.id]?.total_won?.toFixed(2) || '0.00'}</div>
                  <div
                    className="text-xs text-indigo-500 hover:text-indigo-700 cursor-pointer underline decoration-indigo-300 underline-offset-2"
                    onClick={() => navigate(`/tracking?customer=${encodeURIComponent(customer.name)}`)}
                  >
                    {stats[customer.id]?.quote_count || 0} Quotes
                  </div>
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => startEdit(customer)} className="p-2 text-blue-600 hover:bg-blue-50 rounded"><Edit2 size={18} /></button>
                    {(user.role === 'admin' || user.permissions?.canDeleteData) && (
                      <button onClick={() => handleDelete(customer.id)} className="p-2 text-red-600 hover:bg-red-50 rounded"><Trash2 size={18} /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}

            {filtered.length === 0 && !isAdding && (
              <tr>
                <td colSpan={8} className="p-8 text-center text-gray-400">
                  {search ? `No customers match "${search}"` : 'No customers found. Add one to get started.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="p-4 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4 bg-white rounded-b-xl">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Rows per page:</span>
          <input
            type="number"
            min="1"
            className="w-16 p-1 border border-gray-300 rounded text-sm text-center focus:ring-2 focus:ring-indigo-500 outline-none"
            value={rowsPerPage || ''}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              setRowsPerPage(isNaN(val) ? '' as any : val);
              setCurrentPage(1);
            }}
            onBlur={() => {
              if (!rowsPerPage || rowsPerPage < 1) setRowsPerPage(20);
            }}
          />
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            Page {safePage} of {totalPages}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              Previous
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>

      {/* Modal for Add / Edit Customer */}
      {(isAdding || isEditing !== null) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="bg-emerald-600 px-4 py-3 flex items-center justify-between text-white">
              <div className="flex items-center gap-2 font-medium">
                <UserPlus size={18} />
                {isEditing !== null ? 'Edit Customer DB' : 'Add to Customer DB'}
              </div>
              <button 
                onClick={() => { setIsAdding(false); setIsEditing(null); setEditForm({}); }}
                className="hover:bg-white/20 p-1 rounded transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 200px)' }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Customer Name</label>
                  <input
                    type="text"
                    className="w-full p-2 border border-emerald-500 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-shadow"
                    value={editForm.name || ''}
                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Mobile</label>
                    <input
                      type="text"
                      className="w-full p-2 border border-gray-300 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                      value={editForm.mobile || ''}
                      onChange={e => setEditForm({ ...editForm, mobile: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Contact Person</label>
                    <input
                      type="text"
                      className="w-full p-2 border border-gray-300 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                      value={editForm.contact || ''}
                      onChange={e => setEditForm({ ...editForm, contact: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                  <input
                    type="email"
                    className="w-full p-2 border border-gray-300 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none"
                    value={editForm.email || ''}
                    onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Address</label>
                  <textarea
                    rows={3}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none resize-y"
                    value={editForm.address || ''}
                    onChange={e => setEditForm({ ...editForm, address: e.target.value })}
                  />
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 rounded-b-xl">
              <button
                onClick={() => { setIsAdding(false); setIsEditing(null); setEditForm({}); }}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => isEditing !== null ? handleUpdate(isEditing) : handleAdd()}
                disabled={!editForm.name}
                className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isEditing !== null ? 'Save Changes' : 'Save & Select'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
