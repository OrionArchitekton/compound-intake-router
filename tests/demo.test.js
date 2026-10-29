import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('the standalone demo uses fictional classification and cannot send real alerts', () => {
  const result = spawnSync(process.execPath, ['scripts/demo.js'], { encoding: 'utf8', timeout: 5000,
    env: { ...process.env, ANTHROPIC_API_KEY: '', DELIVERY_MODE: 'email',
      ENABLE_ENRICHMENT: 'true', RESEND_API_KEY: '' },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /OFFLINE SAMPLE/);
  assert.match(result.stdout, /"auditRows": 1/);
  assert.match(result.stdout, /"enrich": "skipped"/);
  assert.match(result.stdout, /"mode": "console"/);
});
