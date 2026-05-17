import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Save, X, Search, Bot, Upload, CheckCircle2, AlertTriangle, Loader2, CheckSquare, Square } from 'lucide-react';

interface Product {
  id: number;
  item_code?: string;
  description: string;
  description_ar?: string;
  supplier_name?: string;
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
  const [lastTranslatedDesc, setLastTranslatedDesc] = useState('');
  const [showPriceSync, setShowPriceSync] = useState(false);
  const [syncData, setSyncData] = useState<{ id?: number; description: string; current_price: number; new_price: number; match_type: 'exact' | 'fuzzy' | 'none' }[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const [suppliers, setSuppliers] = useState<{ id: number; name: string }[]>([]);

  useEffect(() => { 
    fetchProducts(); 
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const res = await fetch('/api/suppliers');
      if (res.ok) setSuppliers(await res.json());
    } catch (e) {}
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
    setLastTranslatedDesc(product.description);
    setIsEditing(product.id);
    setEditForm(product);
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === currentItems.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(currentItems.map(p => p.id)));
  };
  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.size} selected product(s)? This cannot be undone.`)) return;
    for (const id of selectedIds) {
      await fetch(`/api/products/${id}`, { method: 'DELETE' });
    }
    setSelectedIds(new Set());
    fetchProducts();
  };

  const handleAutoTranslate = async (text: string) => {
    if (!text || text === lastTranslatedDesc) return;
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.translation) {
          setEditForm(prev => ({ ...prev, description_ar: data.translation }));
          setLastTranslatedDesc(text);
        }
      }
    } catch (e) {
      console.error('Translation failed', e);
    }
  };

  const tokens = search.toLowerCase().split(/\s+/).filter(t => t.length > 0);
  const normalize = (s: string) => s ? s.toLowerCase().replace(/[^a-z0-9]/g, '') : '';

  const filtered = products.filter(p => {
    if (tokens.length === 0) return true;
    
    const desc = p.description?.toLowerCase() || '';
    const descAr = p.description_ar?.toLowerCase() || '';
    const normDesc = normalize(desc);
    const normDescAr = normalize(descAr);
    
    // Check if ALL tokens match at least one field (either normally or normalized)
    const allTokensMatch = tokens.every(token => {
      const nToken = normalize(token);
      return (
        desc.includes(token) || 
        descAr.includes(token) ||
        (p.item_code?.toLowerCase() || '').includes(token) ||
        (p.supplier_name?.toLowerCase() || '').includes(token) ||
        (nToken && (normDesc.includes(nToken) || normDescAr.includes(nToken))) ||
        p.unit?.toLowerCase().includes(token) ||
        String(p.unit_price).includes(token)
      );
    });

    return allTokensMatch;
  });

  const totalPages = Math.ceil(filtered.length / rowsPerPage) || 1;
  const safePage = Math.min(currentPage, totalPages);
  const currentItems = filtered.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between px-6 py-3 bg-red-50 border-b border-red-200">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-red-700">{selectedIds.size} product{selectedIds.size !== 1 && 's'} selected</span>
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
            {(user.role === 'admin' || user.permissions?.canUsePriceSync) && (
              <button
                onClick={() => setShowPriceSync(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors whitespace-nowrap font-bold"
              >
                <Bot size={18} /> Smart Update
              </button>
            )}
            <button
              onClick={() => { 
                setIsAdding(true); 
                setEditForm({ unit: 'Pc', unit_price: 0 }); 
                setLastTranslatedDesc('');
              }}
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
              <th className="p-4 border-b w-10">
                <button onClick={toggleSelectAll} className={selectedIds.size === currentItems.length && currentItems.length > 0 ? 'text-indigo-600' : 'text-gray-300 hover:text-indigo-400'}>
                  {selectedIds.size === currentItems.length && currentItems.length > 0 ? <CheckSquare size={16} /> : <Square size={16} />}
                </button>
              </th>
              <th className="p-4 border-b">ID</th>
              <th className="p-4 border-b">Item Code</th>
              <th className="p-4 border-b">Description</th>
              <th className="p-4 border-b text-right">الوصف</th>
              <th className="p-4 border-b">Supplier</th>
              <th className="p-4 border-b">Unit</th>
              <th className="p-4 border-b">Unit Price</th>
              <th className="p-4 border-b text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">

            {currentItems.map((product) => (
              <tr 
                key={product.id} 
                className={`hover:bg-gray-50 even:bg-gray-50/50 transition-colors cursor-pointer ${selectedIds.has(product.id) ? 'bg-indigo-50 even:bg-indigo-50' : ''}`}
                onDoubleClick={() => startEdit(product)}
              >
                <td className="p-4">
                  <button onClick={e => { e.stopPropagation(); toggleSelect(product.id); }}
                    className={selectedIds.has(product.id) ? 'text-indigo-600' : 'text-gray-300 hover:text-indigo-400'}>
                    {selectedIds.has(product.id) ? <CheckSquare size={16} /> : <Square size={16} />}
                  </button>
                </td>
                <td className="p-4 text-gray-500">{product.id}</td>
                <td className="p-4"><span className="text-gray-600">{product.item_code}</span></td>
                <td className="p-4"><span className="font-medium text-gray-900">{product.description}</span></td>
                <td className="p-4"><span className="font-medium text-gray-900 text-right block" dir="rtl">{product.description_ar || ''}</span></td>
                <td className="p-4"><span className="text-gray-600">{product.supplier_name}</span></td>
                <td className="p-4"><span className="text-gray-600">{product.unit}</span></td>
                <td className="p-4"><span className="text-gray-900 font-mono">{product.unit_price.toFixed(2)}</span></td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => startEdit(product)} className="p-2 text-blue-600 hover:bg-blue-50 rounded"><Edit2 size={18} /></button>
                    {(user.role === 'admin' || user.permissions?.canDeleteData) && (
                      <button onClick={() => handleDelete(product.id)} className="p-2 text-red-600 hover:bg-red-50 rounded"><Trash2 size={18} /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}

            {filtered.length === 0 && !isAdding && (
              <tr>
                <td colSpan={9} className="p-8 text-center text-gray-400">
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

      {/* ── Price Sync Modal ────────────────────────────────────────────── */}
      {showPriceSync && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-purple-600 to-indigo-600">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-lg"><Bot className="text-white" /></div>
                <div>
                  <h2 className="text-white font-bold text-lg">AI Price Sync</h2>
                  <p className="text-white/70 text-xs">Update your database using supplier price lists (PDF/Excel)</p>
                </div>
              </div>
              <button onClick={() => { setShowPriceSync(false); setSyncData([]); }} className="text-white/70 hover:text-white text-xl">&times;</button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6">
              {syncData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50">
                  <div className="p-4 bg-purple-100 rounded-full mb-4">
                    <Upload className="text-purple-600" size={32} />
                  </div>
                  <h3 className="text-lg font-bold text-gray-800">Upload Price List</h3>
                  <p className="text-gray-500 text-sm mb-6 max-w-xs text-center">Upload your supplier's PDF or Excel file. AI will extract model numbers and prices.</p>
                  
                  <input
                    type="file"
                    id="price-sync-upload"
                    className="hidden"
                    accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.webp"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setIsSyncing(true);
                      
                      const formData = new FormData();
                      formData.append('file', file);
                      
                      try {
                        const token = localStorage.getItem('token') || '';
                        const res = await fetch('/api/admin/price-sync/extract', {
                          method: 'POST',
                          headers: { 'Authorization': `Bearer ${token}` },
                          body: formData
                        });
                        if (res.ok) {
                          const data = await res.json();
                          setSyncData(data);
                        } else {
                          const err = await res.json();
                          alert(err.error || 'Failed to extract data');
                        }
                      } catch (err) {
                        alert('Network error during AI extraction');
                      } finally {
                        setIsSyncing(false);
                      }
                    }}
                  />
                  <label
                    htmlFor="price-sync-upload"
                    className={`px-8 py-3 bg-purple-600 text-white rounded-xl font-bold cursor-pointer hover:bg-purple-700 transition-all shadow-lg flex items-center gap-2 ${isSyncing ? 'opacity-50 pointer-events-none' : ''}`}
                  >
                    {isSyncing ? <Loader2 className="animate-spin" /> : <Plus size={20} />}
                    {isSyncing ? 'AI is analyzing...' : 'Select Document'}
                  </label>
                  {isSyncing && <p className="mt-4 text-xs text-purple-600 font-medium animate-pulse">Scanning pages, matching models, and calculating differences...</p>}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 bg-amber-50 border border-amber-100 rounded-xl">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="text-amber-600" />
                      <div>
                        <p className="text-sm font-bold text-amber-900">Review Prices before Syncing</p>
                        <p className="text-xs text-amber-700">AI found {syncData.length} matches. You can edit the "New Price" column manually before applying.</p>
                      </div>
                    </div>
                  </div>

                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse text-sm">
                      <thead className="bg-gray-50 text-gray-600 font-bold">
                        <tr>
                          <th className="p-3">Product Description</th>
                          <th className="p-3 text-right">Current Price</th>
                          <th className="p-3 text-right">New Price</th>
                          <th className="p-3 text-center">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {syncData.map((item, idx) => {
                          const diff = item.new_price - item.current_price;
                          return (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="p-3 font-medium text-gray-800">{item.description}</td>
                              <td className="p-3 text-right font-mono text-gray-500">{item.current_price.toFixed(2)}</td>
                              <td className="p-3 text-right">
                                <input
                                  type="number"
                                  className="w-24 p-1 border border-indigo-200 rounded text-right font-mono font-bold bg-indigo-50/30 focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                  value={item.new_price}
                                  onChange={e => {
                                    const next = [...syncData];
                                    next[idx].new_price = parseFloat(e.target.value) || 0;
                                    setSyncData(next);
                                  }}
                                />
                              </td>
                              <td className="p-3 text-center">
                                {diff > 0 ? (
                                  <span className="text-red-600 font-bold flex items-center justify-center gap-1">↑ {diff.toFixed(2)}</span>
                                ) : diff < 0 ? (
                                  <span className="text-emerald-600 font-bold flex items-center justify-center gap-1">↓ {Math.abs(diff).toFixed(2)}</span>
                                ) : (
                                  <span className="text-gray-400">No Change</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {syncData.length > 0 && (
              <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                <button
                  onClick={() => { setSyncData([]); }}
                  className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700"
                >
                  Clear & Start Over
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowPriceSync(false)}
                    className="px-4 py-2 text-sm font-semibold text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      setIsSyncing(true);
                      try {
                        const res = await fetch('/api/admin/price-sync/apply', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ updates: syncData.filter(d => d.id) })
                        });
                        if (res.ok) {
                          alert('Prices updated successfully!');
                          setShowPriceSync(false);
                          setSyncData([]);
                          fetchProducts();
                        } else {
                          alert('Failed to apply updates');
                        }
                      } catch (err) {
                        alert('Network error during sync');
                      } finally {
                        setIsSyncing(false);
                      }
                    }}
                    className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-bold flex items-center gap-2"
                  >
                    {isSyncing ? <Loader2 className="animate-spin" /> : <CheckCircle2 size={18} />}
                    Apply {syncData.length} Updates
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* ── Product Modal (Add / Edit) ────────────────────────────────────────────── */}
      {(isAdding || isEditing !== null) && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center print:hidden" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {/* Header */}
            <div className={`px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r ${isAdding ? 'from-indigo-600 to-purple-600' : 'from-blue-600 to-cyan-600'}`}>
              <div className="flex items-center gap-2">
                {isAdding ? <Plus size={18} className="text-white" /> : <Edit2 size={18} className="text-white" />}
                <h2 className="text-white font-bold text-base">{isAdding ? 'Add to Product DB' : 'Edit Product'}</h2>
              </div>
              <button onClick={() => { setIsAdding(false); setIsEditing(null); setEditForm({}); }} className="text-white/70 hover:text-white text-xl leading-none">&times;</button>
            </div>
            {/* Body */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Product Name</label>
                <input
                  type="text"
                  autoFocus
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                  value={editForm.description || ''}
                  onChange={e => setEditForm(m => ({ ...m, description: e.target.value }))}
                  onBlur={e => handleAutoTranslate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Product Name (Arabic)</label>
                <input
                  type="text"
                  dir="rtl"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-right"
                  value={editForm.description_ar || ''}
                  onChange={e => setEditForm(m => ({ ...m, description_ar: e.target.value }))}
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Item Code</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={editForm.item_code || ''}
                    onChange={e => setEditForm(m => ({ ...m, item_code: e.target.value }))}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Supplier Name</label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                    value={editForm.supplier_name || ''}
                    onChange={e => setEditForm(m => ({ ...m, supplier_name: e.target.value }))}
                  >
                    <option value="">-- Select Supplier --</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Unit</label>
                  <input
                    type="text"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={editForm.unit || ''}
                    onChange={e => setEditForm(m => ({ ...m, unit: e.target.value }))}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Unit Price</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={editForm.unit_price === undefined ? '' : editForm.unit_price}
                    onChange={e => setEditForm(m => ({ ...m, unit_price: parseFloat(e.target.value) || 0 }))}
                  />
                </div>
              </div>
            </div>
            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end bg-gray-50">
              <button
                className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-100 transition-colors"
                onClick={() => { setIsAdding(false); setIsEditing(null); setEditForm({}); }}
              >Cancel</button>
              <button
                className={`px-5 py-2 text-white rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 ${isAdding ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                onClick={async () => {
                  if (isAdding) {
                    await handleAdd();
                  } else if (isEditing !== null) {
                    await handleUpdate(isEditing);
                  }
                }}
              >
                {isAdding ? 'Save & Add' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
