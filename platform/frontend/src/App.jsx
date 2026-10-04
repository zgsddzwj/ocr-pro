import { Navigate, NavLink, Route, Routes, useNavigate } from 'react-router-dom';
import { getToken, setToken } from './lib/api';
import Dashboard from './pages/Dashboard';
import Farmers from './pages/Farmers';
import Login from './pages/Login';
import Print from './pages/Print';
import PurchaseEdit from './pages/PurchaseEdit';
import RecordDetail from './pages/RecordDetail';
import Settings from './pages/Settings';

const NAV_ITEMS = [
  { to: '/', label: '工作台', end: true },
  { to: '/records/new', label: '开新单' },
  { to: '/farmers', label: '农户库' },
  { to: '/settings', label: '设置' },
];

function Layout({ children }) {
  const navigate = useNavigate();
  const logout = () => {
    setToken('');
    navigate('/login');
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 bg-brand text-white shadow-md">
        <div className="mx-auto max-w-6xl px-4 py-2.5 md:flex md:items-center md:gap-6 md:px-5 md:py-3">
          <div className="flex items-center justify-between">
            <div className="text-lg font-bold tracking-wide">收粮收购平台</div>
            <button
              onClick={logout}
              className="rounded-lg px-3 py-1.5 text-sm text-white/80 hover:bg-white/10 md:hidden"
            >
              退出
            </button>
          </div>
          <nav className="-mx-4 mt-1 flex gap-1 overflow-x-auto px-4 md:mx-0 md:mt-0 md:flex-1 md:px-0">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `whitespace-nowrap rounded-lg px-4 py-1.5 text-sm transition-colors ${
                    isActive ? 'bg-white/20 font-semibold' : 'text-white/85 hover:bg-white/10'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <button
            onClick={logout}
            className="hidden rounded-lg px-3 py-1.5 text-sm text-white/80 hover:bg-white/10 md:block"
          >
            退出
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-5 md:px-5 md:py-6">{children}</main>
    </div>
  );
}

function RequireAuth({ children }) {
  if (!getToken()) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/print/:id" element={<Print />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout>
              <Dashboard />
            </Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/records/new"
        element={
          <RequireAuth>
            <Layout>
              <PurchaseEdit />
            </Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/records/:id"
        element={
          <RequireAuth>
            <Layout>
              <RecordDetail />
            </Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/farmers"
        element={
          <RequireAuth>
            <Layout>
              <Farmers />
            </Layout>
          </RequireAuth>
        }
      />
      <Route
        path="/settings"
        element={
          <RequireAuth>
            <Layout>
              <Settings />
            </Layout>
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
