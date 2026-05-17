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
  console.log(`[CONNECT] Starting connection to Actual Budget`);
  console.log(`[CONNECT] Server URL: ${serverUrl}`);
  console.log(`[CONNECT] Password length: ${password.length} chars`);

  await ensureInitialized();

  if (activeSyncId && activeSyncId === serverUrl) {
    console.log(`[CONNECT] Already connected to ${serverUrl}, skipping`);
    return;
  }

  try {
    // Preflight network check: attempt to GET the server root to catch obvious network/TLS errors
    const preflightUrl = serverUrl;
    console.log(`[PREFLIGHT] Testing network connectivity to: ${preflightUrl}`);

    try {
      console.log(`[PREFLIGHT] Sending GET request...`);
      const resp = await fetch(preflightUrl, { method: "GET" });
      console.log(
        `[PREFLIGHT] Response status: ${resp.status} ${resp.statusText}`,
      );
      console.log(`[PREFLIGHT] Response headers:`, {
        contentType: resp.headers.get("content-type"),
        contentLength: resp.headers.get("content-length"),
      });

      if (!resp.ok) {
        console.warn(
          `[PREFLIGHT] Server returned non-2xx: ${resp.status} ${resp.statusText}`,
        );
      } else {
        console.log(`[PREFLIGHT] Server is reachable and responding`);
      }
    } catch (preErr: any) {
      console.error(`[PREFLIGHT] Network error:`, {
        message: preErr?.message,
        code: preErr?.code,
        errno: preErr?.errno,
        syscall: preErr?.syscall,
        hostname: preErr?.hostname,
        port: preErr?.port,
        stack: preErr?.stack,
      });
      throw new Error(
        `Network preflight to ${preflightUrl} failed: ${preErr?.message ?? preErr}`,
      );
    }

    console.log(`[DOWNLOAD] Attempting to download budget from: ${serverUrl}`);
    await downloadBudget(serverUrl, { password });
    console.log(`[DOWNLOAD] Budget downloaded successfully`);

    console.log(`[SYNC] Syncing budget data...`);
    await sync();
    console.log(`[SYNC] Sync completed successfully`);

    activeSyncId = serverUrl;
    console.log(`[CONNECT] Connection successful, active sync ID set`);
  } catch (err: any) {
    console.error(`[CONNECT] Connection failed with error:`, {
      message: err?.message,
      code: err?.code,
      stack: err?.stack,
      cause: err?.cause,
    });
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
