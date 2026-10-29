import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { route } from '../src/router.js';
import { loadConfig } from '../src/config.js';

const lead = { id: 'int_example', sender: { name: 'Example Lead', email: 'lead@example.com' },
  subject: 'A repair quote', body: 'Please quote' };
const classification = { type: 'lead', venture: 'services', urgency: 'high', typeConfidence: 0.9,
  reasoning: 'A quote request', suggestedAction: 'Call back', spamScore: 0 };
const enrichment = { domain: 'example.com', pageTitle: null };

test('webhook delivery posts a structured alert to an owner-configured receiver', async t => {
  let received;
  const receiver = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    received = JSON.parse(body);
    res.writeHead(204).end();
  });
  await new Promise(resolve => receiver.listen(0, '127.0.0.1', resolve));
  t.after(() => receiver.close());
  const result = await route(lead, classification, enrichment, {
    config: loadConfig(), env: { DELIVERY_MODE: 'webhook',
      ALERT_WEBHOOK_URL: `http://127.0.0.1:${receiver.address().port}/alert` },
  });
  assert.equal(result.mode, 'webhook');
  assert.equal(result.delivered, true);
  assert.equal(received.id, lead.id);
  assert.equal(received.destination, 'sales');
  assert.equal(received.classification.venture, 'services');
});

test('Slack is opt-in and sends plain text to the configured incoming webhook', async () => {
  let sent;
  const result = await route(lead, classification, enrichment, { config: loadConfig(),
    env: { DELIVERY_MODE: 'slack', SLACK_WEBHOOK_URL: 'https://hooks.slack.com/services/example' },
    fetchFn: async (url, options) => {
      sent = JSON.parse(options.body);
      return new Response('ok');
    },
  });
  assert.equal(result.delivered, true);
  assert.equal(result.mode, 'slack');
  assert.equal(sent.blocks[0].text.type, 'plain_text');
  assert.match(sent.text, /int_example/);
});

test('email delivery uses the configured sender and recipient, never a lead-controlled address', async () => {
  let sent;
  const result = await route(lead, classification, enrichment, { config: loadConfig(),
    env: { DELIVERY_MODE: 'email', RESEND_API_KEY: 'test-only',
      ALERT_EMAIL_FROM: 'Intake <intake@example.org>', ALERT_EMAIL_TO: 'owner@example.org' },
    fetchFn: async (url, options) => {
      sent = { url, options, body: JSON.parse(options.body) };
      return new Response(JSON.stringify({ id: 'accepted-example' }), { status: 200 });
    },
  });
  assert.equal(result.delivered, true);
  assert.equal(result.mode, 'email');
  assert.equal(sent.url, 'https://api.resend.com/emails');
  assert.equal(sent.body.from, 'Intake <intake@example.org>');
  assert.deepEqual(sent.body.to, ['owner@example.org']);
  assert.match(sent.body.text, /A repair quote/);
});

test('remote failures and missing configuration are never console delivery successes', async t => {
  t.mock.method(console, 'error', () => {});
  for (const env of [
    { DELIVERY_MODE: 'webhook', ALERT_WEBHOOK_URL: 'https://receiver.example/alert' },
    { DELIVERY_MODE: 'slack' }, { DELIVERY_MODE: 'email' }, { DELIVERY_MODE: 'typo' },
    { DELIVERY_MODE: 'webhook', ALERT_WEBHOOK_URL: 'http://remote.example/alert' },
  ]) {
    let attempts = 0;
    const result = await route(lead, classification, enrichment, { config: loadConfig(), env,
      fetchFn: async () => { attempts++; return new Response('failed', { status: 503 }); },
    });
    assert.equal(result.delivered, false);
    assert.equal(result.mode, env.DELIVERY_MODE);
    assert.ok(attempts <= 1, 'no automatic retries or duplicate sends');
  }
});

test('network exceptions do not spill endpoint secrets into the result or logs', async t => {
  const logs = [];
  t.mock.method(console, 'error', (...args) => logs.push(args.join(' ')));
  const result = await route(lead, classification, enrichment, { config: loadConfig(),
    env: { DELIVERY_MODE: 'webhook', ALERT_WEBHOOK_URL: 'https://receiver.example/secret-placeholder' },
    fetchFn: async () => { throw new Error('secret-placeholder provider exception'); },
  });
  assert.equal(result.delivered, false);
  assert.doesNotMatch(JSON.stringify({ result, logs }), /secret-placeholder/);
});

test('spam is log-only regardless of selected integration', async () => {
  const result = await route(lead, { ...classification, type: 'spam' }, enrichment, {
    config: loadConfig(), env: { DELIVERY_MODE: 'webhook', ALERT_WEBHOOK_URL: 'https://example.com/' },
    fetchFn: () => { throw new Error('must not send'); },
  });
  assert.equal(result.mode, 'filtered');
  assert.equal(result.delivered, false);
});
