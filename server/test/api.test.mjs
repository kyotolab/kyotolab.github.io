import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 8788;
const BASE = `http://127.0.0.1:${PORT}`;
const STAFF = "test-staff-key-000000000000";
const ADMIN = "test-admin-key-000000000000";
const sha = (s) => createHash("sha256").update(s).digest("hex");
const persist = mkdtempSync(join(tmpdir(), "kyotolab-menu-"));
let server;

before(async () => {
  execFileSync("npx", ["wrangler", "d1", "migrations", "apply", "DB", "--local", "--persist-to", persist], {
    stdio: "ignore",
  });
  server = spawn(
    "npx",
    [
      "wrangler", "dev", "--port", String(PORT), "--ip", "127.0.0.1", "--persist-to", persist,
      "--var", `STAFF_KEYS:${JSON.stringify({ demo: sha(STAFF) })}`,
      "--var", `ADMIN_KEY_HASH:${sha(ADMIN)}`,
    ],
    { stdio: "ignore", detached: true }
  );
  for (let i = 0; i < 120; i++) {
    try {
      if ((await fetch(`${BASE}/api/shops/demo/menu`)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("wrangler dev did not start");
});

after(() => {
  try {
    process.kill(-server.pid);
  } catch {}
  rmSync(persist, { recursive: true, force: true });
});

const call = (path, { method = "GET", body, key } = {}) =>
  fetch(BASE + path, {
    method,
    headers: {
      ...(body ? { "content-type": "application/json" } : {}),
      ...(key ? { authorization: `Bearer ${key}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

test("the menu is public and lists no sold-out dishes at first", async () => {
  const res = await call("/api/shops/demo/menu");
  assert.equal(res.status, 200);
  const menu = await res.json();
  assert.equal(menu.dishes.length, 8);
  assert.deepEqual(menu.soldout, []);
});

test("an unknown shop is 404", async () => {
  assert.equal((await call("/api/shops/nope/menu")).status, 404);
  assert.equal((await call("/s/nope")).status, 404);
});

test("the guest and staff pages are served with a CSP", async () => {
  for (const path of ["/s/demo", "/staff/demo"]) {
    const res = await call(path);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type"), /text\/html/);
    assert.match(res.headers.get("content-security-policy"), /script-src 'self'/);
  }
});

test("the server computes the 10% fee for translated orders and none for Japanese", async () => {
  let res = await call("/api/shops/demo/orders", {
    method: "POST",
    body: { lang: "en", items: [{ id: "yuba", qty: 2 }, { id: "miso", qty: 1 }, { id: "yuba", qty: 1 }] },
  });
  assert.equal(res.status, 201);
  assert.deepEqual(
    { ...(await res.json()), id: 0 },
    { id: 0, subtotal: 3900, fee: 390, total: 4290 }
  );

  res = await call("/api/shops/demo/orders", { method: "POST", body: { lang: "ja", items: [{ id: "tamago", qty: 1 }] } });
  assert.deepEqual({ ...(await res.json()), id: 0 }, { id: 0, subtotal: 800, fee: 0, total: 800 });

  res = await call("/api/shops/demo/orders", { method: "POST", body: { lang: "ko", items: [{ id: "miso", qty: 1 }, { id: "tsukemono", qty: 1 }, { id: "warabi", qty: 1 }, { id: "tamago", qty: 1 }, { id: "yuba", qty: 1 }, { id: "oyako", qty: 1 }, { id: "saba", qty: 1 }, { id: "tempura", qty: 1 }] } });
  const odd = await res.json();
  assert.equal(odd.subtotal, 7800);
  assert.equal(odd.fee, 780);
});

test("bad orders are rejected", async () => {
  const bad = [
    { lang: "fr", items: [{ id: "yuba", qty: 1 }] },
    { lang: "en", items: [] },
    { lang: "en", items: [{ id: "nope", qty: 1 }] },
    { lang: "en", items: [{ id: "yuba", qty: 0 }] },
    { lang: "en", items: [{ id: "yuba", qty: 1.5 }] },
    { lang: "en", items: [{ id: "yuba", qty: 15 }, { id: "yuba", qty: 6 }] },
  ];
  for (const body of bad) {
    assert.equal((await call("/api/shops/demo/orders", { method: "POST", body })).status, 400, JSON.stringify(body));
  }
  const res = await fetch(`${BASE}/api/shops/demo/orders`, { method: "POST", body: "not json" });
  assert.equal(res.status, 400);
});

test("staff endpoints need the shop key or the admin key", async () => {
  assert.equal((await call("/api/shops/demo/orders")).status, 401);
  assert.equal((await call("/api/shops/demo/orders", { key: "wrong-key-00000000000000" })).status, 401);
  assert.equal((await call("/api/shops/demo/orders", { key: STAFF })).status, 200);
  assert.equal((await call("/api/shops/demo/orders", { key: ADMIN })).status, 200);
  assert.equal((await call("/api/shops/demo/soldout", { method: "POST", body: { dish: "yuba", out: true } })).status, 401);
});

test("sold-out dishes show in the menu and block orders", async () => {
  let res = await call("/api/shops/demo/soldout", { method: "POST", key: STAFF, body: { dish: "saba", out: true } });
  assert.deepEqual((await res.json()).soldout, ["saba"]);
  assert.deepEqual((await (await call("/api/shops/demo/menu")).json()).soldout, ["saba"]);

  res = await call("/api/shops/demo/orders", { method: "POST", body: { lang: "en", items: [{ id: "saba", qty: 1 }] } });
  assert.equal(res.status, 409);
  assert.deepEqual((await res.json()).dishes, ["saba"]);

  res = await call("/api/shops/demo/soldout", { method: "POST", key: STAFF, body: { dish: "saba", out: false } });
  assert.deepEqual((await res.json()).soldout, []);
  assert.equal((await call("/api/shops/demo/soldout", { method: "POST", key: STAFF, body: { dish: "nope", out: true } })).status, 400);
});

test("today's orders, voiding, and the monthly report agree", async () => {
  const list = await (await call("/api/shops/demo/orders", { key: STAFF })).json();
  assert.equal(list.orders.length, 3);
  const [latest] = list.orders;

  let report = await (await call("/api/shops/demo/report", { key: STAFF })).json();
  assert.deepEqual(
    { orders: report.orders, translated: report.translated, subtotal: report.subtotal, fee: report.fee },
    { orders: 3, translated: 2, subtotal: 3900 + 800 + 7800, fee: 390 + 780 }
  );

  assert.equal((await call(`/api/shops/demo/orders/${latest.id}`, { method: "POST", key: STAFF, body: { voided: true } })).status, 200);
  report = await (await call("/api/shops/demo/report", { key: STAFF })).json();
  assert.equal(report.orders, 2);
  assert.equal(report.fee, 390);
  assert.equal((await call("/api/shops/demo/orders/999999", { method: "POST", key: STAFF, body: { voided: true } })).status, 404);

  const csv = await (await call("/api/shops/demo/report?format=csv", { key: STAFF })).text();
  const rows = csv.trim().split("\r\n");
  assert.equal(rows.length, 3);
  assert.match(rows[1], /湯葉あんかけ丼×3 九条ねぎと油揚げの味噌汁×1,3900,390,4290$/);

  const empty = await (await call("/api/shops/demo/report?month=2020-01", { key: STAFF })).json();
  assert.deepEqual({ orders: empty.orders, fee: empty.fee }, { orders: 0, fee: 0 });
});

test("more than 20 orders a minute for one shop are refused", async () => {
  let refused = 0;
  for (let i = 0; i < 20; i++) {
    const res = await call("/api/shops/demo/orders", { method: "POST", body: { lang: "en", items: [{ id: "miso", qty: 1 }] } });
    if (res.status === 429) refused++;
  }
  assert.ok(refused > 0);
});
