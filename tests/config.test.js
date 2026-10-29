import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../src/config.js';

test('a profile cannot disable or corrupt the manual-review fallback', () => {
  const folder = mkdtempSync(join(tmpdir(), 'intake-profile-'));
  const path = join(folder, 'profile.json');
  try {
    for (const route of [{ action: 'log-only' }, { default: {} }, { general: 123 }]) {
      const config = loadConfig();
      config.routing.routes.unknown = route;
      writeFileSync(path, JSON.stringify(config));
      assert.throws(() => loadConfig(path), /routing|manual review/i);
    }
  } finally { rmSync(folder, { recursive: true, force: true }); }
});
