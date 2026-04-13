import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Save, X, Search } from 'lucide-react';

interface Product {
  id: number;
  description: string;
  description_ar?: string;
  unit: string;
  unit_price: number;
}

export default function ProductDB() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<Product>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => { fetchProducts(); }, []);

  const fetchProducts = async () => {
    const res = await fetch('/api/products');
    const data = await res.json();
    setProducts(data);
  };

  const handleAdd = async () => {
    if (!editForm.description || editForm.unit_price === undefined || editForm.unit_price === null) return;
    await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    });
    setIsAdding(false);
    setEditForm({});
    fetchProducts();
  };

  const handleUpdate = async (id: number) => {
    await fetch(`/api/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    });
    setIsEditing(null);
    setEditForm({});
    fetchProducts();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    await fetch(`/api/products/${id}`, { method: 'DELETE' });
    fetchProducts();
  };

  const startEdit = (product: Product) => {
    setIsEditing(product.id);
    setEditForm(product);
  };

  const q = search.toLowerCase();
  const filtered = products.filter(p =>
    !q ||
    p.description?.toLowerCase().includes(q) ||
    p.description_ar?.toLowerCase().includes(q) ||
    p.unit?.toLowerCase().includes(q) ||
    String(p.unit_price).includes(q)
  );

  const totalPages = Math.ceil(filtered.length / rowsPerPage) || 1;
  const safePage = Math.min(currentPage, totalPages);
  const currentItems = filtered.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-200 bg-gray-50">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-800">Product Database</h2>
            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full">
              {filtered.length} / {products.length}
            </span>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Search */}
            <div className="relative flex-1 sm:flex-none">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search products…"
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
              onClick={() => { setIsAdding(true); setEditForm({ unit: 'set', unit_price: 0 }); }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap"
            >
              <Plus size={18} /> Add Product
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 text-gray-600 text-sm uppercase tracking-wider">
              <th className="p-4 border-b">ID</th>
              <th className="p-4 border-b">Description</th>
              <th className="p-4 border-b text-right">الوصف</th>
              <th className="p-4 border-b">Unit</th>
              <th className="p-4 border-b">Unit Price</th>
              <th className="p-4 border-b text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {isAdding && (
              <tr className="bg-indigo-50">
                <td className="p-4 text-gray-500">New</td>
                <td className="p-4">
                  <input type="text" className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Product description"
                    value={editForm.description || ''} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
                </td>
                <td className="p-4">
                  <input type="text" dir="rtl" className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none text-right" placeholder="وصف المنتج"
                    value={editForm.description_ar || ''} onChange={e => setEditForm({ ...editForm, description_ar: e.target.value })} />
                </td>
                <td className="p-4">
                  <input type="text" className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="Unit"
                    value={editForm.unit || ''} onChange={e => setEditForm({ ...editForm, unit: e.target.value })} />
                </td>
                <td className="p-4">
                  <input type="number" className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="0.00"
                    value={editForm.unit_price || ''} onChange={e => setEditForm({ ...editForm, unit_price: parseFloat(e.target.value) })} />
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={handleAdd} className="p-2 text-green-600 hover:bg-green-50 rounded"><Save size={18} /></button>
                    <button onClick={() => setIsAdding(false)} className="p-2 text-red-600 hover:bg-red-50 rounded"><X size={18} /></button>
                  </div>
                </td>
              </tr>
            )}

            {currentItems.map((product) => (
              <tr key={product.id} className="hover:bg-gray-50 even:bg-gray-50/50 transition-colors">
                <td className="p-4 text-gray-500">{product.id}</td>
                <td className="p-4">
                  {isEditing === product.id ? (
                    <input type="text" className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={editForm.description || ''} onChange={e => setEditForm({ ...editForm, description: e.target.value })} />
                  ) : (
                    <span className="font-medium text-gray-900">{product.description}</span>
                  )}
                </td>
                <td className="p-4">
                  {isEditing === product.id ? (
                    <input type="text" dir="rtl" className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none text-right"
                      value={editForm.description_ar || ''} onChange={e => setEditForm({ ...editForm, description_ar: e.target.value })} />
                  ) : (
                    <span className="font-medium text-gray-900 text-right block" dir="rtl">{product.description_ar || ''}</span>
                  )}
                </td>
                <td className="p-4">
                  {isEditing === product.id ? (
                    <input type="text" className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={editForm.unit || ''} onChange={e => setEditForm({ ...editForm, unit: e.target.value })} />
                  ) : (
                    <span className="text-gray-600">{product.unit}</span>
                  )}
                </td>
                <td className="p-4">
                  {isEditing === product.id ? (
                    <input type="number" className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={editForm.unit_price || ''} onChange={e => setEditForm({ ...editForm, unit_price: parseFloat(e.target.value) })} />
                  ) : (
                    <span className="text-gray-900 font-mono">{product.unit_price.toFixed(2)}</span>
                  )}
                </td>
                <td className="p-4 text-right">
                  {isEditing === product.id ? (
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleUpdate(product.id)} className="p-2 text-green-600 hover:bg-green-50 rounded"><Save size={18} /></button>
                      <button onClick={() => setIsEditing(null)} className="p-2 text-gray-600 hover:bg-gray-100 rounded"><X size={18} /></button>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-2">
                      <button onClick={() => startEdit(product)} className="p-2 text-blue-600 hover:bg-blue-50 rounded"><Edit2 size={18} /></button>
                      {(user.role === 'admin' || user.permissions?.canDeleteData) && (
                        <button onClick={() => handleDelete(product.id)} className="p-2 text-red-600 hover:bg-red-50 rounded"><Trash2 size={18} /></button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}

            {filtered.length === 0 && !isAdding && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-gray-400">
                  {search ? `No products match "${search}"` : 'No products found. Add one to get started.'}
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
