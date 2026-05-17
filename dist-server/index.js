import path from 'path';
import express from 'express';
import cors from 'cors';
import { connectToActual, getAccounts, getBudgetMonths } from './actual';
const app = express();
const port = Number(process.env.PORT ?? 4000);
const distPath = path.join(process.cwd(), 'dist');
app.use(cors({ origin: true }));
app.use(express.json());
app.use(express.static(distPath));
app.post('/api/connect', async (req, res) => {
    const { serverUrl, password } = req.body;
    if (typeof serverUrl !== 'string' || !serverUrl.trim() || typeof password !== 'string' || !password.trim()) {
        return res.status(400).json({ error: 'serverUrl and password are required' });
    }
    try {
        await connectToActual(serverUrl.trim(), password.trim());
        const accounts = await getAccounts();
        const months = await getBudgetMonths();
        return res.json({ connected: true, accounts, months });
    }
    catch (error) {
        console.error('Failed to connect to Actual Budget:', error);
        return res.status(500).json({ error: error?.message ?? 'Connection failed' });
    }
});
app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
});
app.listen(port, () => {
    console.log(`Actual Budget OFX backend listening on http://localhost:${port}`);
});
//# sourceMappingURL=index.js.map