"use strict";
const electron = require("electron");
const path = require("path");
const Database = require("better-sqlite3");
const betterSqlite3 = require("drizzle-orm/better-sqlite3");
const sqliteCore = require("drizzle-orm/sqlite-core");
const drizzleOrm = require("drizzle-orm");
const crypto = require("crypto");
const products = sqliteCore.sqliteTable("products", {
  id: sqliteCore.text("id").primaryKey(),
  sku: sqliteCore.text("sku"),
  name: sqliteCore.text("name").notNull(),
  price: sqliteCore.text("price").notNull(),
  // stored as string, NUMERIC precision
  iva_rate: sqliteCore.text("iva_rate").notNull(),
  is_active: sqliteCore.integer("is_active", { mode: "boolean" }).notNull().default(true),
  synced_at: sqliteCore.text("synced_at").notNull()
  // ISO timestamp from cloud
});
const customers = sqliteCore.sqliteTable("customers", {
  id: sqliteCore.text("id").primaryKey(),
  legal_name: sqliteCore.text("legal_name").notNull(),
  trade_name: sqliteCore.text("trade_name"),
  cuit: sqliteCore.text("cuit"),
  email: sqliteCore.text("email"),
  phone: sqliteCore.text("phone"),
  synced_at: sqliteCore.text("synced_at").notNull()
});
const sales = sqliteCore.sqliteTable("sales", {
  id: sqliteCore.text("id").primaryKey(),
  // local UUID
  customer_id: sqliteCore.text("customer_id"),
  payment_method: sqliteCore.text("payment_method").notNull(),
  // 'cash' | 'card' | 'transfer'
  subtotal: sqliteCore.text("subtotal").notNull(),
  tax_amount: sqliteCore.text("tax_amount").notNull(),
  total: sqliteCore.text("total").notNull(),
  sold_at: sqliteCore.text("sold_at").notNull(),
  cloud_id: sqliteCore.text("cloud_id"),
  // set after sync
  synced_at: sqliteCore.text("synced_at")
});
const saleItems = sqliteCore.sqliteTable("sale_items", {
  id: sqliteCore.integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  sale_id: sqliteCore.text("sale_id").notNull().references(() => sales.id),
  product_id: sqliteCore.text("product_id").notNull(),
  product_name: sqliteCore.text("product_name").notNull(),
  qty: sqliteCore.real("qty").notNull(),
  unit_price: sqliteCore.text("unit_price").notNull(),
  total: sqliteCore.text("total").notNull()
});
const syncQueue = sqliteCore.sqliteTable("sync_queue", {
  id: sqliteCore.integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  sale_id: sqliteCore.text("sale_id").notNull().references(() => sales.id),
  attempts: sqliteCore.integer("attempts").notNull().default(0),
  last_error: sqliteCore.text("last_error"),
  created_at: sqliteCore.text("created_at").notNull()
});
const licenseCache = sqliteCore.sqliteTable("license_cache", {
  id: sqliteCore.integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  org_id: sqliteCore.text("org_id").notNull(),
  branch_id: sqliteCore.text("branch_id").notNull(),
  valid_until: sqliteCore.text("valid_until").notNull(),
  cached_at: sqliteCore.text("cached_at").notNull(),
  features: sqliteCore.text("features").notNull().default("[]")
  // JSON array
});
const settings = sqliteCore.sqliteTable("settings", {
  key: sqliteCore.text("key").primaryKey(),
  value: sqliteCore.text("value").notNull()
});
const schema = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  customers,
  licenseCache,
  products,
  saleItems,
  sales,
  settings,
  syncQueue
}, Symbol.toStringTag, { value: "Module" }));
let _db = null;
function initDb() {
  const dbPath = path.join(electron.app.getPath("userData"), "andiko-pos.db");
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  _db = betterSqlite3.drizzle(sqlite, { schema });
  runMigrations(sqlite);
}
function db() {
  if (!_db) throw new Error("DB not initialized");
  return _db;
}
function runMigrations(sqlite) {
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

    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      customer_id TEXT,
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
      unit_price TEXT NOT NULL,
      total TEXT NOT NULL
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
  `);
}
const SYNC_INTERVAL_MS = 30 * 60 * 1e3;
const SALES_SYNC_INTERVAL_MS = 60 * 1e3;
function getSettings() {
  const rows = db().select().from(settings).all();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
async function fetchCloud(path2, config) {
  const s = getSettings();
  const base = s["cloud_url"] ?? "";
  const token = s["api_token"] ?? "";
  const res = await fetch(`${base}${path2}`, {
    ...config,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...config?.headers }
  });
  if (!res.ok) throw new Error(`Cloud error ${res.status}: ${await res.text()}`);
  return res.json();
}
async function syncCatalog() {
  const s = getSettings();
  const since = s["catalog_synced_at"] ?? "1970-01-01T00:00:00.000Z";
  const branchId = s["branch_id"] ?? "";
  const { products: productList } = await fetchCloud(
    `/api/v1/pos/products?branch_id=${branchId}&since=${encodeURIComponent(since)}`
  );
  for (const p of productList) {
    db().insert(products).values({
      id: p.id,
      sku: p.sku ?? null,
      name: p.name,
      price: p.price,
      iva_rate: p.iva_rate,
      is_active: p.is_active,
      synced_at: p.updated_at
    }).onConflictDoUpdate({ target: products.id, set: {
      sku: p.sku ?? null,
      name: p.name,
      price: p.price,
      iva_rate: p.iva_rate,
      is_active: p.is_active,
      synced_at: p.updated_at
    } }).run();
  }
  const { customers: customerList } = await fetchCloud(
    `/api/v1/pos/customers?since=${encodeURIComponent(since)}`
  );
  for (const c of customerList) {
    db().insert(customers).values({
      id: c.id,
      legal_name: c.legal_name,
      trade_name: c.trade_name ?? null,
      cuit: c.cuit ?? null,
      email: c.email ?? null,
      phone: c.phone ?? null,
      synced_at: c.updated_at
    }).onConflictDoUpdate({ target: customers.id, set: {
      legal_name: c.legal_name,
      trade_name: c.trade_name ?? null,
      cuit: c.cuit ?? null,
      email: c.email ?? null,
      phone: c.phone ?? null,
      synced_at: c.updated_at
    } }).run();
  }
  db().insert(settings).values({ key: "catalog_synced_at", value: (/* @__PURE__ */ new Date()).toISOString() }).onConflictDoUpdate({ target: settings.key, set: { value: (/* @__PURE__ */ new Date()).toISOString() } }).run();
}
async function syncPendingSales() {
  const pending = db().select().from(syncQueue).all();
  if (pending.length === 0) return;
  const saleIds = pending.map((q) => q.sale_id);
  const saleRows = db().select().from(sales).all().filter((s) => saleIds.includes(s.id));
  const payload = saleRows.map((s) => ({
    local_id: s.id,
    device_id: getSettings()["device_id"] ?? "",
    customer_id: s.customer_id ?? null,
    payment_method: s.payment_method,
    subtotal: s.subtotal,
    tax_amount: s.tax_amount,
    total: s.total,
    sold_at: s.sold_at,
    items: []
    // TODO: join sale_items
  }));
  const result = await fetchCloud("/api/v1/pos/sales/sync", {
    method: "POST",
    body: JSON.stringify({ sales: payload })
  });
  const now = (/* @__PURE__ */ new Date()).toISOString();
  for (const localId of result.synced) {
    db().update(sales).set({ synced_at: now }).where(drizzleOrm.eq(sales.id, localId)).run();
    const q = pending.find((p) => p.sale_id === localId);
    if (q) db().delete(syncQueue).where(drizzleOrm.eq(syncQueue.id, q.id)).run();
  }
  for (const err of result.errors) {
    const q = pending.find((p) => p.sale_id === err.local_id);
    if (q) {
      db().update(syncQueue).set({ attempts: q.attempts + 1, last_error: err.message }).where(drizzleOrm.eq(syncQueue.id, q.id)).run();
    }
  }
}
function registerSyncHandlers(ipc) {
  ipc.handle("sync:catalog", async () => {
    try {
      await syncCatalog();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  });
  ipc.handle("sync:sales", async () => {
    try {
      await syncPendingSales();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  });
  ipc.handle("settings:save", async (_e, kv) => {
    for (const [key, value] of Object.entries(kv)) {
      db().insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } }).run();
    }
    return { ok: true };
  });
  ipc.handle("settings:get", async () => getSettings());
  setInterval(async () => {
    try {
      await syncCatalog();
    } catch {
    }
  }, SYNC_INTERVAL_MS);
  setInterval(async () => {
    try {
      await syncPendingSales();
    } catch {
    }
  }, SALES_SYNC_INTERVAL_MS);
}
function registerSalesHandlers(ipc) {
  ipc.handle("sales:create", async (_e, payload) => {
    const d = db();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const id = payload.local_id || crypto.randomUUID();
    d.insert(sales).values({
      id,
      customer_id: payload.customer_id ?? null,
      payment_method: payload.payment_method,
      subtotal: payload.subtotal,
      tax_amount: payload.tax_amount,
      total: payload.total,
      sold_at: payload.sold_at || now
    }).run();
    for (const item of payload.items) {
      d.insert(saleItems).values({
        sale_id: id,
        product_id: item.product_id,
        product_name: item.product_name,
        qty: item.qty,
        unit_price: item.unit_price,
        total: item.total
      }).run();
    }
    d.insert(syncQueue).values({
      sale_id: id,
      attempts: 0,
      created_at: now
    }).run();
    return { id };
  });
  ipc.handle("sales:list-today", async () => {
    const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    return db().select().from(sales).all().filter((s) => s.sold_at.startsWith(today));
  });
}
let mainWindow = null;
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  if (process.env.NODE_ENV === "development") {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
electron.app.whenReady().then(async () => {
  initDb();
  registerSalesHandlers(electron.ipcMain);
  registerSyncHandlers(electron.ipcMain);
  createWindow();
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") electron.app.quit();
});
electron.app.on("activate", () => {
  if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
});
