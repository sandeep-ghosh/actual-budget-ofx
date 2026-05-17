import { FormEvent, useState } from 'react';

function App() {
  const [serverUrl, setServerUrl] = useState('');
  const [password, setPassword] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<any[]>([]);
  const [months, setMonths] = useState<string[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  async function handleConnect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setConnecting(true);
    try {
      const response = await fetch('/api/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serverUrl, password })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || 'Unable to connect to Actual Budget');
      }

      const data = await response.json();
      setAccounts(data.accounts ?? []);
      setMonths(data.months ?? []);
      setSelectedAccount(data.accounts?.[0]?.id ?? null);
      setSelectedMonth(data.months?.[0] ?? null);
      setConnected(true);
    } catch (err: any) {
      setError(err?.message ?? 'Connection failed');
      setConnected(false);
    } finally {
      setConnecting(false);
    }
  }

  async function handleExport() {
    if (!selectedAccount || !selectedMonth) return setError('Select account and month');
    setError(null);
    setExporting(true);
    try {
      const res = await fetch('/api/export-ofx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: selectedAccount, month: selectedMonth })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Export failed');
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ofx-${selectedAccount}-${selectedMonth}.ofx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message ?? 'Export failed');
    } finally {
      setExporting(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="card">
        <h1>Actual Budget OFX Exporter</h1>
        <p>Enter your Actual Budget server URL and password to connect.</p>

        {connected ? (
          <div className="status-card">
            <strong>Connected!</strong>
            <p>The backend is now ready to fetch accounts and export OFX.</p>

            <div style={{ marginTop: '1rem', display: 'grid', gap: '0.75rem' }}>
              <label>
                Account
                <select value={selectedAccount ?? ''} onChange={(e) => setSelectedAccount(e.target.value)}>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name || acc.id}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Month
                <select value={selectedMonth ?? ''} onChange={(e) => setSelectedMonth(e.target.value)}>
                  {months.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>

              <button onClick={handleExport} disabled={exporting}>
                {exporting ? 'Exporting…' : 'Export OFX'}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleConnect} className="form-grid">
            <label>
              Server URL
              <input
                value={serverUrl}
                onChange={(event) => setServerUrl(event.target.value)}
                placeholder="https://your-actual-server.local"
                required
                autoFocus
              />
            </label>

            <label>
              Password
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                placeholder="Server password or token"
                required
              />
            </label>

            <button type="submit" disabled={connecting}>
              {connecting ? 'Connecting…' : 'Connect'}
            </button>
          </form>
        )}

        {error ? <p className="error-message">{error}</p> : null}
      </section>
    </main>
  );
}

export default App;
