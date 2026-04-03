import { generateId, extractDomain, truncate } from './utils.js';

export function normalize(raw) {
  const errors = [];

  // Extract sender — handle multiple shapes
  const sender = raw.sender || {};
  const email = sender.email || raw.email || raw.from || null;
  if (!email) errors.push('sender.email is required');

  const body = raw.body || raw.message || raw.text || '';
  if (!body && !raw.subject) errors.push('body or subject is required');

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const domain = extractDomain(email);

  return {
    ok: true,
    payload: {
      id: generateId(),
      receivedAt: raw.receivedAt || new Date().toISOString(),
      sender: {
        name: sender.name || raw.name || email.split('@')[0],
        email,
        domain,
        company: sender.company || raw.company || domain || null,
      },
      subject: raw.subject || null,
      body: truncate(body),
      bodyPreview: truncate(body, 200),
      source: raw.source || 'unknown',
    },
  };
}
