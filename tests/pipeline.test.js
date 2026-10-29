import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { processIntake } from '../src/pipeline.js';
import { classify } from '../src/classifier.js';
import { route } from '../src/router.js';
import { loadConfig } from '../src/config.js';
import { initDb, getRecent } from '../src/logger.js';

test('an authorized HTTP lead reaches a webhook and a matching SQLite audit row', async t => {
  const module = await import('../src/app.js').catch(() => ({}));
  assert.equal(typeof module.createApp, 'function', 'HTTP app factory is required for the deployed path');
  const temp = mkdtempSync(join(tmpdir(), 'intake-test-'));
  const db = initDb(join(temp, 'intakes.db'));
  let alert;
  const receiver = createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    alert = JSON.parse(body); res.writeHead(204).end();
  });
  await new Promise(resolve => receiver.listen(0, '127.0.0.1', resolve));
  const config = loadConfig();
  const client = { messages: { create: async () => ({ content: [{ type: 'text', text: JSON.stringify({
    type: 'lead', venture: 'services', urgency: 'high', reasoning: 'A quote', suggestedAction: 'Call back',
  }) }] }) } };
  const process = raw => processIntake(raw, { config,
    classifyFn: payload => classify(payload, { config, client }),
    routeFn: (p, c, e) => route(p, c, e, { config, env: { DELIVERY_MODE: 'webhook',
      ALERT_WEBHOOK_URL: `http://127.0.0.1:${receiver.address().port}/` } }),
  });
  const app = module.createApp({ token: 'test-token', process });
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.on('listening', resolve));
  t.after(() => { server.close(); receiver.close(); db.close(); rmSync(temp, { recursive: true, force: true }); });
  const url = `http://127.0.0.1:${server.address().port}/intake`;
  assert.equal((await fetch(url, { method: 'POST' })).status, 401);
  const response = await fetch(url, { method: 'POST', headers: {
    'Content-Type': 'application/json', Authorization: 'Bearer test-token',
  }, body: JSON.stringify({ sender: { email: 'lead@example.com' }, subject: 'A quote', body: 'Help please' }) });
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.classification.venture, 'services');
  assert.equal(result.routing.delivered, true);
  assert.equal(result.pipeline.enrich, 'skipped');
  assert.equal(result.pipeline.log, 'ok');
  assert.equal(alert.id, result.id);
  const rows = getRecent();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, result.id);
  assert.equal(rows[0].route_destination, 'sales');
  assert.equal(rows[0].route_success, 1);
  assert.equal(JSON.parse(rows[0].pipeline_status).route, 'ok');
});

test('classifier failure goes to manual review and failed alert/audit statuses remain visible', async t => {
  t.mock.method(console, 'error', () => {});
  let record;
  const result = await processIntake({ email: 'lead@example.com', body: 'Hello' }, {
    config: loadConfig(), enrichEnabled: false,
    classifyFn: async () => { throw new Error('provider details must not escape'); },
    routeFn: async (p, c, e, options) => {
      assert.equal(c.type, 'unknown');
      return route(p, c, e, { ...options, env: { DELIVERY_MODE: 'webhook' } });
    },
    logFn: value => { record = value; throw new Error('disk full'); },
  });
  assert.equal(result.routing.destination, 'manual-review');
  assert.equal(result.routing.delivered, false);
  assert.equal(result.pipeline.classify, 'degraded');
  assert.equal(result.pipeline.route, 'failed');
  assert.equal(result.pipeline.log, 'failed');
  assert.equal(record.route_success, 0);
  assert.doesNotMatch(JSON.stringify(result), /provider details|disk full/);
});
