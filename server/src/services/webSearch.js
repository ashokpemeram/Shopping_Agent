import { config } from '../config.js';
import { AppError } from '../utils/errors.js';

export async function webSearch(query) {
  if (!config.searchApiKey) {
    throw new AppError('Web search is not configured. Add SEARCH_API_KEY to the server .env file.', 503, 'MISSING_SEARCH_KEY');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(config.searchApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: config.searchApiKey, query, search_depth: 'basic', max_results: 8, include_answer: false }),
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = data?.detail || data?.message || `${response.status} ${response.statusText}`;
      throw new AppError(`Web search failed: ${detail}`, 502, 'SEARCH_PROVIDER_ERROR');
    }
    return (Array.isArray(data.results) ? data.results : [])
      .filter((item) => typeof item.url === 'string' && /^https?:\/\//i.test(item.url))
      .map((item) => ({ title: String(item.title || item.url), url: item.url, snippet: String(item.content || item.snippet || '') }));
  } catch (error) {
    if (error.name === 'AbortError') throw new AppError('Web search timed out. Please retry.', 504, 'SEARCH_TIMEOUT');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function buildSearchQueries(requirements) {
  const category = requirements.category;
  const budget = requirements.budget?.max;
  const cap = budget ? ` under ${budget} ${requirements.budget.currency || 'INR'}` : '';
  const location = requirements.budget?.currency === 'INR' ? ' India' : '';
  const useCase = requirements.useCase ? ` ${requirements.useCase}` : '';
  const preferences = Object.entries(requirements.preferences || {}).slice(0, 2).map(([key, value]) => `${value} ${key}`);
  const candidates = [
    `${category}${useCase}${cap}${location} price specifications`,
    ...preferences.map((preference) => `${category} ${preference}${cap}${location}`),
    ...(requirements.searchKeywords || []).slice(0, 2).map((keyword) => `${category} ${keyword}${cap}${location}`)
  ];
  return [...new Set(candidates.map((item) => item.trim()).filter(Boolean))].slice(0, 3);
}
