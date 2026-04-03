import { stripHtml } from './utils.js';

export async function enrich(sender) {
  const result = {
    domain: sender.domain,
    hasWebsite: false,
    pageTitle: null,
    status: 'skipped',
  };

  if (!sender.domain) return result;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const res = await fetch(`https://${sender.domain}`, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': 'CompoundIntakeRouter/1.0' },
    });
    clearTimeout(timeout);

    result.hasWebsite = res.ok;

    if (res.ok) {
      const html = await res.text();
      const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      if (titleMatch) {
        result.pageTitle = stripHtml(titleMatch[1]).slice(0, 200);
      }
    }

    result.status = 'ok';
  } catch (err) {
    result.status = 'failed';
  }

  return result;
}
