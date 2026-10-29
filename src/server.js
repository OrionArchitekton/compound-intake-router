import 'dotenv/config';
import { createApp } from './app.js';
import { processIntake } from './pipeline.js';
import { loadConfig } from './config.js';
import { initDb } from './logger.js';

const host = process.env.HOST || '127.0.0.1';
if (process.env.ENABLE_ENRICHMENT === 'true') {
  console.error('Website enrichment is not included; remove ENABLE_ENRICHMENT=true');
  process.exit(1);
}
if (!['127.0.0.1', 'localhost', '::1'].includes(host) && !process.env.INTAKE_TOKEN) {
  console.error('Non-local hosting requires INTAKE_TOKEN');
  process.exit(1);
}
const config = loadConfig();
initDb();
const app = createApp({ process: raw => processIntake(raw, { config }) });
const port = Number(process.env.PORT || 3747);
const server = app.listen(port, host, () => {
  console.log(`Intake Router listening on ${host}:${server.address().port}`);
  console.log(`Delivery mode: ${process.env.DELIVERY_MODE || 'console'}`);
});
