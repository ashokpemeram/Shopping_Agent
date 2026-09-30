import { askGemini } from './gemini.js';

const SPEC_KEYS = ['processor', 'ram', 'storage', 'gpu', 'display', 'resolution', 'refreshRate', 'camera', 'cameraQuality', 'battery', 'batteryLife', 'noiseCancellation', 'microphone', 'latency', 'connectivity', 'features', 'material', 'size', 'weight', 'comfort', 'waterResistance', 'compatibility'];

function evidenceText(result) {
  return `${result.title} ${result.snippet}`.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, '');
}

export function sourcePrice(result) {
  const text = `${result.title} ${result.snippet}`;
  const amounts = [...text.matchAll(/[\d,]+(?:\.\d{1,2})?/g)];
  for (const match of amounts) {
    const start = match.index;
    const end = start + match[0].length;
    const context = `${text.slice(Math.max(0, start - 16), start)} ${text.slice(end, end + 12)}`;
    let currency = null;
    if (context.includes('\u20b9') || /\bINR\b|\bRs\.?(?:\s|$)|\brupees?\b/i.test(context)) currency = 'INR';
    else if (context.includes('$') || /\bUSD\b|\bdollars?\b/i.test(context)) currency = 'USD';
    else if (context.includes('\u20ac') || /\bEUR\b|\beuros?\b/i.test(context)) currency = 'EUR';
    else if (context.includes('\u00a3') || /\bGBP\b|\bpounds?\b/i.test(context)) currency = 'GBP';
    const value = Number(match[0].replaceAll(',', ''));
    if (currency && Number.isFinite(value) && value > 0) return { price: value, currency };
  }
  return { price: null, currency: null };
}

export async function extractProducts(results, category) {
  if (!results.length) return [];
  const indexedResults = results.map((result, index) => ({ id: index, ...result }));
  const prompt = `Extract concrete individual products from these public web search results. Return JSON only in this schema: {"products":[{"sourceId":0,"isProduct":true,"name":"product name or null","brand":"brand or null","category":"category or null","specifications":{"processor":"verbatim value or null","ram":"verbatim value or null","storage":"verbatim value or null","gpu":"verbatim value or null","display":"verbatim value or null","resolution":"verbatim value or null","refreshRate":"verbatim value or null","camera":"verbatim value or null","cameraQuality":"verbatim value or null","battery":"verbatim value or null","batteryLife":"verbatim value or null","noiseCancellation":"verbatim value or null","microphone":"verbatim value or null","latency":"verbatim value or null","connectivity":"verbatim value or null","features":"verbatim value or null","material":"verbatim value or null","size":"verbatim value or null","weight":"verbatim value or null","comfort":"verbatim value or null","waterResistance":"verbatim value or null","compatibility":"verbatim value or null"}}]}. Include a result only when it clearly names an individual purchasable product relevant to category “${category}”; skip category pages, generic guides, and unrelated products. sourceId must exactly match an input id. Extract only text supported by that result's title/snippet. Copy specification values verbatim, and use null when missing. Do not produce price or URL fields. Results: ${JSON.stringify(indexedResults)}`;
  const extracted = await askGemini(prompt, 'product extraction');
  const byId = new Map(indexedResults.map((item) => [item.id, item]));
  const seen = new Set();
  return (Array.isArray(extracted?.products) ? extracted.products : []).flatMap((item) => {
    const source = byId.get(Number(item.sourceId));
    if (!source || !item.isProduct || seen.has(source.url)) return [];
    const evidence = evidenceText(source);
    const specs = {};
    for (const key of SPEC_KEYS) {
      const value = item.specifications?.[key];
      specs[key] = typeof value === 'string' && value.trim() && evidence.includes(value.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')) ? value.trim() : null;
    }
    const name = typeof item.name === 'string' && item.name.trim() && evidence.includes(item.name.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')) ? item.name.trim() : source.title;
    const brand = typeof item.brand === 'string' && item.brand.trim() && evidence.includes(item.brand.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')) ? item.brand.trim() : null;
    const { price, currency } = sourcePrice(source);
    const host = new URL(source.url).hostname.replace(/^www\./, '');
    seen.add(source.url);
    return [{ name, brand, category, price, currency, specifications: specs, source: host, url: source.url, sourceSnippet: source.snippet }];
  });
}
