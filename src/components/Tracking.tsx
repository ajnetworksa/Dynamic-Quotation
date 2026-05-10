import React, { useState, useEffect, useRef } from 'react';
import { Trash2, FileText, Search, X, Filter, Download, CheckSquare, Bell, Clock, Calendar, Layers } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import QuoteDiffViewer from './QuoteDiffViewer';

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
  followup_date?: string;
  followup_note?: string;
  author_username?: string;
  author_name?: string;
}

const STATUS_BADGE: Record<string, string> = {
  Accepted: 'bg-green-100 text-green-800',
  Rejected: 'bg-red-100 text-red-800',
  Sent: 'bg-yellow-100 text-yellow-800',
  Draft: 'bg-gray-100 text-gray-800',
};

type SortKey = 'quote_id' | 'type' | 'status' | 'date' | 'customer_name' | 'grand_total' | 'updated_at' | 'author_username';
type SortDir = 'asc' | 'desc' | null;

export default function Tracking() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [creatorFilter, setCreatorFilter] = useState('');

  // Date Range
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  // Bulk Status
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState('');

  // Timeline
  const [timelineQuoteId, setTimelineQuoteId] = useState<string | null>(null);
  const [timelineData, setTimelineData] = useState<any[]>([]);
  const [timelineQuote, setTimelineQuote] = useState<any>(null);

  // Follow-up
  const [followupQuoteId, setFollowupQuoteId] = useState<string | null>(null);
  const [followupDate, setFollowupDate] = useState('');
  const [followupNote, setFollowupNote] = useState('');

  // Version Diff
  const [diffBaseId, setDiffBaseId] = useState<string | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // ── Drag-to-scroll on the table container ─────────────────────────────
  const tableScrollRef = useRef<HTMLDivElement>(null);
  const dragScroll = useRef({ active: false, startX: 0, scrollLeft: 0, hasDragged: false });

  const onDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only trigger on primary button (left click), not on interactive elements
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest('a,button,input,select,textarea,label')) return;
    const el = tableScrollRef.current;
    if (!el) return;
    dragScroll.current = { active: true, startX: e.clientX, scrollLeft: el.scrollLeft, hasDragged: false };
    el.style.cursor = 'grabbing';
    el.style.userSelect = 'none';
  };

  const onDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragScroll.current.active) return;
    const el = tableScrollRef.current;
    if (!el) return;
    const dx = e.clientX - dragScroll.current.startX;
    if (Math.abs(dx) > 5) dragScroll.current.hasDragged = true;
    el.scrollLeft = dragScroll.current.scrollLeft - dx;
  };

  const onDragEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragScroll.current.active) return;
    dragScroll.current.active = false;
    const el = tableScrollRef.current;
    if (!el) return;
    el.style.cursor = 'grab';
    el.style.userSelect = '';
  };

  const onClickCapture = (e: React.MouseEvent) => {
    if (dragScroll.current.hasDragged) {
      e.stopPropagation();
      e.preventDefault();
      dragScroll.current.hasDragged = false;
    }
  };
  // ─────────────────────────────────────────────────────────────────────
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const canSeeAll = user.role === 'admin' || !!user.permissions?.canViewAllQuotes;
  const showCreatedBy = user.role === 'admin' || !!user.permissions?.canViewCreatedBy;

  useEffect(() => {
    fetchQuotes();
    const customer = searchParams.get('customer');
    if (customer) {
      setSearch(customer);
    }
  }, [searchParams]);

  const fetchQuotes = async () => {
    try {
      const res = await fetch('/api/quotes');
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setQuotes(data);
    } catch (e) {
      console.error('Failed to fetch quotes', e);
    }
  };

  const handleRecall = (quote_id: string) => navigate(`/quote?recall=${quote_id}`);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : prev === 'desc' ? null : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const SortIcon = ({ col }: { col: SortKey }) => {
    if (sortKey !== col || !sortDir) return <span className="ml-1 text-gray-300 text-xs">⇅</span>;
    return <span className="ml-1 text-indigo-600 text-xs">{sortDir === 'asc' ? '▲' : '▼'}</span>;
  };

  const handleBulkStatusApply = async () => {
    if (!bulkStatus || selectedIds.size === 0) return;
    try {
      await fetch('/api/quotes/bulk-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), status: bulkStatus })
      });
      setSelectedIds(new Set());
      setBulkStatus('');
      fetchQuotes();
    } catch (e) {
      alert('Failed to update status.');
    }
  };

  const updateSingleStatus = async (quoteId: string, newStatus: string) => {
    try {
      await fetch('/api/quotes/bulk-status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [quoteId], status: newStatus })
      });
      setQuotes(prev => prev.map(q => q.quote_id === quoteId ? { ...q, status: newStatus } : q));
    } catch (e) {
      alert('Failed to update status.');
    }
  };

  const closeTimeline = () => { setTimelineQuoteId(null); setTimelineData([]); setTimelineQuote(null); };

  const fetchTimeline = async (id: string) => {
    try {
      const res = await fetch(`/api/quotes/${id}/timeline`);
      if (!res.ok) return;
      const data = await res.json();
      // New format: { quote, logs }
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        setTimelineData(Array.isArray(data.logs) ? data.logs : []);
        setTimelineQuote(data.quote || null);
        setTimelineQuoteId(id);
      } else if (Array.isArray(data)) {
        // Legacy fallback
        setTimelineData(data);
        setTimelineQuote(null);
        setTimelineQuoteId(id);
      }
    } catch (e) { }
  };

  const saveFollowup = async () => {
    if (!followupQuoteId) return;
    try {
      await fetch(`/api/quotes/${followupQuoteId}/followup`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followup_date: followupDate, followup_note: followupNote })
      });
      setFollowupQuoteId(null);
      fetchQuotes();
    } catch (e) { }
  };

  const exportCSV = () => {
    if (filtered.length === 0) return alert('No records to export');
    const header = showCreatedBy
      ? ['Document ID', 'Type', 'Status', 'Date', 'Customer', 'Subject', 'Total Amount', 'Last Modified', 'Created By']
      : ['Document ID', 'Type', 'Status', 'Date', 'Customer', 'Subject', 'Total Amount', 'Last Modified'];
    const rows = filtered.map(q => [
      q.quote_id, q.type || 'Quotation', q.status || 'Draft', q.date, `"${(q.customer_name || '').replace(/"/g, '""')}"`,
      `"${(q.subject || '').replace(/"/g, '""')}"`, q.grand_total, q.updated_at ? new Date(q.updated_at).toLocaleString() : '',
      ...(showCreatedBy ? [q.author_username || '—'] : [])
    ]);
    const csvContent = [header, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `quotes_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const tokens = search.toLowerCase().split(/\s+/).filter(t => t.length > 0);
  const normalize = (s: string) => s ? s.toLowerCase().replace(/[^a-z0-9]/g, '') : '';

  // Collect unique creator names for the dropdown (only for users who can see creator info)
  const creatorOptions = showCreatedBy
    ? Array.from(new Set(quotes.map(q => q.author_username).filter(Boolean))).sort() as string[]
    : [];

  let filtered = quotes.filter(quote => {
    const matchSearch = (() => {
      if (tokens.length === 0) return true;
      
      const normId = normalize(quote.quote_id);
      const normCustomer = normalize(quote.customer_name);
      const normSubject = normalize(quote.subject);

      return tokens.every(token => {
        const nToken = normalize(token);
        return (
          quote.quote_id?.toLowerCase().includes(token) ||
          quote.customer_name?.toLowerCase().includes(token) ||
          quote.subject?.toLowerCase().includes(token) ||
          quote.status?.toLowerCase().includes(token) ||
          quote.type?.toLowerCase().includes(token) ||
          (nToken && (normId.includes(nToken) || normCustomer.includes(nToken) || normSubject.includes(nToken)))
        );
      });
    })();

    const matchStatus = !statusFilter || (quote.status || 'Draft') === statusFilter;
    const matchType = !typeFilter || (quote.type || 'Quotation') === typeFilter;
    const matchDateFrom = !dateFrom || quote.date >= dateFrom;
    const matchDateTo = !dateTo || quote.date <= dateTo;
    const matchCreator = !creatorFilter || quote.author_username === creatorFilter;
    return matchSearch && matchStatus && matchType && matchDateFrom && matchDateTo && matchCreator;
  });

  if (sortKey && sortDir) {
    filtered = [...filtered].sort((a, b) => {
      let aVal: any = a[sortKey] ?? '';
      let bVal: any = b[sortKey] ?? '';

      if (sortKey === 'grand_total') {
        aVal = Number(aVal) || 0;
        bVal = Number(bVal) || 0;
      } else if (sortKey === 'date' || sortKey === 'updated_at') {
        aVal = aVal ? new Date(aVal).getTime() : 0;
        bVal = bVal ? new Date(bVal).getTime() : 0;
      } else {
        aVal = String(aVal).toLowerCase();
        bVal = String(bVal).toLowerCase();
      }

      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }

  const clearFilters = () => { setSearch(''); setStatusFilter(''); setTypeFilter(''); setDateFrom(''); setDateTo(''); setCreatorFilter(''); setCurrentPage(1); };
  const hasFilters = search || statusFilter || typeFilter || dateFrom || dateTo || creatorFilter;

  const totalPages = Math.ceil(filtered.length / rowsPerPage) || 1;
  const safePage = Math.min(currentPage, totalPages);
  const currentItems = filtered.slice((safePage - 1) * rowsPerPage, safePage * rowsPerPage);

  const thClass = "p-4 border-b cursor-pointer select-none hover:bg-gray-200 transition-colors whitespace-nowrap";

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

            {/* Date Range */}
            <div className="flex items-center gap-2 bg-white border border-gray-300 rounded-lg px-2 py-1.5 focus-within:ring-2 focus-within:ring-indigo-500">
              <Calendar size={14} className="text-gray-400 shrink-0" />
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="text-sm outline-none bg-transparent" title="From Date" />
              <span className="text-gray-400 text-xs">to</span>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="text-sm outline-none bg-transparent" title="To Date" />
            </div>

            {/* Export CSV */}
            <button onClick={exportCSV} className="flex items-center gap-1 text-sm bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 px-3 py-2 rounded-lg transition-colors font-medium">
              <Download size={14} /> Export
            </button>

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

            {/* Creator Filter — visible when canViewCreatedBy is granted */}
            {showCreatedBy && creatorOptions.length > 0 && (
              <div className="relative">
                <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <select
                  value={creatorFilter}
                  onChange={e => { setCreatorFilter(e.target.value); setCurrentPage(1); }}
                  className="pl-8 pr-7 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none appearance-none bg-white cursor-pointer"
                >
                  <option value="">All Users</option>
                  {creatorOptions.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>
            )}

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

      <div
        ref={tableScrollRef}
        className="overflow-x-auto"
        style={{ cursor: 'grab' }}
        onPointerDown={onDragStart}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        onPointerLeave={onDragEnd}
        onClickCapture={onClickCapture}
      >
        <table className="w-full text-left border-collapse min-w-max">
          <thead>
            <tr className="bg-gray-100 text-gray-600 text-sm uppercase tracking-wider">
              <th className="p-4 border-b w-10 text-center">
                <input
                  type="checkbox"
                  className="cursor-pointer"
                  checked={filtered.length > 0 && selectedIds.size === filtered.length}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedIds(new Set(filtered.map(q => q.quote_id)));
                    else setSelectedIds(new Set());
                  }}
                />
              </th>
              <th className={thClass} onClick={() => handleSort('quote_id')}>Document ID <SortIcon col="quote_id" /></th>
              <th className={thClass} onClick={() => handleSort('type')}>Type <SortIcon col="type" /></th>
              <th className={thClass} onClick={() => handleSort('status')}>Status <SortIcon col="status" /></th>
              <th className={thClass} onClick={() => handleSort('date')}>Date <SortIcon col="date" /></th>
              <th className={thClass} onClick={() => handleSort('customer_name')}>Customer <SortIcon col="customer_name" /></th>
              <th className="p-4 border-b">Subject</th>
              <th className={thClass} onClick={() => handleSort('grand_total')}>Total Amount <SortIcon col="grand_total" /></th>
              <th className={thClass} onClick={() => handleSort('updated_at')}>Last Modified <SortIcon col="updated_at" /></th>
              {showCreatedBy && <th className={thClass} onClick={() => handleSort('author_username')}>Created By <SortIcon col="author_username" /></th>}
              <th className="p-4 border-b text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {currentItems.map((quote) => {
              const formatDisplayDate = (d: any) => {
                if (!d) return '';
                const num = Number(d);
                if (!isNaN(num) && num > 20000 && num < 100000) {
                  return new Date(Math.round((num - 25569) * 86400 * 1000)).toISOString().split('T')[0];
                }
                return String(d);
              };
              const overdue = quote.followup_date && quote.followup_date < new Date().toISOString().split('T')[0] && !['Accepted', 'Rejected'].includes(quote.status || '');
              return (
                <tr 
                  key={quote.id} 
                  onClick={() => handleRecall(quote.quote_id)}
                  className={`hover:bg-gray-50 even:bg-gray-50/50 transition-colors cursor-pointer ${overdue ? 'bg-amber-50/50' : ''}`}
                >
                  <td className="p-4 text-center cursor-default" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="cursor-pointer"
                      checked={selectedIds.has(quote.quote_id)}
                      onChange={(e) => {
                        const next = new Set(selectedIds);
                        if (e.target.checked) next.add(quote.quote_id);
                        else next.delete(quote.quote_id);
                        setSelectedIds(next);
                      }}
                    />
                  </td>
                  <td className="p-4 font-medium text-indigo-600 hover:text-indigo-800 transition-colors hover:underline">
                    {quote.quote_id}
                    {quote.revision_of && <span className="block text-xs text-gray-400">Rev of: {quote.revision_of}</span>}
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${quote.type === 'Tax Invoice' ? 'bg-purple-100 text-purple-800' : quote.type === 'Proforma Invoice' ? 'bg-teal-100 text-teal-800' : 'bg-blue-100 text-blue-800'}`}>
                      {quote.type || 'Quotation'}
                    </span>
                  </td>
                  <td className="p-4 cursor-default" onClick={e => e.stopPropagation()}>
                    <select
                      value={quote.status || 'Draft'}
                      onChange={e => updateSingleStatus(quote.quote_id, e.target.value)}
                      className={`text-xs font-semibold rounded px-2 py-1 border-0 outline-none cursor-pointer appearance-none ${STATUS_BADGE[quote.status || 'Draft'] || STATUS_BADGE.Draft}`}
                    >
                      <option value="Draft">Draft</option>
                      <option value="Sent">Sent</option>
                      <option value="Accepted">Accepted</option>
                      <option value="Rejected">Rejected</option>
                    </select>
                  </td>
                  <td className="p-4 text-gray-600">
                    {formatDisplayDate(quote.date)}
                    {quote.followup_date && (
                      <div className={`text-xs mt-1 font-medium ${overdue ? 'text-amber-600' : 'text-gray-400'}`}>
                        Follow-up: {quote.followup_date}
                      </div>
                    )}
                  </td>
                  <td className="p-4 font-medium text-gray-900 cursor-text">{quote.customer_name}</td>
                  <td className="p-4 text-gray-600 truncate max-w-[200px] cursor-text" title={quote.subject}>{quote.subject}</td>
                  <td className="p-4 font-mono font-medium text-gray-900">{quote.grand_total?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td className="p-4 text-gray-500 text-sm">
                    {quote.updated_at ? new Date(quote.updated_at).toLocaleString() : '-'}
                  </td>
                  {showCreatedBy && (
                    <td className="p-4">
                      {quote.author_username || quote.author_name ? (
                        <button
                          onClick={e => { e.stopPropagation(); setCreatorFilter(creatorFilter === quote.author_username ? '' : (quote.author_username || '')); }}
                          title={`Filter by ${quote.author_username || quote.author_name}`}
                          className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold border transition-colors ${
                            creatorFilter === quote.author_username
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100'
                          }`}
                        >
                          <span className="w-5 h-5 rounded-full bg-indigo-200 text-indigo-800 flex items-center justify-center font-bold text-[10px] shrink-0">
                            {(quote.author_name || quote.author_username || '?').charAt(0).toUpperCase()}
                          </span>
                          {quote.author_name || quote.author_username}
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  )}
                  <td className="p-4 text-right cursor-default" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-end gap-2">
                      {(user?.role === 'admin' || user?.permissions?.canViewHistory) && (
                        <button
                          onClick={() => fetchTimeline(quote.quote_id)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View Timeline"
                        >
                          <Clock size={18} />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setFollowupQuoteId(quote.quote_id);
                          setFollowupDate(quote.followup_date || '');
                          setFollowupNote(quote.followup_note || '');
                        }}
                        className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                        title="Set Follow-up"
                      >
                        <Bell size={18} />
                      </button>
                      <button
                        onClick={() => handleRecall(quote.quote_id)}
                        className="flex items-center gap-1 px-3 py-1.5 text-sm bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                        title="Open in Form"
                      >
                        <FileText size={16} /> Open
                      </button>
                      <button
                        onClick={() => setDiffBaseId(quote.quote_id)}
                        className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                        title="Compare Versions"
                      >
                        <Layers size={18} />
                      </button>
                      {(user.role === 'admin' || user.permissions?.canDeleteData) && (
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
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
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={showCreatedBy ? 10 : 9} className="p-8 text-center text-gray-400">
                  {hasFilters ? 'No records match your search/filters.' : 'No records yet.'}
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

      {/* Bulk Status Sticky Bar */}
      {
        selectedIds.size > 0 && (
          <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] p-4 flex justify-between items-center z-50 animate-slide-up">
            <div className="text-gray-700 font-medium">Selected {selectedIds.size} records</div>
            <div className="flex items-center gap-3">
              <select
                value={bulkStatus}
                onChange={e => setBulkStatus(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-indigo-500"
              >
                <option value="">Update Status...</option>
                <option value="Draft">Draft</option>
                <option value="Sent">Sent</option>
                <option value="Accepted">Accepted</option>
                <option value="Rejected">Rejected</option>
              </select>
              <button
                onClick={handleBulkStatusApply}
                disabled={!bulkStatus}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                <CheckSquare size={16} /> Apply to Selected
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )
      }

      {/* History / Timeline Modal */}
      {timelineQuoteId && (
        <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-end" onClick={closeTimeline}>
          <div className="bg-white h-full w-full max-w-md shadow-2xl flex flex-col animate-slide-in-right" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Clock size={20} className="text-blue-600" />
                Quote History
                <span className="text-sm font-mono text-indigo-600 font-semibold">{timelineQuoteId}</span>
              </h3>
              <button onClick={closeTimeline} className="text-gray-400 hover:text-gray-700 transition-colors"><X size={22} /></button>
            </div>

            {/* Quote Summary Card */}
            {timelineQuote && (
              <div className="px-6 py-4 bg-indigo-50 border-b border-indigo-100 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-[10px] font-bold uppercase text-indigo-400 mb-0.5">Customer</p>
                  <p className="font-semibold text-gray-900">{timelineQuote.customer_name || '—'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-indigo-400 mb-0.5">Type</p>
                  <p className="font-semibold text-gray-900">{timelineQuote.type || 'Quotation'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-indigo-400 mb-0.5">Created By</p>
                  <div className="flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-indigo-200 text-indigo-800 text-[10px] font-bold flex items-center justify-center shrink-0">
                      {(timelineQuote.author_username || '?').charAt(0).toUpperCase()}
                    </span>
                    <span className="font-semibold text-gray-900">{timelineQuote.author_username || 'Unknown'}</span>
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-indigo-400 mb-0.5">Current Status</p>
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${STATUS_BADGE[timelineQuote.status || 'Draft'] || STATUS_BADGE.Draft}`}>
                    {timelineQuote.status || 'Draft'}
                  </span>
                </div>
              </div>
            )}

            {/* Timeline Entries */}
            <div className="flex-1 overflow-y-auto p-6">
              {timelineData.length === 0 && (
                <p className="text-gray-400 italic text-sm">No activity logs found.</p>
              )}
              {timelineData.map((log, i) => {
                const isCreate  = log.action === 'Created';
                const isStatus  = log.action?.startsWith('Status changed');
                const isDraft   = log.action?.toLowerCase().includes('draft') || log.action?.toLowerCase().includes('autosave');
                const dotClass  = isCreate  ? 'bg-green-500 border-green-300'
                                : isStatus  ? 'bg-blue-500 border-blue-300'
                                : isDraft   ? 'bg-gray-400 border-gray-300'
                                :             'bg-amber-400 border-amber-300';
                return (
                  <div key={log.id} className="relative flex gap-4 pb-7">
                    {i !== timelineData.length - 1 && (
                      <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-gray-200" />
                    )}
                    <div className={`w-6 h-6 rounded-full border-2 flex-shrink-0 z-10 mt-0.5 ${dotClass}`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm leading-tight">{log.action}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="w-4 h-4 rounded-full bg-gray-200 text-gray-700 text-[9px] font-bold flex items-center justify-center shrink-0">
                          {(log.actor || '?').charAt(0).toUpperCase()}
                        </span>
                        <span className="text-xs font-semibold text-gray-700">{log.actor || 'System'}</span>
                        <span className="text-gray-300 text-xs">•</span>
                        <span className="text-xs text-gray-500">{new Date(log.timestamp).toLocaleString()}</span>
                        
                        {(user?.role === 'admin' || user?.permissions?.canUndoQuote) && log.previous_state && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (!confirm('Are you sure you want to undo this action and restore the previous state?')) return;
                              try {
                                const res = await fetch(`/api/quotes/${timelineQuoteId}/undo/${log.id}`, { method: 'POST' });
                                if (res.ok) {
                                  alert('Quote restored successfully!');
                                  fetchTimeline(timelineQuoteId!);
                                  fetchQuotes();
                                } else {
                                  const err = await res.json();
                                  alert('Failed to undo: ' + err.error);
                                }
                              } catch (err: any) {
                                alert('Error: ' + err.message);
                              }
                            }}
                            className="ml-auto flex items-center gap-1 px-2 py-0.5 bg-red-50 hover:bg-red-100 text-red-600 rounded text-[10px] font-bold uppercase transition-colors"
                          >
                            Undo Action
                          </button>
                        )}
                      </div>
                      {/* Field-level change details */}
                      {log.details && (() => {
                        try {
                          const changes: { field: string; from: string; to: string }[] = JSON.parse(log.details);
                          if (changes.length === 0) return null;
                          return (
                            <div className="mt-2 rounded-lg border border-gray-100 bg-gray-50 overflow-hidden text-xs">
                              {changes.map((c, ci) => {
                                const isAdded   = c.field === 'Item Added';
                                const isRemoved = c.field === 'Item Removed';
                                const isChanged = c.field.startsWith('Item Changed:');
                                return (
                                  <div key={ci} className={`px-3 py-2 flex flex-col gap-0.5 ${ci > 0 ? 'border-t border-gray-100' : ''}`}>
                                    {/* Field label */}
                                    <span className={`font-bold uppercase tracking-wide text-[9px] ${
                                      isAdded ? 'text-green-600' : isRemoved ? 'text-red-500' : isChanged ? 'text-amber-600' : 'text-gray-500'
                                    }`}>
                                      {isAdded ? '＋ ' : isRemoved ? '－ ' : ''}{c.field}
                                    </span>
                                    {/* Values */}
                                    {isAdded ? (
                                      <span className="text-green-700 font-semibold">{c.to}</span>
                                    ) : isRemoved ? (
                                      <span className="line-through text-red-400">{c.from}</span>
                                    ) : (
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="line-through text-red-400 max-w-[44%] truncate" title={c.from}>{c.from}</span>
                                        <span className="text-gray-400">→</span>
                                        <span className="text-green-600 font-semibold max-w-[44%] truncate" title={c.to}>{c.to}</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        } catch { return null; }
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Follow-up Modal */}
      {
        followupQuoteId && (
          <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center">
            <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full mx-4">
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2"><Bell className="text-amber-500" /> Set Follow-up</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input type="date" value={followupDate} onChange={e => setFollowupDate(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Note (Optional)</label>
                  <textarea value={followupNote} onChange={e => setFollowupNote(e.target.value)} rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-indigo-500" placeholder="e.g. Call customer to confirm details..." />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button className="px-4 py-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-700" onClick={() => setFollowupQuoteId(null)}>Cancel</button>
                <button className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors" onClick={saveFollowup}>Save</button>
              </div>
            </div>
          </div>
        )
      }

      {/* Quote Diff Viewer Modal */}
      {diffBaseId && (
        <QuoteDiffViewer baseQuoteId={diffBaseId} onClose={() => setDiffBaseId(null)} />
      )}

    </div >
  );
}
