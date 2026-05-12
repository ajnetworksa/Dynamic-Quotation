import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Loader2, ChevronRight, User, DollarSign, 
  Clock, CheckCircle2, Send, FileText,
  MoreVertical, Edit2, Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const STATUSES = ['Draft', 'Sent', 'Approved', 'Invoiced'] as const;
type Status = typeof STATUSES[number];

interface Quote {
  id: number;
  quote_id: string;
  customer_name: string;
  subject: string;
  grand_total: number;
  status: string;
  date: string;
}

export default function KanbanBoard() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchQuotes();
  }, []);

  const fetchQuotes = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/quotes');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setQuotes(data);
    } catch (err) {
      setError('Failed to load board');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: number, newStatus: string) => {
    try {
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

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
      <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
      <p className="text-gray-500 font-medium animate-pulse">Initializing Kanban Board...</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Quotation Kanban</h1>
          <p className="text-gray-500 dark:text-gray-400">Track and manage your quotation pipeline</p>
        </div>
        <button 
          onClick={() => navigate('/quote')}
          className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100 dark:shadow-none"
        >
          + New Quote
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
        {STATUSES.map(status => (
          <div key={status} className="flex flex-col gap-4 bg-gray-100/50 dark:bg-gray-800/40 p-4 rounded-2xl border border-gray-200/50 dark:border-gray-700/50 min-h-[500px]">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${
                  status === 'Draft' ? 'bg-gray-400' :
                  status === 'Sent' ? 'bg-blue-500' :
                  status === 'Approved' ? 'bg-green-500' :
                  'bg-purple-600'
                }`} />
                <h2 className="font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider text-xs">{status}</h2>
                <span className="bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-[10px] font-bold px-1.5 py-0.5 rounded-md border border-gray-200 dark:border-gray-600">
                  {quotes.filter(q => q.status === status).length}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <AnimatePresence mode="popLayout">
                {quotes.filter(q => q.status === status).map(quote => (
                  <motion.div
                    key={quote.id}
                    layout
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 group hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-500 transition-all cursor-pointer relative"
                    onClick={() => {
                      localStorage.setItem('currentQuoteId', quote.quote_id);
                      navigate('/quote');
                    }}
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded uppercase">
                          {quote.quote_id}
                        </span>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {status !== 'Invoiced' && (
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                const nextIndex = STATUSES.indexOf(status as any) + 1;
                                updateStatus(quote.id, STATUSES[nextIndex]);
                              }}
                              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-400 hover:text-indigo-600"
                              title="Move to next stage"
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
                          {quote.grand_total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-gray-400">
                          <Clock size={10} />
                          {new Date(quote.date).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
