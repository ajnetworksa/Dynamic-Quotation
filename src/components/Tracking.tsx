import { useState, useEffect } from 'react';
import { Trash2, FileText, Search, X, Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Quote {
  id: number;
  quote_id: string;
  date: string;
  customer_name: string;
  subject: string;
  grand_total: number;
  status?: string;
  type?: string;
  revision_of?: string;
  updated_at?: string;
}

const STATUS_BADGE: Record<string, string> = {
  Accepted: 'bg-green-100 text-green-800',
  Rejected: 'bg-red-100 text-red-800',
  Sent: 'bg-yellow-100 text-yellow-800',
  Draft: 'bg-gray-100 text-gray-800',
};

export default function Tracking() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => { fetchQuotes(); }, []);

  const fetchQuotes = async () => {
    const res = await fetch('/api/quotes');
    const data = await res.json();
    setQuotes(data);
  };

  const handleRecall = (quote_id: string) => navigate(`/quote?recall=${quote_id}`);

  const q = search.toLowerCase();
  const filtered = quotes.filter(quote => {
    const matchSearch = !q ||
      quote.quote_id?.toLowerCase().includes(q) ||
      quote.customer_name?.toLowerCase().includes(q) ||
      quote.subject?.toLowerCase().includes(q) ||
      quote.status?.toLowerCase().includes(q) ||
      quote.type?.toLowerCase().includes(q);
    const matchStatus = !statusFilter || (quote.status || 'Draft') === statusFilter;
    const matchType = !typeFilter || (quote.type || 'Quotation') === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  const clearFilters = () => { setSearch(''); setStatusFilter(''); setTypeFilter(''); };
  const hasFilters = search || statusFilter || typeFilter;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-200 bg-gray-50">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-semibold text-gray-800">Quotation Records</h2>
            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full">
              {filtered.length} / {quotes.length}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            {/* Text Search */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search records…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 pr-8 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-52"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Status Filter */}
            <div className="relative">
              <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="pl-8 pr-7 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none appearance-none bg-white cursor-pointer"
              >
                <option value="">All Statuses</option>
                <option value="Draft">Draft</option>
                <option value="Sent">Sent</option>
                <option value="Accepted">Accepted</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>

            {/* Type Filter */}
            <div className="relative">
              <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="pl-8 pr-7 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none appearance-none bg-white cursor-pointer"
              >
                <option value="">All Types</option>
                <option value="Quotation">Quotation</option>
                <option value="Tax Invoice">Tax Invoice</option>
                <option value="Proforma Invoice">Proforma Invoice</option>
              </select>
            </div>

            {/* Clear */}
            {hasFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 text-sm text-red-500 hover:text-red-700 font-medium"
              >
                <X size={14} /> Clear
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-100 text-gray-600 text-sm uppercase tracking-wider">
              <th className="p-4 border-b">Document ID</th>
              <th className="p-4 border-b">Type</th>
              <th className="p-4 border-b">Status</th>
              <th className="p-4 border-b">Date</th>
              <th className="p-4 border-b">Customer</th>
              <th className="p-4 border-b">Subject</th>
              <th className="p-4 border-b">Total Amount</th>
              <th className="p-4 border-b">Last Modified</th>
              <th className="p-4 border-b text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filtered.map((quote) => (
              <tr key={quote.id} className="hover:bg-gray-50 transition-colors">
                <td className="p-4 font-medium text-indigo-600">
                  {quote.quote_id}
                  {quote.revision_of && <span className="block text-xs text-gray-400">Rev of: {quote.revision_of}</span>}
                </td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${quote.type === 'Tax Invoice' ? 'bg-purple-100 text-purple-800' : quote.type === 'Proforma Invoice' ? 'bg-teal-100 text-teal-800' : 'bg-blue-100 text-blue-800'}`}>
                    {quote.type || 'Quotation'}
                  </span>
                </td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${STATUS_BADGE[quote.status || 'Draft'] || STATUS_BADGE.Draft}`}>
                    {quote.status || 'Draft'}
                  </span>
                </td>
                <td className="p-4 text-gray-600">{quote.date}</td>
                <td className="p-4 font-medium text-gray-900">{quote.customer_name}</td>
                <td className="p-4 text-gray-600 truncate max-w-[200px]" title={quote.subject}>{quote.subject}</td>
                <td className="p-4 font-mono font-medium text-gray-900">{quote.grand_total?.toFixed(2)}</td>
                <td className="p-4 text-gray-500 text-sm">
                  {quote.updated_at ? new Date(quote.updated_at).toLocaleString() : '-'}
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => handleRecall(quote.quote_id)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                      title="Open in Form"
                    >
                      <FileText size={16} /> Open
                    </button>
                    {user.role === 'admin' && (
                      <button
                        onClick={async () => {
                          if (!confirm('Are you sure you want to delete this record?')) return;
                          await fetch(`/api/quotes/${quote.quote_id}`, { method: 'DELETE' });
                          fetchQuotes();
                        }}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Record"
                      >
                        <Trash2 size={18} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="p-8 text-center text-gray-400">
                  {hasFilters ? 'No records match your search/filters.' : 'No records yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
