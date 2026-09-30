import { askGemini } from './gemini.js';

export async function generateRecommendations(scoredProducts, requirements) {
  if (!scoredProducts.length) {
    return { summary: 'No products with a verifiable price and matching category were found in the retrieved search results. Try broadening the request or check the sources directly.', recommendations: [] };
  }
  const candidates = scoredProducts.slice(0, 8).map((product, id) => ({
    id, name: product.name, price: product.price, currency: product.currency, brand: product.brand,
    specifications: product.specifications, score: product.score, matchedRequirements: product.matchedRequirements,
    missingRequirements: product.missingRequirements, source: product.source, url: product.url, sourceSnippet: product.sourceSnippet
  }));
  const prompt = `You are writing concise shopping recommendations. Use ONLY the candidate products below; do not invent products, prices, specs, availability, discounts, or URLs. Recommend up to 5 products and return JSON only: {"summary":"brief comparison summary","recommendations":[{"id":0,"whyRecommended":"grounded reason, mention unknowns when relevant"}]}. Include only useful candidates and sort best fit first. Use their transparent score and matched/missing requirements. User requirements: ${JSON.stringify(requirements)}. Candidate data: ${JSON.stringify(candidates)}`;
  const generated = await askGemini(prompt, 'recommendation generation');
  const idMap = new Map(candidates.map((candidate) => [candidate.id, scoredProducts[candidate.id]]));
  const seen = new Set();
  const recommendations = (Array.isArray(generated?.recommendations) ? generated.recommendations : []).slice(0, 5).flatMap((item) => {
    const product = idMap.get(Number(item.id));
    if (!product || seen.has(product.url)) return [];
    seen.add(product.url);
    return [{
      name: product.name, price: product.price, currency: product.currency, brand: product.brand,
      specifications: product.specifications, score: product.score,
      matchedRequirements: product.matchedRequirements, missingRequirements: product.missingRequirements,
      whyRecommended: typeof item.whyRecommended === 'string' ? item.whyRecommended : 'This product scored well against the available source data.',
      source: product.source, url: product.url
    }];
  });
  const safeSummary = typeof generated.summary === 'string' && generated.summary.trim()
    ? generated.summary.trim()
    : `Compared ${scoredProducts.length} source-backed products using price, stated preferences, and specification coverage.`;
  return { summary: safeSummary, recommendations };
}
