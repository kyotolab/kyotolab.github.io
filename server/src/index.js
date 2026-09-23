import { SHOPS } from "./shops.js";

const LANGS = ["ja", "en", "zh", "ko"];
const JST = 9 * 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;
const ORDERS_PER_MINUTE = 20;
const MAX_BODY = 8 * 1024;

const PAGE_HEADERS = {
  "content-security-policy":
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "cache-control": "no-cache",
};

export default {
  async fetch(request, env) {
    try {
      return await route(request, env);
    } catch (err) {
      console.error(err);
      return json({ error: "server_error" }, 500);
    }
  },
};

async function route(request, env) {
  const url = new URL(request.url);
  const method = request.method;

  const page = url.pathname.match(/^\/(s|staff)\/([a-z0-9-]+)\/?$/);
  if (page) {
    if (method !== "GET" || !SHOPS[page[2]]) return new Response("Not found", { status: 404 });
    const res = await env.ASSETS.fetch(new URL(page[1] === "s" ? "/guest.html" : "/staff.html", url));
    const out = new Response(res.body, res);
    for (const [k, v] of Object.entries(PAGE_HEADERS)) out.headers.set(k, v);
    return out;
  }

  const api = url.pathname.match(/^\/api\/shops\/([a-z0-9-]+)\/(menu|soldout|orders|report)(?:\/(\d+))?$/);
  if (!api) return json({ error: "not_found" }, 404);
  const shop = SHOPS[api[1]];
  if (!shop) return json({ error: "unknown_shop" }, 404);
  const what = api[2];
  const orderId = api[3] ? Number(api[3]) : null;

  if (what === "menu" && method === "GET" && orderId === null) return getMenu(env, shop);
  if (what === "orders" && method === "POST" && orderId === null) return createOrder(request, env, shop);

  if (!(await isStaff(request, env, shop.id))) return json({ error: "unauthorized" }, 401);
  if (what === "soldout" && method === "POST" && orderId === null) return setSoldout(request, env, shop);
  if (what === "orders" && method === "GET" && orderId === null) return listOrders(url, env, shop);
  if (what === "orders" && method === "POST" && orderId !== null) return setVoided(request, env, shop, orderId);
  if (what === "report" && method === "GET" && orderId === null) return report(url, env, shop);
  return json({ error: "method_not_allowed" }, 405);
}

async function getMenu(env, shop) {
  return json({ ...shop, soldout: [...(await soldoutSet(env, shop.id))] });
}

async function createOrder(request, env, shop) {
  const body = await readJson(request);
  const lang = body && LANGS.includes(body.lang) ? body.lang : null;
  const items = body && Array.isArray(body.items) ? body.items : null;
  if (!lang || !items || items.length < 1 || items.length > 30) return json({ error: "bad_request" }, 400);

  const dishes = new Map(shop.dishes.map((d) => [d.id, d]));
  const qty = new Map();
  for (const it of items) {
    if (!it || !dishes.has(it.id) || !Number.isInteger(it.qty) || it.qty < 1) return json({ error: "bad_request" }, 400);
    qty.set(it.id, (qty.get(it.id) || 0) + it.qty);
  }
  if ([...qty.values()].some((n) => n > 20)) return json({ error: "bad_request" }, 400);

  const out = await soldoutSet(env, shop.id);
  const unavailable = [...qty.keys()].filter((id) => out.has(id));
  if (unavailable.length) return json({ error: "sold_out", dishes: unavailable }, 409);

  const now = Date.now();
  const recent = await env.DB.prepare("SELECT COUNT(*) AS n FROM orders WHERE shop_id = ? AND created_at > ?")
    .bind(shop.id, now - 60 * 1000)
    .first();
  if (recent.n >= ORDERS_PER_MINUTE) return json({ error: "too_many_orders" }, 429);

  const lines = [...qty].map(([id, n]) => ({ id, qty: n, price: dishes.get(id).price }));
  const subtotal = lines.reduce((sum, l) => sum + l.price * l.qty, 0);
  const fee = lang === "ja" ? 0 : Math.floor((subtotal * shop.feeRate) / 100);
  const res = await env.DB.prepare(
    "INSERT INTO orders (shop_id, created_at, lang, items, subtotal, fee) VALUES (?, ?, ?, ?, ?, ?)"
  )
    .bind(shop.id, now, lang, JSON.stringify(lines), subtotal, fee)
    .run();
  return json({ id: res.meta.last_row_id, subtotal, fee, total: subtotal + fee }, 201);
}

async function setSoldout(request, env, shop) {
  const body = await readJson(request);
  if (!body || !shop.dishes.some((d) => d.id === body.dish) || typeof body.out !== "boolean") {
    return json({ error: "bad_request" }, 400);
  }
  if (body.out) {
    await env.DB.prepare("INSERT OR REPLACE INTO soldout (shop_id, dish_id, updated_at) VALUES (?, ?, ?)")
      .bind(shop.id, body.dish, Date.now())
      .run();
  } else {
    await env.DB.prepare("DELETE FROM soldout WHERE shop_id = ? AND dish_id = ?").bind(shop.id, body.dish).run();
  }
  return json({ soldout: [...(await soldoutSet(env, shop.id))] });
}

async function listOrders(url, env, shop) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("date") || "")
    ? url.searchParams.get("date")
    : jstDate(Date.now());
  const [y, m, d] = date.split("-").map(Number);
  const start = Date.UTC(y, m - 1, d) - JST;
  const { results } = await env.DB.prepare(
    "SELECT id, created_at, lang, items, subtotal, fee, voided FROM orders WHERE shop_id = ? AND created_at >= ? AND created_at < ? ORDER BY id DESC"
  )
    .bind(shop.id, start, start + DAY)
    .all();
  return json({ date, orders: results.map(toOrder) });
}

async function setVoided(request, env, shop, id) {
  const body = await readJson(request);
  if (!body || typeof body.voided !== "boolean") return json({ error: "bad_request" }, 400);
  const res = await env.DB.prepare("UPDATE orders SET voided = ? WHERE id = ? AND shop_id = ?")
    .bind(body.voided ? 1 : 0, id, shop.id)
    .run();
  if (!res.meta.changes) return json({ error: "not_found" }, 404);
  return json({ id, voided: body.voided });
}

async function report(url, env, shop) {
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(url.searchParams.get("month") || "")
    ? url.searchParams.get("month")
    : jstDate(Date.now()).slice(0, 7);
  const [y, m] = month.split("-").map(Number);
  const start = Date.UTC(y, m - 1, 1) - JST;
  const end = Date.UTC(y, m, 1) - JST;

  if (url.searchParams.get("format") === "csv") {
    const { results } = await env.DB.prepare(
      "SELECT id, created_at, lang, items, subtotal, fee FROM orders WHERE shop_id = ? AND voided = 0 AND created_at >= ? AND created_at < ? ORDER BY id"
    )
      .bind(shop.id, start, end)
      .all();
    const names = new Map(shop.dishes.map((d) => [d.id, d.name.ja]));
    const rows = [["注文番号", "日時", "言語", "品目", "小計", "サービス料", "合計"]];
    for (const r of results) {
      const o = toOrder(r);
      const items = o.items.map((l) => `${names.get(l.id) || l.id}×${l.qty}`).join(" ");
      rows.push([o.id, jstDateTime(o.createdAt), o.lang, items, o.subtotal, o.fee, o.subtotal + o.fee]);
    }
    const csv = "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${shop.id}-${month}.csv"`,
        "cache-control": "no-store",
      },
    });
  }

  const row = await env.DB.prepare(
    "SELECT COUNT(*) AS orders, COALESCE(SUM(fee > 0), 0) AS translated, COALESCE(SUM(subtotal), 0) AS subtotal, COALESCE(SUM(fee), 0) AS fee FROM orders WHERE shop_id = ? AND voided = 0 AND created_at >= ? AND created_at < ?"
  )
    .bind(shop.id, start, end)
    .first();
  return json({ month, ...row });
}

async function soldoutSet(env, shopId) {
  const { results } = await env.DB.prepare("SELECT dish_id FROM soldout WHERE shop_id = ?").bind(shopId).all();
  return new Set(results.map((r) => r.dish_id));
}

async function isStaff(request, env, shopId) {
  const m = (request.headers.get("authorization") || "").match(/^Bearer ([A-Za-z0-9_-]{16,128})$/);
  if (!m) return false;
  const hash = await sha256hex(m[1]);
  let keys = {};
  try {
    keys = JSON.parse(env.STAFF_KEYS || "{}");
  } catch {
    keys = {};
  }
  return [keys[shopId], env.ADMIN_KEY_HASH].some((h) => typeof h === "string" && safeEqual(h, hash));
}

async function sha256hex(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function readJson(request) {
  const text = await request.text();
  if (text.length > MAX_BODY) return null;
  try {
    const v = JSON.parse(text);
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
}

function toOrder(r) {
  return {
    id: r.id,
    createdAt: r.created_at,
    lang: r.lang,
    items: JSON.parse(r.items),
    subtotal: r.subtotal,
    fee: r.fee,
    voided: r.voided === 1,
  };
}

function jstDate(ms) {
  return new Date(ms + JST).toISOString().slice(0, 10);
}

function jstDateTime(ms) {
  return new Date(ms + JST).toISOString().slice(0, 16).replace("T", " ");
}

function csvCell(v) {
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
