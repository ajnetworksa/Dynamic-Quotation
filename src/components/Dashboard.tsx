import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, CheckCircle, XCircle, Clock, TrendingUp, Send } from 'lucide-react';

interface Quote {
    id: number;
    quote_id: string;
    date: string;
    customer_name: string;
    subject: string;
    grand_total: number;
    status?: string;
    type?: string;
    updated_at?: string;
}

export default function Dashboard() {
    const [quotes, setQuotes] = useState<Quote[]>([]);
    const navigate = useNavigate();

    useEffect(() => {
        fetchQuotes();
    }, []);

    const fetchQuotes = async () => {
        try {
            const res = await fetch('/api/quotes');
            const data = await res.json();
            setQuotes(data);
        } catch (err) {
            console.error("Failed to load dashboard data", err);
        }
    };

    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const thisMonthQuotes = quotes.filter(q => q.date && q.date.startsWith(currentMonth));

    const stats = {
        totalRevenue: quotes.filter(q => q.status === 'Accepted').reduce((sum, q) => sum + (q.grand_total || 0), 0),
        monthRevenue: thisMonthQuotes.filter(q => q.status === 'Accepted').reduce((sum, q) => sum + (q.grand_total || 0), 0),
        pendingCount: quotes.filter(q => q.status === 'Draft' || q.status === 'Sent' || !q.status).length,
        acceptedCount: quotes.filter(q => q.status === 'Accepted').length,
        rejectedCount: quotes.filter(q => q.status === 'Rejected').length,
        sentCount: quotes.filter(q => q.status === 'Sent').length,
    };

    const getRecentQuotes = () => {
        return [...quotes].sort((a, b) => {
            const dateA = new Date(a.updated_at || a.date || 0).getTime();
            const dateB = new Date(b.updated_at || b.date || 0).getTime();
            return dateB - dateA;
        }).slice(0, 5);
    };

    const handleRecall = (quote_id: string) => {
        navigate(`/quote?recall=${quote_id}`);
    };

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Hello, Welcome back!</h1>
                    <p className="text-gray-500 mt-1">Here is the overview of your quotation and sales activities.</p>
                </div>
                <button
                    onClick={() => navigate('/quote')}
                    className="flex items-center gap-2 px-5 py-2.5 text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow flex-shrink-0 font-medium"
                >
                    <FileText size={20} /> New Document
                </button>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
                    <div className="p-3 bg-emerald-100 text-emerald-600 rounded-lg">
                        <CheckCircle size={28} />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500">Won Revenue</p>
                        <h3 className="text-xl font-bold text-gray-900 mt-1">SAR {stats.totalRevenue.toLocaleString()}</h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
                    <div className="p-3 bg-indigo-100 text-indigo-600 rounded-lg">
                        <TrendingUp size={28} />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500">This Month (Won)</p>
                        <h3 className="text-xl font-bold text-gray-900 mt-1">SAR {stats.monthRevenue.toLocaleString()}</h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
                    <div className="p-3 bg-amber-100 text-amber-600 rounded-lg">
                        <Clock size={28} />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500">Pending / Draft Actions</p>
                        <h3 className="text-2xl font-bold text-gray-900 mt-1">{stats.pendingCount}</h3>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center gap-4">
                    <div className="p-3 bg-red-100 text-red-600 rounded-lg">
                        <XCircle size={28} />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500">Lost Deals</p>
                        <h3 className="text-2xl font-bold text-gray-900 mt-1">{stats.rejectedCount}</h3>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Conversion Rate Card */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center text-center">
                    <h3 className="text-lg font-bold text-gray-800 mb-2 self-start">Conversion Metrics</h3>
                    <div className="flex-1 w-full flex items-center justify-center">
                        <div className="w-48 h-48 rounded-full border-[16px] border-emerald-500 flex items-center justify-center relative shadow-inner">
                            <div className="absolute inset-0 border-[16px] border-gray-100 rounded-full" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 50%, 0 50%)' }}></div>
                            <div className="flex flex-col">
                                <span className="text-3xl font-black text-emerald-600">
                                    {quotes.length > 0 ? Math.round((stats.acceptedCount / quotes.length) * 100) : 0}%
                                </span>
                                <span className="text-xs font-bold text-gray-500 uppercase mt-1">Win Rate</span>
                            </div>
                        </div>
                    </div>
                    <div className="w-full grid grid-cols-3 gap-2 mt-4 text-sm font-medium border-t border-gray-100 pt-4">
                        <div className="text-emerald-600"><span className="block text-xl font-bold">{stats.acceptedCount}</span> Won</div>
                        <div className="text-yellow-600 border-l border-r border-gray-100"><span className="block text-xl font-bold">{stats.sentCount}</span> Sent</div>
                        <div className="text-gray-500"><span className="block text-xl font-bold">{quotes.length}</span> Total</div>
                    </div>
                </div>

                {/* Recent Quotes List */}
                <div className="col-span-1 lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-6 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                        <h2 className="text-lg font-bold text-gray-800">Recent Activity</h2>
                        <button onClick={() => navigate('/tracking')} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">View All</button>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {getRecentQuotes().map((quote) => (
                            <div key={quote.id} className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between">
                                <div>
                                    <div className="flex gap-2 items-center">
                                        <span className="font-bold text-indigo-900 cursor-pointer hover:underline" onClick={() => handleRecall(quote.quote_id)}>{quote.quote_id}</span>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${quote.status === 'Accepted' ? 'bg-green-100 text-green-800' :
                                                quote.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                                                    quote.status === 'Sent' ? 'bg-yellow-100 text-yellow-800' :
                                                        'bg-gray-100 text-gray-800'
                                            }`}>
                                            {quote.status || 'Draft'}
                                        </span>
                                        <span className="text-xs text-gray-400">({quote.type || 'Quotation'})</span>
                                    </div>
                                    <div className="text-sm font-medium text-gray-900 mt-1">{quote.customer_name}</div>
                                    <div className="text-xs text-gray-500 truncate max-w-sm" title={quote.subject}>{quote.subject}</div>
                                </div>
                                <div className="text-right flex flex-col items-end">
                                    <div className="font-mono font-bold text-gray-900">SAR {quote.grand_total?.toLocaleString()}</div>
                                    <div className="text-xs text-gray-400 mt-1">{quote.date}</div>
                                    <button
                                        onClick={() => handleRecall(quote.quote_id)}
                                        className="mt-2 text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                                    >
                                        Open <Send size={12} />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {quotes.length === 0 && (
                            <div className="p-12 text-center text-gray-500 bg-white">
                                No activity found. Create your first quote to see statistics here.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
