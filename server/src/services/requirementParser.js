import { askGemini } from './gemini.js';
import { AppError } from '../utils/errors.js';

export async function extractRequirements(query) {
  const prompt = `You are a shopping requirements parser. Convert the request into JSON only, without markdown.
Keep explicit requirements separate from reasonable inferred preferences. Never present an inference as an explicit request.
Support any shopping category. Use INR when the user uses ₹, Rs, rupees, or gives an Indian shopping context; otherwise use the stated currency or null.
Schema:
{
  "category": "short category name",
  "budget": { "currency": "INR or other ISO code or null", "max": number or null },
  "useCase": "string or null",
  "explicitRequirements": ["requirements clearly stated by user"],
  "inferredPreferences": ["reasonable assumptions, each marked as inferred"],
  "preferences": { "attributeKey": "desired value" },
  "searchKeywords": ["3 to 6 useful search phrases"]
}
Use only obvious preferences. If the user did not specify RAM, GPU, storage, or another attribute, do not add it as a requirement; it may be inferred only when clearly useful and must stay in inferredPreferences/preferences with its inferred status reflected in the description. Do not invent a budget. Category should be a concise noun phrase.
User request: ${JSON.stringify(query)}`;
  const data = await askGemini(prompt, 'requirement extraction');
  if (!data || typeof data.category !== 'string' || !data.category.trim()) {
    throw new AppError('Could not identify a product category. Try a clearer request, such as “wireless headphones under ₹10,000”.', 422, 'INVALID_REQUIREMENTS');
  }
  const max = Number(data?.budget?.max);
  return {
    category: data.category.trim(),
    budget: {
      currency: typeof data?.budget?.currency === 'string' ? data.budget.currency : null,
      max: Number.isFinite(max) && max > 0 ? max : null
    },
    useCase: typeof data.useCase === 'string' && data.useCase.trim() ? data.useCase.trim() : null,
    explicitRequirements: Array.isArray(data.explicitRequirements) ? data.explicitRequirements.filter((v) => typeof v === 'string') : [],
    inferredPreferences: Array.isArray(data.inferredPreferences) ? data.inferredPreferences.filter((v) => typeof v === 'string') : [],
    preferences: data.preferences && typeof data.preferences === 'object' && !Array.isArray(data.preferences) ? data.preferences : {},
    searchKeywords: Array.isArray(data.searchKeywords) ? data.searchKeywords.filter((v) => typeof v === 'string').slice(0, 6) : []
  };
}
