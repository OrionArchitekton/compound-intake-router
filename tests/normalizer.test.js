import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalize } from '../src/normalizer.js';

test('malformed lead fields are rejected rather than crashing the pipeline', () => {
  for (const raw of [null, [], 1, { email: {} }, { email: 'lead@example.com', body: {} },
    { sender: 'person', subject: 'Hello' }, { email: 'bad\naddress', body: 'Hi' },
    { email: 'lead@example.com', subject: 123 }]) {
    assert.equal(normalize(raw).ok, false, JSON.stringify(raw));
  }
});
