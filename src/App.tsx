import { FormEvent, useEffect, useState } from "react";

const SERVER_URL_STORAGE_KEY = "actual-budget-ofx.serverUrl";

function getSelectableMonths(months: string[]) {
  const now = new Date();
  const currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const oldestMonth = new Date(
    currentMonth.getFullYear(),
    currentMonth.getMonth() - 12,
    1,
  );

  return months
    .filter((month) => {
      if (!/^\d{4}-\d{2}$/.test(month)) {
        return false;
      }

      const [year, monthNumber] = month.split("-").map(Number);
      const monthDate = new Date(year, monthNumber - 1, 1);

      return monthDate >= oldestMonth && monthDate <= currentMonth;
    })
    .sort((a, b) => b.localeCompare(a));
}

function buildOfxFilename(accountName: string, month: string) {
  const safeAccountName =
    accountName
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
      .replace(/\s+/g, " ")
      .replace(/-+/g, "-") || "account";

  return `${safeAccountName}-${month}.ofx`;
}

function App() {
  const [serverUrl, setServerUrl] = useState("");
  const [password, setPassword] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<any[]>([]);
  const [months, setMonths] = useState<string[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const savedServerUrl = window.localStorage.getItem(SERVER_URL_STORAGE_KEY);

    if (savedServerUrl) {
      setServerUrl(savedServerUrl);
    }
  }, []);

  async function handleConnect(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setConnecting(true);

    const trimmedServerUrl = serverUrl.trim();

    try {
      const response = await fetch("/api/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ serverUrl: trimmedServerUrl, password }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Unable to connect to Actual Budget");
      }

      window.localStorage.setItem(SERVER_URL_STORAGE_KEY, trimmedServerUrl);

      const data = await response.json();
      const selectableMonths = getSelectableMonths(data.months ?? []);

      setAccounts(data.accounts ?? []);
      setMonths(selectableMonths);
      setSelectedAccount(data.accounts?.[0]?.id ?? null);
      setSelectedMonth(selectableMonths[0] ?? null);
      setConnected(true);
    } catch (err: any) {
      setError(err?.message ?? "Connection failed");
      setConnected(false);
    } finally {
      setConnecting(false);
    }
  }

  async function handleExport() {
    if (!selectedAccount || !selectedMonth)
      return setError("Select account and month");
    setError(null);
    setExporting(true);
    try {
      const res = await fetch("/api/export-ofx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: selectedAccount,
          month: selectedMonth,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Export failed");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const account = accounts.find(
        (acc) => String(acc.id) === String(selectedAccount),
      );

      a.href = url;
      a.download = buildOfxFilename(
        account?.name || selectedAccount,
        selectedMonth,
      );
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message ?? "Export failed");
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

            <div style={{ marginTop: "1rem", display: "grid", gap: "0.75rem" }}>
              <label>
                Account
                <select
                  value={selectedAccount ?? ""}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name || acc.id}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Month
                <select
                  value={selectedMonth ?? ""}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                >
                  {months.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>

              <button onClick={handleExport} disabled={exporting}>
                {exporting ? "Exporting…" : "Export OFX"}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleConnect} className="form-grid" autoComplete="on">
            <label htmlFor="actual-server-url">
              Server URL
              <input
                id="actual-server-url"
                name="actual-server-url"
                type="url"
                value={serverUrl}
                onChange={(event) => setServerUrl(event.target.value)}
                placeholder="https://your-actual-server.local"
                autoComplete="url"
                autoCapitalize="none"
                spellCheck={false}
                required
                autoFocus
              />
            </label>

            <label htmlFor="actual-server-password">
              Password
              <input
                id="actual-server-password"
                name="actual-server-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                placeholder="Server password or token"
                autoComplete="current-password"
                required
              />
            </label>

            <button type="submit" disabled={connecting}>
              {connecting ? "Connecting…" : "Connect"}
            </button>
          </form>
        )}

        {error ? <p className="error-message">{error}</p> : null}
      </section>
    </main>
  );
}

export default App;
