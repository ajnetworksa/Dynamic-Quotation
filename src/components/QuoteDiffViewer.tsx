import React, { useState, useEffect, useRef } from 'react';
import { X, ArrowRight, Loader2 } from 'lucide-react';
import { matchItems, sameValue } from '../lib/quoteDiff';
import { formatMoney } from '../lib/money';

interface DiffViewerProps {
  baseQuoteId: string;
  onClose: () => void;
}

// Small modal shell: dialog semantics, Escape closes, focus moves in and returns to the opener.
function Modal({ labelledBy, onClose, children }: { labelledBy: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); opener?.focus?.(); };
  }, [onClose]);
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={labelledBy} className="outline-none w-full flex justify-center">
        {children}
      </div>
    </div>
  );
}

export default function QuoteDiffViewer({ baseQuoteId, onClose }: DiffViewerProps) {
  const [versions, setVersions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [v1, setV1] = useState<string>('');
  const [v2, setV2] = useState<string>('');

  useEffect(() => {
    const controller = new AbortController();
    const fetchVersions = async () => {
      try {
        const res = await fetch(`/api/quotes/${baseQuoteId}/versions`, { signal: controller.signal });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.error || `Could not load versions (${res.status}).`);
          return;
        }
        const data = await res.json();
        // Order by revision number so "older -> newer" is right even if IDs sort oddly.
        const rev = (id: string) => { const m = String(id).match(/-R(\d+)$/); return m ? parseInt(m[1], 10) : 0; };
        const sorted = [...data].sort((a: any, b: any) => rev(a.quote_id) - rev(b.quote_id));
        setVersions(sorted);
        if (sorted.length >= 2) {
          setV1(sorted[sorted.length - 2].quote_id); // second to last
          setV2(sorted[sorted.length - 1].quote_id); // latest
        }
      } catch (err: any) {
        if (err?.name !== 'AbortError') setError('Network error while loading versions.');
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };
    fetchVersions();
    return () => controller.abort();
  }, [baseQuoteId]);

  const doc1 = versions.find(v => v.quote_id === v1);
  const doc2 = versions.find(v => v.quote_id === v2);

  if (isLoading) {
    return (
      <Modal labelledBy="diff-title" onClose={onClose}>
        <div className="bg-white p-6 rounded-lg flex items-center gap-2" id="diff-title">
          <Loader2 className="animate-spin text-indigo-600" /> Loading versions...
        </div>
      </Modal>
    );
  }

  if (error || versions.length < 2) {
    return (
      <Modal labelledBy="diff-title" onClose={onClose}>
        <div className="bg-white p-6 rounded-lg max-w-md w-full relative">
          <button onClick={onClose} aria-label="Close" className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
          <h2 id="diff-title" className="text-lg font-bold mb-2">{error ? 'Could not compare' : 'Notice'}</h2>
          <p className="text-gray-600">{error || 'This quote has no previous revisions to compare.'}</p>
        </div>
      </Modal>
    );
  }

  const cur1 = doc1?.currency || 'SAR';
  const cur2 = doc2?.currency || 'SAR';
  const money = (v: any, cur: string) => (typeof v === 'number' ? formatMoney(v, cur) : v ?? '—');

  const renderComparisonRow = (label: string, val1: any, val2: any, isCurrency = false) => {
    const changed = !sameValue(val1, val2);
    const show = (v: any, cur: string) => (isCurrency ? money(v, cur) : (v === null || v === undefined || v === '' ? '—' : String(v)));
    return (
      <tr className="border-b border-gray-100">
        <th scope="row" className="py-2 text-sm font-medium text-gray-500 w-1/4 text-left">{label}</th>
        <td className={`py-2 px-2 text-sm w-[37.5%] ${changed ? 'bg-red-50 text-red-700' : 'text-gray-800'}`}>{show(val1, cur1)}</td>
        <td className={`py-2 px-2 text-sm w-[37.5%] ${changed ? 'bg-green-50 text-green-700 font-medium' : 'text-gray-800'}`}>{show(val2, cur2)}</td>
      </tr>
    );
  };

  const itemPairs = (doc1 && doc2) ? matchItems(doc1.items || [], doc2.items || []) : [];
  const changedCount = itemPairs.filter(p => p.status !== 'same').length;

  return (
    <Modal labelledBy="diff-title" onClose={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 shrink-0 flex-wrap gap-3">
          <h2 id="diff-title" className="text-lg font-bold text-gray-800 flex items-center gap-2">
            Quote Version Diff
          </h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <select
                aria-label="Older version"
                value={v1}
                onChange={e => setV1(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {versions.map(v => <option key={v.quote_id} value={v.quote_id}>{v.quote_id}</option>)}
              </select>
              <ArrowRight size={16} className="text-gray-400" aria-hidden="true" />
              <select
                aria-label="Newer version"
                value={v2}
                onChange={e => setV2(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {versions.map(v => <option key={v.quote_id} value={v.quote_id}>{v.quote_id}</option>)}
              </select>
            </div>
            <button onClick={onClose} aria-label="Close" className="p-1 text-gray-400 hover:text-gray-600 rounded">
              <X size={24} />
            </button>
          </div>
        </div>

        {v1 === v2 && (
          <p role="status" className="px-6 pt-4 text-sm text-amber-700">You selected the same version on both sides, so nothing differs.</p>
        )}

        {/* Content */}
        {doc1 && doc2 && (
          <div className="flex-1 overflow-auto p-6 flex flex-col gap-8">

            {/* Header Data Diff */}
            <section>
              <h3 className="text-md font-bold text-indigo-900 mb-3 uppercase tracking-wider">Document Details</h3>
              <table className="w-full text-left">
                <tbody>
                  {renderComparisonRow('Date', doc1.date, doc2.date)}
                  {renderComparisonRow('Expiry', doc1.expiry_date, doc2.expiry_date)}
                  {renderComparisonRow('Status', doc1.status, doc2.status)}
                  {renderComparisonRow('Customer', doc1.customer_name, doc2.customer_name)}
                  {renderComparisonRow('Subject', doc1.subject, doc2.subject)}
                  {renderComparisonRow('Subtotal', doc1.subtotal, doc2.subtotal, true)}
                  {renderComparisonRow('Discount', doc1.discount, doc2.discount, true)}
                  {renderComparisonRow('VAT rate (%)', doc1.vat_rate, doc2.vat_rate)}
                  {renderComparisonRow('VAT', doc1.tax, doc2.tax, true)}
                  {renderComparisonRow('Total Amount', doc1.grand_total, doc2.grand_total, true)}
                  {renderComparisonRow('Payment terms', doc1.payment, doc2.payment)}
                  {renderComparisonRow('Warranty', doc1.warranty, doc2.warranty)}
                  {renderComparisonRow('Note', doc1.note, doc2.note)}
                </tbody>
              </table>
            </section>

            {/* Line Items Diff */}
            <section>
              <h3 className="text-md font-bold text-indigo-900 mb-1 uppercase tracking-wider">Line Items</h3>
              <p className="text-xs text-gray-500 mb-3">{changedCount} of {itemPairs.length} line(s) differ. Lines are matched by item code or description, not by row position.</p>
              <div className="border border-gray-200 rounded-lg overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-100 border-b border-gray-200 text-gray-600">
                    <tr>
                      <th className="py-2 px-3 font-medium border-r w-1/2">Older Version ({v1})</th>
                      <th className="py-2 px-3 font-medium w-1/2">Newer Version ({v2})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemPairs.map((pair, idx) => {
                      const { i1, i2, changed, status } = pair;
                      const cell = (it: any, side: 'old' | 'new', cur: string) => it ? (
                        <div className="space-y-1">
                          <p className={`font-medium ${changed.description ? (side === 'old' ? 'text-red-700' : 'text-green-700') : 'text-gray-800'}`}>{it.description}</p>
                          <div className="text-xs text-gray-500 flex gap-4 flex-wrap">
                            <span className={changed.qty ? (side === 'old' ? 'text-red-600 font-bold' : 'text-green-600 font-bold') : ''}>Qty: {it.qty}{it.unit ? ` ${it.unit}` : ''}</span>
                            <span className={changed.price ? (side === 'old' ? 'text-red-600 font-bold' : 'text-green-600 font-bold') : ''}>Price: {formatMoney(Number(it.unit_price) || 0, cur)}</span>
                          </div>
                        </div>
                      ) : <span className="text-gray-400 italic">{side === 'old' ? 'Not in this version' : 'Removed'}</span>;
                      return (
                        <tr key={idx} className="border-b border-gray-200 last:border-0 hover:bg-gray-50">
                          <td className={`p-3 align-top border-r ${status === 'removed' ? 'bg-red-50' : ''}`}>{cell(i1, 'old', cur1)}</td>
                          <td className={`p-3 align-top ${status === 'added' ? 'bg-green-50' : ''}`}>{cell(i2, 'new', cur2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

          </div>
        )}
      </div>
    </Modal>
  );
}
