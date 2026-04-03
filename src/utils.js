import crypto from 'node:crypto';

export function generateId() {
  const hex = crypto.randomBytes(6).toString('hex');
  return `int_${hex}`;
}

export function extractDomain(email) {
  if (!email || !email.includes('@')) return null;
  return email.split('@')[1].toLowerCase();
}

export function truncate(str, max = 3000) {
  if (!str) return '';
  if (str.length <= max) return str;
  return str.slice(0, max) + '...';
}

export function stripHtml(str) {
  if (!str) return '';
  return str
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export function timer() {
  const start = Date.now();
  return () => Date.now() - start;
}
