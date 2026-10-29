import { generateId, extractDomain, truncate } from './utils.js';

export function normalize(raw) {
  const errors = [];
  const invalid = () => ({ ok: false, errors: ['Expected a sender email and text body or subject'] });
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return invalid();
  if (raw.sender !== undefined && (!raw.sender || typeof raw.sender !== 'object' || Array.isArray(raw.sender))) {
    return invalid();
  }
  const textFields = ['email', 'from', 'body', 'message', 'text', 'subject', 'name', 'company', 'source', 'receivedAt'];
  if (textFields.some(key => raw[key] !== undefined && typeof raw[key] !== 'string')) return invalid();
  if (['email', 'name', 'company'].some(key => raw.sender?.[key] !== undefined &&
      typeof raw.sender[key] !== 'string')) return invalid();

  // Extract sender — handle multiple shapes
  const sender = raw.sender || {};
  const email = sender.email || raw.email || raw.from || null;
  if (!email) errors.push('sender.email is required');
  else if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Invalid sender email');

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
        name: truncate(sender.name || raw.name || email.split('@')[0], 200),
        email,
        domain,
        company: truncate(sender.company || raw.company || domain, 200) || null,
      },
      subject: truncate(raw.subject, 500) || null,
      body: truncate(body),
      bodyPreview: truncate(body, 200),
      source: raw.source || 'unknown',
    },
  };
}
