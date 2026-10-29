import { loadConfig } from './config.js';
import { deliver } from './delivery.js';

const oneLine = value => String(value ?? '').replace(/[\r\n\u2028\u2029]+/g, ' ');

export function resolveDestination(classification, config = loadConfig()) {
  if (classification.type === 'spam') return null;
  if (classification.type === 'unknown') return config.routing.fallbackChannel;
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
    `From: ${oneLine(normalized.sender.name)} <${oneLine(normalized.sender.email)}>`,
    `Subject: ${oneLine(normalized.subject) || '(no subject)'}`,
    `Reasoning: ${oneLine(classification.reasoning)}`, `Action: ${oneLine(classification.suggestedAction)}`,
    `Route: ${oneLine(destination)}`, `Intake: ${oneLine(normalized.id)}`,
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
