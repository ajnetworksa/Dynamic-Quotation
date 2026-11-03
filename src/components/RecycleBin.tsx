import React, { useState, useEffect } from 'react';
import { Trash2, RotateCcw, AlertCircle, Shield, FileText, Calendar, Clock, Loader2, Search, Pin, PinOff } from 'lucide-react';

interface RecycleBinItem {
  quote_id: string;
  subject: string;
  customer_name: string;
  author_name: string;
  deleted_at: string;
  deleted_by: string;
  retain_forever: number;
}

export function RecycleBin() {
  const [items, setItems] = useState<RecycleBinItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/recycle-bin', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to fetch recycle bin');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (quote_id: string) => {
    if (!confirm(`Are you sure you want to restore ${quote_id}?`)) return;
    try {
      const res = await fetch(`/api/recycle-bin/${quote_id}/restore`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        fetchItems();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to restore');
      }
    } catch {
      alert('Network error');
    }
  };

  const handleDelete = async (quote_id: string) => {
    if (!confirm(`WARNING: This will PERMANENTLY delete ${quote_id}. This action cannot be undone. Are you sure?`)) return;
    try {
      const res = await fetch(`/api/recycle-bin/${quote_id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (res.ok) {
        fetchItems();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete');
      }
    } catch {
      alert('Network error');
    }
  };

  const handleToggleRetain = async (quote_id: string, currentRetain: number) => {
    try {
      const res = await fetch(`/api/recycle-bin/${quote_id}/retain`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ retain: currentRetain ? 0 : 1 })
      });
      if (res.ok) {
        fetchItems();
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to update retention status');
      }
    } catch {
      alert('Network error');
    }
  };

  const filteredItems = items.filter(item => 
    item.quote_id.toLowerCase().includes(search.toLowerCase()) ||
    (item.subject && item.subject.toLowerCase().includes(search.toLowerCase())) ||
    (item.customer_name && item.customer_name.toLowerCase().includes(search.toLowerCase())) ||
    (item.deleted_by && item.deleted_by.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-50 rounded-xl">
            <Trash2 className="text-red-600" size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Recycle Bin</h1>
            <p className="text-gray-500 text-sm mt-1">Manage deleted quotations. Items are automatically permanently deleted after the retention period.</p>
          </div>
        </div>
        <div className="relative w-full md:w-64">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search deleted quotes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-xl border border-red-200 flex items-center gap-2">
          <AlertCircle size={18} /> {error}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-semibold">
              <tr>
                <th className="px-4 py-3">Quote ID</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Deleted By</th>
                <th className="px-4 py-3">Deleted At</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    <Loader2 size={24} className="animate-spin mx-auto mb-2 text-indigo-500" />
                    Loading recycle bin...
                  </td>
                </tr>
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    <Trash2 size={24} className="mx-auto mb-2 text-gray-300" />
                    Recycle bin is empty
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.quote_id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-800">
                      <div className="flex items-center gap-2">
                        <FileText size={14} className="text-gray-400" />
                        {item.quote_id}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{item.subject || '-'}</td>
                    <td className="px-4 py-3 text-gray-600">{item.customer_name || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-gray-600">
                        <Shield size={14} className="text-indigo-400" />
                        {item.deleted_by || 'Unknown'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="flex items-center gap-1.5 text-gray-600">
                          <Calendar size={12} className="text-gray-400" />
                          {new Date(item.deleted_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                        <span className="flex items-center gap-1.5 text-gray-400 text-xs mt-0.5">
                          <Clock size={12} />
                          {new Date(item.deleted_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleToggleRetain(item.quote_id, item.retain_forever)}
                        title={item.retain_forever ? "Will not be auto-deleted" : "Will be auto-deleted eventually"}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase transition-colors ${
                          item.retain_forever 
                            ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' 
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                      >
                        {item.retain_forever ? <Pin size={10} /> : <PinOff size={10} />}
                        {item.retain_forever ? 'Retained' : 'Auto-Clear'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleRestore(item.quote_id)}
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors tooltip-wrapper"
                          title="Restore"
                        >
                          <RotateCcw size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(item.quote_id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors tooltip-wrapper"
                          title="Delete Permanently"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
