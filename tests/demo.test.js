import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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

test('the live demo loads the dotenv token and authenticates every example without printing it', async t => {
  const folder = mkdtempSync(join(tmpdir(), 'intake-live-demo-'));
  writeFileSync(join(folder, '.env'), 'INTAKE_TOKEN=test-only-live-demo\n');
  const received = [];
  const receiver = createServer(async (req, res) => {
    let body = ''; for await (const part of req) body += part;
    received.push({ auth: req.headers.authorization, payload: JSON.parse(body) });
    res.setHeader('Content-Type', 'application/json');
    if (req.headers.authorization !== 'Bearer test-only-live-demo') {
      res.writeHead(401).end('{"error":"Unauthorized"}'); return;
    }
    res.end(JSON.stringify({ id: `test-${received.length}`, classification: { type: 'lead', venture: 'services' },
      routing: { destination: 'sales', mode: 'console' }, pipeline: { route: 'ok' } }));
  });
  await new Promise(resolve => receiver.listen(0, '127.0.0.1', resolve));
  t.after(() => { receiver.close(); rmSync(folder, { recursive: true, force: true }); });
  const env = { ...process.env, PORT: String(receiver.address().port), DOTENV_CONFIG_PATH: join(folder, '.env') };
  delete env.INTAKE_TOKEN;
  async function runDemo(env) {
    const child = spawn('npm', ['run', 'demo:live'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    const [code] = await once(child, 'exit');
    return { code, output };
  }
  const success = await runDemo(env);
  assert.equal(success.code, 0, success.output);
  assert.equal(received.length, 5);
  assert.ok(received.every(item => item.auth === 'Bearer test-only-live-demo'));
  assert.doesNotMatch(success.output, /test-only-live-demo/);
  const denied = await runDemo({ ...env, INTAKE_TOKEN: 'test-only-wrong' });
  assert.equal(denied.code, 1);
  assert.equal(received.length, 6, 'must stop on the first denial, without retries');
  assert.doesNotMatch(denied.output, /test-only-wrong|test-only-live-demo/);
});
