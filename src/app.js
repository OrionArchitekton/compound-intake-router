import express from 'express';
import { timingSafeEqual } from 'node:crypto';
import { processIntake } from './pipeline.js';

export function createApp({ token = process.env.INTAKE_TOKEN, process: handleIntake = processIntake } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  app.use('/intake', (req, res, next) => {
    if (token) {
      const actual = Buffer.from(req.get('Authorization') || '');
      const expected = Buffer.from(`Bearer ${token}`);
      if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
    }
    next();
  });
  app.use(express.json({ limit: '32kb' }));
  app.post('/intake', async (req, res) => {
    try {
      const result = await handleIntake(req.body);
      res.status(result.status === 'rejected' ? 400 : 200).json(result);
    } catch {
      res.status(500).json({ error: 'Intake failed; check service status' });
    }
  });
  app.get('/health', (req, res) => res.json({
    status: 'ok', uptime: Math.floor(process.uptime()), delivery: process.env.DELIVERY_MODE || 'console',
  }));
  app.use((err, req, res, next) => {
    const status = err.type === 'entity.too.large' ? 413 : 400;
    res.status(status).json({ error: 'Invalid request body' });
  });
  return app;
}
