import React, { useCallback, useEffect, useState } from 'react';
import { Wallet, Trash2, Plus, Loader2 } from 'lucide-react';
import { toast, confirmAsync } from '../lib/notify';
import { formatMoney } from '../lib/money';

interface Payment { id: number; amount: number; paid_on: string; method: string | null; note: string | null; created_by: string | null }
interface Summary { payments: Payment[]; total: number; paid: number; due: number; settled: boolean }

const METHODS = ['Bank transfer', 'Cash', 'Cheque', 'Card', 'Other'];

/** Payments received against a document: add, remove, and see the balance. Shown in the Tracking history drawer. */
export default function PaymentsPanel({ quoteId, currency = 'SAR', onChanged }: { quoteId: string; currency?: string; onChanged?: () => void }) {
  const [data, setData] = useState<Summary | null>(null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState(METHODS[0]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/quotes/${encodeURIComponent(quoteId)}/payments`);
      if (res.ok) setData(await res.json());
      else setError('Could not load payments.');
    } catch { setError('Network error while loading payments.'); }
  }, [quoteId]);
  useEffect(() => { setData(null); setError(''); load(); }, [load]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(amount);
    if (!(value > 0)) { setError('Enter an amount greater than 0.'); return; }
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/quotes/${encodeURIComponent(quoteId)}/payments`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: value, paid_on: date, method, note }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setError(body.error || body.details?.join('; ') || 'Could not add the payment.'); return; }
      setData(body); setAmount(''); setNote('');
      toast('Payment recorded.', 'success');
      onChanged?.();
    } finally { setBusy(false); }
  };

  const remove = async (id: number) => {
    if (!await confirmAsync('Remove this payment?', { danger: true })) return;
    const res = await fetch(`/api/quotes/${encodeURIComponent(quoteId)}/payments/${id}`, { method: 'DELETE' });
    if (res.ok) { setData(await res.json()); onChanged?.(); } else toast('Could not remove the payment.', 'error');
  };

  return (
    <section aria-labelledby="pay-title" className="px-6 py-4 border-b border-gray-200">
      <h4 id="pay-title" className="text-sm font-bold text-gray-800 flex items-center gap-2 mb-2"><Wallet size={16} className="text-emerald-600" /> Payments</h4>
      {!data && !error && <Loader2 className="animate-spin text-indigo-600" size={16} />}
      {error && <p role="alert" className="text-xs text-red-600 mb-2">{error}</p>}
      {data && (
        <>
          <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
            <div className="bg-gray-50 rounded p-2"><div className="text-gray-500">Total</div><div className="font-mono font-bold">{formatMoney(data.total, currency)}</div></div>
            <div className="bg-emerald-50 rounded p-2"><div className="text-emerald-700">Paid</div><div className="font-mono font-bold text-emerald-800">{formatMoney(data.paid, currency)}</div></div>
            <div className={`rounded p-2 ${data.settled ? 'bg-emerald-100' : 'bg-amber-50'}`}><div className={data.settled ? 'text-emerald-700' : 'text-amber-700'}>{data.settled ? 'Settled' : 'Balance due'}</div><div className="font-mono font-bold">{formatMoney(data.due, currency)}</div></div>
          </div>
          {data.payments.length > 0 && (
            <ul className="divide-y divide-gray-100 border border-gray-200 rounded mb-3 text-xs">
              {data.payments.map(p => (
                <li key={p.id} className="flex items-center justify-between gap-2 p-2">
                  <div className="min-w-0">
                    <span className="font-mono font-bold">{formatMoney(p.amount, currency)}</span>
                    <span className="text-gray-500"> · {p.paid_on}{p.method ? ` · ${p.method}` : ''}</span>
                    {p.note && <div className="text-gray-400 truncate" title={p.note}>{p.note}</div>}
                  </div>
                  <button onClick={() => remove(p.id)} aria-label={`Remove payment of ${p.amount}`} className="p-1 text-red-500 hover:bg-red-50 rounded shrink-0"><Trash2 size={14} /></button>
                </li>
              ))}
            </ul>
          )}
          {!data.settled && (
            <form onSubmit={add} className="grid grid-cols-2 gap-2 text-xs">
              <input aria-label="Amount" inputMode="decimal" placeholder={`Amount (max ${data.due.toFixed(2)})`} value={amount} onChange={e => setAmount(e.target.value)} className="border border-gray-300 rounded px-2 py-1.5" />
              <input aria-label="Payment date" type="date" value={date} onChange={e => setDate(e.target.value)} className="border border-gray-300 rounded px-2 py-1.5" />
              <select aria-label="Payment method" value={method} onChange={e => setMethod(e.target.value)} className="border border-gray-300 rounded px-2 py-1.5 bg-white">{METHODS.map(m => <option key={m}>{m}</option>)}</select>
              <input aria-label="Note" placeholder="Note (optional)" value={note} onChange={e => setNote(e.target.value)} maxLength={300} className="border border-gray-300 rounded px-2 py-1.5" />
              <button type="submit" disabled={busy} className="col-span-2 inline-flex items-center justify-center gap-1 bg-emerald-600 text-white rounded py-1.5 font-semibold hover:bg-emerald-700 disabled:opacity-50"><Plus size={14} /> Add payment</button>
            </form>
          )}
        </>
      )}
    </section>
  );
}
