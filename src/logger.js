import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = join(__dirname, '..', 'data', 'intakes.db');

let db = null;

export function initDb() {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS intakes (
      id TEXT PRIMARY KEY,
      received_at TEXT,
      processed_at TEXT,
      sender_email TEXT,
      sender_domain TEXT,
      subject TEXT,
      body_preview TEXT,
      type TEXT,
      urgency TEXT,
      venture TEXT,
      suggested_action TEXT,
      route_destination TEXT,
      route_success INTEGER,
      processing_ms INTEGER,
      raw_payload TEXT,
      classification_raw TEXT,
      pipeline_status TEXT
    )
  `);

  return db;
}

const INSERT = `
  INSERT INTO intakes (
    id, received_at, processed_at, sender_email, sender_domain,
    subject, body_preview, type, urgency, venture, suggested_action,
    route_destination, route_success, processing_ms,
    raw_payload, classification_raw, pipeline_status
  ) VALUES (
    @id, @received_at, @processed_at, @sender_email, @sender_domain,
    @subject, @body_preview, @type, @urgency, @venture, @suggested_action,
    @route_destination, @route_success, @processing_ms,
    @raw_payload, @classification_raw, @pipeline_status
  )
`;

export function logIntake(record) {
  try {
    if (!db) initDb();
    db.prepare(INSERT).run(record);
  } catch (err) {
    console.error(`[logger] SQLite write failed: ${err.message}`);
    console.error('[logger] Record dumped to stderr:', JSON.stringify(record));
  }
}

export function getRecent(n = 20) {
  if (!db) initDb();
  return db.prepare('SELECT * FROM intakes ORDER BY received_at DESC LIMIT ?').all(n);
}
