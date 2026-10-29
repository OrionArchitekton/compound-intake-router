import { loadConfig } from './config.js';
import { deliver } from './delivery.js';

export function resolveDestination(classification, config = loadConfig()) {
  const routes = config.routing.routes;
  const entry = Object.hasOwn(routes, classification.type) ? routes[classification.type] : null;
  if (entry?.action === 'log-only') return null;
  return (entry && Object.hasOwn(entry, classification.venture) ? entry[classification.venture] : null)
    || entry?.default || config.routing.fallbackChannel;
}

export async function route(normalized, classification, enrichment,
  { config = loadConfig(), env = process.env, fetchFn = fetch } = {}) {
  const destination = resolveDestination(classification, config);
  if (destination === null) return { destination: '(log-only)', delivered: false, mode: 'filtered' };
  const mode = env.DELIVERY_MODE || 'console';
  const text = [
    `[${classification.type.toUpperCase()}] ${classification.urgency.toUpperCase()} - ${classification.venture}`,
    `From: ${normalized.sender.name} <${normalized.sender.email}>`,
    `Subject: ${normalized.subject || '(no subject)'}`,
    `Reasoning: ${classification.reasoning}`, `Action: ${classification.suggestedAction}`,
    `Route: ${destination}`, `Intake: ${normalized.id}`,
  ].join('\n');
  try {
    await deliver({ id: normalized.id, destination, sender: normalized.sender,
      subject: normalized.subject, classification, enrichment, text }, env, fetchFn);
    return { destination, delivered: true, mode };
  } catch {
    // Deliberately omit URLs, provider error text and payloads (they may contain secrets).
    console.error('[router] Alert was not confirmed accepted; inspect the audit row');
    return { destination, delivered: false, mode, error: 'Delivery not confirmed' };
  }
}
