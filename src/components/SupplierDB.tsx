import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Save, X, Search, ChevronDown, ChevronUp, Package, Copy, ArrowRight, CheckSquare, Square } from 'lucide-react';

interface Supplier { id: number; name: string; }

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
  const [selectedProductForEdit, setSelectedProductForEdit] = useState<any | null>(null);
  const [productEditForm, setProductEditForm] = useState<{ item_code: string; supplier_name: string }>({ item_code: '', supplier_name: '' });
  // Multi-select: key = supplierId, value = Set of product ids
  const [selectedProducts, setSelectedProducts] = useState<Record<number, Set<number>>>({});
  // Bulk action modal
  const [bulkModal, setBulkModal] = useState<{ supplierId: number; mode: 'copy' | 'move' } | null>(null);
  const [bulkTargetSupplier, setBulkTargetSupplier] = useState('');
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  const toggleExpand = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedSuppliers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  useEffect(() => { fetchSuppliers(); fetchProducts(); }, []);

  const fetchSuppliers = async () => {
    try { const res = await fetch('/api/suppliers'); if (res.ok) { const d = await res.json(); if (Array.isArray(d)) setSuppliers(d); } } catch (e) {}
  };
  const fetchProducts = async () => {
    try { const res = await fetch('/api/products'); if (res.ok) { const d = await res.json(); if (Array.isArray(d)) setProducts(d); } } catch (e) {}
  };

  const handleAdd = async () => {
    if (!editForm.name) return;
    const res = await fetch('/api/suppliers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editForm) });
    if (res.ok) { setIsAdding(false); setEditForm({}); fetchSuppliers(); }
    else { const d = await res.json(); alert(d.error || 'Failed'); }
  };
  const handleUpdate = async (id: number) => {
    const res = await fetch(`/api/suppliers/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editForm) });
    if (res.ok) { setIsEditing(null); setEditForm({}); fetchSuppliers(); }
    else { const d = await res.json(); alert(d.error || 'Failed'); }
  };
  const handleDelete = async (id: number) => {
    if (!confirm('Delete this supplier?')) return;
    await fetch(`/api/suppliers/${id}`, { method: 'DELETE' });
    fetchSuppliers();
  };
  const startEdit = (s: Supplier) => { setIsEditing(s.id); setEditForm(s); };
  const openProductEdit = (product: any) => {
    setSelectedProductForEdit(product);
    setProductEditForm({ item_code: product.item_code || '', supplier_name: product.supplier_name || '' });
  };
  const handleProductUpdate = async () => {
    if (!selectedProductForEdit) return;
    const res = await fetch(`/api/products/${selectedProductForEdit.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...selectedProductForEdit, item_code: productEditForm.item_code || null, supplier_name: productEditForm.supplier_name || null }),
    });
    if (res.ok) { setSelectedProductForEdit(null); fetchProducts(); }
    else { const d = await res.json(); alert(d.error || 'Failed'); }
  };

  // Multi-select helpers
  const getSelected = (supplierId: number): Set<number> => selectedProducts[supplierId] || new Set();
  const toggleProductSelect = (supplierId: number, productId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedProducts(prev => {
      const cur = new Set(prev[supplierId] || []);
      if (cur.has(productId)) cur.delete(productId); else cur.add(productId);
      return { ...prev, [supplierId]: cur };
    });
  };
  const selectAll = (supplierId: number, supplierProducts: any[]) => {
    setSelectedProducts(prev => ({ ...prev, [supplierId]: new Set(supplierProducts.map(p => p.id)) }));
  };
  const clearSelection = (supplierId: number) => {
    setSelectedProducts(prev => ({ ...prev, [supplierId]: new Set() }));
  };

  const handleBulkAction = async () => {
    if (!bulkModal || !bulkTargetSupplier) return;
    setIsBulkLoading(true);
    const sel = getSelected(bulkModal.supplierId);
    const selectedProds = products.filter(p => sel.has(p.id));
    try {
      for (const prod of selectedProds) {
        if (bulkModal.mode === 'copy') {
          // Create a duplicate with the new supplier
          await fetch('/api/products', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...prod, id: undefined, supplier_name: bulkTargetSupplier }),
          });
        } else {
          // Move: update existing product's supplier
          await fetch(`/api/products/${prod.id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...prod, supplier_name: bulkTargetSupplier }),
          });
        }
      }
      setBulkModal(null);
      setBulkTargetSupplier('');
      clearSelection(bulkModal.supplierId);
      fetchProducts();
    } catch (e) {
      alert('Error during bulk operation');
    } finally {
      setIsBulkLoading(false);
    }
  };

  const tokens = search.toLowerCase().split(/\s+/).filter(t => t.length > 0);
  const normalize = (s: string) => s ? s.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  const filtered = suppliers.filter(s => {
    if (tokens.length === 0) return true;
    const n = normalize(s.name);
    return tokens.every(t => s.name.toLowerCase().includes(t) || n.includes(normalize(t)));
  });
  const totalPages = Math.ceil(filtered.length / rowsPerPage) || 1;
  const safePage = Math.min(currentPage, totalPages);
  const currentItems = filtered.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage);

  return (
    <>
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 bg-gray-50">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-800">Supplier Database</h2>
            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full">{filtered.length} / {suppliers.length}</span>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input type="text" placeholder="Search suppliers…" value={search} onChange={e => setSearch(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-full sm:w-56" />
              {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} /></button>}
            </div>
            <button onClick={() => { setIsAdding(true); setEditForm({}); }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors whitespace-nowrap">
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
                  <input type="text" className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                    placeholder="Supplier Name" value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                </td>
                <td className="p-4" />
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button onClick={handleAdd} className="p-2 text-green-600 hover:bg-green-50 rounded"><Save size={18} /></button>
                    <button onClick={() => setIsAdding(false)} className="p-2 text-red-600 hover:bg-red-50 rounded"><X size={18} /></button>
                  </div>
                </td>
              </tr>
            )}

            {currentItems.map(supplier => {
              const supplierProducts = products.filter(p => p.supplier_name === supplier.name);
              const sel = getSelected(supplier.id);
              const allSelected = supplierProducts.length > 0 && sel.size === supplierProducts.length;
              const someSelected = sel.size > 0;
              return (
                <tr key={supplier.id} className="hover:bg-gray-50 even:bg-gray-50/50 transition-colors cursor-pointer" onDoubleClick={() => startEdit(supplier)}>
                  <td className="p-4 text-gray-500 align-top">{supplier.id}</td>
                  <td className="p-4 align-top">
                    {isEditing === supplier.id ? (
                      <input type="text" className="w-full p-2 border rounded focus:ring-2 focus:ring-indigo-500 outline-none"
                        value={editForm.name || ''} onChange={e => setEditForm({ ...editForm, name: e.target.value })} />
                    ) : (
                      <span className="font-medium text-gray-900">{supplier.name}</span>
                    )}
                  </td>
                  <td className="p-4 align-top">
                    {supplierProducts.length > 0 ? (
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <button onClick={e => toggleExpand(supplier.id, e)}
                            className="flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
                            <Package size={16} />
                            {supplierProducts.length} Product{supplierProducts.length !== 1 && 's'}
                            {expandedSuppliers.has(supplier.id) ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                          {/* Bulk action buttons appear when items are selected */}
                          {someSelected && (
                            <div className="flex items-center gap-1.5 ml-2">
                              <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">{sel.size} selected</span>
                              <button onClick={e => { e.stopPropagation(); setBulkModal({ supplierId: supplier.id, mode: 'copy' }); setBulkTargetSupplier(''); }}
                                className="flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded hover:bg-emerald-100 transition-colors">
                                <Copy size={12} /> Copy To
                              </button>
                              <button onClick={e => { e.stopPropagation(); setBulkModal({ supplierId: supplier.id, mode: 'move' }); setBulkTargetSupplier(''); }}
                                className="flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded hover:bg-amber-100 transition-colors">
                                <ArrowRight size={12} /> Move To
                              </button>
                              <button onClick={e => { e.stopPropagation(); clearSelection(supplier.id); }}
                                className="text-xs text-gray-400 hover:text-gray-600 px-1">✕ Clear</button>
                            </div>
                          )}
                        </div>

                        {expandedSuppliers.has(supplier.id) && (
                          <div className="mt-2.5 border border-indigo-100 rounded-lg overflow-hidden">
                            {/* Select-all header */}
                            <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50/50 border-b border-indigo-100">
                              <button onClick={e => { e.stopPropagation(); allSelected ? clearSelection(supplier.id) : selectAll(supplier.id, supplierProducts); }}
                                className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800">
                                {allSelected ? <CheckSquare size={14} /> : <Square size={14} />}
                                {allSelected ? 'Deselect All' : 'Select All'}
                              </button>
                            </div>
                            <div className="flex flex-col max-h-64 overflow-y-auto">
                              {supplierProducts.map(p => {
                                const isSelected = sel.has(p.id);
                                return (
                                  <div key={p.id}
                                    className={`flex items-center gap-2 px-3 py-2 border-b border-gray-50 last:border-0 transition-all ${isSelected ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}>
                                    {/* Checkbox */}
                                    <button onClick={e => toggleProductSelect(supplier.id, p.id, e)}
                                      className={`shrink-0 ${isSelected ? 'text-indigo-600' : 'text-gray-300 hover:text-indigo-400'}`}>
                                      {isSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                                    </button>
                                    {/* Clickable product info */}
                                    <div onClick={e => { e.stopPropagation(); openProductEdit(p); }}
                                      className="flex items-center gap-1.5 flex-1 cursor-pointer hover:text-indigo-700 transition-colors text-sm"
                                      title="Click to edit item code or assign supplier">
                                      {p.item_code ? (
                                        <span className="font-mono text-[11px] font-bold bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded tracking-tight shrink-0">{p.item_code}</span>
                                      ) : (
                                        <span className="font-mono text-[10px] italic bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded tracking-tight shrink-0">No Code</span>
                                      )}
                                      <span className="font-medium text-left">{p.description}</span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
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
              <tr><td colSpan={4} className="p-8 text-center text-gray-400">
                {search ? `No suppliers match "${search}"` : 'No suppliers found. Add one to get started.'}
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="p-4 border-t border-gray-200 flex flex-col sm:flex-row justify-between items-center gap-4 bg-white rounded-b-xl">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Rows per page:</span>
          <input type="number" min="1" className="w-16 p-1 border border-gray-300 rounded text-sm text-center focus:ring-2 focus:ring-indigo-500 outline-none"
            value={rowsPerPage || ''} onChange={e => { const v = parseInt(e.target.value); setRowsPerPage(isNaN(v) ? '' as any : v); setCurrentPage(1); }}
            onBlur={() => { if (!rowsPerPage || rowsPerPage < 1) setRowsPerPage(20); }} />
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">Page {safePage} of {totalPages}</span>
          <div className="flex gap-1">
            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={safePage === 1}
              className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium">Previous</button>
            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
              className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium">Next</button>
          </div>
        </div>
      </div>
    </div>

    {/* ── Single Product Edit Modal ── */}
    {selectedProductForEdit && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
          <div className="bg-indigo-600 px-4 py-3 flex items-center justify-between text-white">
            <div className="flex items-center gap-2 font-medium"><Package size={18} /> Edit Product Assignment</div>
            <button onClick={() => setSelectedProductForEdit(null)} className="hover:bg-white/20 p-1 rounded transition-colors"><X size={18} /></button>
          </div>
          <div className="p-5 overflow-y-auto space-y-4" style={{ maxHeight: 'calc(100vh - 200px)' }}>
            <div className="bg-gray-50 border border-gray-100 rounded-lg p-3">
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">Product Description</span>
              <p className="text-gray-800 font-semibold text-sm mt-0.5">{selectedProductForEdit.description}</p>
              {selectedProductForEdit.description_ar && (
                <p className="text-gray-500 text-xs mt-1 text-right" dir="rtl">{selectedProductForEdit.description_ar}</p>
              )}
              <div className="mt-2.5 pt-2.5 border-t border-gray-100 flex justify-between text-xs text-gray-500 font-medium">
                <span>Unit: <span className="text-gray-700">{selectedProductForEdit.unit || 'Pcs'}</span></span>
                <span>Price: <span className="text-emerald-600 font-mono font-bold">SAR {selectedProductForEdit.unit_price?.toFixed(2)}</span></span>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Item Code</label>
                <input type="text" className="w-full p-2 border border-indigo-500 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-sm"
                  placeholder="Enter item code..." value={productEditForm.item_code} onChange={e => setProductEditForm({ ...productEditForm, item_code: e.target.value })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Assign Supplier</label>
                <select className="w-full p-2 border border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-sm"
                  value={productEditForm.supplier_name} onChange={e => setProductEditForm({ ...productEditForm, supplier_name: e.target.value })}>
                  <option value="">— Select a supplier —</option>
                  {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>
            </div>
          </div>
          <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 rounded-b-xl">
            <button onClick={() => setSelectedProductForEdit(null)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800">Cancel</button>
            <button onClick={handleProductUpdate} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">Save Changes</button>
          </div>
        </div>
      </div>
    )}

    {/* ── Bulk Copy / Move Modal ── */}
    {bulkModal && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
          <div className={`px-4 py-3 flex items-center justify-between text-white ${bulkModal.mode === 'copy' ? 'bg-emerald-600' : 'bg-amber-500'}`}>
            <div className="flex items-center gap-2 font-medium">
              {bulkModal.mode === 'copy' ? <Copy size={18} /> : <ArrowRight size={18} />}
              {bulkModal.mode === 'copy' ? 'Copy Products To Supplier' : 'Move Products To Supplier'}
            </div>
            <button onClick={() => setBulkModal(null)} className="hover:bg-white/20 p-1 rounded transition-colors"><X size={18} /></button>
          </div>
          <div className="p-5 space-y-4">
            <div className="bg-gray-50 rounded-lg p-3 space-y-1">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">Selected Products ({getSelected(bulkModal.supplierId).size})</p>
              <div className="max-h-36 overflow-y-auto space-y-1">
                {products.filter(p => getSelected(bulkModal.supplierId).has(p.id)).map(p => (
                  <div key={p.id} className="flex items-center gap-1.5 text-sm">
                    {p.item_code && <span className="font-mono text-[11px] bg-indigo-100 text-indigo-700 px-1 rounded">{p.item_code}</span>}
                    <span className="text-gray-700">{p.description}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">
                {bulkModal.mode === 'copy' ? 'Copy To Supplier' : 'Move To Supplier'}
              </label>
              <select className="w-full p-2 border border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-sm"
                value={bulkTargetSupplier} onChange={e => setBulkTargetSupplier(e.target.value)}>
                <option value="">— Select target supplier —</option>
                {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
            {bulkModal.mode === 'copy' && (
              <p className="text-xs text-gray-500 bg-emerald-50 border border-emerald-100 rounded p-2">
                ℹ️ This creates <strong>duplicate</strong> entries assigned to the selected supplier. The originals remain unchanged.
              </p>
            )}
            {bulkModal.mode === 'move' && (
              <p className="text-xs text-gray-500 bg-amber-50 border border-amber-100 rounded p-2">
                ⚠️ This <strong>reassigns</strong> the selected products to the new supplier. They will no longer appear under the current supplier.
              </p>
            )}
          </div>
          <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 rounded-b-xl">
            <button onClick={() => setBulkModal(null)} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800">Cancel</button>
            <button onClick={handleBulkAction} disabled={!bulkTargetSupplier || isBulkLoading}
              className={`px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${bulkModal.mode === 'copy' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-amber-500 hover:bg-amber-600'}`}>
              {isBulkLoading ? 'Processing...' : bulkModal.mode === 'copy' ? `Copy ${getSelected(bulkModal.supplierId).size} Products` : `Move ${getSelected(bulkModal.supplierId).size} Products`}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
