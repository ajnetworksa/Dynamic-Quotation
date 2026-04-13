import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, CheckCircle, XCircle, Clock, TrendingUp, Send, Users, BarChart2, Award, Repeat2 } from 'lucide-react';

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

const STATUS_COLORS: Record<string, string> = {
    Accepted: 'bg-green-100 text-green-800',
    Rejected: 'bg-red-100 text-red-800',
    Sent: 'bg-yellow-100 text-yellow-800',
    Draft: 'bg-gray-100 text-gray-800',
};

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
            console.error('Failed to load dashboard data', err);
        }
    };

    const currentMonth = new Date().toISOString().slice(0, 7);
    const thisMonthQuotes = quotes.filter(q => q.date && q.date.startsWith(currentMonth));

    const stats = {
        totalDocs: quotes.length,
        totalRevenue: quotes.filter(q => q.status === 'Accepted').reduce((s, q) => s + (q.grand_total || 0), 0),
        monthRevenue: thisMonthQuotes.filter(q => q.status === 'Accepted').reduce((s, q) => s + (q.grand_total || 0), 0),
        monthCount: thisMonthQuotes.length,
        pendingCount: quotes.filter(q => q.status === 'Draft' || q.status === 'Sent' || !q.status).length,
        acceptedCount: quotes.filter(q => q.status === 'Accepted').length,
        rejectedCount: quotes.filter(q => q.status === 'Rejected').length,
        sentCount: quotes.filter(q => q.status === 'Sent').length,
        winRate: quotes.length > 0 ? Math.round((quotes.filter(q => q.status === 'Accepted').length / quotes.length) * 100) : 0,
    };

    // Last 6 months bar chart data
    const last6Months = Array.from({ length: 6 }, (_, i) => {
        const d = new Date();
        d.setMonth(d.getMonth() - (5 - i));
        const key = d.toISOString().slice(0, 7);
        const label = d.toLocaleString('default', { month: 'short' });
        const total = quotes
            .filter(q => q.date?.startsWith(key) && q.status === 'Accepted')
            .reduce((s, q) => s + (q.grand_total || 0), 0);
        return { label, total, key };
    });
    const maxBar = Math.max(...last6Months.map(m => m.total), 1);

    // Top 5 customers by total accepted revenue
    const customerTotals: Record<string, number> = {};
    quotes.filter(q => q.status === 'Accepted').forEach(q => {
        const name = q.customer_name || 'Unknown';
        customerTotals[name] = (customerTotals[name] || 0) + (q.grand_total || 0);
    });
    const topCustomers = Object.entries(customerTotals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    const getRecentQuotes = () =>
        [...quotes].sort((a, b) => {
            const da = new Date(a.updated_at || a.date || 0).getTime();
            const db = new Date(b.updated_at || b.date || 0).getTime();
            return db - da;
        }).slice(0, 6);

    const handleRecall = (quote_id: string) => navigate(`/quote?recall=${quote_id}`);

    // Repeat customers: customers with 2+ quotes, sorted by quote count desc
    const customerQuoteMap: Record<string, { count: number; accepted: number; lastDate: string; lastStatus: string; lastId: string }> = {};
    quotes.forEach(q => {
        const name = q.customer_name || 'Unknown';
        if (!customerQuoteMap[name]) customerQuoteMap[name] = { count: 0, accepted: 0, lastDate: '', lastStatus: '', lastId: '' };
        customerQuoteMap[name].count++;
        if (q.status === 'Accepted') customerQuoteMap[name].accepted++;
        if (!customerQuoteMap[name].lastDate || (q.date || '') > customerQuoteMap[name].lastDate) {
            customerQuoteMap[name].lastDate = q.date || '';
            customerQuoteMap[name].lastStatus = q.status || 'Draft';
            customerQuoteMap[name].lastId = q.quote_id;
        }
    });
    const repeatCustomers = Object.entries(customerQuoteMap)
        .filter(([, v]) => v.count >= 2)
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 8);

    const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
    const canViewRevenue = currentUser.role === 'admin' || !!currentUser.permissions?.canViewRevenue;

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex justify-between items-center bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Hello, Welcome back!</h1>
                    <p className="text-gray-500 mt-1">Here is the overview of your quotation and sales activities.</p>
                </div>
                <div className="flex gap-3 flex-shrink-0">
                    <button
                        onClick={() => navigate('/customers')}
                        className="flex items-center gap-2 px-4 py-2.5 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors font-medium"
                    >
                        <Users size={18} /> Customers
                    </button>
                    <button
                        onClick={() => navigate('/tracking')}
                        className="flex items-center gap-2 px-4 py-2.5 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors font-medium"
                    >
                        <BarChart2 size={18} /> Tracking
                    </button>
                    <button
                        onClick={() => navigate('/quote')}
                        className="flex items-center gap-2 px-5 py-2.5 text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow font-medium"
                    >
                        <FileText size={18} /> New Document
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className={`grid grid-cols-2 ${canViewRevenue ? 'md:grid-cols-3 lg:grid-cols-6' : 'md:grid-cols-4'} gap-4`}>
                {[
                    { label: 'Total Documents', value: stats.totalDocs, icon: <FileText size={22} />, color: 'bg-indigo-100 text-indigo-600', hide: false },
                    { label: 'Won Revenue', value: `SAR ${stats.totalRevenue.toLocaleString()}`, icon: <CheckCircle size={22} />, color: 'bg-emerald-100 text-emerald-600', hide: !canViewRevenue },
                    { label: 'This Month (Won)', value: `SAR ${stats.monthRevenue.toLocaleString()}`, icon: <TrendingUp size={22} />, color: 'bg-blue-100 text-blue-600', hide: !canViewRevenue },
                    { label: 'This Month (Docs)', value: stats.monthCount, icon: <BarChart2 size={22} />, color: 'bg-violet-100 text-violet-600', hide: false },
                    { label: 'Pending / Draft', value: stats.pendingCount, icon: <Clock size={22} />, color: 'bg-amber-100 text-amber-600', hide: false },
                    { label: 'Lost Deals', value: stats.rejectedCount, icon: <XCircle size={22} />, color: 'bg-red-100 text-red-600', hide: false },
                ].filter(c => !c.hide).map((card) => (
                    <div key={card.label} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${card.color}`}>
                            {card.icon}
                        </div>
                        <div>
                            <p className="text-xs font-medium text-gray-500 leading-tight">{card.label}</p>
                            <p className="text-lg font-bold text-gray-900 mt-0.5 leading-tight">{card.value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Middle Row: Bar Chart + Conversion Metrics */}
            {canViewRevenue && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Monthly Revenue Bar Chart */}
                    <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                        <h3 className="text-lg font-bold text-gray-800 mb-5">Monthly Won Revenue (SAR)</h3>
                        <div className="flex items-end gap-4 h-40">
                            {last6Months.map((m) => {
                                const heightPct = maxBar > 0 ? (m.total / maxBar) * 100 : 0;
                                const isCurrent = m.key === currentMonth;
                                return (
                                    <div key={m.key} className="flex-1 flex flex-col items-center gap-1 group relative">
                                        {/* Tooltip */}
                                        <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                                            SAR {m.total.toLocaleString()}
                                        </div>
                                        <div className="w-full rounded-t-md transition-all duration-300"
                                            style={{
                                                height: `${Math.max(heightPct, 2)}%`,
                                                background: isCurrent
                                                    ? 'linear-gradient(to top, #4f46e5, #818cf8)'
                                                    : 'linear-gradient(to top, #cbd5e1, #e2e8f0)'
                                            }}
                                        />
                                        <span className={`text-xs font-semibold ${isCurrent ? 'text-indigo-600' : 'text-gray-500'}`}>{m.label}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Conversion Metrics */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex flex-col items-center justify-center text-center">
                        <h3 className="text-lg font-bold text-gray-800 mb-3 self-start">Conversion Metrics</h3>
                        <div className="flex-1 w-full flex items-center justify-center">
                            <div className="w-40 h-40 rounded-full border-[14px] border-emerald-500 flex items-center justify-center relative shadow-inner">
                                <div className="absolute inset-0 border-[14px] border-gray-100 rounded-full" style={{ clipPath: 'polygon(0 0, 100% 0, 100% 50%, 0 50%)' }} />
                                <div className="flex flex-col">
                                    <span className="text-3xl font-black text-emerald-600">{stats.winRate}%</span>
                                    <span className="text-xs font-bold text-gray-500 uppercase mt-1">Win Rate</span>
                                </div>
                            </div>
                        </div>
                        <div className="w-full grid grid-cols-3 gap-2 mt-4 text-sm font-medium border-t border-gray-100 pt-4">
                            <div className="text-emerald-600"><span className="block text-xl font-bold">{stats.acceptedCount}</span>Won</div>
                            <div className="text-yellow-600 border-l border-r border-gray-100"><span className="block text-xl font-bold">{stats.sentCount}</span>Sent</div>
                            <div className="text-gray-500"><span className="block text-xl font-bold">{stats.totalDocs}</span>Total</div>
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom Row: Recent Activity + Top Customers */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Recent Activity */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-6 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                        <h2 className="text-lg font-bold text-gray-800">Recent Activity</h2>
                        <button onClick={() => navigate('/tracking')} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">View All</button>
                    </div>
                    <div className="divide-y divide-gray-100">
                        {getRecentQuotes().map((quote) => (
                            <div key={quote.id} className="p-4 hover:bg-gray-50 transition-colors flex items-center justify-between">
                                <div>
                                    <div className="flex gap-2 items-center flex-wrap">
                                        <span
                                            className="font-bold text-indigo-900 cursor-pointer hover:underline"
                                            onClick={() => handleRecall(quote.quote_id)}
                                        >
                                            {quote.quote_id}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${STATUS_COLORS[quote.status || 'Draft'] || STATUS_COLORS.Draft}`}>
                                            {quote.status || 'Draft'}
                                        </span>
                                        <span className="text-xs text-gray-400">({quote.type || 'Quotation'})</span>
                                    </div>
                                    <div className="text-sm font-medium text-gray-900 mt-1">{quote.customer_name}</div>
                                    <div className="text-xs text-gray-500 truncate max-w-xs" title={quote.subject}>{quote.subject}</div>
                                </div>
                                <div className="text-right flex flex-col items-end ml-4">
                                    {canViewRevenue && (
                                        <div className="font-mono font-bold text-gray-900 whitespace-nowrap">SAR {quote.grand_total?.toLocaleString()}</div>
                                    )}
                                    <div className="text-xs text-gray-400 mt-1">{quote.date}</div>
                                    <button
                                        onClick={() => handleRecall(quote.quote_id)}
                                        className="mt-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium flex items-center gap-1"
                                    >
                                        Open <Send size={11} />
                                    </button>
                                </div>
                            </div>
                        ))}
                        {quotes.length === 0 && (
                            <div className="p-12 text-center text-gray-400">No activity yet. Create your first quote.</div>
                        )}
                    </div>
                </div>

                {/* Top Customers */}
                {canViewRevenue && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                        <div className="p-6 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
                            <Award size={18} className="text-amber-500" />
                            <h2 className="text-lg font-bold text-gray-800">Top Customers</h2>
                        </div>
                        <div className="p-4 space-y-4">
                            {topCustomers.length === 0 && (
                                <p className="text-gray-400 text-sm text-center py-6">No accepted deals yet.</p>
                            )}
                            {topCustomers.map(([name, total], i) => {
                                const pct = maxBar > 0 ? Math.round((total / topCustomers[0][1]) * 100) : 0;
                                const colors = ['bg-amber-400', 'bg-indigo-400', 'bg-emerald-400', 'bg-blue-400', 'bg-rose-400'];
                                return (
                                    <div key={name}>
                                        <div className="flex justify-between items-center mb-1">
                                            <div className="flex items-center gap-2">
                                                <span className={`w-5 h-5 rounded-full text-white text-xs font-bold flex items-center justify-center ${colors[i]}`}>{i + 1}</span>
                                                <span className="text-sm font-medium text-gray-800 truncate max-w-[140px]" title={name}>{name}</span>
                                            </div>
                                            <span className="text-xs font-mono font-bold text-gray-600 whitespace-nowrap ml-2">
                                                SAR {total.toLocaleString()}
                                            </span>
                                        </div>
                                        <div className="h-1.5 rounded-full bg-gray-100">
                                            <div className={`h-full rounded-full transition-all duration-500 ${colors[i]}`} style={{ width: `${pct}%` }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>

            {/* Repeat Customers Panel */}
            {repeatCustomers.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="p-6 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
                        <Repeat2 size={18} className="text-indigo-500" />
                        <h2 className="text-lg font-bold text-gray-800">Repeat Customers</h2>
                        <span className="ml-auto text-xs text-gray-400">Customers with 2+ quotes</span>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                                    <th className="px-5 py-3 text-left font-semibold">Customer</th>
                                    <th className="px-5 py-3 text-center font-semibold">Quotes</th>
                                    <th className="px-5 py-3 text-center font-semibold">Won</th>
                                    <th className="px-5 py-3 text-center font-semibold">Win Rate</th>
                                    <th className="px-5 py-3 text-center font-semibold">Last Status</th>
                                    <th className="px-5 py-3 text-center font-semibold">Last Quote</th>
                                    <th className="px-5 py-3 text-right font-semibold">Latest Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {repeatCustomers.map(([name, v], i) => {
                                    const winRate = Math.round((v.accepted / v.count) * 100);
                                    const winColor = winRate >= 60 ? 'text-emerald-600' : winRate >= 30 ? 'text-amber-600' : 'text-red-500';
                                    const rowBg = i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50';
                                    return (
                                        <tr key={name} className={`${rowBg} hover:bg-indigo-50/40 transition-colors`}>
                                            <td className="px-5 py-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center shrink-0">
                                                        {name.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className="font-medium text-gray-900 truncate max-w-[200px]" title={name}>{name}</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3 text-center">
                                                <button
                                                    onClick={() => navigate(`/tracking?customer=${encodeURIComponent(name)}`)}
                                                    title={`View all quotes for ${name}`}
                                                    className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm hover:bg-indigo-600 hover:text-white transition-colors cursor-pointer"
                                                >{v.count}</button>
                                            </td>
                                            <td className="px-5 py-3 text-center font-semibold text-emerald-600">{v.accepted}</td>
                                            <td className="px-5 py-3 text-center">
                                                <span className={`font-bold ${winColor}`}>{winRate}%</span>
                                                <div className="mt-1 h-1 rounded-full bg-gray-200 w-16 mx-auto">
                                                    <div className={`h-full rounded-full ${ winRate >= 60 ? 'bg-emerald-400' : winRate >= 30 ? 'bg-amber-400' : 'bg-red-400'}`} style={{ width: `${winRate}%` }} />
                                                </div>
                                            </td>
                                            <td className="px-5 py-3 text-center">
                                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${STATUS_COLORS[v.lastStatus] || STATUS_COLORS.Draft}`}>
                                                    {v.lastStatus}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 text-center">
                                                <button
                                                    onClick={() => handleRecall(v.lastId)}
                                                    className="text-indigo-600 hover:text-indigo-800 font-mono text-xs font-semibold hover:underline"
                                                >{v.lastId}</button>
                                            </td>
                                            <td className="px-5 py-3 text-right text-xs text-gray-400 whitespace-nowrap">{v.lastDate}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
