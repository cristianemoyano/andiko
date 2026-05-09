"use strict";
const electron = require("electron");
const path = require("path");
const Database = require("better-sqlite3");
const betterSqlite3 = require("drizzle-orm/better-sqlite3");
const sqliteCore = require("drizzle-orm/sqlite-core");
const drizzleOrm = require("drizzle-orm");
const nodeCrypto = require("crypto");
const products = sqliteCore.sqliteTable("products", {
  id: sqliteCore.text("id").primaryKey(),
  sku: sqliteCore.text("sku"),
  barcode: sqliteCore.text("barcode"),
  name: sqliteCore.text("name").notNull(),
  price: sqliteCore.text("price").notNull(),
  // stored as string, NUMERIC precision
  iva_rate: sqliteCore.text("iva_rate").notNull(),
  is_active: sqliteCore.integer("is_active", { mode: "boolean" }).notNull().default(true),
  image_url: sqliteCore.text("image_url"),
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
const posUsers = sqliteCore.sqliteTable("pos_users", {
  id: sqliteCore.text("id").primaryKey(),
  name: sqliteCore.text("name").notNull(),
  email: sqliteCore.text("email").notNull(),
  role: sqliteCore.text("role").notNull(),
  branch_id: sqliteCore.text("branch_id"),
  pos_pin_hash: sqliteCore.text("pos_pin_hash"),
  synced_at: sqliteCore.text("synced_at").notNull()
  // ISO timestamp from cloud (user.updated_at)
});
const sales = sqliteCore.sqliteTable("sales", {
  id: sqliteCore.text("id").primaryKey(),
  // local UUID
  customer_id: sqliteCore.text("customer_id"),
  cashier_user_id: sqliteCore.text("cashier_user_id"),
  cashier_name: sqliteCore.text("cashier_name"),
  payments: sqliteCore.text("payments").notNull().default("[]"),
  // JSON: PosSalePayment[]
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
  iva_rate: sqliteCore.text("iva_rate").notNull().default("21"),
  unit_price: sqliteCore.text("unit_price").notNull(),
  total: sqliteCore.text("total").notNull()
});
const posDraftSales = sqliteCore.sqliteTable("pos_draft_sales", {
  id: sqliteCore.text("id").primaryKey(),
  status: sqliteCore.text("status").notNull().default("draft"),
  // draft|abandoned|paid|cancelled
  cashier_user_id: sqliteCore.text("cashier_user_id"),
  cashier_name: sqliteCore.text("cashier_name"),
  customer_id: sqliteCore.text("customer_id"),
  payments: sqliteCore.text("payments").default("[]"),
  // JSON: PosSalePayment[] (null while draft)
  subtotal: sqliteCore.text("subtotal").notNull().default("0"),
  tax_amount: sqliteCore.text("tax_amount").notNull().default("0"),
  total: sqliteCore.text("total").notNull().default("0"),
  last_opened_at: sqliteCore.text("last_opened_at"),
  created_at: sqliteCore.text("created_at").notNull(),
  updated_at: sqliteCore.text("updated_at").notNull()
});
const posDraftSaleItems = sqliteCore.sqliteTable("pos_draft_sale_items", {
  id: sqliteCore.integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
  draft_sale_id: sqliteCore.text("draft_sale_id").notNull().references(() => posDraftSales.id),
  product_id: sqliteCore.text("product_id").notNull(),
  product_name: sqliteCore.text("product_name").notNull(),
  qty: sqliteCore.real("qty").notNull(),
  iva_rate: sqliteCore.text("iva_rate").notNull().default("21"),
  unit_price: sqliteCore.text("unit_price").notNull(),
  total: sqliteCore.text("total").notNull(),
  sort_order: sqliteCore.integer("sort_order", { mode: "number" }).notNull().default(0)
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
const posPaymentMethods = sqliteCore.sqliteTable("pos_payment_methods", {
  id: sqliteCore.text("id").primaryKey(),
  // cloud UUID
  name: sqliteCore.text("name").notNull(),
  type: sqliteCore.text("type").notNull(),
  requires_reference: sqliteCore.integer("requires_reference", { mode: "boolean" }).notNull().default(false),
  sort_order: sqliteCore.integer("sort_order", { mode: "number" }).notNull().default(0),
  synced_at: sqliteCore.text("synced_at").notNull()
});
const cashSessions = sqliteCore.sqliteTable("cash_sessions", {
  id: sqliteCore.text("id").primaryKey(),
  cashier_user_id: sqliteCore.text("cashier_user_id"),
  cashier_name: sqliteCore.text("cashier_name"),
  opened_at: sqliteCore.text("opened_at").notNull(),
  closed_at: sqliteCore.text("closed_at"),
  opening_amount: sqliteCore.text("opening_amount").notNull().default("0"),
  closing_amount_declared: sqliteCore.text("closing_amount_declared"),
  closing_amount_expected: sqliteCore.text("closing_amount_expected"),
  difference: sqliteCore.text("difference"),
  status: sqliteCore.text("status").notNull().default("open"),
  // 'open' | 'closed'
  cloud_id: sqliteCore.text("cloud_id"),
  synced_at: sqliteCore.text("synced_at")
});
const schema = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  cashSessions,
  customers,
  licenseCache,
  posDraftSaleItems,
  posDraftSales,
  posPaymentMethods,
  posUsers,
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
      payments TEXT NOT NULL DEFAULT '[]',
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
      payments TEXT DEFAULT '[]',
      subtotal TEXT NOT NULL DEFAULT '0',
      tax_amount TEXT NOT NULL DEFAULT '0',
      total TEXT NOT NULL DEFAULT '0',
      last_opened_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pos_payment_methods (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      requires_reference INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      synced_at TEXT NOT NULL
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

    CREATE TABLE IF NOT EXISTS cash_sessions (
      id TEXT PRIMARY KEY,
      cashier_user_id TEXT,
      cashier_name TEXT,
      opened_at TEXT NOT NULL,
      closed_at TEXT,
      opening_amount TEXT NOT NULL DEFAULT '0',
      closing_amount_declared TEXT,
      closing_amount_expected TEXT,
      difference TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      cloud_id TEXT,
      synced_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_sale_id ON sync_queue(sale_id);
    CREATE INDEX IF NOT EXISTS idx_products_is_active ON products(is_active);
    CREATE INDEX IF NOT EXISTS idx_pos_users_name ON pos_users(name);
    CREATE INDEX IF NOT EXISTS idx_pos_draft_sales_status_updated_at ON pos_draft_sales(status, updated_at);
    CREATE INDEX IF NOT EXISTS idx_pos_draft_sale_items_draft_sale_id ON pos_draft_sale_items(draft_sale_id);
  `);
  try {
    sqlite.exec(`ALTER TABLE sale_items ADD COLUMN iva_rate TEXT NOT NULL DEFAULT '21';`);
  } catch {
  }
  try {
    sqlite.exec(`ALTER TABLE sales ADD COLUMN cashier_name TEXT;`);
  } catch {
  }
  try {
    sqlite.exec(`ALTER TABLE sales ADD COLUMN cashier_user_id TEXT;`);
  } catch {
  }
  try {
    sqlite.exec(`ALTER TABLE pos_users ADD COLUMN pos_pin_hash TEXT;`);
  } catch {
  }
  try {
    sqlite.exec(`ALTER TABLE products ADD COLUMN barcode TEXT;`);
  } catch {
  }
  try {
    sqlite.exec(`ALTER TABLE products ADD COLUMN image_url TEXT;`);
  } catch {
  }
  try {
    sqlite.exec(`ALTER TABLE sales ADD COLUMN payments TEXT NOT NULL DEFAULT '[]';`);
  } catch {
  }
  try {
    sqlite.exec(`ALTER TABLE pos_draft_sales ADD COLUMN payments TEXT DEFAULT '[]';`);
  } catch {
  }
  const hasPmCol = sqlite.prepare(`PRAGMA table_info(sales)`).all().some((c) => c.name === "payment_method");
  if (hasPmCol) {
    sqlite.exec(`
      PRAGMA foreign_keys = OFF;
      BEGIN;
      CREATE TABLE sales_new (
        id TEXT PRIMARY KEY,
        customer_id TEXT,
        cashier_user_id TEXT,
        cashier_name TEXT,
        payments TEXT NOT NULL DEFAULT '[]',
        subtotal TEXT NOT NULL,
        tax_amount TEXT NOT NULL,
        total TEXT NOT NULL,
        sold_at TEXT NOT NULL,
        cloud_id TEXT,
        synced_at TEXT
      );
      INSERT INTO sales_new SELECT id, customer_id, cashier_user_id, cashier_name,
        COALESCE(payments, '[]'), subtotal, tax_amount, total, sold_at, cloud_id, synced_at
        FROM sales;
      DROP TABLE sales;
      ALTER TABLE sales_new RENAME TO sales;
      COMMIT;
      PRAGMA foreign_keys = ON;
    `);
  }
  try {
    sqlite.exec(`CREATE INDEX IF NOT EXISTS idx_cash_sessions_status ON cash_sessions(status);`);
  } catch {
  }
}
var randomFallback = null;
function randomBytes(len) {
  try {
    return crypto.getRandomValues(new Uint8Array(len));
  } catch {
  }
  try {
    return nodeCrypto.randomBytes(len);
  } catch {
  }
  if (!randomFallback) {
    throw Error(
      "Neither WebCryptoAPI nor a crypto module is available. Use bcrypt.setRandomFallback to set an alternative"
    );
  }
  return randomFallback(len);
}
function setRandomFallback(random) {
  randomFallback = random;
}
function genSaltSync(rounds, seed_length) {
  rounds = rounds || GENSALT_DEFAULT_LOG2_ROUNDS;
  if (typeof rounds !== "number")
    throw Error(
      "Illegal arguments: " + typeof rounds + ", " + typeof seed_length
    );
  if (rounds < 4) rounds = 4;
  else if (rounds > 31) rounds = 31;
  var salt = [];
  salt.push("$2b$");
  if (rounds < 10) salt.push("0");
  salt.push(rounds.toString());
  salt.push("$");
  salt.push(base64_encode(randomBytes(BCRYPT_SALT_LEN), BCRYPT_SALT_LEN));
  return salt.join("");
}
function genSalt(rounds, seed_length, callback) {
  if (typeof seed_length === "function")
    callback = seed_length, seed_length = void 0;
  if (typeof rounds === "function") callback = rounds, rounds = void 0;
  if (typeof rounds === "undefined") rounds = GENSALT_DEFAULT_LOG2_ROUNDS;
  else if (typeof rounds !== "number")
    throw Error("illegal arguments: " + typeof rounds);
  function _async(callback2) {
    nextTick(function() {
      try {
        callback2(null, genSaltSync(rounds));
      } catch (err) {
        callback2(err);
      }
    });
  }
  if (callback) {
    if (typeof callback !== "function")
      throw Error("Illegal callback: " + typeof callback);
    _async(callback);
  } else
    return new Promise(function(resolve, reject) {
      _async(function(err, res) {
        if (err) {
          reject(err);
          return;
        }
        resolve(res);
      });
    });
}
function hashSync(password, salt) {
  if (typeof salt === "undefined") salt = GENSALT_DEFAULT_LOG2_ROUNDS;
  if (typeof salt === "number") salt = genSaltSync(salt);
  if (typeof password !== "string" || typeof salt !== "string")
    throw Error("Illegal arguments: " + typeof password + ", " + typeof salt);
  return _hash(password, salt);
}
function hash(password, salt, callback, progressCallback) {
  function _async(callback2) {
    if (typeof password === "string" && typeof salt === "number")
      genSalt(salt, function(err, salt2) {
        _hash(password, salt2, callback2, progressCallback);
      });
    else if (typeof password === "string" && typeof salt === "string")
      _hash(password, salt, callback2, progressCallback);
    else
      nextTick(
        callback2.bind(
          this,
          Error("Illegal arguments: " + typeof password + ", " + typeof salt)
        )
      );
  }
  if (callback) {
    if (typeof callback !== "function")
      throw Error("Illegal callback: " + typeof callback);
    _async(callback);
  } else
    return new Promise(function(resolve, reject) {
      _async(function(err, res) {
        if (err) {
          reject(err);
          return;
        }
        resolve(res);
      });
    });
}
function safeStringCompare(known, unknown) {
  var diff = known.length ^ unknown.length;
  for (var i = 0; i < known.length; ++i) {
    diff |= known.charCodeAt(i) ^ unknown.charCodeAt(i);
  }
  return diff === 0;
}
function compareSync(password, hash2) {
  if (typeof password !== "string" || typeof hash2 !== "string")
    throw Error("Illegal arguments: " + typeof password + ", " + typeof hash2);
  if (hash2.length !== 60) return false;
  return safeStringCompare(
    hashSync(password, hash2.substring(0, hash2.length - 31)),
    hash2
  );
}
function compare(password, hashValue, callback, progressCallback) {
  function _async(callback2) {
    if (typeof password !== "string" || typeof hashValue !== "string") {
      nextTick(
        callback2.bind(
          this,
          Error(
            "Illegal arguments: " + typeof password + ", " + typeof hashValue
          )
        )
      );
      return;
    }
    if (hashValue.length !== 60) {
      nextTick(callback2.bind(this, null, false));
      return;
    }
    hash(
      password,
      hashValue.substring(0, 29),
      function(err, comp) {
        if (err) callback2(err);
        else callback2(null, safeStringCompare(comp, hashValue));
      },
      progressCallback
    );
  }
  if (callback) {
    if (typeof callback !== "function")
      throw Error("Illegal callback: " + typeof callback);
    _async(callback);
  } else
    return new Promise(function(resolve, reject) {
      _async(function(err, res) {
        if (err) {
          reject(err);
          return;
        }
        resolve(res);
      });
    });
}
function getRounds(hash2) {
  if (typeof hash2 !== "string")
    throw Error("Illegal arguments: " + typeof hash2);
  return parseInt(hash2.split("$")[2], 10);
}
function getSalt(hash2) {
  if (typeof hash2 !== "string")
    throw Error("Illegal arguments: " + typeof hash2);
  if (hash2.length !== 60)
    throw Error("Illegal hash length: " + hash2.length + " != 60");
  return hash2.substring(0, 29);
}
function truncates(password) {
  if (typeof password !== "string")
    throw Error("Illegal arguments: " + typeof password);
  return utf8Length(password) > 72;
}
var nextTick = typeof setImmediate === "function" ? setImmediate : typeof scheduler === "object" && typeof scheduler.postTask === "function" ? scheduler.postTask.bind(scheduler) : setTimeout;
function utf8Length(string) {
  var len = 0, c = 0;
  for (var i = 0; i < string.length; ++i) {
    c = string.charCodeAt(i);
    if (c < 128) len += 1;
    else if (c < 2048) len += 2;
    else if ((c & 64512) === 55296 && (string.charCodeAt(i + 1) & 64512) === 56320) {
      ++i;
      len += 4;
    } else len += 3;
  }
  return len;
}
function utf8Array(string) {
  var offset = 0, c1, c2;
  var buffer = new Array(utf8Length(string));
  for (var i = 0, k = string.length; i < k; ++i) {
    c1 = string.charCodeAt(i);
    if (c1 < 128) {
      buffer[offset++] = c1;
    } else if (c1 < 2048) {
      buffer[offset++] = c1 >> 6 | 192;
      buffer[offset++] = c1 & 63 | 128;
    } else if ((c1 & 64512) === 55296 && ((c2 = string.charCodeAt(i + 1)) & 64512) === 56320) {
      c1 = 65536 + ((c1 & 1023) << 10) + (c2 & 1023);
      ++i;
      buffer[offset++] = c1 >> 18 | 240;
      buffer[offset++] = c1 >> 12 & 63 | 128;
      buffer[offset++] = c1 >> 6 & 63 | 128;
      buffer[offset++] = c1 & 63 | 128;
    } else {
      buffer[offset++] = c1 >> 12 | 224;
      buffer[offset++] = c1 >> 6 & 63 | 128;
      buffer[offset++] = c1 & 63 | 128;
    }
  }
  return buffer;
}
var BASE64_CODE = "./ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".split("");
var BASE64_INDEX = [
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  0,
  1,
  54,
  55,
  56,
  57,
  58,
  59,
  60,
  61,
  62,
  63,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
  13,
  14,
  15,
  16,
  17,
  18,
  19,
  20,
  21,
  22,
  23,
  24,
  25,
  26,
  27,
  -1,
  -1,
  -1,
  -1,
  -1,
  -1,
  28,
  29,
  30,
  31,
  32,
  33,
  34,
  35,
  36,
  37,
  38,
  39,
  40,
  41,
  42,
  43,
  44,
  45,
  46,
  47,
  48,
  49,
  50,
  51,
  52,
  53,
  -1,
  -1,
  -1,
  -1,
  -1
];
function base64_encode(b, len) {
  var off = 0, rs = [], c1, c2;
  if (len <= 0 || len > b.length) throw Error("Illegal len: " + len);
  while (off < len) {
    c1 = b[off++] & 255;
    rs.push(BASE64_CODE[c1 >> 2 & 63]);
    c1 = (c1 & 3) << 4;
    if (off >= len) {
      rs.push(BASE64_CODE[c1 & 63]);
      break;
    }
    c2 = b[off++] & 255;
    c1 |= c2 >> 4 & 15;
    rs.push(BASE64_CODE[c1 & 63]);
    c1 = (c2 & 15) << 2;
    if (off >= len) {
      rs.push(BASE64_CODE[c1 & 63]);
      break;
    }
    c2 = b[off++] & 255;
    c1 |= c2 >> 6 & 3;
    rs.push(BASE64_CODE[c1 & 63]);
    rs.push(BASE64_CODE[c2 & 63]);
  }
  return rs.join("");
}
function base64_decode(s, len) {
  var off = 0, slen = s.length, olen = 0, rs = [], c1, c2, c3, c4, o, code;
  if (len <= 0) throw Error("Illegal len: " + len);
  while (off < slen - 1 && olen < len) {
    code = s.charCodeAt(off++);
    c1 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
    code = s.charCodeAt(off++);
    c2 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
    if (c1 == -1 || c2 == -1) break;
    o = c1 << 2 >>> 0;
    o |= (c2 & 48) >> 4;
    rs.push(String.fromCharCode(o));
    if (++olen >= len || off >= slen) break;
    code = s.charCodeAt(off++);
    c3 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
    if (c3 == -1) break;
    o = (c2 & 15) << 4 >>> 0;
    o |= (c3 & 60) >> 2;
    rs.push(String.fromCharCode(o));
    if (++olen >= len || off >= slen) break;
    code = s.charCodeAt(off++);
    c4 = code < BASE64_INDEX.length ? BASE64_INDEX[code] : -1;
    o = (c3 & 3) << 6 >>> 0;
    o |= c4;
    rs.push(String.fromCharCode(o));
    ++olen;
  }
  var res = [];
  for (off = 0; off < olen; off++) res.push(rs[off].charCodeAt(0));
  return res;
}
var BCRYPT_SALT_LEN = 16;
var GENSALT_DEFAULT_LOG2_ROUNDS = 10;
var BLOWFISH_NUM_ROUNDS = 16;
var MAX_EXECUTION_TIME = 100;
var P_ORIG = [
  608135816,
  2242054355,
  320440878,
  57701188,
  2752067618,
  698298832,
  137296536,
  3964562569,
  1160258022,
  953160567,
  3193202383,
  887688300,
  3232508343,
  3380367581,
  1065670069,
  3041331479,
  2450970073,
  2306472731
];
var S_ORIG = [
  3509652390,
  2564797868,
  805139163,
  3491422135,
  3101798381,
  1780907670,
  3128725573,
  4046225305,
  614570311,
  3012652279,
  134345442,
  2240740374,
  1667834072,
  1901547113,
  2757295779,
  4103290238,
  227898511,
  1921955416,
  1904987480,
  2182433518,
  2069144605,
  3260701109,
  2620446009,
  720527379,
  3318853667,
  677414384,
  3393288472,
  3101374703,
  2390351024,
  1614419982,
  1822297739,
  2954791486,
  3608508353,
  3174124327,
  2024746970,
  1432378464,
  3864339955,
  2857741204,
  1464375394,
  1676153920,
  1439316330,
  715854006,
  3033291828,
  289532110,
  2706671279,
  2087905683,
  3018724369,
  1668267050,
  732546397,
  1947742710,
  3462151702,
  2609353502,
  2950085171,
  1814351708,
  2050118529,
  680887927,
  999245976,
  1800124847,
  3300911131,
  1713906067,
  1641548236,
  4213287313,
  1216130144,
  1575780402,
  4018429277,
  3917837745,
  3693486850,
  3949271944,
  596196993,
  3549867205,
  258830323,
  2213823033,
  772490370,
  2760122372,
  1774776394,
  2652871518,
  566650946,
  4142492826,
  1728879713,
  2882767088,
  1783734482,
  3629395816,
  2517608232,
  2874225571,
  1861159788,
  326777828,
  3124490320,
  2130389656,
  2716951837,
  967770486,
  1724537150,
  2185432712,
  2364442137,
  1164943284,
  2105845187,
  998989502,
  3765401048,
  2244026483,
  1075463327,
  1455516326,
  1322494562,
  910128902,
  469688178,
  1117454909,
  936433444,
  3490320968,
  3675253459,
  1240580251,
  122909385,
  2157517691,
  634681816,
  4142456567,
  3825094682,
  3061402683,
  2540495037,
  79693498,
  3249098678,
  1084186820,
  1583128258,
  426386531,
  1761308591,
  1047286709,
  322548459,
  995290223,
  1845252383,
  2603652396,
  3431023940,
  2942221577,
  3202600964,
  3727903485,
  1712269319,
  422464435,
  3234572375,
  1170764815,
  3523960633,
  3117677531,
  1434042557,
  442511882,
  3600875718,
  1076654713,
  1738483198,
  4213154764,
  2393238008,
  3677496056,
  1014306527,
  4251020053,
  793779912,
  2902807211,
  842905082,
  4246964064,
  1395751752,
  1040244610,
  2656851899,
  3396308128,
  445077038,
  3742853595,
  3577915638,
  679411651,
  2892444358,
  2354009459,
  1767581616,
  3150600392,
  3791627101,
  3102740896,
  284835224,
  4246832056,
  1258075500,
  768725851,
  2589189241,
  3069724005,
  3532540348,
  1274779536,
  3789419226,
  2764799539,
  1660621633,
  3471099624,
  4011903706,
  913787905,
  3497959166,
  737222580,
  2514213453,
  2928710040,
  3937242737,
  1804850592,
  3499020752,
  2949064160,
  2386320175,
  2390070455,
  2415321851,
  4061277028,
  2290661394,
  2416832540,
  1336762016,
  1754252060,
  3520065937,
  3014181293,
  791618072,
  3188594551,
  3933548030,
  2332172193,
  3852520463,
  3043980520,
  413987798,
  3465142937,
  3030929376,
  4245938359,
  2093235073,
  3534596313,
  375366246,
  2157278981,
  2479649556,
  555357303,
  3870105701,
  2008414854,
  3344188149,
  4221384143,
  3956125452,
  2067696032,
  3594591187,
  2921233993,
  2428461,
  544322398,
  577241275,
  1471733935,
  610547355,
  4027169054,
  1432588573,
  1507829418,
  2025931657,
  3646575487,
  545086370,
  48609733,
  2200306550,
  1653985193,
  298326376,
  1316178497,
  3007786442,
  2064951626,
  458293330,
  2589141269,
  3591329599,
  3164325604,
  727753846,
  2179363840,
  146436021,
  1461446943,
  4069977195,
  705550613,
  3059967265,
  3887724982,
  4281599278,
  3313849956,
  1404054877,
  2845806497,
  146425753,
  1854211946,
  1266315497,
  3048417604,
  3681880366,
  3289982499,
  290971e4,
  1235738493,
  2632868024,
  2414719590,
  3970600049,
  1771706367,
  1449415276,
  3266420449,
  422970021,
  1963543593,
  2690192192,
  3826793022,
  1062508698,
  1531092325,
  1804592342,
  2583117782,
  2714934279,
  4024971509,
  1294809318,
  4028980673,
  1289560198,
  2221992742,
  1669523910,
  35572830,
  157838143,
  1052438473,
  1016535060,
  1802137761,
  1753167236,
  1386275462,
  3080475397,
  2857371447,
  1040679964,
  2145300060,
  2390574316,
  1461121720,
  2956646967,
  4031777805,
  4028374788,
  33600511,
  2920084762,
  1018524850,
  629373528,
  3691585981,
  3515945977,
  2091462646,
  2486323059,
  586499841,
  988145025,
  935516892,
  3367335476,
  2599673255,
  2839830854,
  265290510,
  3972581182,
  2759138881,
  3795373465,
  1005194799,
  847297441,
  406762289,
  1314163512,
  1332590856,
  1866599683,
  4127851711,
  750260880,
  613907577,
  1450815602,
  3165620655,
  3734664991,
  3650291728,
  3012275730,
  3704569646,
  1427272223,
  778793252,
  1343938022,
  2676280711,
  2052605720,
  1946737175,
  3164576444,
  3914038668,
  3967478842,
  3682934266,
  1661551462,
  3294938066,
  4011595847,
  840292616,
  3712170807,
  616741398,
  312560963,
  711312465,
  1351876610,
  322626781,
  1910503582,
  271666773,
  2175563734,
  1594956187,
  70604529,
  3617834859,
  1007753275,
  1495573769,
  4069517037,
  2549218298,
  2663038764,
  504708206,
  2263041392,
  3941167025,
  2249088522,
  1514023603,
  1998579484,
  1312622330,
  694541497,
  2582060303,
  2151582166,
  1382467621,
  776784248,
  2618340202,
  3323268794,
  2497899128,
  2784771155,
  503983604,
  4076293799,
  907881277,
  423175695,
  432175456,
  1378068232,
  4145222326,
  3954048622,
  3938656102,
  3820766613,
  2793130115,
  2977904593,
  26017576,
  3274890735,
  3194772133,
  1700274565,
  1756076034,
  4006520079,
  3677328699,
  720338349,
  1533947780,
  354530856,
  688349552,
  3973924725,
  1637815568,
  332179504,
  3949051286,
  53804574,
  2852348879,
  3044236432,
  1282449977,
  3583942155,
  3416972820,
  4006381244,
  1617046695,
  2628476075,
  3002303598,
  1686838959,
  431878346,
  2686675385,
  1700445008,
  1080580658,
  1009431731,
  832498133,
  3223435511,
  2605976345,
  2271191193,
  2516031870,
  1648197032,
  4164389018,
  2548247927,
  300782431,
  375919233,
  238389289,
  3353747414,
  2531188641,
  2019080857,
  1475708069,
  455242339,
  2609103871,
  448939670,
  3451063019,
  1395535956,
  2413381860,
  1841049896,
  1491858159,
  885456874,
  4264095073,
  4001119347,
  1565136089,
  3898914787,
  1108368660,
  540939232,
  1173283510,
  2745871338,
  3681308437,
  4207628240,
  3343053890,
  4016749493,
  1699691293,
  1103962373,
  3625875870,
  2256883143,
  3830138730,
  1031889488,
  3479347698,
  1535977030,
  4236805024,
  3251091107,
  2132092099,
  1774941330,
  1199868427,
  1452454533,
  157007616,
  2904115357,
  342012276,
  595725824,
  1480756522,
  206960106,
  497939518,
  591360097,
  863170706,
  2375253569,
  3596610801,
  1814182875,
  2094937945,
  3421402208,
  1082520231,
  3463918190,
  2785509508,
  435703966,
  3908032597,
  1641649973,
  2842273706,
  3305899714,
  1510255612,
  2148256476,
  2655287854,
  3276092548,
  4258621189,
  236887753,
  3681803219,
  274041037,
  1734335097,
  3815195456,
  3317970021,
  1899903192,
  1026095262,
  4050517792,
  356393447,
  2410691914,
  3873677099,
  3682840055,
  3913112168,
  2491498743,
  4132185628,
  2489919796,
  1091903735,
  1979897079,
  3170134830,
  3567386728,
  3557303409,
  857797738,
  1136121015,
  1342202287,
  507115054,
  2535736646,
  337727348,
  3213592640,
  1301675037,
  2528481711,
  1895095763,
  1721773893,
  3216771564,
  62756741,
  2142006736,
  835421444,
  2531993523,
  1442658625,
  3659876326,
  2882144922,
  676362277,
  1392781812,
  170690266,
  3921047035,
  1759253602,
  3611846912,
  1745797284,
  664899054,
  1329594018,
  3901205900,
  3045908486,
  2062866102,
  2865634940,
  3543621612,
  3464012697,
  1080764994,
  553557557,
  3656615353,
  3996768171,
  991055499,
  499776247,
  1265440854,
  648242737,
  3940784050,
  980351604,
  3713745714,
  1749149687,
  3396870395,
  4211799374,
  3640570775,
  1161844396,
  3125318951,
  1431517754,
  545492359,
  4268468663,
  3499529547,
  1437099964,
  2702547544,
  3433638243,
  2581715763,
  2787789398,
  1060185593,
  1593081372,
  2418618748,
  4260947970,
  69676912,
  2159744348,
  86519011,
  2512459080,
  3838209314,
  1220612927,
  3339683548,
  133810670,
  1090789135,
  1078426020,
  1569222167,
  845107691,
  3583754449,
  4072456591,
  1091646820,
  628848692,
  1613405280,
  3757631651,
  526609435,
  236106946,
  48312990,
  2942717905,
  3402727701,
  1797494240,
  859738849,
  992217954,
  4005476642,
  2243076622,
  3870952857,
  3732016268,
  765654824,
  3490871365,
  2511836413,
  1685915746,
  3888969200,
  1414112111,
  2273134842,
  3281911079,
  4080962846,
  172450625,
  2569994100,
  980381355,
  4109958455,
  2819808352,
  2716589560,
  2568741196,
  3681446669,
  3329971472,
  1835478071,
  660984891,
  3704678404,
  4045999559,
  3422617507,
  3040415634,
  1762651403,
  1719377915,
  3470491036,
  2693910283,
  3642056355,
  3138596744,
  1364962596,
  2073328063,
  1983633131,
  926494387,
  3423689081,
  2150032023,
  4096667949,
  1749200295,
  3328846651,
  309677260,
  2016342300,
  1779581495,
  3079819751,
  111262694,
  1274766160,
  443224088,
  298511866,
  1025883608,
  3806446537,
  1145181785,
  168956806,
  3641502830,
  3584813610,
  1689216846,
  3666258015,
  3200248200,
  1692713982,
  2646376535,
  4042768518,
  1618508792,
  1610833997,
  3523052358,
  4130873264,
  2001055236,
  3610705100,
  2202168115,
  4028541809,
  2961195399,
  1006657119,
  2006996926,
  3186142756,
  1430667929,
  3210227297,
  1314452623,
  4074634658,
  4101304120,
  2273951170,
  1399257539,
  3367210612,
  3027628629,
  1190975929,
  2062231137,
  2333990788,
  2221543033,
  2438960610,
  1181637006,
  548689776,
  2362791313,
  3372408396,
  3104550113,
  3145860560,
  296247880,
  1970579870,
  3078560182,
  3769228297,
  1714227617,
  3291629107,
  3898220290,
  166772364,
  1251581989,
  493813264,
  448347421,
  195405023,
  2709975567,
  677966185,
  3703036547,
  1463355134,
  2715995803,
  1338867538,
  1343315457,
  2802222074,
  2684532164,
  233230375,
  2599980071,
  2000651841,
  3277868038,
  1638401717,
  4028070440,
  3237316320,
  6314154,
  819756386,
  300326615,
  590932579,
  1405279636,
  3267499572,
  3150704214,
  2428286686,
  3959192993,
  3461946742,
  1862657033,
  1266418056,
  963775037,
  2089974820,
  2263052895,
  1917689273,
  448879540,
  3550394620,
  3981727096,
  150775221,
  3627908307,
  1303187396,
  508620638,
  2975983352,
  2726630617,
  1817252668,
  1876281319,
  1457606340,
  908771278,
  3720792119,
  3617206836,
  2455994898,
  1729034894,
  1080033504,
  976866871,
  3556439503,
  2881648439,
  1522871579,
  1555064734,
  1336096578,
  3548522304,
  2579274686,
  3574697629,
  3205460757,
  3593280638,
  3338716283,
  3079412587,
  564236357,
  2993598910,
  1781952180,
  1464380207,
  3163844217,
  3332601554,
  1699332808,
  1393555694,
  1183702653,
  3581086237,
  1288719814,
  691649499,
  2847557200,
  2895455976,
  3193889540,
  2717570544,
  1781354906,
  1676643554,
  2592534050,
  3230253752,
  1126444790,
  2770207658,
  2633158820,
  2210423226,
  2615765581,
  2414155088,
  3127139286,
  673620729,
  2805611233,
  1269405062,
  4015350505,
  3341807571,
  4149409754,
  1057255273,
  2012875353,
  2162469141,
  2276492801,
  2601117357,
  993977747,
  3918593370,
  2654263191,
  753973209,
  36408145,
  2530585658,
  25011837,
  3520020182,
  2088578344,
  530523599,
  2918365339,
  1524020338,
  1518925132,
  3760827505,
  3759777254,
  1202760957,
  3985898139,
  3906192525,
  674977740,
  4174734889,
  2031300136,
  2019492241,
  3983892565,
  4153806404,
  3822280332,
  352677332,
  2297720250,
  60907813,
  90501309,
  3286998549,
  1016092578,
  2535922412,
  2839152426,
  457141659,
  509813237,
  4120667899,
  652014361,
  1966332200,
  2975202805,
  55981186,
  2327461051,
  676427537,
  3255491064,
  2882294119,
  3433927263,
  1307055953,
  942726286,
  933058658,
  2468411793,
  3933900994,
  4215176142,
  1361170020,
  2001714738,
  2830558078,
  3274259782,
  1222529897,
  1679025792,
  2729314320,
  3714953764,
  1770335741,
  151462246,
  3013232138,
  1682292957,
  1483529935,
  471910574,
  1539241949,
  458788160,
  3436315007,
  1807016891,
  3718408830,
  978976581,
  1043663428,
  3165965781,
  1927990952,
  4200891579,
  2372276910,
  3208408903,
  3533431907,
  1412390302,
  2931980059,
  4132332400,
  1947078029,
  3881505623,
  4168226417,
  2941484381,
  1077988104,
  1320477388,
  886195818,
  18198404,
  3786409e3,
  2509781533,
  112762804,
  3463356488,
  1866414978,
  891333506,
  18488651,
  661792760,
  1628790961,
  3885187036,
  3141171499,
  876946877,
  2693282273,
  1372485963,
  791857591,
  2686433993,
  3759982718,
  3167212022,
  3472953795,
  2716379847,
  445679433,
  3561995674,
  3504004811,
  3574258232,
  54117162,
  3331405415,
  2381918588,
  3769707343,
  4154350007,
  1140177722,
  4074052095,
  668550556,
  3214352940,
  367459370,
  261225585,
  2610173221,
  4209349473,
  3468074219,
  3265815641,
  314222801,
  3066103646,
  3808782860,
  282218597,
  3406013506,
  3773591054,
  379116347,
  1285071038,
  846784868,
  2669647154,
  3771962079,
  3550491691,
  2305946142,
  453669953,
  1268987020,
  3317592352,
  3279303384,
  3744833421,
  2610507566,
  3859509063,
  266596637,
  3847019092,
  517658769,
  3462560207,
  3443424879,
  370717030,
  4247526661,
  2224018117,
  4143653529,
  4112773975,
  2788324899,
  2477274417,
  1456262402,
  2901442914,
  1517677493,
  1846949527,
  2295493580,
  3734397586,
  2176403920,
  1280348187,
  1908823572,
  3871786941,
  846861322,
  1172426758,
  3287448474,
  3383383037,
  1655181056,
  3139813346,
  901632758,
  1897031941,
  2986607138,
  3066810236,
  3447102507,
  1393639104,
  373351379,
  950779232,
  625454576,
  3124240540,
  4148612726,
  2007998917,
  544563296,
  2244738638,
  2330496472,
  2058025392,
  1291430526,
  424198748,
  50039436,
  29584100,
  3605783033,
  2429876329,
  2791104160,
  1057563949,
  3255363231,
  3075367218,
  3463963227,
  1469046755,
  985887462
];
var C_ORIG = [
  1332899944,
  1700884034,
  1701343084,
  1684370003,
  1668446532,
  1869963892
];
function _encipher(lr, off, P, S) {
  var n, l = lr[off], r = lr[off + 1];
  l ^= P[0];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[1];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[2];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[3];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[4];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[5];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[6];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[7];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[8];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[9];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[10];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[11];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[12];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[13];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[14];
  n = S[l >>> 24];
  n += S[256 | l >> 16 & 255];
  n ^= S[512 | l >> 8 & 255];
  n += S[768 | l & 255];
  r ^= n ^ P[15];
  n = S[r >>> 24];
  n += S[256 | r >> 16 & 255];
  n ^= S[512 | r >> 8 & 255];
  n += S[768 | r & 255];
  l ^= n ^ P[16];
  lr[off] = r ^ P[BLOWFISH_NUM_ROUNDS + 1];
  lr[off + 1] = l;
  return lr;
}
function _streamtoword(data, offp) {
  for (var i = 0, word = 0; i < 4; ++i)
    word = word << 8 | data[offp] & 255, offp = (offp + 1) % data.length;
  return { key: word, offp };
}
function _key(key, P, S) {
  var offset = 0, lr = [0, 0], plen = P.length, slen = S.length, sw;
  for (var i = 0; i < plen; i++)
    sw = _streamtoword(key, offset), offset = sw.offp, P[i] = P[i] ^ sw.key;
  for (i = 0; i < plen; i += 2)
    lr = _encipher(lr, 0, P, S), P[i] = lr[0], P[i + 1] = lr[1];
  for (i = 0; i < slen; i += 2)
    lr = _encipher(lr, 0, P, S), S[i] = lr[0], S[i + 1] = lr[1];
}
function _ekskey(data, key, P, S) {
  var offp = 0, lr = [0, 0], plen = P.length, slen = S.length, sw;
  for (var i = 0; i < plen; i++)
    sw = _streamtoword(key, offp), offp = sw.offp, P[i] = P[i] ^ sw.key;
  offp = 0;
  for (i = 0; i < plen; i += 2)
    sw = _streamtoword(data, offp), offp = sw.offp, lr[0] ^= sw.key, sw = _streamtoword(data, offp), offp = sw.offp, lr[1] ^= sw.key, lr = _encipher(lr, 0, P, S), P[i] = lr[0], P[i + 1] = lr[1];
  for (i = 0; i < slen; i += 2)
    sw = _streamtoword(data, offp), offp = sw.offp, lr[0] ^= sw.key, sw = _streamtoword(data, offp), offp = sw.offp, lr[1] ^= sw.key, lr = _encipher(lr, 0, P, S), S[i] = lr[0], S[i + 1] = lr[1];
}
function _crypt(b, salt, rounds, callback, progressCallback) {
  var cdata = C_ORIG.slice(), clen = cdata.length, err;
  if (rounds < 4 || rounds > 31) {
    err = Error("Illegal number of rounds (4-31): " + rounds);
    if (callback) {
      nextTick(callback.bind(this, err));
      return;
    } else throw err;
  }
  if (salt.length !== BCRYPT_SALT_LEN) {
    err = Error(
      "Illegal salt length: " + salt.length + " != " + BCRYPT_SALT_LEN
    );
    if (callback) {
      nextTick(callback.bind(this, err));
      return;
    } else throw err;
  }
  rounds = 1 << rounds >>> 0;
  var P, S, i = 0, j;
  if (typeof Int32Array === "function") {
    P = new Int32Array(P_ORIG);
    S = new Int32Array(S_ORIG);
  } else {
    P = P_ORIG.slice();
    S = S_ORIG.slice();
  }
  _ekskey(salt, b, P, S);
  function next() {
    if (progressCallback) progressCallback(i / rounds);
    if (i < rounds) {
      var start = Date.now();
      for (; i < rounds; ) {
        i = i + 1;
        _key(b, P, S);
        _key(salt, P, S);
        if (Date.now() - start > MAX_EXECUTION_TIME) break;
      }
    } else {
      for (i = 0; i < 64; i++)
        for (j = 0; j < clen >> 1; j++) _encipher(cdata, j << 1, P, S);
      var ret = [];
      for (i = 0; i < clen; i++)
        ret.push((cdata[i] >> 24 & 255) >>> 0), ret.push((cdata[i] >> 16 & 255) >>> 0), ret.push((cdata[i] >> 8 & 255) >>> 0), ret.push((cdata[i] & 255) >>> 0);
      if (callback) {
        callback(null, ret);
        return;
      } else return ret;
    }
    if (callback) nextTick(next);
  }
  if (typeof callback !== "undefined") {
    next();
  } else {
    var res;
    while (true) if (typeof (res = next()) !== "undefined") return res || [];
  }
}
function _hash(password, salt, callback, progressCallback) {
  var err;
  if (typeof password !== "string" || typeof salt !== "string") {
    err = Error("Invalid string / salt: Not a string");
    if (callback) {
      nextTick(callback.bind(this, err));
      return;
    } else throw err;
  }
  var minor, offset;
  if (salt.charAt(0) !== "$" || salt.charAt(1) !== "2") {
    err = Error("Invalid salt version: " + salt.substring(0, 2));
    if (callback) {
      nextTick(callback.bind(this, err));
      return;
    } else throw err;
  }
  if (salt.charAt(2) === "$") minor = String.fromCharCode(0), offset = 3;
  else {
    minor = salt.charAt(2);
    if (minor !== "a" && minor !== "b" && minor !== "y" || salt.charAt(3) !== "$") {
      err = Error("Invalid salt revision: " + salt.substring(2, 4));
      if (callback) {
        nextTick(callback.bind(this, err));
        return;
      } else throw err;
    }
    offset = 4;
  }
  if (salt.charAt(offset + 2) > "$") {
    err = Error("Missing salt rounds");
    if (callback) {
      nextTick(callback.bind(this, err));
      return;
    } else throw err;
  }
  var r1 = parseInt(salt.substring(offset, offset + 1), 10) * 10, r2 = parseInt(salt.substring(offset + 1, offset + 2), 10), rounds = r1 + r2, real_salt = salt.substring(offset + 3, offset + 25);
  password += minor >= "a" ? "\0" : "";
  var passwordb = utf8Array(password), saltb = base64_decode(real_salt, BCRYPT_SALT_LEN);
  function finish(bytes) {
    var res = [];
    res.push("$2");
    if (minor >= "a") res.push(minor);
    res.push("$");
    if (rounds < 10) res.push("0");
    res.push(rounds.toString());
    res.push("$");
    res.push(base64_encode(saltb, saltb.length));
    res.push(base64_encode(bytes, C_ORIG.length * 4 - 1));
    return res.join("");
  }
  if (typeof callback == "undefined")
    return finish(_crypt(passwordb, saltb, rounds));
  else {
    _crypt(
      passwordb,
      saltb,
      rounds,
      function(err2, bytes) {
        if (err2) callback(err2, null);
        else callback(null, finish(bytes));
      },
      progressCallback
    );
  }
}
function encodeBase64(bytes, length) {
  return base64_encode(bytes, length);
}
function decodeBase64(string, length) {
  return base64_decode(string, length);
}
const bcrypt = {
  setRandomFallback,
  genSaltSync,
  genSalt,
  hashSync,
  hash,
  compareSync,
  compare,
  getRounds,
  getSalt,
  truncates,
  encodeBase64,
  decodeBase64
};
const SYNC_INTERVAL_MS = 30 * 60 * 1e3;
const SALES_SYNC_INTERVAL_MS = 60 * 1e3;
function getSettings() {
  const rows = db().select().from(settings).all();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}
function saveSetting(key, value) {
  db().insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } }).run();
}
async function validateLicense() {
  const s = getSettings();
  const deviceId = s["device_id"] ?? "";
  const res = await fetchCloud(`/api/v1/pos/license?device_id=${encodeURIComponent(deviceId)}`);
  if (res.valid) {
    if (res.branch_id) saveSetting("branch_id", res.branch_id);
    if (res.branch_name) saveSetting("branch_name", res.branch_name);
    if (res.org_id) saveSetting("org_id", res.org_id);
    if (res.org_name) saveSetting("org_name", res.org_name);
    if (res.device_id) saveSetting("device_id", res.device_id);
    if (res.device_name) saveSetting("device_name", res.device_name);
    if (res.valid_until) saveSetting("license_valid_until", res.valid_until);
    saveSetting("license_last_valid_at", (/* @__PURE__ */ new Date()).toISOString());
  } else {
    for (const key of ["branch_name", "org_name", "device_name", "license_valid_until", "license_last_valid_at"]) {
      db().delete(settings).where(drizzleOrm.eq(settings.key, key)).run();
    }
  }
  return { valid: res.valid, reason: res.reason };
}
async function fetchCloud(path2, config, timeoutMs = 1e4) {
  const s = getSettings();
  const base = s["cloud_url"] ?? "";
  const token = s["api_token"] ?? "";
  if (!base) throw new Error("URL del servidor no configurada");
  if (!token) throw new Error("Token de dispositivo no configurado");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}${path2}`, {
      ...config,
      signal: controller.signal,
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...config?.headers }
    });
    if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`);
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}
async function verifyUserPin(args) {
  return fetchCloud(
    "/api/v1/pos/users/verify-pin",
    { method: "POST", body: JSON.stringify(args) },
    1e4
  );
}
async function syncCatalog() {
  const s = getSettings();
  const since = s["catalog_synced_at"] ?? "1970-01-01T00:00:00.000Z";
  const branchId = s["branch_id"] ?? "";
  const { data: productList } = await fetchCloud(
    `/api/v1/pos/products?branch_id=${branchId}&since=${encodeURIComponent(since)}`
  );
  for (const p of productList) {
    db().insert(products).values({
      id: p.id,
      sku: p.sku ?? null,
      barcode: p.barcode ?? null,
      name: p.name,
      price: p.price,
      iva_rate: p.iva_rate,
      is_active: p.is_active,
      image_url: p.image_url ?? null,
      synced_at: p.updated_at
    }).onConflictDoUpdate({ target: products.id, set: {
      sku: p.sku ?? null,
      barcode: p.barcode ?? null,
      name: p.name,
      price: p.price,
      iva_rate: p.iva_rate,
      is_active: p.is_active,
      image_url: p.image_url ?? null,
      synced_at: p.updated_at
    } }).run();
  }
  const { data: customerList } = await fetchCloud(
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
  const usersSince = s["users_synced_at"] ?? "1970-01-01T00:00:00.000Z";
  const { data: userList } = await fetchCloud(
    `/api/v1/pos/users?since=${encodeURIComponent(usersSince)}&limit=50`,
    { method: "GET" }
  );
  for (const u of userList) {
    db().insert(posUsers).values({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      branch_id: u.branch_id ?? null,
      pos_pin_hash: u.pos_pin_hash ?? null,
      synced_at: u.updated_at
    }).onConflictDoUpdate({ target: posUsers.id, set: {
      name: u.name,
      email: u.email,
      role: u.role,
      branch_id: u.branch_id ?? null,
      pos_pin_hash: u.pos_pin_hash ?? null,
      synced_at: u.updated_at
    } }).run();
  }
  const nextUsersSince = userList.length > 0 ? userList.map((u) => u.updated_at).reduce((max, cur) => cur > max ? cur : max, usersSince) : usersSince;
  db().insert(settings).values({ key: "users_synced_at", value: nextUsersSince }).onConflictDoUpdate({ target: settings.key, set: { value: nextUsersSince } }).run();
  if (!branchId) throw new Error("Validá la licencia primero para obtener la sucursal asignada");
  const { data: paymentMethodList } = await fetchCloud(
    `/api/v1/pos/payment-methods?branch_id=${branchId}`
  );
  db().delete(posPaymentMethods).run();
  for (const pm of paymentMethodList) {
    db().insert(posPaymentMethods).values({
      id: pm.id,
      name: pm.name,
      type: pm.type,
      requires_reference: pm.requires_reference,
      sort_order: pm.sort_order,
      synced_at: pm.updated_at
    }).run();
  }
  db().insert(settings).values({ key: "catalog_synced_at", value: (/* @__PURE__ */ new Date()).toISOString() }).onConflictDoUpdate({ target: settings.key, set: { value: (/* @__PURE__ */ new Date()).toISOString() } }).run();
}
async function syncPendingSales() {
  const pending = db().select().from(syncQueue).all();
  if (pending.length === 0) return { synced: 0, failed: [] };
  const saleIds = pending.map((q) => q.sale_id);
  const saleRows = db().select().from(sales).where(drizzleOrm.inArray(sales.id, saleIds)).all();
  const itemRows = db().select().from(saleItems).where(drizzleOrm.inArray(saleItems.sale_id, saleIds)).all();
  const itemsBySaleId = itemRows.reduce((acc, item) => {
    (acc[item.sale_id] ??= []).push(item);
    return acc;
  }, {});
  const payload = saleRows.map((s) => ({
    pos_sale_id: s.id,
    customer_id: s.customer_id ?? void 0,
    cashier_user_id: s.cashier_user_id ?? void 0,
    cashier_name: s.cashier_name ?? void 0,
    payments: JSON.parse(s.payments ?? "[]"),
    sold_at: s.sold_at,
    items: (itemsBySaleId[s.id] ?? []).map((i) => ({
      variant_id: i.product_id,
      description: i.product_name,
      qty: i.qty,
      unit_price: i.unit_price,
      iva_rate: i.iva_rate ?? "21"
    }))
  }));
  const result = await fetchCloud(
    "/api/v1/pos/sales/sync",
    { method: "POST", body: JSON.stringify({ sales: payload }) }
  );
  const now = (/* @__PURE__ */ new Date()).toISOString();
  let synced = 0;
  const failed = [];
  for (const r of result.results) {
    if (r.cloud_id) {
      db().update(sales).set({ synced_at: now, cloud_id: r.cloud_id }).where(drizzleOrm.eq(sales.id, r.pos_sale_id)).run();
      const q = pending.find((p) => p.sale_id === r.pos_sale_id);
      if (q) db().delete(syncQueue).where(drizzleOrm.eq(syncQueue.id, q.id)).run();
      synced++;
    } else {
      const errMsg = r.error ?? "Unknown error";
      const q = pending.find((p) => p.sale_id === r.pos_sale_id);
      if (q) {
        db().update(syncQueue).set({ attempts: q.attempts + 1, last_error: errMsg }).where(drizzleOrm.eq(syncQueue.id, q.id)).run();
      }
      failed.push({ id: r.pos_sale_id, error: errMsg });
    }
  }
  return { synced, failed };
}
async function syncPendingCashSessions() {
  const toSync = db().select().from(cashSessions).where(drizzleOrm.sql`${cashSessions.synced_at} IS NULL OR ${cashSessions.cloud_id} IS NULL`).all();
  if (toSync.length === 0) return;
  const payload = toSync.map((s) => ({
    local_id: s.id,
    cashier_user_id: s.cashier_user_id ?? void 0,
    cashier_name: s.cashier_name ?? void 0,
    opened_at: s.opened_at,
    closed_at: s.closed_at ?? void 0,
    opening_amount: s.opening_amount,
    closing_amount_declared: s.closing_amount_declared ?? void 0,
    closing_amount_expected: s.closing_amount_expected ?? void 0,
    difference: s.difference ?? void 0,
    status: s.status
  }));
  const result = await fetchCloud(
    "/api/v1/pos/cash-sessions/sync",
    { method: "POST", body: JSON.stringify({ sessions: payload }) }
  );
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const failed = [];
  for (const r of result.results) {
    if (r.cloud_id) {
      db().update(cashSessions).set({ synced_at: now, cloud_id: r.cloud_id }).where(drizzleOrm.eq(cashSessions.id, r.local_id)).run();
    } else {
      failed.push(r.error ?? "unknown");
    }
  }
  if (failed.length > 0) {
    throw new Error(`${failed.length} turno(s) no sincronizados: ${failed[0]}`);
  }
}
const GRACE_PERIOD_DAYS = 7;
async function checkLicenseOnStartup() {
  const s = getSettings();
  const cloudUrl = s["cloud_url"] ?? "";
  const apiToken = s["api_token"] ?? "";
  if (!cloudUrl || !apiToken) {
    return { status: "blocked", reason: "no_config" };
  }
  try {
    const result = await validateLicense();
    if (result.valid) return { status: "ok" };
    return { status: "blocked", reason: "revoked" };
  } catch {
  }
  const lastValidAt = s["license_last_valid_at"];
  if (!lastValidAt) return { status: "blocked", reason: "unknown" };
  const daysSinceValid = (Date.now() - new Date(lastValidAt).getTime()) / (1e3 * 60 * 60 * 24);
  const daysLeft = Math.floor(GRACE_PERIOD_DAYS - daysSinceValid);
  if (daysLeft > 0) return { status: "grace", daysLeft };
  return { status: "blocked", reason: "expired" };
}
function registerSyncHandlers(ipc) {
  ipc.handle("license:check", async () => {
    try {
      return await checkLicenseOnStartup();
    } catch {
      return { status: "blocked", reason: "unknown" };
    }
  });
  ipc.handle("sync:license", async () => {
    try {
      return await validateLicense();
    } catch (e) {
      return { valid: false, reason: String(e) };
    }
  });
  ipc.handle("sync:catalog", async () => {
    try {
      await syncCatalog();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  });
  ipc.handle("sync:sales", async () => {
    const errors = [];
    let salesResult = { synced: 0, failed: [] };
    try {
      salesResult = await syncPendingSales();
    } catch (e) {
      errors.push(`ventas: ${String(e)}`);
    }
    try {
      await syncPendingCashSessions();
    } catch (e) {
      errors.push(`turnos: ${String(e)}`);
    }
    if (errors.length > 0) return { ok: false, error: errors.join(" | ") };
    if (salesResult.failed.length > 0) {
      const detail = salesResult.failed.map((f) => f.error).join(" | ");
      return { ok: false, error: `${salesResult.failed.length} venta(s) fallaron: ${detail}` };
    }
    return { ok: true, synced: salesResult.synced };
  });
  ipc.handle("settings:save", async (_e, kv) => {
    for (const [key, value] of Object.entries(kv)) {
      db().insert(settings).values({ key, value }).onConflictDoUpdate({ target: settings.key, set: { value } }).run();
    }
    return { ok: true };
  });
  ipc.handle("settings:get", async () => getSettings());
  ipc.handle("paymentMethods:list", async () => {
    return db().select().from(posPaymentMethods).orderBy(posPaymentMethods.sort_order).all();
  });
  ipc.handle("users:search", async (_e, query) => {
    const q = (query ?? "").trim();
    const term = `%${q}%`;
    const d = db();
    const rows = q ? d.select().from(posUsers).where(
      drizzleOrm.or(
        drizzleOrm.like(posUsers.name, term),
        drizzleOrm.like(posUsers.email, term),
        drizzleOrm.like(drizzleOrm.sql`coalesce(${posUsers.role}, '')`, term)
      )
    ).limit(20).all() : d.select().from(posUsers).limit(20).all();
    return { ok: true, data: rows };
  });
  ipc.handle("users:verifyPin", async (_e, args) => {
    try {
      const res = await verifyUserPin(args);
      return res;
    } catch {
      const row = db().select().from(posUsers).where(drizzleOrm.eq(posUsers.id, args.user_id)).get();
      const hash2 = row?.pos_pin_hash;
      if (!hash2) return { ok: false, error: "Sin conexión y sin PIN sincronizado para este usuario" };
      const ok = await bcrypt.compare(args.pin, hash2);
      if (!ok) return { ok: false, error: "PIN incorrecto" };
      return { ok: true, user: { id: row.id, name: row.name } };
    }
  });
  ipc.handle("dev:resetLocalData", async () => {
    try {
      db().delete(syncQueue).run();
      db().delete(saleItems).run();
      db().delete(sales).run();
      db().delete(posPaymentMethods).run();
      db().delete(posUsers).run();
      db().delete(customers).run();
      db().delete(products).run();
      db().delete(settings).run();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  });
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
    try {
      await syncPendingCashSessions();
    } catch {
    }
  }, SALES_SYNC_INTERVAL_MS);
}
function registerSalesHandlers(ipc) {
  ipc.handle("sales:create", async (_e, payload) => {
    const d = db();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const id = payload.local_id || nodeCrypto.randomUUID();
    const s = d.select().from(settings).all();
    const settingsMap = Object.fromEntries(s.map((r) => [r.key, r.value]));
    d.insert(sales).values({
      id,
      customer_id: payload.customer_id ?? null,
      cashier_user_id: payload.cashier_user_id ?? settingsMap["cashier_user_id"] ?? null,
      cashier_name: payload.cashier_name ?? settingsMap["cashier_name"] ?? null,
      payments: JSON.stringify(payload.payments),
      subtotal: payload.subtotal,
      tax_amount: payload.tax_amount,
      total: payload.total,
      sold_at: payload.sold_at || now
    }).run();
    for (const item of payload.items) {
      const p = d.select({ iva_rate: products.iva_rate }).from(products).where(drizzleOrm.eq(products.id, item.product_id)).get();
      d.insert(saleItems).values({
        sale_id: id,
        product_id: item.product_id,
        product_name: item.product_name,
        qty: item.qty,
        iva_rate: p?.iva_rate ?? "21",
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
  ipc.handle("sales:list", async (_e, args) => {
    const limit = Math.min(Math.max(args?.limit ?? 200, 1), 500);
    return db().select().from(sales).orderBy(drizzleOrm.desc(sales.sold_at)).limit(limit).all();
  });
  ipc.handle("sales:get", async (_e, saleId) => {
    const s = db().select().from(sales).where(drizzleOrm.eq(sales.id, saleId)).get();
    if (!s) return null;
    const items = db().select().from(saleItems).where(drizzleOrm.eq(saleItems.sale_id, saleId)).all();
    return { sale: s, items };
  });
  ipc.handle("sales:closingReport", async (_e, date) => {
    const day = date ?? (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const rows = db().select({ payments: sales.payments, total: sales.total }).from(sales).where(drizzleOrm.sql`strftime('%Y-%m-%d', ${sales.sold_at}) = ${day}`).all();
    const byType = {};
    let grandTotal = 0;
    let count = 0;
    for (const row of rows) {
      const payments = JSON.parse(row.payments ?? "[]");
      for (const p of payments) {
        byType[p.payment_method_name] = (byType[p.payment_method_name] ?? 0) + Number(p.amount);
      }
      grandTotal += Number(row.total);
      count++;
    }
    return { byType, total: grandTotal, count, date: day };
  });
}
function registerProductsHandlers(ipc) {
  ipc.handle("products:search", async (_e, query) => {
    const d = db();
    const trimmed = query.trim();
    const term = `%${trimmed}%`;
    const rows = trimmed ? d.select().from(products).where(
      drizzleOrm.and(
        drizzleOrm.eq(products.is_active, true),
        drizzleOrm.or(
          drizzleOrm.eq(products.barcode, trimmed),
          // exact barcode match first
          drizzleOrm.like(products.name, term),
          drizzleOrm.like(products.sku, term)
        )
      )
    ).limit(40).all() : d.select().from(products).where(drizzleOrm.eq(products.is_active, true)).limit(40).all();
    return rows;
  });
}
function registerCustomersHandlers(ipc) {
  ipc.handle("customers:search", async (_e, query) => {
    const d = db();
    const q = query.trim();
    const term = `%${q}%`;
    const rows = q ? d.select().from(customers).where(
      drizzleOrm.or(
        drizzleOrm.like(customers.legal_name, term),
        drizzleOrm.like(drizzleOrm.sql`coalesce(${customers.trade_name}, '')`, term),
        drizzleOrm.like(drizzleOrm.sql`coalesce(${customers.cuit}, '')`, term)
      )
    ).limit(30).all() : d.select().from(customers).limit(30).all();
    return rows;
  });
}
function registerDraftSalesHandlers(ipc) {
  ipc.handle("draftSales:getActive", async () => {
    const row = db().select().from(posDraftSales).where(drizzleOrm.eq(posDraftSales.status, "draft")).orderBy(drizzleOrm.desc(posDraftSales.updated_at)).limit(1).get();
    if (!row) return { ok: true, data: null };
    return { ok: true, data: row };
  });
  ipc.handle("draftSales:list", async (_e, args) => {
    const status = args?.status ?? "draft";
    const limit = Math.min(Math.max(args?.limit ?? 100, 1), 500);
    const rows = db().select().from(posDraftSales).where(drizzleOrm.eq(posDraftSales.status, status)).orderBy(drizzleOrm.desc(posDraftSales.updated_at)).limit(limit).all();
    return { ok: true, data: rows };
  });
  ipc.handle("draftSales:get", async (_e, draftSaleId) => {
    const sale = db().select().from(posDraftSales).where(drizzleOrm.eq(posDraftSales.id, draftSaleId)).get();
    if (!sale) return { ok: true, data: null };
    const items = db().select().from(posDraftSaleItems).where(drizzleOrm.eq(posDraftSaleItems.draft_sale_id, draftSaleId)).orderBy(posDraftSaleItems.sort_order).all();
    return { ok: true, data: { sale, items } };
  });
  ipc.handle(
    "draftSales:createOrResume",
    async (_e, args) => {
      const d = db();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      if (args?.draft_sale_id) {
        const existing = d.select().from(posDraftSales).where(drizzleOrm.eq(posDraftSales.id, args.draft_sale_id)).get();
        if (existing) {
          d.update(posDraftSales).set({ last_opened_at: now, updated_at: now }).where(drizzleOrm.eq(posDraftSales.id, args.draft_sale_id)).run();
          return { ok: true, id: args.draft_sale_id };
        }
      }
      const id = nodeCrypto.randomUUID();
      d.insert(posDraftSales).values({
        id,
        status: "draft",
        cashier_user_id: args?.cashier_user_id ?? null,
        cashier_name: args?.cashier_name ?? null,
        customer_id: args?.customer_id ?? null,
        payments: "[]",
        subtotal: "0",
        tax_amount: "0",
        total: "0",
        last_opened_at: now,
        created_at: now,
        updated_at: now
      }).run();
      return { ok: true, id };
    }
  );
  ipc.handle(
    "draftSales:update",
    async (_e, args) => {
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const patch = { updated_at: now };
      if ("cashier_user_id" in args) patch.cashier_user_id = args.cashier_user_id ?? null;
      if ("cashier_name" in args) patch.cashier_name = args.cashier_name ?? null;
      if ("customer_id" in args) patch.customer_id = args.customer_id ?? null;
      if (args.subtotal !== void 0) patch.subtotal = args.subtotal;
      if (args.tax_amount !== void 0) patch.tax_amount = args.tax_amount;
      if (args.total !== void 0) patch.total = args.total;
      db().update(posDraftSales).set(patch).where(drizzleOrm.eq(posDraftSales.id, args.draft_sale_id)).run();
      return { ok: true };
    }
  );
  ipc.handle(
    "draftSaleItems:upsert",
    async (_e, args) => {
      const d = db();
      const p = d.select({ iva_rate: products.iva_rate }).from(products).where(drizzleOrm.eq(products.id, args.product_id)).get();
      const iva_rate = args.iva_rate ?? p?.iva_rate ?? "21";
      const sort_order = args.sort_order ?? 0;
      d.insert(posDraftSaleItems).values({
        draft_sale_id: args.draft_sale_id,
        product_id: args.product_id,
        product_name: args.product_name,
        qty: args.qty,
        iva_rate,
        unit_price: args.unit_price,
        total: args.total,
        sort_order
      }).onConflictDoUpdate({
        target: [posDraftSaleItems.draft_sale_id, posDraftSaleItems.product_id],
        set: {
          product_name: args.product_name,
          qty: args.qty,
          iva_rate,
          unit_price: args.unit_price,
          total: args.total,
          sort_order
        }
      }).run();
      d.update(posDraftSales).set({ updated_at: (/* @__PURE__ */ new Date()).toISOString() }).where(drizzleOrm.eq(posDraftSales.id, args.draft_sale_id)).run();
      return { ok: true };
    }
  );
  ipc.handle("draftSaleItems:remove", async (_e, args) => {
    const d = db();
    d.delete(posDraftSaleItems).where(drizzleOrm.and(drizzleOrm.eq(posDraftSaleItems.draft_sale_id, args.draft_sale_id), drizzleOrm.eq(posDraftSaleItems.product_id, args.product_id))).run();
    d.update(posDraftSales).set({ updated_at: (/* @__PURE__ */ new Date()).toISOString() }).where(drizzleOrm.eq(posDraftSales.id, args.draft_sale_id)).run();
    return { ok: true };
  });
  ipc.handle(
    "draftSales:checkout",
    async (_e, args) => {
      const d = db();
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const draft = d.select().from(posDraftSales).where(drizzleOrm.eq(posDraftSales.id, args.draft_sale_id)).get();
      if (!draft) return { ok: false, error: "DRAFT_NOT_FOUND" };
      const items = d.select().from(posDraftSaleItems).where(drizzleOrm.eq(posDraftSaleItems.draft_sale_id, args.draft_sale_id)).all();
      if (items.length === 0) return { ok: false, error: "EMPTY_DRAFT" };
      const s = d.select().from(settings).all();
      const settingsMap = Object.fromEntries(s.map((r) => [r.key, r.value]));
      const paymentsJson = JSON.stringify(args.payments);
      const saleId = nodeCrypto.randomUUID();
      d.insert(sales).values({
        id: saleId,
        customer_id: draft.customer_id ?? null,
        cashier_user_id: draft.cashier_user_id ?? settingsMap["cashier_user_id"] ?? null,
        cashier_name: draft.cashier_name ?? settingsMap["cashier_name"] ?? null,
        payments: paymentsJson,
        subtotal: args.subtotal,
        tax_amount: args.tax_amount,
        total: args.total,
        sold_at: args.sold_at ?? now
      }).run();
      for (const item of items) {
        d.insert(saleItems).values({
          sale_id: saleId,
          product_id: item.product_id,
          product_name: item.product_name,
          qty: item.qty,
          iva_rate: item.iva_rate ?? "21",
          unit_price: item.unit_price,
          total: item.total
        }).run();
      }
      d.insert(syncQueue).values({ sale_id: saleId, attempts: 0, created_at: now }).run();
      d.update(posDraftSales).set({
        status: "paid",
        payments: paymentsJson,
        subtotal: args.subtotal,
        tax_amount: args.tax_amount,
        total: args.total,
        updated_at: now
      }).where(drizzleOrm.eq(posDraftSales.id, args.draft_sale_id)).run();
      return { ok: true, sale_id: saleId };
    }
  );
  ipc.handle("draftSales:cancel", async (_e, draft_sale_id) => {
    const now = (/* @__PURE__ */ new Date()).toISOString();
    db().update(posDraftSales).set({ status: "cancelled", updated_at: now }).where(drizzleOrm.eq(posDraftSales.id, draft_sale_id)).run();
    return { ok: true };
  });
}
function registerCashSessionHandlers(ipc) {
  ipc.handle("cashSessions:getCurrent", async () => {
    return db().select().from(cashSessions).where(drizzleOrm.eq(cashSessions.status, "open")).get() ?? null;
  });
  ipc.handle("cashSessions:open", async (_e, args) => {
    const existing = db().select().from(cashSessions).where(drizzleOrm.eq(cashSessions.status, "open")).get();
    if (existing) return { ok: false, error: "Ya hay un turno abierto", session: existing };
    const id = nodeCrypto.randomUUID();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    db().insert(cashSessions).values({
      id,
      cashier_user_id: args.cashier_user_id ?? null,
      cashier_name: args.cashier_name ?? null,
      opened_at: now,
      opening_amount: args.opening_amount,
      status: "open"
    }).run();
    const session = db().select().from(cashSessions).where(drizzleOrm.eq(cashSessions.id, id)).get();
    return { ok: true, session };
  });
  ipc.handle("cashSessions:close", async (_e, args) => {
    const session = db().select().from(cashSessions).where(drizzleOrm.eq(cashSessions.id, args.session_id)).get();
    if (!session) return { ok: false, error: "Turno no encontrado" };
    if (session.status === "closed") return { ok: false, error: "El turno ya está cerrado" };
    const openedAt = session.opened_at;
    const sessionSales = db().select({ payments: sales.payments }).from(sales).where(drizzleOrm.gte(sales.sold_at, openedAt)).all();
    const cashFromSales = sessionSales.reduce((sum, s) => {
      const payments = JSON.parse(s.payments ?? "[]");
      const cash = payments.filter((p) => p.payment_method_type === "cash");
      return sum + cash.reduce((a, p) => a + Number(p.amount), 0);
    }, 0);
    const expected = (Number(session.opening_amount) + cashFromSales).toFixed(2);
    const declared = Number(args.closing_amount_declared).toFixed(2);
    const difference = (Number(declared) - Number(expected)).toFixed(2);
    const now = (/* @__PURE__ */ new Date()).toISOString();
    db().update(cashSessions).set({
      status: "closed",
      closed_at: now,
      closing_amount_declared: declared,
      closing_amount_expected: expected,
      difference
    }).where(drizzleOrm.eq(cashSessions.id, args.session_id)).run();
    const updated = db().select().from(cashSessions).where(drizzleOrm.eq(cashSessions.id, args.session_id)).get();
    return { ok: true, session: updated };
  });
  ipc.handle("cashSessions:list", async (_e, args) => {
    const limit = Math.min(args?.limit ?? 50, 200);
    return db().select().from(cashSessions).orderBy(drizzleOrm.desc(cashSessions.opened_at)).limit(limit).all();
  });
  ipc.handle("cashSessions:get", async (_e, sessionId) => {
    return db().select().from(cashSessions).where(drizzleOrm.eq(cashSessions.id, sessionId)).get() ?? null;
  });
}
let mainWindow = null;
function createWindow() {
  mainWindow = new electron.BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    fullscreen: process.env.NODE_ENV !== "development",
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
  electron.globalShortcut.register("F11", () => {
    mainWindow?.setFullScreen(!mainWindow.isFullScreen());
  });
  electron.globalShortcut.register("CommandOrControl+Alt+I", () => {
    mainWindow?.webContents.toggleDevTools();
  });
}
electron.app.whenReady().then(async () => {
  try {
    initDb();
  } catch (err) {
    console.error("[DB] Failed to initialize database:", err);
  }
  registerSalesHandlers(electron.ipcMain);
  registerProductsHandlers(electron.ipcMain);
  registerCustomersHandlers(electron.ipcMain);
  registerDraftSalesHandlers(electron.ipcMain);
  registerCashSessionHandlers(electron.ipcMain);
  registerSyncHandlers(electron.ipcMain);
  createWindow();
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") electron.app.quit();
});
electron.app.on("activate", () => {
  if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
});
