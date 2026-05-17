import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Save, X, Search, ChevronDown, ChevronUp, Package } from 'lucide-react';

interface Supplier {
  id: number;
  name: string;
}

export default function SupplierDB() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<Supplier>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const toggleExpand = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedSuppliers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    fetchSuppliers();
    fetchProducts();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const res = await fetch('/api/suppliers');
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setSuppliers(data);
    } catch (e) {
      console.error('Failed to fetch suppliers', e);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setProducts(data);
    } catch (e) {
      console.error('Failed to fetch products', e);
    }
  };

  const handleAdd = async () => {
    if (!editForm.name) return;
    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        const data = await res.json();
        alert('Failed to add supplier: ' + (data.details ? data.details.join(', ') : data.error || 'Unknown error'));
        return;
      }
      setIsAdding(false);
      setEditForm({});
      fetchSuppliers();
    } catch (e) {
      alert('Network error occurred while adding.');
    }
  };

  const handleUpdate = async (id: number) => {
    try {
      const res = await fetch(`/api/suppliers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        const data = await res.json();
        alert('Failed to update supplier: ' + (data.details ? data.details.join(', ') : data.error || 'Unknown error'));
        return;
      }
      setIsEditing(null);
      setEditForm({});
      fetchSuppliers();
    } catch (e) {
      alert('Network error occurred while updating.');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this supplier?')) return;
    await fetch(`/api/suppliers/${id}`, { method: 'DELETE' });
    fetchSuppliers();
  };

  const startEdit = (supplier: Supplier) => {
    setIsEditing(supplier.id);
    setEditForm(supplier);
  };

  const tokens = search.toLowerCase().split(/\s+/).filter(t => t.length > 0);
  const normalize = (s: string) => s ? s.toLowerCase().replace(/[^a-z0-9]/g, '') : '';

  const filtered = suppliers.filter(s => {
    if (tokens.length === 0) return true;
    
    const normName = normalize(s.name);

    return tokens.every(token => {
      const nToken = normalize(token);
      return (
        s.name?.toLowerCase().includes(token) ||
        (nToken && normName.includes(nToken))
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
            <h2 className="text-xl font-semibold text-gray-800">Supplier Database</h2>
            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full">
              {filtered.length} / {suppliers.length}
            </span>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:flex-none">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search suppliers…"
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
              <Plus size={18} /> Add Supplier
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 text-gray-600 text-sm uppercase tracking-wider">
              <th className="p-4 border-b w-24">ID</th>
              <th className="p-4 border-b w-1/4">Name</th>
              <th className="p-4 border-b">Products (Item Code - Description)</th>
              <th className="p-4 border-b w-32 text-right">Actions</th>
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
                    placeholder="Supplier Name"
                    value={editForm.name || ''}
                    onChange={e => setEditForm({ ...editForm, name: e.target.value })}
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

            {currentItems.map((supplier) => {
              const supplierProducts = products.filter(p => p.supplier_name === supplier.name);
              return (
                <tr 
                  key={supplier.id} 
                  className="hover:bg-gray-50 even:bg-gray-50/50 transition-colors cursor-pointer"
                  onDoubleClick={() => startEdit(supplier)}
                >
                  <td className="p-4 text-gray-500 align-top">{supplier.id}</td>
                  <td className="p-4 align-top">
                    {isEditing === supplier.id ? (
                      <input
                        type="text"
                        className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={editForm.name || ''}
                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                      />
                    ) : (
                      <span className="font-medium text-gray-900">
                        {supplier.name}
                      </span>
                    )}
                  </td>
                  <td className="p-4 align-top">
                    {supplierProducts.length > 0 ? (
                      <div>
                        <button 
                          onClick={(e) => toggleExpand(supplier.id, e)}
                          className="flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                        >
                          <Package size={16} />
                          {supplierProducts.length} Product{supplierProducts.length !== 1 && 's'}
                          {expandedSuppliers.has(supplier.id) ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                        
                        {expandedSuppliers.has(supplier.id) && (
                          <div className="flex flex-col gap-1.5 mt-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar border-l-2 border-indigo-100 pl-3 py-1">
                            {supplierProducts.map(p => (
                              <div key={p.id} className="text-sm pb-1.5 border-b border-gray-50 last:border-0 last:pb-0">
                                {p.item_code && <span className="font-mono text-[11px] font-bold bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded mr-2 tracking-tight">{p.item_code}</span>}
                                <span className="text-gray-700">{p.description}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400 italic">No products</span>
                    )}
                  </td>
                  <td className="p-4 text-right align-top">
                    {isEditing === supplier.id ? (
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleUpdate(supplier.id)} className="p-2 text-green-600 hover:bg-green-50 rounded"><Save size={18} /></button>
                        <button onClick={() => setIsEditing(null)} className="p-2 text-gray-600 hover:bg-gray-100 rounded"><X size={18} /></button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2">
                        <button onClick={() => startEdit(supplier)} className="p-2 text-blue-600 hover:bg-blue-50 rounded"><Edit2 size={18} /></button>
                        {(user.role === 'admin' || user.permissions?.canDeleteData) && (
                          <button onClick={() => handleDelete(supplier.id)} className="p-2 text-red-600 hover:bg-red-50 rounded"><Trash2 size={18} /></button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}

            {filtered.length === 0 && !isAdding && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-gray-400">
                  {search ? `No suppliers match "${search}"` : 'No suppliers found. Add one to get started.'}
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
