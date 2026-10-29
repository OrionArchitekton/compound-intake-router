import 'dotenv/config';
import { readFile } from 'node:fs/promises';

// Explicitly invoked live path: may call the model and selected alert adapter.
const endpoint = `http://127.0.0.1:${process.env.PORT || 3747}/intake`;
const headers = { 'Content-Type': 'application/json' };
if (process.env.INTAKE_TOKEN) headers.Authorization = `Bearer ${process.env.INTAKE_TOKEN}`;

try {
  for (const name of ['lead', 'partnership', 'support', 'applicant', 'spam']) {
    const body = await readFile(new URL(`../examples/${name}.json`, import.meta.url), 'utf8');
    const response = await fetch(endpoint, { method: 'POST', headers, body,
      redirect: 'error', signal: AbortSignal.timeout(45000) });
    if (!response.ok) throw new Error('Intake rejected');
    const result = await response.json();
    console.log(JSON.stringify({ example: name, id: result.id, classification: {
      type: result.classification.type, venture: result.classification.venture,
    }, routing: result.routing, pipeline: result.pipeline }));
  }
  console.log('Done. Run npm run view-log privately to inspect the audit trail.');
} catch {
  console.error('Live demo stopped. Check server/auth settings and the audit trail before retrying; a request may already have been accepted.');
  process.exitCode = 1;
}
