import { useEffect, useState } from 'react';
import { api } from './api.js';
import Login from './components/Login.jsx';
import Dashboard from './components/Dashboard.jsx';
import Settings from './components/Settings.jsx';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('forwards');

  useEffect(() => {
    api
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="login-wrap">Зареждане...</div>;
  }

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <div className="app-shell">
      <div className="topbar">
        <div>
          <h1>Networking Panel</h1>
          <div className="muted">Управление на iptables пренасочвания</div>
        </div>
        <div className="row">
          <span className="muted">{user.username}</span>
          <button
            className="secondary"
            onClick={async () => {
              await api.logout();
              setUser(null);
            }}
          >
            Изход
          </button>
        </div>
      </div>

      <div className="tabs">
        <button
          className={`tab ${tab === 'forwards' ? 'active' : ''}`}
          onClick={() => setTab('forwards')}
        >
          Портове
        </button>
        <button
          className={`tab ${tab === 'settings' ? 'active' : ''}`}
          onClick={() => setTab('settings')}
        >
          Настройки
        </button>
      </div>

      {tab === 'forwards' ? <Dashboard /> : <Settings onUserChange={setUser} />}
    </div>
  );
}
