import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import { config } from './config.js';
import searchRoutes from './routes/search.js';
import { AppError } from './utils/errors.js';

const app = express();
app.use(cors({ origin: config.clientUrl }));
app.use(express.json({ limit: '32kb' }));
app.get('/api/health', (_req, res) => res.json({
  status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
  configured: { gemini: Boolean(config.geminiApiKey), search: Boolean(config.searchApiKey), mongo: Boolean(config.mongoUri) }
}));
app.use('/api/search', searchRoutes);
app.use((_req, _res, next) => next(new AppError('Route not found.', 404, 'NOT_FOUND')));
app.use((error, _req, res, _next) => {
  if (error instanceof SyntaxError && 'body' in error) return res.status(400).json({ success: false, error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON.' } });
  const status = error.statusCode || 500;
  if (status >= 500) console.error(error);
  return res.status(status).json({ success: false, error: { code: error.code || 'INTERNAL_ERROR', message: status === 500 ? 'Something went wrong. Please try again.' : error.message } });
});

if (config.mongoUri) {
  mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 })
    .then(() => console.log('MongoDB connected'))
    .catch((error) => console.error(`MongoDB connection failed: ${error.message}`));
} else {
  console.warn('MONGODB_URI is not set; search and history endpoints will return 503.');
}

app.listen(config.port, () => console.log(`Shopping agent API listening on http://localhost:${config.port}`));
