import os from 'os';
import path from 'path';
import { init, shutdown, downloadBudget, sync, getAccounts as fetchAccounts, getBudgetMonths as fetchBudgetMonths, getTransactions, utils } from '@actual-app/api';
let hasStarted = false;
let activeSyncId = null;
async function ensureInitialized() {
    if (!hasStarted) {
        const dataDir = path.join(os.tmpdir(), 'actual-budget-ofx');
        await init({ dataDir });
        hasStarted = true;
    }
}
export async function connectToActual(serverUrl, password) {
    await ensureInitialized();
    if (activeSyncId && activeSyncId === serverUrl) {
        return;
    }
    await downloadBudget(serverUrl, { password });
    await sync();
    activeSyncId = serverUrl;
}
export async function getAccounts() {
    await ensureInitialized();
    return await fetchAccounts();
}
export async function getBudgetMonths() {
    await ensureInitialized();
    return await fetchBudgetMonths();
}
export async function getTransactionsForMonth(accountId, month) {
    await ensureInitialized();
    const [year, monthPart] = month.split('-').map(Number);
    const start = `${year}-${String(monthPart).padStart(2, '0')}-01`;
    const endDate = new Date(year, monthPart, 0);
    const end = `${year}-${String(monthPart).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;
    const transactions = await getTransactions(accountId, start, end);
    return transactions.map((transaction) => ({
        ...transaction,
        amount: typeof transaction.amount === 'number' ? utils.integerToAmount(transaction.amount) : transaction.amount
    }));
}
export async function disconnectActual() {
    if (hasStarted) {
        await shutdown();
        hasStarted = false;
        activeSyncId = null;
    }
}
//# sourceMappingURL=actual.js.map