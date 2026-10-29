import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../src/config.js';
import { classify } from '../src/classifier.js';
import { route } from '../src/router.js';
import { processIntake } from '../src/pipeline.js';
import { initDb, getRecent } from '../src/logger.js';

console.log('OFFLINE SAMPLE - fictional model response; no paid API calls or real alerts');
const config = loadConfig(new URL('../config/service-business.json', import.meta.url));
const folder = mkdtempSync(join(tmpdir(), 'intake-demo-'));
const db = initDb(join(folder, 'sample.db'));
const client = { messages: { create: async () => ({ content: [{ type: 'text', text: JSON.stringify({
  type: 'lead', typeConfidence: 0.95, venture: 'services', ventureConfidence: 0.95,
  urgency: 'high', reasoning: 'A customer wants a repair quote',
  suggestedAction: 'Ask for a suitable callback time', spamScore: 0,
}) }] }) } };
try {
  const result = await processIntake({ sender: { name: 'Example Customer', email: 'lead@example.com' },
    subject: 'Quote for a repair', body: 'Can you quote a small repair this week?' }, {
    config, enrichEnabled: false,
    classifyFn: payload => classify(payload, { config, client }),
    routeFn: (p, c, e) => route(p, c, e, { config, env: { DELIVERY_MODE: 'console' } }),
  });
  console.log(JSON.stringify({ ...result, auditRows: getRecent().length }, null, 2));
} finally {
  db.close();
  rmSync(folder, { recursive: true, force: true });
}
