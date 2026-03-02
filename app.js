import express from 'express';
import 'dotenv/config';
import identityRoutes from './src/routes/identityRoutes.js';
import errorHandler from './src/middleware/errorHandler.js';
import logger from './src/utils/logger.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(express.json());

// Optional: log every incoming request
app.use((req, _res, next) => {
    logger.info(`→ ${req.method} ${req.originalUrl}`);
    next();
});

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/', identityRoutes);

// Health-check (useful for deployment platforms)
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Error Handler ───────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    logger.info(`Server listening on http://localhost:${PORT}`);
});

export default app;
