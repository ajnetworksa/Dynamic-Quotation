import React from 'react';
import { Users } from 'lucide-react';
import { toast } from '../../lib/notify';

export interface AddCustomerState {
  name: string;
  mobile: string;
  address: string;
  contact: string;
  email: string;
  isSaving?: boolean;
}

interface Props {
  modal: AddCustomerState;
  setModal: React.Dispatch<React.SetStateAction<AddCustomerState | null>>;
  /** Called with the new customer after the customer list was refreshed. */
  onCreated: (customer: any, allCustomers: any[]) => void;
}

const inputClass = 'w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-emerald-500 text-sm text-gray-900 bg-white';

/** "Add to Customer DB" dialog opened from the customer field of a quote. */
export default function AddCustomerModal({ modal, setModal, onCreated }: Props) {
  const set = (patch: Partial<AddCustomerState>) => setModal(m => (m ? { ...m, ...patch } : m));

  const save = async () => {
    if (!modal.name.trim()) { toast('Name is required'); return; }
    set({ isSaving: true });
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modal.name.trim(), mobile: modal.mobile, address: modal.address, contact: modal.contact, email: modal.email }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        toast(body.error || 'Could not add the customer.', 'error');
        set({ isSaving: false });
        return;
      }
      const { id } = await res.json();
      const refreshed = await fetch(`/api/customers?_t=${Date.now()}`);
      if (refreshed.ok) {
        const data = await refreshed.json();
        if (Array.isArray(data)) {
          const created = data.find((c: any) => c.id === id);
          if (created) onCreated(created, data);
        }
      }
      setModal(null);
    } catch {
      set({ isSaving: false });
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="Add to Customer DB" className="fixed inset-0 z-[10000] flex items-center justify-center print:hidden" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-emerald-600 to-teal-600">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-white" />
            <h2 className="text-white font-bold text-base">Add to Customer DB</h2>
          </div>
          <button onClick={() => setModal(null)} aria-label="Close" className="text-white/70 hover:text-white text-xl leading-none">&times;</button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label htmlFor="ac-name" className="block text-xs font-semibold text-gray-500 mb-1">Customer Name</label>
            <input id="ac-name" type="text" autoFocus className={inputClass} value={modal.name} onChange={e => set({ name: e.target.value })} placeholder="Company or Individual Name" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="ac-mobile" className="block text-xs font-semibold text-gray-500 mb-1">Mobile</label>
              <input id="ac-mobile" type="text" className={inputClass} value={modal.mobile} onChange={e => set({ mobile: e.target.value })} />
            </div>
            <div>
              <label htmlFor="ac-contact" className="block text-xs font-semibold text-gray-500 mb-1">Contact Person</label>
              <input id="ac-contact" type="text" className={inputClass} value={modal.contact} onChange={e => set({ contact: e.target.value })} />
            </div>
          </div>
          <div>
            <label htmlFor="ac-email" className="block text-xs font-semibold text-gray-500 mb-1">Email</label>
            <input id="ac-email" type="text" className={inputClass} value={modal.email} onChange={e => set({ email: e.target.value })} />
          </div>
          <div>
            <label htmlFor="ac-address" className="block text-xs font-semibold text-gray-500 mb-1">Address</label>
            <textarea id="ac-address" rows={2} className={inputClass} value={modal.address} onChange={e => set({ address: e.target.value })} />
          </div>
        </div>
        <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
          <button onClick={() => setModal(null)} className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors">Cancel</button>
          <button disabled={modal.isSaving} onClick={save} className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm font-bold flex items-center gap-2 disabled:opacity-70">
            {modal.isSaving ? 'Saving...' : 'Save & Select'}
          </button>
        </div>
      </div>
    </div>
  );
}
