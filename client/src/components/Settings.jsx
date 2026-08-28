import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Settings({ onUserChange }) {
  const [settings, setSettings] = useState(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState(null);

  useEffect(() => {
    api.getSettings().then(setSettings).catch(console.error);
  }, []);

  async function saveSettings(event) {
    event.preventDefault();
    setMessage(null);
    try {
      const updated = await api.updateSettings(settings);
      setSettings(updated);
      setMessage({ type: 'ok', text: 'OCI настройките са запазени.' });
    } catch (error) {
      setMessage({ type: 'warn', text: error.message });
    }
  }

  async function saveCredentials(event) {
    event.preventDefault();
    setMessage(null);
    try {
      const user = await api.updateCredentials({
        currentPassword,
        ...(newUsername ? { newUsername } : {}),
        ...(newPassword ? { newPassword } : {}),
      });
      onUserChange(user);
      setCurrentPassword('');
      setNewUsername('');
      setNewPassword('');
      setMessage({ type: 'ok', text: 'Credentials са обновени.' });
    } catch (error) {
      setMessage({ type: 'warn', text: error.message });
    }
  }

  if (!settings) return <div className="card">Зареждане...</div>;

  return (
    <div className="stack">
      {message ? <div className={`alert ${message.type}`}>{message.text}</div> : null}

      <form className="card stack" onSubmit={saveCredentials}>
        <h2>Смяна на потребител / парола</h2>
        <div>
          <label htmlFor="currentPassword">Текуща парола</label>
          <input
            id="currentPassword"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="newUsername">Нов username (по избор)</label>
          <input
            id="newUsername"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="newPassword">Нова парола (по избор)</label>
          <input
            id="newPassword"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <button className="primary">Запази credentials</button>
      </form>

      <form className="card stack" onSubmit={saveSettings}>
        <h2>OCI настройки</h2>
        <p className="muted">
          API ключовете се четат от <code>~/.oci/config</code> на Ubuntu машината.
        </p>
        <div>
          <label htmlFor="region">Region</label>
          <input
            id="region"
            value={settings.region}
            onChange={(e) => setSettings({ ...settings, region: e.target.value })}
          />
        </div>
        <div>
          <label htmlFor="securityListId">Security List OCID</label>
          <input
            id="securityListId"
            value={settings.securityListId}
            onChange={(e) =>
              setSettings({ ...settings, securityListId: e.target.value })
            }
          />
        </div>
        <div>
          <label htmlFor="securityListUrl">Security List URL</label>
          <input
            id="securityListUrl"
            value={settings.securityListUrl}
            onChange={(e) =>
              setSettings({ ...settings, securityListUrl: e.target.value })
            }
          />
        </div>
        <button className="primary">Запази OCI настройки</button>
      </form>
    </div>
  );
}
