import { config } from '../config.js';
import { AppError } from '../utils/errors.js';

function parseJson(text) {
  const clean = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(clean);
  } catch {
    throw new AppError('Gemini returned malformed JSON. Please try the search again.', 502, 'MALFORMED_AI_RESPONSE');
  }
}

export async function askGemini(prompt, label = 'AI request') {
  if (!config.geminiApiKey) {
    throw new AppError('Gemini is not configured. Add GEMINI_API_KEY to the server .env file.', 503, 'MISSING_GEMINI_KEY');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.geminiModel)}:generateContent?key=${encodeURIComponent(config.geminiApiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.2 }
        }),
        signal: controller.signal
      }
    );
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const detail = data?.error?.message || `${response.status} ${response.statusText}`;
      throw new AppError(`Gemini ${label} failed: ${detail}`, 502, 'GEMINI_ERROR');
    }
    const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('');
    if (!text) throw new AppError(`Gemini returned no content during ${label.toLowerCase()}.`, 502, 'EMPTY_AI_RESPONSE');
    return parseJson(text);
  } catch (error) {
    if (error.name === 'AbortError') throw new AppError('Gemini request timed out. Please retry.', 504, 'AI_TIMEOUT');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
