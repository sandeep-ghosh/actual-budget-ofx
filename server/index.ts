import path from "path";
import express from "express";
import cors from "cors";
import {
  connectToActual,
  getAccounts,
  getBudgetMonths,
  getTransactionsForMonth,
} from "./actual.js";
import { buildOfx } from "./ofx.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);
const distPath = path.join(process.cwd(), "dist");

app.use(cors({ origin: true }));
app.use(express.json());
app.use(express.static(distPath));

app.post("/api/connect", async (req, res) => {
  const { serverUrl, password } = req.body;

  if (
    typeof serverUrl !== "string" ||
    !serverUrl.trim() ||
    typeof password !== "string" ||
    !password.trim()
  ) {
    return res
      .status(400)
      .json({ error: "serverUrl and password are required" });
  }

  try {
    await connectToActual(serverUrl.trim(), password.trim());
    const accounts = await getAccounts();
    const months = await getBudgetMonths();

    return res.json({ connected: true, accounts, months });
  } catch (error: any) {
    console.error("Failed to connect to Actual Budget:", error);
    return res
      .status(500)
      .json({ error: error?.message ?? "Connection failed" });
  }
});

app.post("/api/export-ofx", async (req, res) => {
  const { accountId, month } = req.body;

  if (
    typeof accountId !== "string" ||
    !accountId.trim() ||
    typeof month !== "string" ||
    !month.trim()
  ) {
    return res
      .status(400)
      .json({ error: "accountId and month are required (format: YYYY-MM)" });
  }

  try {
    const accounts = await getAccounts();
    const account =
      accounts.find((a: any) => a.id === accountId) ||
      accounts.find((a: any) => String(a.id) === String(accountId));

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
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="ofx-${accountId}-${month}.ofx"`,
    );
    return res.send(ofx);
  } catch (error: any) {
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
  console.log(
    `Actual Budget OFX backend listening on http://localhost:${port}`,
  );
});

// Global error handlers to avoid process exit on unexpected promise rejections
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection at:", reason);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});
