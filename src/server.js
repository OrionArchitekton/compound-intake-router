import 'dotenv/config';
import express from 'express';
import { processIntake } from './pipeline.js';
import { initDb } from './logger.js';

const app = express();
app.use(express.json());

app.post('/intake', async (req, res) => {
  const result = await processIntake(req.body);

  if (result.status === 'rejected') {
    return res.status(400).json(result);
  }

  res.json(result);
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.floor(process.uptime()),
    delivery: process.env.DELIVERY_MODE || 'console',
  });
});

const PORT = process.env.PORT || 3747;

initDb();
app.listen(PORT, () => {
  const mode = process.env.DELIVERY_MODE || 'console';
  console.log(`\nCompound Intake Router running on :${PORT}`);
  console.log(`Delivery mode: ${mode}`);
  if (mode === 'slack' && !process.env.SLACK_WEBHOOK_URL) {
    console.log('Warning: DELIVERY_MODE=slack but SLACK_WEBHOOK_URL not set. Will fall back to console.');
  }
  console.log('SQLite initialized at data/intakes.db');
  console.log(`POST /intake to process messages\n`);
});
