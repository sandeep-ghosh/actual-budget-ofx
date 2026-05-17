import path from "path";
import express from "express";
import cors from "cors";
import { connectToActual, getAccounts, getBudgetMonths, getTransactionsForMonth, } from "./actual.js";
import { buildOfx } from "./ofx.js";
import { validateAndNormalizeServerUrl } from "./server-url.js";
const app = express();
const port = Number(process.env.PORT ?? 4000);
const distPath = path.join(process.cwd(), "dist");
function buildOfxFilename(accountName, month) {
    const safeAccountName = accountName
        .trim()
        .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
        .replace(/\s+/g, " ")
        .replace(/-+/g, "-") || "account";
    return `${safeAccountName}-${month}.ofx`;
}
app.use(cors({ origin: true }));
app.use(express.json());
app.use(express.static(distPath));
app.post("/api/connect", async (req, res) => {
    const { serverUrl, password } = req.body;
    console.log(`[API /connect] Incoming request`);
    console.log(`[API /connect] serverUrl: ${serverUrl}`);
    console.log(`[API /connect] password length: ${password?.length ?? 0} chars`);
    if (typeof serverUrl !== "string" ||
        !serverUrl.trim() ||
        typeof password !== "string" ||
        !password.trim()) {
        console.error(`[API /connect] Invalid input: serverUrl or password missing`);
        return res
            .status(400)
            .json({ error: "serverUrl and password are required" });
    }
    try {
        const normalizedServerUrl = validateAndNormalizeServerUrl(serverUrl);
        console.log(`[API /connect] Calling connectToActual...`);
        await connectToActual(normalizedServerUrl, password.trim());
        console.log(`[API /connect] Fetching accounts...`);
        const accounts = await getAccounts();
        console.log(`[API /connect] Got ${accounts.length} accounts`);
        console.log(`[API /connect] Fetching budget months...`);
        const months = await getBudgetMonths();
        console.log(`[API /connect] Got ${months.length} months`);
        console.log(`[API /connect] Connection successful, returning response`);
        return res.json({ connected: true, accounts, months });
    }
    catch (error) {
        const statusCode = error instanceof Error && error.message.includes("server URL")
            ? 400
            : 500;
        console.error(`[API /connect] Error:`, {
            message: error?.message,
            code: error?.code,
            stack: error?.stack,
        });
        return res
            .status(statusCode)
            .json({ error: error?.message ?? "Connection failed" });
    }
});
app.post("/api/export-ofx", async (req, res) => {
    const { accountId, month } = req.body;
    if (typeof accountId !== "string" ||
        !accountId.trim() ||
        typeof month !== "string" ||
        !month.trim()) {
        return res
            .status(400)
            .json({ error: "accountId and month are required (format: YYYY-MM)" });
    }
    try {
        const accounts = await getAccounts();
        const account = accounts.find((a) => a.id === accountId) ||
            accounts.find((a) => String(a.id) === String(accountId));
        if (!account) {
            return res.status(404).json({ error: "Account not found" });
        }
        const transactions = await getTransactionsForMonth(accountId, month);
        const [yearStr, monthStr] = month.split("-");
        const year = Number(yearStr);
        const monthNum = Number(monthStr);
        const startDate = `${year}-${String(monthNum).padStart(2, "0")}-01`;
        const endDateObj = new Date(year, monthNum, 0);
        const endDate = `${year}-${String(monthNum).padStart(2, "0")}-${String(endDateObj.getDate()).padStart(2, "0")}`;
        const ofx = buildOfx(account, transactions, startDate, endDate);
        res.setHeader("Content-Type", "application/x-ofx");
        res.setHeader("Content-Disposition", `attachment; filename="${buildOfxFilename(account.name || accountId, month)}"`);
        return res.send(ofx);
    }
    catch (error) {
        console.error("Failed to generate OFX:", error);
        return res
            .status(500)
            .json({ error: error?.message ?? "Failed to generate OFX" });
    }
});
app.get("*", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
});
app.listen(port, () => {
    console.log(`Actual Budget OFX backend listening on http://localhost:${port}`);
});
// Global error handlers to avoid process exit on unexpected promise rejections
process.on("unhandledRejection", (reason) => {
    console.error("Unhandled Rejection at:", reason);
});
process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception:", err);
});
//# sourceMappingURL=index.js.map