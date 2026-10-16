import React, { useEffect, useState } from 'react';
import { CheckCircle2, XCircle, Download, Loader2, AlertCircle } from 'lucide-react';
import { formatMoney } from '../lib/money';

interface PublicQuote {
  company: { name: string; logo: string | null };
  quote: {
    quote_id: string; type: string; date: string; expiry_date: string | null; subject: string | null; customer_name: string | null;
    currency: string; vat_rate: number; subtotal: number; discount: number; tax: number; grand_total: number; status: string;
  };
  items: Array<{ description: string; description_ar: string | null; qty: number; unit: string | null; unit_price: number; net_price: number }>;
  terms: Array<{ label: string; text: string }>;
  expired: boolean;
  canRespond: boolean;
  decision: { decision: string; signer_name: string | null; responded_at: string | null } | null;
}

/** Public page a client opens from an approval link: review the document, download the PDF, accept or decline. No login. */
export default function ApprovalPage({ token }: { token: string }) {
  const [data, setData] = useState<PublicQuote | null>(null);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [consent, setConsent] = useState(false);
  const [mode, setMode] = useState<'accept' | 'reject' | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [done, setDone] = useState<'accepted' | 'rejected' | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/public/quotes/${encodeURIComponent(token)}`);
        const body = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok) setError(body.error || 'This link is not valid.');
        else setData(body);
      } catch { if (!cancelled) setError('Could not load this document. Please check your connection and try again.'); }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const respond = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mode) return;
    setBusy(true); setFormError('');
    try {
      const res = await fetch(`/api/public/quotes/${encodeURIComponent(token)}/respond`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: mode, name, reason, consent }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setFormError(body.details?.join('; ') || body.error || 'Something went wrong. Please try again.'); return; }
      setDone(mode === 'accept' ? 'accepted' : 'rejected');
    } catch { setFormError('Network error. Please try again.'); } finally { setBusy(false); }
  };

  if (error) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div role="alert" className="bg-white rounded-2xl shadow p-8 max-w-md text-center">
          <AlertCircle className="mx-auto text-amber-500 mb-3" size={40} aria-hidden="true" />
          <h1 className="text-xl font-bold text-gray-800 mb-2">Link unavailable</h1>
          <p className="text-gray-600">{error}</p>
        </div>
      </main>
    );
  }
  if (!data) {
    return <main className="min-h-screen bg-gray-50 flex items-center justify-center"><Loader2 className="animate-spin text-indigo-600" size={32} aria-label="Loading" /></main>;
  }

  const { quote: q, company } = data;
  const cur = q.currency || 'SAR';
  const decided = done || (data.decision ? (data.decision.decision === 'rejected' ? 'rejected' : 'accepted') : null);

  return (
    <main className="min-h-screen bg-gray-50 py-6 px-3 sm:px-6" dir="auto">
      <div className="max-w-3xl mx-auto space-y-4">
        <header className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 flex items-center gap-4">
          {company.logo && <img src={company.logo} alt="" className="h-12 w-auto object-contain" />}
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 truncate">{company.name}</h1>
            <p className="text-sm text-gray-500">{q.type} {q.quote_id}{q.customer_name ? ` · for ${q.customer_name}` : ''}</p>
          </div>
        </header>

        {decided && (
          <div role="status" className={`rounded-2xl p-5 flex items-start gap-3 border ${decided === 'accepted' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-gray-100 border-gray-300 text-gray-800'}`}>
            {decided === 'accepted' ? <CheckCircle2 className="text-emerald-600 shrink-0" aria-hidden="true" /> : <XCircle className="text-gray-500 shrink-0" aria-hidden="true" />}
            <div>
              <p className="font-semibold">{decided === 'accepted' ? 'Thank you! This document has been accepted.' : 'This document was declined.'}</p>
              {(data.decision?.signer_name || (done && name)) && <p className="text-sm">Recorded for {data.decision?.signer_name || name}. We will be in touch shortly.</p>}
            </div>
          </div>
        )}

        <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
          {q.subject && <h2 className="font-semibold text-gray-800 mb-1">{q.subject}</h2>}
          <p className="text-sm text-gray-500 mb-4">Date {String(q.date).slice(0, 10)}{q.expiry_date ? ` · Valid until ${String(q.expiry_date).slice(0, 10)}` : ''}{data.expired ? ' (expired)' : ''}</p>
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm text-left">
              <thead className="text-gray-500 border-b border-gray-200">
                <tr><th className="py-2 px-2 font-medium">Description</th><th className="py-2 px-2 font-medium text-right">Qty</th><th className="py-2 px-2 font-medium text-right">Unit price</th><th className="py-2 px-2 font-medium text-right">Total</th></tr>
              </thead>
              <tbody>
                {data.items.map((it, i) => (
                  <tr key={i} className="border-b border-gray-100 align-top">
                    <td className="py-2 px-2"><div>{it.description}</div>{it.description_ar && <div dir="rtl" className="text-gray-500">{it.description_ar}</div>}</td>
                    <td className="py-2 px-2 text-right whitespace-nowrap">{it.qty}{it.unit ? ` ${it.unit}` : ''}</td>
                    <td className="py-2 px-2 text-right font-mono whitespace-nowrap">{formatMoney(it.unit_price, cur)}</td>
                    <td className="py-2 px-2 text-right font-mono whitespace-nowrap">{formatMoney(it.net_price, cur)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
            <div className="flex justify-between"><dt className="text-gray-500">Subtotal</dt><dd className="font-mono">{formatMoney(q.subtotal, cur)}</dd></div>
            {q.discount > 0 && <div className="flex justify-between"><dt className="text-gray-500">Discount</dt><dd className="font-mono">-{formatMoney(q.discount, cur)}</dd></div>}
            <div className="flex justify-between"><dt className="text-gray-500">VAT ({q.vat_rate}%)</dt><dd className="font-mono">{formatMoney(q.tax, cur)}</dd></div>
            <div className="flex justify-between text-base font-bold border-t border-gray-200 pt-2"><dt>Total</dt><dd className="font-mono">{formatMoney(q.grand_total, cur)}</dd></div>
          </dl>
        </section>

        {data.terms.length > 0 && (
          <section className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 space-y-3 text-sm">
            {data.terms.map(t => <div key={t.label}><h3 className="font-semibold text-gray-700">{t.label}</h3><p className="text-gray-600 whitespace-pre-line">{t.text}</p></div>)}
          </section>
        )}

        <div className="flex flex-wrap gap-3">
          <a href={`/api/public/quotes/${encodeURIComponent(token)}/pdf`} className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50">
            <Download size={16} aria-hidden="true" /> Download PDF
          </a>
        </div>

        {data.canRespond && !decided && (
          <section aria-labelledby="respond-title" className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5">
            <h2 id="respond-title" className="font-bold text-gray-800 mb-3">Your decision</h2>
            {!mode ? (
              <div className="flex flex-wrap gap-3">
                <button onClick={() => setMode('accept')} disabled={data.expired} className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-50">Accept</button>
                <button onClick={() => setMode('reject')} className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50">Decline</button>
                {data.expired && <p className="text-sm text-amber-700 w-full">This offer has expired, so it can no longer be accepted online. Please contact us.</p>}
              </div>
            ) : (
              <form onSubmit={respond} className="space-y-3">
                <div>
                  <label htmlFor="ap-name" className="block text-sm font-medium text-gray-700 mb-1">Type your full name to sign</label>
                  <input id="ap-name" value={name} onChange={e => setName(e.target.value)} autoComplete="name" required minLength={2} maxLength={120}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 outline-none" />
                </div>
                {mode === 'reject' && (
                  <div>
                    <label htmlFor="ap-reason" className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
                    <textarea id="ap-reason" value={reason} onChange={e => setReason(e.target.value)} rows={2} maxLength={500} className="w-full border border-gray-300 rounded-lg px-3 py-2" />
                  </div>
                )}
                <label className="flex items-start gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} className="mt-1" required />
                  <span>I confirm that I am authorised to {mode === 'accept' ? 'accept' : 'decline'} this {q.type.toLowerCase()} on behalf of {q.customer_name || 'the customer'}.</span>
                </label>
                {formError && <p role="alert" className="text-sm text-red-600">{formError}</p>}
                <div className="flex gap-3">
                  <button type="submit" disabled={busy || !consent || name.trim().length < 2} className={`px-5 py-2.5 rounded-lg font-semibold text-white disabled:opacity-50 ${mode === 'accept' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-gray-700 hover:bg-gray-800'}`}>
                    {busy ? 'Sending…' : mode === 'accept' ? 'Confirm acceptance' : 'Confirm decline'}
                  </button>
                  <button type="button" onClick={() => { setMode(null); setFormError(''); }} className="px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700">Back</button>
                </div>
              </form>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
