import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Loader2, ChevronRight, DollarSign, Clock, X, AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { t, useLang } from '../lib/i18n';

// Pipeline stages in order. Rejected / Cancelled are closed states reachable via the reject button
// (or set elsewhere, e.g. Tracking) and are shown so those quotes never disappear from the board.
const STATUSES = ['Draft', 'Sent', 'Accepted', 'Invoiced', 'Rejected', 'Cancelled'] as const;
const PIPELINE = ['Draft', 'Sent', 'Accepted', 'Invoiced'] as const;
type Status = typeof STATUSES[number];

const DOT_COLORS: Record<Status, string> = {
  Draft: 'bg-gray-400',
  Sent: 'bg-blue-500',
  Accepted: 'bg-green-500',
  Invoiced: 'bg-purple-600',
  Rejected: 'bg-red-500',
  Cancelled: 'bg-gray-500',
};

interface Quote {
  id: number;
  quote_id: string;
  customer_name: string;
  subject: string;
  grand_total: number | null;
  status: string | null;
  date: string;
}

const money = (n: number | null | undefined) =>
  (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const shortDate = (d: string) => {
  const parsed = new Date(d);
  return isNaN(parsed.getTime()) ? (d || '') : parsed.toLocaleDateString();
};

export default function KanbanBoard() {
  useLang();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchQuotes(true);
  }, []);

  // showSpinner is only true for the first load; later refreshes (e.g. rollback) keep the board visible.
  const fetchQuotes = async (showSpinner = false) => {
    try {
      if (showSpinner) setLoading(true);
      const res = await fetch('/api/quotes');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setQuotes(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('Failed to load board');
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  const updateStatus = async (id: number, newStatus: string) => {
    try {
      setError('');
      // Optimistic update
      setQuotes(prev => prev.map(q => q.id === id ? { ...q, status: newStatus } : q));

      const res = await fetch(`/api/quotes/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (!res.ok) throw new Error('Failed to update');
    } catch (err) {
      setError('Failed to update status');
      fetchQuotes(); // Rollback
    }
  };

  // A quote with a missing/unknown status is treated as a Draft so it never disappears.
  const statusOf = (q: Quote): Status =>
    (STATUSES as readonly string[]).includes(q.status || '') ? (q.status as Status) : 'Draft';

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
      <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      <p className="text-gray-500 font-medium animate-pulse">Initializing Kanban Board...</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">{t('Quotation Kanban')}</h1>
          <p className="text-gray-500 dark:text-gray-400">{t('Track and manage your quotation pipeline')}</p>
        </div>
        <button
          onClick={() => navigate('/quote')}
          className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 dark:shadow-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          {t('+ New Quote')}
        </button>
      </div>

      {error && (
        <div role="alert" className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm font-medium px-4 py-3 rounded-xl">
          <AlertCircle size={16} />
          <span className="flex-1">{error}</span>
          <button onClick={() => setError('')} aria-label="Dismiss error" className="p-1 rounded hover:bg-red-100">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 items-start">
        {STATUSES.map(status => {
          const columnQuotes = quotes.filter(q => statusOf(q) === status);
          const columnTotal = columnQuotes.reduce((sum, q) => sum + (Number(q.grand_total) || 0), 0);
          return (
          <div key={status} className="flex flex-col gap-4 bg-gray-100/50 dark:bg-gray-800/40 p-4 rounded-2xl border border-gray-200/50 dark:border-gray-700/50 min-h-[200px] md:min-h-[400px]">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${DOT_COLORS[status]}`} />
                <h2 className="font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider text-xs">{t(status)}</h2>
                <span className="bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-[10px] font-bold px-1.5 py-0.5 rounded-md border border-gray-200 dark:border-gray-600">
                  {columnQuotes.length}
                </span>
              </div>
            </div>
            <p className="text-[10px] font-semibold text-gray-400 px-1 -mt-2">{money(columnTotal)}</p>

            <div className="flex flex-col gap-3">
              {columnQuotes.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-6">{t('No quotes')}</p>
              )}
              <AnimatePresence mode="popLayout">
                {columnQuotes.map(quote => {
                  const pipelineIndex = (PIPELINE as readonly string[]).indexOf(status);
                  const nextStatus = pipelineIndex >= 0 && pipelineIndex < PIPELINE.length - 1 ? PIPELINE[pipelineIndex + 1] : null;
                  const canReject = status === 'Draft' || status === 'Sent';
                  return (
                  <motion.div
                    key={quote.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Open quote ${quote.quote_id}`}
                    className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 group hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-500 transition-all cursor-pointer relative focus-visible:outline focus-visible:outline-2 focus-visible:outline-indigo-500"
                    onClick={() => navigate(`/quote?recall=${encodeURIComponent(quote.quote_id)}`)}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return;
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/quote?recall=${encodeURIComponent(quote.quote_id)}`);
                      }
                    }}
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded uppercase">
                          {quote.quote_id}
                        </span>
                        {/* Always visible on touch, shown on hover/focus on desktop */}
                        <div className="flex gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                          {canReject && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateStatus(quote.id, 'Rejected');
                              }}
                              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-400 hover:text-red-600"
                              title="Mark as rejected"
                              aria-label={`Mark ${quote.quote_id} as rejected`}
                            >
                              <X size={14} />
                            </button>
                          )}
                          {nextStatus && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateStatus(quote.id, nextStatus);
                              }}
                              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-400 hover:text-indigo-600"
                              title={`Move to ${nextStatus}`}
                              aria-label={`Move ${quote.quote_id} to ${nextStatus}`}
                            >
                              <ChevronRight size={14} />
                            </button>
                          )}
                        </div>
                      </div>

                      <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm line-clamp-1">{quote.customer_name || 'No Customer'}</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">{quote.subject || 'No Subject'}</p>

                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50 dark:border-gray-700/50">
                        <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                          <DollarSign size={12} />
                          {money(quote.grand_total)}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-gray-500">
                          <Clock size={10} />
                          {shortDate(quote.date)}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
