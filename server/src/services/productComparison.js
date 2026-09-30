const CATEGORY_SIGNALS = {
  laptop: ['laptop', 'notebook'], phone: ['phone', 'smartphone', 'mobile'], headphones: ['headphone', 'headset', 'earphone'],
  monitor: ['monitor', 'display'], shoes: ['shoe', 'sneaker', 'running footwear'], television: ['television', 'tv'],
  tablet: ['tablet', 'ipad'], camera: ['camera'], smartwatch: ['smartwatch', 'smart watch']
};

const CATEGORY_ATTRIBUTES = {
  laptop: ['processor', 'gpu', 'ram', 'storage', 'display'], phone: ['cameraQuality', 'processor', 'ram', 'storage', 'batteryLife'],
  headphones: ['noiseCancellation', 'microphone', 'batteryLife', 'latency', 'connectivity'], monitor: ['resolution', 'refreshRate', 'size', 'display', 'connectivity'],
  shoes: ['material', 'comfort', 'size', 'weight', 'waterResistance'], television: ['resolution', 'display', 'size', 'connectivity', 'features'],
  tablet: ['processor', 'display', 'ram', 'storage', 'batteryLife'], camera: ['cameraQuality', 'resolution', 'display', 'storage', 'features'],
  smartwatch: ['batteryLife', 'display', 'features', 'connectivity']
};

function normalize(text) { return String(text || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ''); }

function findCategoryKey(category, categories) {
  const normalizedCategory = normalize(category);
  return Object.keys(categories)
    .filter((key) => normalizedCategory.includes(normalize(key)) || categories[key].some((term) => normalizedCategory.includes(normalize(term))))
    .sort((a, b) => normalize(b).length - normalize(a).length)[0];
}

export function matchesCategory(product, requestedCategory) {
  const haystack = normalize(`${product.name} ${product.sourceSnippet}`);
  const matchingKey = findCategoryKey(requestedCategory, CATEGORY_SIGNALS);
  const signals = matchingKey ? CATEGORY_SIGNALS[matchingKey] : [requestedCategory];
  return signals.some((signal) => haystack.includes(normalize(signal)));
}

function comparePreference(key, desired, product) {
  const normalizedKey = normalize(key);
  const aliases = {
    dedicatedgpu: ['gpu'], ramgb: ['ram'], storagegb: ['storage'], camera: ['camera', 'cameraQuality'], cameraquality: ['cameraQuality', 'camera'],
    anc: ['noiseCancellation', 'features'], noisecancellation: ['noiseCancellation', 'features'], microphone: ['microphone', 'features'],
    mic: ['microphone', 'features'], latency: ['latency', 'features'], batteryhours: ['batteryLife', 'battery'], batterylife: ['batteryLife', 'battery'],
    refreshrate: ['refreshRate', 'display'], resolution: ['resolution', 'display'], displaysize: ['size', 'display'],
    waterproof: ['waterResistance', 'features'], waterresistance: ['waterResistance', 'features'], processor: ['processor'], cpu: ['processor']
  };
  const mappedKeys = aliases[normalizedKey];
  const possibleKeys = Object.keys(product.specifications).filter((specKey) => mappedKeys
    ? mappedKeys.includes(specKey)
    : normalizedKey.includes(normalize(specKey)) || normalize(specKey).includes(normalizedKey));
  const specValue = possibleKeys.map((specKey) => product.specifications[specKey]).find(Boolean);
  const actual = String(specValue || '');
  if (!actual) return { matched: false, unknown: true, label: `${key}: not verified in the source` };
  if (typeof desired === 'boolean') {
    const positive = /^(true|yes|required|dedicated)$/i.test(actual.trim());
    const negative = /^(false|no|integrated|none)$/i.test(actual.trim());
    const isDedicatedGpu = normalizedKey === 'dedicatedgpu' && /rtx|gtx|radeon\s*rx|discrete|dedicated|geforce/i.test(actual) && !/integrated|shared/i.test(actual);
    const featurePresent = ['anc', 'noisecancellation'].includes(normalizedKey) && /anc|active noise|noise cancel/i.test(actual);
    const waterPresent = ['waterproof', 'waterresistance'].includes(normalizedKey) && /ip\d|water resistant|waterproof/i.test(actual);
    const matched = desired ? positive || isDedicatedGpu || featurePresent || waterPresent : negative || /integrated/i.test(actual);
    return { matched, unknown: false, label: `${key}: ${matched ? 'matched' : `source says ${actual}`}` };
  }
  const desiredText = typeof desired === 'object' ? JSON.stringify(desired) : String(desired);
  const exactish = normalize(actual).includes(normalize(desiredText)) || normalize(desiredText).includes(normalize(actual));
  return { matched: exactish, unknown: false, label: `${key}: ${exactish ? 'matched' : `source says ${actual}`}` };
}

export function compareProducts(products, requirements) {
  const categoryKey = findCategoryKey(requirements.category, CATEGORY_ATTRIBUTES);
  const attributes = CATEGORY_ATTRIBUTES[categoryKey] || Object.keys(products[0]?.specifications || {}).filter((key) => products.some((p) => p.specifications[key])).slice(0, 5);
  const requestedPreferences = Object.entries(requirements.preferences || {});
  const budgetWeight = requirements.budget?.max ? 35 : 0;
  const preferenceTotal = requestedPreferences.length ? 45 : 0;
  const coverageWeight = 100 - budgetWeight - preferenceTotal;
  return products.map((product) => {
    const matchedRequirements = [];
    const missingRequirements = [];
    let score = 0;
    if (product.price != null && requirements.budget?.max && (!requirements.budget.currency || product.currency === requirements.budget.currency)) {
      if (product.price <= requirements.budget.max) {
        const ratio = product.price / requirements.budget.max;
        score += budgetWeight * (0.75 + 0.25 * (1 - ratio));
        matchedRequirements.push(`Within budget (${product.currency} ${product.price.toLocaleString('en-IN')})`);
      } else missingRequirements.push('Over the stated budget');
    } else if (product.price != null && requirements.budget?.max) {
      missingRequirements.push('Price currency does not match the budget currency');
    } else if (product.price != null) {
      matchedRequirements.push('Source lists a price');
    } else missingRequirements.push('Price not found in the search result');

    const preferenceWeight = requestedPreferences.length ? preferenceTotal / requestedPreferences.length : 0;
    for (const [key, desired] of requestedPreferences) {
      const comparison = comparePreference(key, desired, product);
      if (comparison.matched) { score += preferenceWeight; matchedRequirements.push(comparison.label); }
      else { missingRequirements.push(comparison.label); if (comparison.unknown) score += preferenceWeight * 0.2; }
    }

    const availableAttributes = attributes.filter((attribute) => product.specifications?.[attribute]);
    const unknownAttributes = attributes.filter((attribute) => !product.specifications?.[attribute]);
    const coverage = attributes.length ? (availableAttributes.length / attributes.length) * coverageWeight : coverageWeight * 0.6;
    score += coverage;
    if (availableAttributes.length) matchedRequirements.push(`Source verifies ${availableAttributes.join(', ')}`);
    if (unknownAttributes.length) missingRequirements.push(`Not specified: ${unknownAttributes.join(', ')}`);
    const ratio = requirements.budget?.max && product.price ? product.price / requirements.budget.max : null;
    const budgetFit = ratio == null ? null : `${Math.round(ratio * 100)}% of budget`;
    return {
      ...product,
      score: Math.max(0, Math.min(100, Math.round(score))),
      matchedRequirements,
      missingRequirements,
      budgetFit
    };
  }).sort((a, b) => b.score - a.score || (a.price ?? Infinity) - (b.price ?? Infinity));
}

export function filterProducts(products, requirements) {
  return products.filter((product) => product.price != null && matchesCategory(product, requirements.category) && (!requirements.budget?.max || (product.price <= requirements.budget.max && (!requirements.budget.currency || product.currency === requirements.budget.currency))));
}
