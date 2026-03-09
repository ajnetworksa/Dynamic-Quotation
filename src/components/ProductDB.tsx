import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Save, X } from 'lucide-react';

interface Product {
  id: number;
  description: string;
  description_ar?: string;
  unit: string;
  unit_price: number;
}

export default function ProductDB() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isEditing, setIsEditing] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<Partial<Product>>({});
  const [isAdding, setIsAdding] = useState(false);
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const res = await fetch('/api/products');
    const data = await res.json();
    setProducts(data);
  };

  const handleAdd = async () => {
    if (!editForm.description || !editForm.unit_price) return;
    
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

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-200 flex justify-between items-center bg-gray-50">
        <h2 className="text-xl font-semibold text-gray-800">Product Database</h2>
        <button
          onClick={() => { setIsAdding(true); setEditForm({ unit: 'set', unit_price: 0 }); }}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus size={18} />
          Add Product
        </button>
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
                  <input
                    type="text"
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="Product description"
                    value={editForm.description || ''}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  />
                </td>
                <td className="p-4">
                  <input
                    type="text"
                    dir="rtl"
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none text-right"
                    placeholder="وصف المنتج"
                    value={editForm.description_ar || ''}
                    onChange={(e) => setEditForm({ ...editForm, description_ar: e.target.value })}
                  />
                </td>
                <td className="p-4">
                  <input
                    type="text"
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="Unit"
                    value={editForm.unit || ''}
                    onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                  />
                </td>
                <td className="p-4">
                  <input
                    type="number"
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="0.00"
                    value={editForm.unit_price || ''}
                    onChange={(e) => setEditForm({ ...editForm, unit_price: parseFloat(e.target.value) })}
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
            
            {products.map((product) => (
              <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                <td className="p-4 text-gray-500">{product.id}</td>
                <td className="p-4">
                  {isEditing === product.id ? (
                    <input
                      type="text"
                      className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={editForm.description || ''}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    />
                  ) : (
                    <span className="font-medium text-gray-900">{product.description}</span>
                  )}
                </td>
                <td className="p-4">
                  {isEditing === product.id ? (
                    <input
                      type="text"
                      dir="rtl"
                      className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none text-right"
                      value={editForm.description_ar || ''}
                      onChange={(e) => setEditForm({ ...editForm, description_ar: e.target.value })}
                    />
                  ) : (
                    <span className="font-medium text-gray-900 text-right block" dir="rtl">{product.description_ar || ''}</span>
                  )}
                </td>
                <td className="p-4">
                  {isEditing === product.id ? (
                    <input
                      type="text"
                      className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={editForm.unit || ''}
                      onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                    />
                  ) : (
                    <span className="text-gray-600">{product.unit}</span>
                  )}
                </td>
                <td className="p-4">
                  {isEditing === product.id ? (
                    <input
                      type="number"
                      className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                      value={editForm.unit_price || ''}
                      onChange={(e) => setEditForm({ ...editForm, unit_price: parseFloat(e.target.value) })}
                    />
                  ) : (
                    <span className="text-gray-900 font-mono">{product.unit_price.toFixed(2)}</span>
                  )}
                </td>
                <td className="p-4 text-right">
                  {isEditing === product.id ? (
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleUpdate(product.id)} className="p-2 text-green-600 hover:bg-green-50 rounded">
                        <Save size={18} />
                      </button>
                      <button onClick={() => setIsEditing(null)} className="p-2 text-gray-600 hover:bg-gray-100 rounded">
                        <X size={18} />
                      </button>
                    </div>
                  ) : (
                    <div className="flex justify-end gap-2">
                      <button onClick={() => startEdit(product)} className="p-2 text-blue-600 hover:bg-blue-50 rounded">
                        <Edit2 size={18} />
                      </button>
                      {user.role === 'admin' && (
                        <button onClick={() => handleDelete(product.id)} className="p-2 text-red-600 hover:bg-red-50 rounded">
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {products.length === 0 && !isAdding && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-gray-500">
                  No products found. Add one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
