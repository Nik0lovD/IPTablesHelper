import { useEffect, useState } from 'react';
import { api } from '../api.js';
import ForwardForm from './ForwardForm.jsx';

const emptyForm = {
  listenPort: '',
  destIp: '',
  destPort: '',
  protocol: 'both',
};

export default function Dashboard() {
  const [forwards, setForwards] = useState([]);
  const [status, setStatus] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [items, info] = await Promise.all([
        api.getForwards(),
        api.status(),
      ]);
      setForwards(items);
      setStatus(info);
    } catch (error) {
      setMessage({ type: 'warn', text: error.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(forward) {
    setEditingId(forward.id);
    setForm({
      listenPort: String(forward.listenPort),
      destIp: forward.destIp,
      destPort: String(forward.destPort),
      protocol: forward.protocol,
    });
    setMessage(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage(null);
    const payload = {
      listenPort: Number(form.listenPort),
      destIp: form.destIp.trim(),
      destPort: Number(form.destPort),
      protocol: form.protocol,
    };

    try {
      const result = editingId
        ? await api.updateForward(editingId, payload)
        : await api.createForward(payload);

      setMessage({
        type: result.oci?.success ? 'ok' : 'warn',
        text: result.oci?.success
          ? result.oci.message
          : `${result.oci?.message || 'iptables е обновен.'} Отвори security list ръчно.`,
        url: result.oci?.securityListUrl,
      });

      cancelEdit();
      await load();
    } catch (error) {
      setMessage({ type: 'warn', text: error.message });
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Да изтрия това пренасочване?')) return;
    setMessage(null);
    try {
      const result = await api.deleteForward(id);
      setMessage({
        type: result.oci?.success ? 'ok' : 'warn',
        text: result.oci?.success
          ? 'Правилото е изтрито.'
          : `${result.oci?.message || 'iptables е обновен.'} Провери security list ръчно.`,
        url: result.oci?.securityListUrl,
      });
      await load();
    } catch (error) {
      setMessage({ type: 'warn', text: error.message });
    }
  }

  return (
    <div className="stack">
      {status ? (
        <div className="card">
          <div className="row">
            <span className={`badge ${status.dryRun ? 'warn' : 'ok'}`}>
              {status.dryRun ? 'Dry-run режим' : 'Linux iptables режим'}
            </span>
            <span className={`badge ${status.oci.configured ? 'ok' : 'warn'}`}>
              {status.oci.configured ? 'OCI ключове: да' : 'OCI ключове: не'}
            </span>
            {status.oci.connection ? (
              <span className={`badge ${status.oci.connection.ok ? 'ok' : 'warn'}`}>
                {status.oci.connection.ok
                  ? 'OCI връзка: OK'
                  : `OCI: ${status.oci.connection.message}`}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {message ? (
        <div className={`alert ${message.type}`}>
          <div>{message.text}</div>
          {message.url ? (
            <div style={{ marginTop: 8 }}>
              <a href={message.url} target="_blank" rel="noreferrer">
                Отвори Oracle Cloud security list
              </a>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="card">
        <h2>{editingId ? 'Редакция' : 'Ново пренасочване'}</h2>
        <ForwardForm
          form={form}
          setForm={setForm}
          onSubmit={handleSubmit}
          onCancel={editingId ? cancelEdit : null}
          submitLabel={editingId ? 'Запази' : 'Добави'}
        />
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2>Активни пренасочвания</h2>
          <button className="secondary" onClick={load} disabled={loading}>
            Обнови
          </button>
        </div>

        {loading ? (
          <div className="empty">Зареждане...</div>
        ) : forwards.length === 0 ? (
          <div className="empty">Няма зададени пренасочвания.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Listen</th>
                <th>Към</th>
                <th>Протокол</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {forwards.map((forward) => (
                <tr key={forward.id}>
                  <td>{forward.listenPort}</td>
                  <td>
                    {forward.destIp}:{forward.destPort}
                  </td>
                  <td>{forward.protocol.toUpperCase()}</td>
                  <td>
                    <div className="row">
                      <button className="secondary" onClick={() => startEdit(forward)}>
                        Редактирай
                      </button>
                      <button className="danger" onClick={() => handleDelete(forward.id)}>
                        Изтрий
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
