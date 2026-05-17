import path from "path";
import fs from "fs";
import express from "express";
import cors from "cors";
import {
  connectToActual,
  getAccounts,
  getBudgetMonths,
  getTransactionsForMonth,
} from "./actual.js";
import { buildOfx } from "./ofx.js";
import { validateAndNormalizeServerUrl } from "./server-url.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);
const distPath = path.join(process.cwd(), "dist");
const indexHtml = fs.readFileSync(path.join(distPath, "index.html"), "utf8");
const allowedOrigins = parseAllowedOrigins();
const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000);
const rateLimitMaxRequests = Number(process.env.RATE_LIMIT_MAX_REQUESTS ?? 60);
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

function parseAllowedOrigins() {
  return (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isAllowedOrigin(origin: string) {
  if (allowedOrigins.length > 0) {
    return allowedOrigins.includes(origin);
  }

  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(
    origin,
  );
}

function rateLimit(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
) {
  const now = Date.now();
  const key = req.ip || req.socket.remoteAddress || "unknown";
  const bucket = rateLimitBuckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(key, {
      count: 1,
      resetAt: now + rateLimitWindowMs,
    });
    return next();
  }

  if (bucket.count >= rateLimitMaxRequests) {
    res.setHeader(
      "Retry-After",
      String(Math.ceil((bucket.resetAt - now) / 1000)),
    );
    return res.status(429).json({ error: "Too many requests" });
  }

  bucket.count += 1;
  return next();
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

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origin not allowed by CORS"));
    },
  }),
);
app.use(express.json());
app.use(express.static(distPath));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/connect", rateLimit, async (req, res) => {
  const { serverUrl, password } = req.body;

  console.log(`[API /connect] Incoming request`);

  if (
    typeof serverUrl !== "string" ||
    !serverUrl.trim() ||
    typeof password !== "string" ||
    !password.trim()
  ) {
    console.error(
      `[API /connect] Invalid input: serverUrl or password missing`,
    );
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
  } catch (error: any) {
    const statusCode =
      error instanceof Error && error.message.includes("server URL")
        ? 400
        : 500;

    console.error(`[API /connect] Error:`, {
      message: error?.message,
      code: error?.code,
    });
    return res
      .status(statusCode)
      .json({ error: error?.message ?? "Connection failed" });
  }
});

app.post("/api/export-ofx", rateLimit, async (req, res) => {
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
      `attachment; filename="${buildOfxFilename(account.name || accountId, month)}"`,
    );
    return res.send(ofx);
  } catch (error: any) {
    console.error("Failed to generate OFX:", error);
    return res
      .status(500)
      .json({ error: error?.message ?? "Failed to generate OFX" });
  }
});

app.get("*", rateLimit, (_req, res) => {
  res.type("html").send(indexHtml);
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
