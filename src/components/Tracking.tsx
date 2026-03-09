import { useState, useEffect } from 'react';
import { Trash2, FileText, Download } from 'lucide-react';
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

export default function Tracking() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    fetchQuotes();
  }, []);

  const fetchQuotes = async () => {
    const res = await fetch('/api/quotes');
    const data = await res.json();
    setQuotes(data);
  };

  const handleDelete = async (quote_id: string) => {
    if (!confirm('Are you sure you want to delete this quote record?')) return;

    await fetch(`/api/quotes/${quote_id}`, { method: 'DELETE' });
    fetchQuotes();
  };

  const handleRecall = (quote_id: string) => {
    navigate(`/quote?recall=${quote_id}`);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-200 bg-gray-50">
        <h2 className="text-xl font-semibold text-gray-800">Quotation Records</h2>
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
            {quotes.map((quote) => (
              <tr key={quote.id} className="hover:bg-gray-50 transition-colors">
                <td className="p-4 font-medium text-indigo-600">
                  {quote.quote_id}
                  {quote.revision_of && <span className="block text-xs text-gray-400">Rev of: {quote.revision_of}</span>}
                </td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${quote.type === 'Tax Invoice' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                    {quote.type || 'Quotation'}
                  </span>
                </td>
                <td className="p-4">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${quote.status === 'Accepted' ? 'bg-green-100 text-green-800' :
                    quote.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                      quote.status === 'Sent' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-gray-100 text-gray-800'
                    }`}>
                    {quote.status || 'Draft'}
                  </span>
                </td>
                <td className="p-4 text-gray-600">{quote.date}</td>
                <td className="p-4 font-medium text-gray-900">{quote.customer_name}</td>
                <td className="p-4 text-gray-600 truncate max-w-[200px]" title={quote.subject}>{quote.subject}</td>
                <td className="p-4 font-mono font-medium text-gray-900">
                  {quote.grand_total?.toFixed(2)}
                </td>
                <td className="p-4 text-gray-500 text-sm">
                  {quote.updated_at ? new Date(quote.updated_at).toLocaleString() : '-'}
                </td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => handleRecall(quote.quote_id)}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                      title="Recall Quote to Form"
                    >
                      <FileText size={16} />
                      Open
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
            {quotes.length === 0 && (
              <tr>
                <td colSpan={9} className="p-8 text-center text-gray-500">
                  No records yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
