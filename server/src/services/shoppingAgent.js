import Search from '../models/Search.js';
import { extractRequirements } from './requirementParser.js';
import { buildSearchQueries, webSearch } from './webSearch.js';
import { extractProducts } from './productExtractor.js';
import { compareProducts, filterProducts } from './productComparison.js';
import { generateRecommendations } from './recommendationGenerator.js';
import { AppError } from '../utils/errors.js';

export async function runShoppingAgent(query) {
  const requirements = await extractRequirements(query);
  const searchQueries = buildSearchQueries(requirements);
  const batches = await Promise.all(searchQueries.map((searchQuery) => webSearch(searchQuery)));
  const results = [...new Map(batches.flat().map((result) => [result.url, result])).values()];
  if (!results.length) throw new AppError('The web search returned no usable results. Try another query.', 404, 'NO_SEARCH_RESULTS');
  const products = await extractProducts(results, requirements.category);
  const eligible = filterProducts(products, requirements);
  const scored = compareProducts(eligible, requirements);
  const generated = await generateRecommendations(scored, requirements);
  const agentSteps = ['Requirements parsed with Gemini', `${results.length} public web results retrieved`, `${products.length} source-grounded product candidates extracted`, `${eligible.length} products passed price and category filters`, 'Products compared and recommendations generated'];
  const record = await Search.create({ userQuery: query, parsedRequirements: requirements, searchQueries, agentSteps, products, recommendations: generated.recommendations, summary: generated.summary });
  return {
    success: true, searchId: record.id, query, requirements, searchQueries, products,
    recommendations: generated.recommendations, summary: generated.summary,
    agentSteps,
    createdAt: record.createdAt
  };
}
