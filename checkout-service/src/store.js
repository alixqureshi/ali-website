import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function openStore(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS bookings (
      session_id TEXT PRIMARY KEY, cohort_id TEXT NOT NULL,
      payment_intent_id TEXT, status TEXT NOT NULL,
      amount INTEGER, currency TEXT, stripe_mode TEXT NOT NULL,
      fulfillment_status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS processed_events (
      event_id TEXT PRIMARY KEY, processed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
  return {
    findByIntent(intentId) {
      return db.prepare('SELECT session_id FROM bookings WHERE payment_intent_id = ?').get(intentId);
    },
    recordEvent(eventId, payment, config) {
      db.exec('BEGIN IMMEDIATE');
      try {
        if (db.prepare('SELECT 1 FROM processed_events WHERE event_id = ?').get(eventId)) {
          db.exec('COMMIT');
          return false;
        }
        if (payment?.sessionId && ['paid', 'refunded'].includes(payment.status)) {
          db.prepare(`INSERT INTO bookings
            (session_id, cohort_id, payment_intent_id, status, amount, currency, stripe_mode)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(session_id) DO UPDATE SET
              status = CASE WHEN bookings.status = 'refunded' THEN 'refunded' ELSE excluded.status END,
              updated_at = CURRENT_TIMESTAMP`).run(payment.sessionId, config.cohortId,
              payment.paymentIntentId || null, payment.status, payment.amount ?? null,
              payment.currency ?? null, config.mode);
        }
        db.prepare('INSERT INTO processed_events (event_id) VALUES (?)').run(eventId);
        db.exec('COMMIT');
        return true;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    listPending() {
      return db.prepare("SELECT * FROM bookings WHERE status = 'paid' AND fulfillment_status = 'pending'").all();
    },
    close() { db.close(); }
  };
}
