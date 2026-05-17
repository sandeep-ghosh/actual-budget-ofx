import os from "os";
import path from "path";
import fs from "fs";
import {
  init,
  shutdown,
  downloadBudget,
  sync,
  getBudgets,
  getAccounts as fetchAccounts,
  getBudgetMonths as fetchBudgetMonths,
  getTransactions,
  utils,
} from "@actual-app/api";
import { validateAndNormalizeServerUrl } from "./server-url.js";

let hasStarted = false;
let activeServerUrl: string | null = null;
let activeSyncId: string | null = null;

async function ensureInitialized(serverUrl?: string, password?: string) {
  if (hasStarted && serverUrl && activeServerUrl !== serverUrl) {
    await shutdown();
    hasStarted = false;
    activeServerUrl = null;
    activeSyncId = null;
  }

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

    await init({
      dataDir,
      ...(serverUrl ? { serverURL: serverUrl } : {}),
      ...(password ? { password } : {}),
    } as any);
    hasStarted = true;
    activeServerUrl = serverUrl ?? null;
  }
}

async function resolveBudgetSyncId(requestedSyncId?: string) {
  const envSyncId = process.env.ACTUAL_BUDGET_SYNC_ID?.trim();
  const syncId = requestedSyncId?.trim() || envSyncId;

  if (syncId) {
    return syncId;
  }

  const budgets = await getBudgets();
  const firstBudget = budgets[0];

  if (!firstBudget?.groupId) {
    throw new Error(
      "No Actual budget files found. Set ACTUAL_BUDGET_SYNC_ID if your server has multiple or hidden budgets.",
    );
  }

  return firstBudget.groupId;
}

export async function connectToActual(
  serverUrl: string,
  password: string,
  budgetSyncId?: string,
) {
  const normalizedServerUrl = validateAndNormalizeServerUrl(serverUrl);

  console.log(`[CONNECT] Starting connection to Actual Budget`);
  console.log(`[CONNECT] Server URL: ${normalizedServerUrl}`);
  console.log(`[CONNECT] Password length: ${password.length} chars`);

  try {
    await ensureInitialized(normalizedServerUrl, password);

    const syncId = await resolveBudgetSyncId(budgetSyncId);

    if (activeServerUrl === normalizedServerUrl && activeSyncId === syncId) {
      console.log(
        `[CONNECT] Already connected to ${normalizedServerUrl}, skipping`,
      );
      return;
    }

    console.log(`[DOWNLOAD] Attempting to download budget: ${syncId}`);
    await downloadBudget(syncId, { password });
    console.log(`[DOWNLOAD] Budget downloaded successfully`);

    console.log(`[SYNC] Syncing budget data...`);
    await sync();
    console.log(`[SYNC] Sync completed successfully`);

    activeSyncId = syncId;
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
    activeServerUrl = null;
    activeSyncId = null;
  }
}
