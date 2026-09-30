import { Router } from 'express';
import mongoose from 'mongoose';
import Search from '../models/Search.js';
import { runShoppingAgent } from '../services/shoppingAgent.js';
import { AppError, asyncHandler } from '../utils/errors.js';

const router = Router();
function requireDatabase() {
  if (mongoose.connection.readyState !== 1) throw new AppError('MongoDB is unavailable. Set MONGODB_URI and ensure the database is running, then retry.', 503, 'DATABASE_UNAVAILABLE');
}

router.post('/', asyncHandler(async (req, res) => {
  const query = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
  if (query.length < 4 || query.length > 500) throw new AppError('Enter a shopping request between 4 and 500 characters.', 400, 'INVALID_QUERY');
  requireDatabase();
  res.status(200).json(await runShoppingAgent(query));
}));

router.get('/history', asyncHandler(async (_req, res) => {
  requireDatabase();
  const searches = await Search.find().sort({ createdAt: -1 }).limit(30).select('userQuery parsedRequirements products recommendations summary createdAt');
  res.json({ success: true, history: searches.map((item) => ({
    id: item.id, query: item.userQuery, category: item.parsedRequirements?.category || null,
    productCount: item.products.length, recommendationCount: item.recommendations.length, createdAt: item.createdAt
  })) });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  requireDatabase();
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError('Invalid search ID.', 400, 'INVALID_SEARCH_ID');
  const search = await Search.findById(req.params.id);
  if (!search) throw new AppError('Saved search not found.', 404, 'SEARCH_NOT_FOUND');
  res.json({ success: true, searchId: search.id, query: search.userQuery, requirements: search.parsedRequirements, searchQueries: search.searchQueries, agentSteps: search.agentSteps, products: search.products, recommendations: search.recommendations, summary: search.summary, createdAt: search.createdAt });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  requireDatabase();
  if (!mongoose.isValidObjectId(req.params.id)) throw new AppError('Invalid search ID.', 400, 'INVALID_SEARCH_ID');
  const deleted = await Search.findByIdAndDelete(req.params.id);
  if (!deleted) throw new AppError('Saved search not found.', 404, 'SEARCH_NOT_FOUND');
  res.json({ success: true, deletedId: req.params.id });
}));

export default router;
