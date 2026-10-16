import React from 'react';
import { Plus } from 'lucide-react';
import { toast } from '../../lib/notify';

export interface AddProductState {
  rowIndex: number;
  description: string;
  unit: string;
  price: string;
  item_code: string;
  supplier_name: string;
  isSaving?: boolean;
}

interface Props {
  modal: AddProductState;
  setModal: React.Dispatch<React.SetStateAction<AddProductState | null>>;
  suppliers: Array<{ id: number; name: string }>;
  /** Arabic translation of the product name (saved with the product). */
  translate: (text: string) => Promise<string | undefined | null | void>;
  /** Called with the freshly created product (after the product list was refreshed). */
  onCreated: (product: any, rowIndex: number, allProducts: any[]) => void;
}

/** "Add to Product DB" dialog opened from a quote line that has no matching product. */
export default function AddProductModal({ modal, setModal, suppliers, translate, onCreated }: Props) {
  const save = async () => {
    const { rowIndex, description, unit, price } = modal;
    const unit_price = parseFloat(price) || 0;
    if (!description.trim()) return;
    setModal(m => (m ? { ...m, isSaving: true } : m));
    try {
      // Pre-translate before saving to DB
      let description_ar = '';
      const trans = await translate(description.trim());
      if (trans) description_ar = String(trans);

      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: description.trim(), description_ar, unit: unit || 'Pc', unit_price, item_code: modal.item_code, supplier_name: modal.supplier_name }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast(body.error || 'Could not add the product.', 'error');
        setModal(m => (m ? { ...m, isSaving: false } : m));
        return;
      }
      const { id } = await res.json();
      const refreshed = await fetch(`/api/products?_t=${Date.now()}`);
      if (refreshed.ok) {
        const data = await refreshed.json();
        if (Array.isArray(data)) {
          const created = data.find((p: any) => p.id === id);
          if (created) onCreated(created, rowIndex, data);
        }
      }
      setModal(null);
    } catch (e) {
      console.error('Failed to add product:', e);
      setModal(m => (m ? { ...m, isSaving: false } : m));
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Add to Product DB" className="fixed inset-0 z-[10000] flex items-center justify-center print:hidden" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-indigo-600 to-purple-600">
          <div className="flex items-center gap-2">
            <Plus size={18} className="text-white" />
            <h2 className="text-white font-bold text-base">Add to Product DB</h2>
          </div>
          <button onClick={() => setModal(null)} aria-label="Close" className="text-white/70 hover:text-white text-xl leading-none">&times;</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label htmlFor="ap-desc" className="block text-xs font-semibold text-gray-500 mb-1">Product Name</label>
            <textarea
              id="ap-desc"
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 bg-white resize-y"
              value={modal.description}
              onChange={e => setModal(m => (m ? { ...m, description: e.target.value } : m))}
              rows={Math.max(2, Math.min(6, Math.ceil((modal.description || '').length / 45)))}
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label htmlFor="ap-code" className="block text-xs font-semibold text-gray-500 mb-1">Item Code</label>
              <input id="ap-code" type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 bg-white"
                value={modal.item_code} onChange={e => setModal(m => (m ? { ...m, item_code: e.target.value } : m))} />
            </div>
            <div className="flex-1">
              <label htmlFor="ap-supplier" className="block text-xs font-semibold text-gray-500 mb-1">Supplier Name</label>
              <select id="ap-supplier" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-900"
                value={modal.supplier_name} onChange={e => setModal(m => (m ? { ...m, supplier_name: e.target.value } : m))}>
                <option value="">-- Select Supplier --</option>
                {suppliers.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label htmlFor="ap-unit" className="block text-xs font-semibold text-gray-500 mb-1">Unit</label>
              <input id="ap-unit" type="text" list="unit-suggestions" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 bg-white"
                value={modal.unit} onChange={e => setModal(m => (m ? { ...m, unit: e.target.value } : m))} />
            </div>
            <div className="flex-1">
              <label htmlFor="ap-price" className="block text-xs font-semibold text-gray-500 mb-1">Unit Price</label>
              <input id="ap-price" type="number" min="0" step="0.01" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 bg-white"
                value={modal.price} onChange={e => setModal(m => (m ? { ...m, price: e.target.value } : m))} />
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end bg-gray-50">
          <button className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-100 transition-colors" onClick={() => setModal(null)}>Cancel</button>
          <button disabled={modal.isSaving} onClick={save} className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-70 flex items-center gap-2">
            {modal.isSaving ? 'Saving...' : 'Save & Add to Quote'}
          </button>
        </div>
      </div>
    </div>
  );
}
