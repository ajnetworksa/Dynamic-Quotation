import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Database, Loader2, Maximize2, Minimize2 } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  data?: any[];
  query?: string;
}

export default function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Permission check — only admins or users with canUseAI can see the chatbot
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const canUseAI = currentUser.role === 'admin' || !!currentUser.permissions?.canUseAI;
  if (!canUseAI) return null;

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ question: userMessage })
      });

      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: data.answer || 'Here is what I found.',
          data: data.data,
          query: data.query
        }]);
      } else {
        const error = await res.json();
        setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${error.error || 'Something went wrong'}` }]);
      }
    } catch (err: any) {
      setMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 p-4 bg-indigo-600 text-white rounded-full shadow-xl hover:bg-indigo-700 transition-transform hover:scale-110 z-50 flex items-center justify-center"
        title="Ask Database AI"
      >
        <Bot size={28} />
      </button>
    );
  }

  return (
    <div className={`fixed bottom-6 right-6 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden z-50 transition-all duration-300 ${isExpanded ? 'w-[800px] h-[80vh]' : 'w-[400px] h-[600px]'} max-w-[calc(100vw-32px)] max-h-[calc(100vh-32px)]`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 text-white flex items-center justify-between shadow-md shrink-0">
        <div className="flex items-center gap-2">
          <Database size={20} className="opacity-90" />
          <div>
            <h3 className="font-bold text-sm tracking-wide">Data Assistant</h3>
            <p className="text-[10px] opacity-80 leading-none mt-1">Ask questions about quotes & customers</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setIsExpanded(!isExpanded)} className="p-1.5 hover:bg-white/20 rounded transition-colors text-white">
            {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-white/20 rounded transition-colors text-white">
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-10">
            <Bot size={48} className="mx-auto mb-4 opacity-20" />
            <p className="text-sm">Hi! I can write database queries to answer your questions.</p>
            <p className="text-xs mt-2 opacity-70">Try asking: <br/>"How many quotes did we make this month?"</p>
          </div>
        )}
        
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2 shadow-sm text-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white border border-gray-100 text-gray-800 rounded-bl-none'}`}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
            
            {msg.data && msg.data.length > 0 && (
              <div className="mt-2 w-full bg-white border border-gray-200 rounded-lg overflow-x-auto shadow-sm">
                <div className="bg-gray-100 px-2 py-1 text-[10px] text-gray-500 font-mono flex justify-between items-center">
                  <span>Query Result ({msg.data.length} rows)</span>
                  {msg.query && <code className="truncate max-w-[200px]" title={msg.query}>{msg.query}</code>}
                </div>
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-medium">
                    <tr>
                      {Object.keys(msg.data[0]).slice(0, 8).map(key => (
                        <th key={key} className="px-3 py-2 border-r border-gray-200 last:border-0">{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {msg.data.slice(0, 50).map((row, i) => (
                      <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-indigo-50">
                        {Object.values(row).slice(0, 8).map((val: any, j) => (
                          <td key={j} className="px-3 py-2 border-r border-gray-100 last:border-0 truncate max-w-[150px]">
                            {val?.toString() || ''}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {msg.data.length > 50 && (
                  <div className="p-2 text-center text-xs text-gray-500 italic bg-gray-50 border-t border-gray-100">
                    Showing first 50 rows only
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex items-start">
            <div className="bg-white border border-gray-100 text-gray-800 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm text-sm flex items-center gap-2">
              <Loader2 size={16} className="animate-spin text-indigo-600" />
              <span className="animate-pulse text-gray-500 text-xs">Querying database...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <div className="p-3 bg-white border-t border-gray-200 shrink-0">
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex bg-gray-50 border border-gray-300 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all text-sm shadow-inner"
        >
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            placeholder="Ask about your data..."
            className="flex-1 bg-transparent px-4 py-3 outline-none disabled:opacity-50"
          />
          <button 
            type="submit" 
            disabled={isLoading || !input.trim()}
            className="px-4 text-indigo-600 hover:bg-gray-100 disabled:opacity-50 disabled:hover:bg-transparent transition-colors flex items-center justify-center font-medium"
          >
            <Send size={18} className={input.trim() ? "translate-x-1" : ""} style={{ transition: "transform 0.2s" }} />
          </button>
        </form>
      </div>
    </div>
  );
}
