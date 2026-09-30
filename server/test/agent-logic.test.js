import test from 'node:test';
import assert from 'node:assert/strict';
import { sourcePrice } from '../src/services/productExtractor.js';
import { buildSearchQueries } from '../src/services/webSearch.js';
import { compareProducts, filterProducts } from '../src/services/productComparison.js';

test('only recognizes prices with an explicit currency marker', () => {
  assert.deepEqual(sourcePrice({ title: 'Zenbook laptop', snippet: 'Now ₹ 64,990 with 16GB RAM' }), { price: 64990, currency: 'INR' });
  assert.deepEqual(sourcePrice({ title: 'Gaming headset', snippet: 'Rs. 9,990 with low latency' }), { price: 9990, currency: 'INR' });
  assert.deepEqual(sourcePrice({ title: 'Laptop 2025', snippet: 'Model 2025 and 16GB RAM' }), { price: null, currency: null });
  assert.deepEqual(sourcePrice({ title: 'Headset', snippet: 'US$ 99.99' }), { price: 99.99, currency: 'USD' });
});

test('search planning uses the requested category and preferences', () => {
  const queries = buildSearchQueries({
    category: 'wireless headphones', budget: { max: 10000, currency: 'INR' }, useCase: 'gaming',
    preferences: { latency: 'low latency' }, searchKeywords: ['gaming headset low latency']
  });
  assert.equal(queries.length, 3);
  assert.ok(queries.every((query) => query.toLowerCase().includes('headphones')));
  assert.ok(queries.some((query) => query.includes('10000')));
});

test('deterministically removes over budget, unpriced, and wrong category products', () => {
  const products = [
    { name: 'Aero 16 laptop', category: 'laptop', price: 65000, currency: 'INR', specifications: {}, sourceSnippet: 'Aero 16 laptop' },
    { name: 'Premium laptop', category: 'laptop', price: 72000, currency: 'INR', specifications: {}, sourceSnippet: 'Premium laptop' },
    { name: 'Budget laptop', category: 'laptop', price: null, currency: null, specifications: {}, sourceSnippet: 'Budget laptop' },
    { name: 'Wireless headset', category: 'headphones', price: 9000, currency: 'INR', specifications: {}, sourceSnippet: 'Wireless gaming headset' }
  ];
  const eligible = filterProducts(products, { category: 'laptop', budget: { max: 70000, currency: 'INR' } });
  assert.deepEqual(eligible.map((product) => product.name), ['Aero 16 laptop']);
});

test('comparison provides explainable scores and matched or missing evidence', () => {
  const product = {
    name: 'Aero 16 laptop', category: 'laptop', price: 65000, currency: 'INR', sourceSnippet: 'Aero 16 laptop 16GB RAM',
    specifications: { processor: 'Ryzen 7', ram: '16GB', storage: null, gpu: 'RTX 4050', display: '15.6 inch' }
  };
  const [scored] = compareProducts([product], { category: 'laptop', budget: { max: 70000, currency: 'INR' }, preferences: { ram: '16GB', dedicatedGpu: true } });
  assert.ok(scored.score > 80 && scored.score <= 100);
  assert.ok(scored.matchedRequirements.some((item) => item.includes('ram')));
  assert.ok(scored.matchedRequirements.some((item) => item.includes('dedicatedGpu')));
  assert.ok(scored.missingRequirements.some((item) => item.includes('storage')));
});

test('comparison uses headphone specific attributes and boolean ANC preferences', () => {
  const product = {
    name: 'Cloud wireless headset', category: 'headphones', price: 8500, currency: 'INR', sourceSnippet: 'Cloud wireless gaming headset',
    specifications: { noiseCancellation: 'Active noise cancellation', microphone: 'Detachable microphone', batteryLife: '40 hours', latency: 'Low latency mode', connectivity: 'Bluetooth 5.3' }
  };
  const [scored] = compareProducts([product], { category: 'headphones', budget: { max: 10000, currency: 'INR' }, preferences: { anc: true, latency: 'low latency' } });
  assert.equal(scored.missingRequirements.length, 0);
  assert.ok(scored.matchedRequirements.some((item) => item.includes('anc')));
  assert.ok(scored.score >= 92);
});
