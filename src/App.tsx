import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { FileText, Database, Users, History, Settings as SettingsIcon, LogOut, Shield, LayoutDashboard } from 'lucide-react';
import QuoteForm from './components/QuoteForm';
import Dashboard from './components/Dashboard';
import ProductDB from './components/ProductDB';
import CustomerDB from './components/CustomerDB';
import Tracking from './components/Tracking';
import Settings from './components/Settings';
import Login from './components/Login';
import UsersDB from './components/UsersDB';

// Global fetch interceptor for auth token
const originalFetch = window.fetch;
Object.defineProperty(window, 'fetch', {
  value: async (input: RequestInfo | URL, init?: RequestInit) => {
    const token = localStorage.getItem('token');
    if (token) {
      init = init || {};
      init.headers = {
        ...init.headers,
        'Authorization': `Bearer ${token}`
      };
    }
    const response = await originalFetch(input, init);
    if (response.status === 401 && window.location.pathname !== '/login') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.dispatchEvent(new Event('auth-change'));
    }
    return response;
  },
  writable: true,
  configurable: true
});

function NavItem({ to, icon: Icon, label }: { to: string, icon: any, label: string }) {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${isActive
        ? 'bg-indigo-600 text-white'
        : 'text-gray-600 hover:bg-gray-100'
        }`}
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
    </Link>
  );
}

function MainLayout({ user, handleLogout }: { user: any, handleLogout: () => void }) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center h-auto md:h-16 py-4 md:py-0 gap-4">
            <div className="flex items-center gap-2">
              <div className="bg-indigo-600 p-2 rounded-lg">
                <FileText className="text-white" size={24} />
              </div>
              <h1 className="text-xl font-bold text-gray-900">AJ Network Solutions</h1>
            </div>
            <nav className="flex gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-hide items-center">
              <NavItem to="/" icon={LayoutDashboard} label="Dashboard" />
              <NavItem to="/quote" icon={FileText} label="Docs" />
              <NavItem to="/products" icon={Database} label="Product DB" />
              <NavItem to="/customers" icon={Users} label="Customer DB" />
              <NavItem to="/tracking" icon={History} label="Tracking" />
              {user?.role === 'admin' && (
                <>
                  <NavItem to="/users" icon={Shield} label="Users" />
                  <NavItem to="/settings" icon={SettingsIcon} label="Settings" />
                </>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-red-600 hover:bg-red-50 ml-2"
                title="Logout"
              >
                <LogOut size={20} />
                <span className="font-medium hidden md:inline">Logout</span>
              </button>
            </nav>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Keep QuoteForm mounted to preserve state when switching tabs */}
        <div style={{ display: location.pathname === '/quote' ? 'block' : 'none' }}>
          <QuoteForm />
        </div>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/products" element={<ProductDB />} />
          <Route path="/customers" element={<CustomerDB />} />
          <Route path="/tracking" element={<Tracking />} />
          {user?.role === 'admin' && (
            <>
              <Route path="/users" element={<UsersDB />} />
              <Route path="/settings" element={<Settings />} />
            </>
          )}
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token'));
  const [user, setUser] = useState<any>(JSON.parse(localStorage.getItem('user') || 'null'));

  useEffect(() => {
    const handleAuthChange = () => {
      setIsAuthenticated(!!localStorage.getItem('token'));
      setUser(JSON.parse(localStorage.getItem('user') || 'null'));
    };
    window.addEventListener('auth-change', handleAuthChange);
    return () => window.removeEventListener('auth-change', handleAuthChange);
  }, []);

  const handleLogin = (token: string, userData: any) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setIsAuthenticated(true);
    setUser(userData);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/logout', { method: 'POST' });
    } catch (e) { }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setIsAuthenticated(false);
    setUser(null);
  };

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <Router>
      <MainLayout user={user} handleLogout={handleLogout} />
    </Router>
  );
}
