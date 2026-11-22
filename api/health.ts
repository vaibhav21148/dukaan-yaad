// GET /api/health -> which free services are configured (never reveals keys).
import { json } from './_lib/http.js';
import { configuredProviders } from './_lib/llm.js';

export function GET(): Response {
  const providers = configuredProviders();
  return json({ llm: providers.length > 0, providers, stt: !!process.env.SARVAM_API_KEY?.trim() });
}
