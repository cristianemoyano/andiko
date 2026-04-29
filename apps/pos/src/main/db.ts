import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import * as schema from '../db/schema'

let _db: ReturnType<typeof drizzle> | null = null

export function initDb() {
  const dbPath = join(app.getPath('userData'), 'andiko-pos.db')
  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('foreign_keys = ON')
  _db = drizzle(sqlite, { schema })
  runMigrations(sqlite)
}

export function db() {
  if (!_db) throw new Error('DB not initialized')
  return _db
}

function runMigrations(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      sku TEXT,
      name TEXT NOT NULL,
      price TEXT NOT NULL,
      iva_rate TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      synced_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      legal_name TEXT NOT NULL,
      trade_name TEXT,
      cuit TEXT,
      email TEXT,
      phone TEXT,
      synced_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pos_users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL,
      branch_id TEXT,
      pos_pin_hash TEXT,
      synced_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
      cashier_user_id TEXT,
      cashier_name TEXT,
      payment_method TEXT NOT NULL,
      subtotal TEXT NOT NULL,
      tax_amount TEXT NOT NULL,
      total TEXT NOT NULL,
      sold_at TEXT NOT NULL,
      cloud_id TEXT,
      synced_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id TEXT NOT NULL REFERENCES sales(id),
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      qty REAL NOT NULL,
      iva_rate TEXT NOT NULL DEFAULT '21',
      unit_price TEXT NOT NULL,
      total TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pos_draft_sales (
      id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'draft', -- draft|abandoned|paid|cancelled
      cashier_user_id TEXT,
      cashier_name TEXT,
      customer_id TEXT,
      payment_method TEXT,
      subtotal TEXT NOT NULL DEFAULT '0',
      tax_amount TEXT NOT NULL DEFAULT '0',
      total TEXT NOT NULL DEFAULT '0',
      last_opened_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pos_draft_sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      draft_sale_id TEXT NOT NULL REFERENCES pos_draft_sales(id) ON DELETE CASCADE,
      product_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      qty REAL NOT NULL,
      iva_rate TEXT NOT NULL DEFAULT '21',
      unit_price TEXT NOT NULL,
      total TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      UNIQUE(draft_sale_id, product_id)
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id TEXT NOT NULL REFERENCES sales(id),
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS license_cache (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      org_id TEXT NOT NULL,
      branch_id TEXT NOT NULL,
      valid_until TEXT NOT NULL,
      cached_at TEXT NOT NULL,
      features TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_sale_id ON sync_queue(sale_id);
    CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
    CREATE INDEX IF NOT EXISTS idx_pos_users_name ON pos_users(name);
    CREATE INDEX IF NOT EXISTS idx_pos_draft_sales_status_updated_at ON pos_draft_sales(status, updated_at);
    CREATE INDEX IF NOT EXISTS idx_pos_draft_sale_items_draft_sale_id ON pos_draft_sale_items(draft_sale_id);
  `)

  // Lightweight, idempotent "alter" migrations for older local DBs
  // (SQLite doesn't support IF NOT EXISTS for ADD COLUMN in older versions)
  try { sqlite.exec(`ALTER TABLE sale_items ADD COLUMN iva_rate TEXT NOT NULL DEFAULT '21';`) } catch { /* ignore */ }
  try { sqlite.exec(`ALTER TABLE sales ADD COLUMN cashier_name TEXT;`) } catch { /* ignore */ }
  try { sqlite.exec(`ALTER TABLE sales ADD COLUMN cashier_user_id TEXT;`) } catch { /* ignore */ }
  try { sqlite.exec(`ALTER TABLE pos_users ADD COLUMN pos_pin_hash TEXT;`) } catch { /* ignore */ }
}
