import React, { useState, useEffect } from 'react';
import { X, ArrowRight, Loader2 } from 'lucide-react';

interface DiffViewerProps {
  baseQuoteId: string;
  onClose: () => void;
}

export default function QuoteDiffViewer({ baseQuoteId, onClose }: DiffViewerProps) {
  const [versions, setVersions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [v1, setV1] = useState<string>('');
  const [v2, setV2] = useState<string>('');

  useEffect(() => {
    const fetchVersions = async () => {
      try {
        const res = await fetch(`/api/quotes/${baseQuoteId}/versions`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        });
        if (res.ok) {
          const data = await res.json();
          setVersions(data);
          if (data.length >= 2) {
            setV1(data[data.length - 2].quote_id); // Second to last
            setV2(data[data.length - 1].quote_id); // Latest
          } else if (data.length === 1) {
            setV1(data[0].quote_id);
            setV2(data[0].quote_id);
          }
        }
      } catch (err) {
        console.error('Failed to fetch versions', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchVersions();
  }, [baseQuoteId]);

  const doc1 = versions.find(v => v.quote_id === v1);
  const doc2 = versions.find(v => v.quote_id === v2);

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg flex items-center gap-2">
          <Loader2 className="animate-spin text-indigo-600" /> Loading versions...
        </div>
      </div>
    );
  }

  if (versions.length < 2) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg max-w-md w-full relative">
          <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
          <h2 className="text-lg font-bold mb-2">Notice</h2>
          <p className="text-gray-600">This quote has no previous revisions to compare.</p>
        </div>
      </div>
    );
  }

  const renderComparisonRow = (label: string, val1: any, val2: any, isCurrency = false) => {
    const format = (v: any) => {
      if (isCurrency) return typeof v === 'number' ? `SAR ${v.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : v;
      return v;
    };
    const changed = val1 !== val2;
    
    return (
      <tr className="border-b border-gray-100">
        <td className="py-2 text-sm font-medium text-gray-500 w-1/4">{label}</td>
        <td className={`py-2 text-sm w-3/8 ${changed ? 'bg-red-50 text-red-700' : 'text-gray-800'}`}>
          {format(val1)}
        </td>
        <td className={`py-2 text-sm w-3/8 ${changed ? 'bg-green-50 text-green-700 font-medium' : 'text-gray-800'}`}>
          {format(val2)}
        </td>
      </tr>
    );
  };

  const mapItems = (items1: any[], items2: any[]) => {
    const all = [];
    const maxLen = Math.max(items1.length, items2.length);
    for (let i = 0; i < maxLen; i++) {
      all.push({
        i1: items1[i] || null,
        i2: items2[i] || null
      });
    }
    return all;
  };

  const itemPairs = (doc1 && doc2) ? mapItems(doc1.items, doc2.items) : [];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50 shrink-0">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            Quote Version Diff
          </h2>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <select 
                value={v1} 
                onChange={e => setV1(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {versions.map(v => <option key={v.quote_id} value={v.quote_id}>{v.quote_id}</option>)}
              </select>
              <ArrowRight size={16} className="text-gray-400" />
              <select 
                value={v2} 
                onChange={e => setV2(e.target.value)}
                className="border border-gray-300 rounded px-2 py-1 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {versions.map(v => <option key={v.quote_id} value={v.quote_id}>{v.quote_id}</option>)}
              </select>
            </div>
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content */}
        {doc1 && doc2 && (
          <div className="flex-1 overflow-auto p-6 flex flex-col gap-8">
            
            {/* Header Data Diff */}
            <section>
              <h3 className="text-md font-bold text-indigo-900 mb-3 uppercase tracking-wider">Document Details</h3>
              <table className="w-full text-left">
                <tbody>
                  {renderComparisonRow('Date', doc1.date, doc2.date)}
                  {renderComparisonRow('Status', doc1.status, doc2.status)}
                  {renderComparisonRow('Subject', doc1.subject, doc2.subject)}
                  {renderComparisonRow('Total Amount', doc1.grand_total, doc2.grand_total, true)}
                </tbody>
              </table>
            </section>

            {/* Line Items Diff */}
            <section>
              <h3 className="text-md font-bold text-indigo-900 mb-3 uppercase tracking-wider">Line Items</h3>
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-sm">
                  <thead className="bg-gray-100 border-b border-gray-200 text-gray-600">
                    <tr>
                      <th className="py-2 px-3 font-medium border-r w-1/2">Older Version ({v1})</th>
                      <th className="py-2 px-3 font-medium w-1/2">Newer Version ({v2})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemPairs.map((pair, idx) => {
                      const isEmpty1 = !pair.i1;
                      const isEmpty2 = !pair.i2;
                      const changedDesc = pair.i1?.description !== pair.i2?.description;
                      const changedQty = pair.i1?.qty !== pair.i2?.qty;
                      const changedPrice = pair.i1?.unit_price !== pair.i2?.unit_price;

                      return (
                        <tr key={idx} className="border-b border-gray-200 last:border-0 hover:bg-gray-50">
                          {/* Column 1 */}
                          <td className={`p-3 align-top border-r ${isEmpty2 && !isEmpty1 ? 'bg-red-50' : ''}`}>
                            {!isEmpty1 ? (
                              <div className="space-y-1">
                                <p className={`font-medium ${changedDesc ? 'text-red-700' : 'text-gray-800'}`}>{pair.i1.description}</p>
                                <div className="text-xs text-gray-500 flex gap-4">
                                  <span className={changedQty ? 'text-red-600 font-bold' : ''}>Qty: {pair.i1.qty}</span>
                                  <span className={changedPrice ? 'text-red-600 font-bold' : ''}>Price: SAR {pair.i1.unit_price}</span>
                                </div>
                              </div>
                            ) : <span className="text-gray-400 italic">No item at this row</span>}
                          </td>
                          {/* Column 2 */}
                          <td className={`p-3 align-top ${isEmpty1 && !isEmpty2 ? 'bg-green-50' : ''}`}>
                            {!isEmpty2 ? (
                              <div className="space-y-1">
                                <p className={`font-medium ${changedDesc ? 'text-green-700' : 'text-gray-800'}`}>{pair.i2.description}</p>
                                <div className="text-xs text-gray-500 flex gap-4">
                                  <span className={changedQty ? 'text-green-600 font-bold' : ''}>Qty: {pair.i2.qty}</span>
                                  <span className={changedPrice ? 'text-green-600 font-bold' : ''}>Price: SAR {pair.i2.unit_price}</span>
                                </div>
                              </div>
                            ) : <span className="text-gray-400 italic">Item removed</span>}
                          </td>
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
    </div>
  );
}
