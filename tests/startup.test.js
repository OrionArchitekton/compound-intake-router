import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

test('the log viewer reads the database path from the local dotenv file', () => {
  const folder = mkdtempSync(join(tmpdir(), 'intake-viewer-'));
  try {
    const dbPath = join(folder, 'configured.db');
    writeFileSync(join(folder, '.env'), `INTAKE_DB_PATH=${dbPath}\n`);
    const env = { ...process.env };
    delete env.INTAKE_DB_PATH;
    const result = spawnSync(process.execPath, [new URL('../scripts/view-log.js', import.meta.url).pathname], {
      cwd: folder, env, encoding: 'utf8', timeout: 3000,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(dbPath), true, 'must open the same configured database as the server');
    assert.equal(existsSync(join(folder, 'data', 'intakes.db')), false);
  } finally { rmSync(folder, { recursive: true, force: true }); }
});

test('the deployed entrypoint refuses network exposure without an inbound token', () => {
  const result = spawnSync(process.execPath, ['src/server.js'], {
    env: { ...process.env, HOST: '0.0.0.0', PORT: '0', INTAKE_TOKEN: '' },
    timeout: 1500, encoding: 'utf8',
  });
  assert.equal(result.status, 1, 'must refuse before opening a listener');
  assert.match(result.stderr, /INTAKE_TOKEN/);
});

test('a legacy website-fetching setting fails closed at startup', () => {
  const result = spawnSync(process.execPath, ['src/server.js'], {
    env: { ...process.env, ENABLE_ENRICHMENT: 'true' }, timeout: 1500, encoding: 'utf8',
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Website enrichment is not included/);
});

test('the actual server entrypoint serves health and protects intake', { timeout: 10000 }, async () => {
  const folder = mkdtempSync(join(tmpdir(), 'intake-startup-'));
  const child = spawn(process.execPath, ['src/server.js'], {
    env: { ...process.env, HOST: '127.0.0.1', PORT: '0', INTAKE_TOKEN: 'test-only',
      INTAKE_DB_PATH: join(folder, 'test.db'), DELIVERY_MODE: 'console', ENABLE_ENRICHMENT: 'false' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const exited = once(child, 'exit');
  try {
    const port = await new Promise((resolve, reject) => {
      let output = '';
      child.stdout.on('data', chunk => {
        output += chunk;
        const match = output.match(/Intake Router listening on 127.0.0.1:(\d+)/);
        if (match) resolve(Number(match[1]));
      });
      child.once('error', reject);
      child.once('exit', () => reject(new Error('Server exited before readiness')));
    });
    const url = `http://127.0.0.1:${port}`;
    const health = await (await fetch(`${url}/health`)).json();
    assert.equal(health.status, 'ok');
    assert.equal(typeof health.uptime, 'number');
    assert.equal(health.delivery, 'console');
    assert.equal((await fetch(`${url}/intake`, { method: 'POST' })).status, 401);
  } finally {
    child.kill(); await exited;
    rmSync(folder, { recursive: true, force: true });
  }
});
