export default function ForwardForm({
  form,
  setForm,
  onSubmit,
  onCancel,
  submitLabel,
}) {
  return (
    <form className="stack" onSubmit={onSubmit}>
      <div className="grid-2">
        <div>
          <label htmlFor="listenPort">Listen port</label>
          <input
            id="listenPort"
            type="number"
            min="1"
            max="65535"
            value={form.listenPort}
            onChange={(e) => setForm({ ...form, listenPort: e.target.value })}
            required
          />
        </div>
        <div>
          <label htmlFor="destPort">Dest port</label>
          <input
            id="destPort"
            type="number"
            min="1"
            max="65535"
            value={form.destPort}
            onChange={(e) => setForm({ ...form, destPort: e.target.value })}
            required
          />
        </div>
      </div>

      <div>
        <label htmlFor="destIp">Dest IP</label>
        <input
          id="destIp"
          value={form.destIp}
          onChange={(e) => setForm({ ...form, destIp: e.target.value })}
          placeholder="46.10.60.194"
          required
        />
      </div>

      <div>
        <label htmlFor="protocol">Протокол</label>
        <select
          id="protocol"
          value={form.protocol}
          onChange={(e) => setForm({ ...form, protocol: e.target.value })}
        >
          <option value="both">TCP + UDP</option>
          <option value="tcp">TCP</option>
          <option value="udp">UDP</option>
        </select>
      </div>

      <div className="row">
        <button className="primary" type="submit">
          {submitLabel}
        </button>
        {onCancel ? (
          <button className="secondary" type="button" onClick={onCancel}>
            Отказ
          </button>
        ) : null}
      </div>
    </form>
  );
}
