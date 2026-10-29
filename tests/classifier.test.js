import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify } from '../src/classifier.js';
import { loadConfig } from '../src/config.js';

test('a service profile controls the classifier categories and business groups', async () => {
  const config = {
    description: 'A local plumbing business',
    types: [{ id: 'booking', description: 'A new job' }, { id: 'unknown', description: 'Manual review' }],
    ventures: [{ id: 'repairs', description: 'Repair jobs' }, { id: 'general', description: 'Other' }],
  };
  let sent;
  const client = { messages: { create: async input => {
    sent = input;
    return { content: [{ type: 'text', text: JSON.stringify({
      type: 'booking', venture: 'repairs', urgency: 'high',
      reasoning: 'A repair request', suggestedAction: 'Call back',
    }) }] };
  } } };
  const result = await classify({ sender: { name: 'Example', email: 'lead@example.com' },
    subject: 'Leaking tap', body: 'Please send a quote' }, { config, client });
  assert.equal(result.type, 'booking');
  assert.equal(result.venture, 'repairs');
  assert.match(sent.system, /plumbing/);
  assert.match(sent.system, /booking/);
  assert.doesNotMatch(sent.system, /venture studio/);
});

test('model values outside the selected profile cannot select a route', async () => {
  const config = loadConfig();
  const client = { messages: { create: async () => ({ content: [{ type: 'text', text:
    JSON.stringify({ type: '__proto__', venture: 'attacker-group', urgency: 'urgent' }) }] }) } };
  await assert.rejects(() => classify({ sender: { email: 'lead@example.com' }, body: 'Hello' },
    { config, client }), /Invalid classification/);
});
