import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Save, X, Search } from 'lucide-react';
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
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
            {isAdding && (
              <tr className="bg-indigo-50">
                <td className="p-4 text-gray-500">New</td>
                {(['name', 'address', 'contact', 'mobile'] as const).map(field => (
                  <td key={field} className="p-4">
                    <input
                      type="text"
                      className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                      value={(editForm as any)[field] || ''}
                      onChange={e => setEditForm({ ...editForm, [field]: e.target.value })}
                    />
                  </td>
                ))}
                <td className="p-4">
                  <input
                    type="email"
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="Email"
                    value={editForm.email || ''}
                    onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                  />
                </td>
                <td className="p-4"></td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={handleAdd} className="p-2 text-green-600 hover:bg-green-50 rounded"><Save size={18} /></button>
                    <button onClick={() => setIsAdding(false)} className="p-2 text-red-600 hover:bg-red-50 rounded"><X size={18} /></button>
                  </div>
                </td>
              </tr>
            )}

            {currentItems.map((customer) => (
              <tr key={customer.id} className="hover:bg-gray-50 even:bg-gray-50/50 transition-colors">
                <td className="p-4 text-gray-500">{customer.id}</td>
                {(['name', 'address', 'contact', 'mobile', 'email'] as const).map(field => (
                  <td key={field} className="p-4">
                    {isEditing === customer.id ? (
                      <input
                        type={field === 'email' ? 'email' : 'text'}
                        className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={(editForm as any)[field] || ''}
                        onChange={e => setEditForm({ ...editForm, [field]: e.target.value })}
                      />
                    ) : (
                      <span className={field === 'name' ? 'font-medium text-gray-900' : 'text-gray-600'}>
                        {(customer as any)[field]}
                      </span>
                    )}
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
                  {isEditing === customer.id ? (
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleUpdate(customer.id)} className="p-2 text-green-600 hover:bg-green-50 rounded"><Save size={18} /></button>
                      <button onClick={() => setIsEditing(null)} className="p-2 text-gray-600 hover:bg-gray-100 rounded"><X size={18} /></button>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-2">
                      <button onClick={() => startEdit(customer)} className="p-2 text-blue-600 hover:bg-blue-50 rounded"><Edit2 size={18} /></button>
                      {(user.role === 'admin' || user.permissions?.canDeleteData) && (
                        <button onClick={() => handleDelete(customer.id)} className="p-2 text-red-600 hover:bg-red-50 rounded"><Trash2 size={18} /></button>
                      )}
                    </div>
                  )}
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
  );
}
