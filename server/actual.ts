import os from "os";
import path from "path";
import fs from "fs";
import {
  init,
  shutdown,
  downloadBudget,
  sync,
  getAccounts as fetchAccounts,
  getBudgetMonths as fetchBudgetMonths,
  getTransactions,
  utils,
} from "@actual-app/api";

let hasStarted = false;
let activeSyncId: string | null = null;

async function ensureInitialized() {
  if (!hasStarted) {
    const dataDir =
      process.env.ACTUAL_DATA_DIR ??
      path.join(os.tmpdir(), "actual-budget-ofx");

    // Ensure the data directory exists before initializing the Actual API.
    try {
      fs.mkdirSync(dataDir, { recursive: true });
    } catch (err) {
      console.error(
        "Unable to create data directory for Actual API:",
        dataDir,
        err,
      );
      throw err;
    }

    await init({ dataDir } as any);
    hasStarted = true;
  }
}

export async function connectToActual(serverUrl: string, password: string) {
  await ensureInitialized();
  if (activeSyncId && activeSyncId === serverUrl) {
    return;
  }

  // Preflight network check: attempt to GET the server root to catch obvious network/TLS errors
  try {
    const preflightUrl = serverUrl;
    try {
      const resp = await fetch(preflightUrl, { method: "GET" });
      // If the server responds with non-2xx/3xx, still proceed — Actual server often returns HTML at root.
      // But log status for debugging.
      if (!resp.ok) {
        console.warn(
          `Preflight GET ${preflightUrl} returned ${resp.status} ${resp.statusText}`,
        );
      }
    } catch (preErr: any) {
      console.error(
        "Preflight request to Actual server failed:",
        preErr?.message ?? preErr,
      );
      throw new Error(
        `Network preflight to Actual server failed: ${preErr?.message ?? preErr}`,
      );
    }

    await downloadBudget(serverUrl, { password });
    await sync();
    activeSyncId = serverUrl;
  } catch (err: any) {
    console.error("connectToActual failed:", err?.stack ?? err);
    throw new Error(
      err?.message ?? "Failed to download or sync budget from Actual server",
    );
  }
}

export async function getAccounts() {
  await ensureInitialized();
  return await fetchAccounts();
}

export async function getBudgetMonths() {
  await ensureInitialized();
  return await fetchBudgetMonths();
}

export async function getTransactionsForMonth(
  accountId: string,
  month: string,
) {
  await ensureInitialized();
  const [year, monthPart] = month.split("-").map(Number);
  const start = `${year}-${String(monthPart).padStart(2, "0")}-01`;
  const endDate = new Date(year, monthPart, 0);
  const end = `${year}-${String(monthPart).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;

  const transactions = await getTransactions(accountId, start, end);
  return transactions.map((transaction: any) => ({
    ...transaction,
    amount:
      typeof transaction.amount === "number"
        ? utils.integerToAmount(transaction.amount)
        : transaction.amount,
  }));
}

export async function disconnectActual() {
  if (hasStarted) {
    await shutdown();
    hasStarted = false;
    activeSyncId = null;
  }
}
