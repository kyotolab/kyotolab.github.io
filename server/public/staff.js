(function () {
  "use strict";

  var SHOP = location.pathname.split("/")[2];
  var API = "/api/shops/" + SHOP;
  var KEY_STORE = "kyotolab-staff-" + SHOP;
  var LANG_NAMES = { ja: "日本語", en: "English", zh: "中文", ko: "한국어" };
  var JST = 9 * 60 * 60 * 1000;

  var state = { key: takeKey(), tab: "soldout", menu: null, out: {}, orders: null, month: jstNow().slice(0, 7), report: null, msg: "", busy: false };

  function takeKey() {
    var m = location.hash.match(/[#&]k=([A-Za-z0-9_-]+)/);
    if (m) {
      try { localStorage.setItem(KEY_STORE, m[1]); } catch (e) {}
      history.replaceState(null, "", location.pathname);
      return m[1];
    }
    try { return localStorage.getItem(KEY_STORE) || ""; } catch (e) { return ""; }
  }

  function jstNow() { return new Date(Date.now() + JST).toISOString(); }
  function hhmm(ms) { return new Date(ms + JST).toISOString().slice(11, 16); }
  function yen(n) { return "¥" + n.toLocaleString("en-US"); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function dishName(id) {
    var ds = state.menu ? state.menu.dishes : [];
    for (var i = 0; i < ds.length; i++) if (ds[i].id === id) return ds[i].name.ja;
    return id;
  }

  function api(path, opts) {
    opts = opts || {};
    var headers = { authorization: "Bearer " + state.key };
    if (opts.body) headers["content-type"] = "application/json";
    return fetch(API + path, { method: opts.method || "GET", headers: headers, body: opts.body ? JSON.stringify(opts.body) : undefined, cache: "no-store" })
      .then(function (r) {
        if (r.status === 401) {
          state.key = "";
          try { localStorage.removeItem(KEY_STORE); } catch (e) {}
          state.msg = "鍵が違います。京都ラボから届いた鍵を入れてください。";
          render();
          throw new Error("unauthorized");
        }
        if (!r.ok) throw new Error(String(r.status));
        return opts.raw ? r : r.json();
      });
  }

  function fail(err) {
    if (err && err.message === "unauthorized") return;
    state.busy = false;
    state.msg = "通信できませんでした。電波を確かめて、もう一度お試しください。";
    render();
  }

  function loadMenu() {
    return fetch(API + "/menu", { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(function (m) {
        state.menu = m;
        state.out = {};
        m.soldout.forEach(function (id) { state.out[id] = true; });
      });
  }
  function loadOrders() {
    return api("/orders").then(function (d) { state.orders = d.orders; });
  }
  function loadReport() {
    return api("/report?month=" + state.month).then(function (d) { state.report = d; });
  }

  function refresh() {
    if (!state.key) { render(); return; }
    var job = state.tab === "orders" ? loadOrders() : state.tab === "month" ? loadReport() : Promise.resolve();
    Promise.all([loadMenu(), job]).then(function () { state.msg = ""; render(); }).catch(fail);
  }

  function keyForm() {
    return '<div class="keyform"><h1>京都ラボ お品書き 店舗用</h1>' +
      (state.msg ? '<p class="msg">' + esc(state.msg) + "</p>" : "") +
      '<p class="lead">京都ラボから届いた鍵を入れてください。この端末に覚えさせるので、次からは入れなくて大丈夫です。</p>' +
      '<form id="keyform"><input id="keyinput" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="鍵">' +
      '<button class="primary" type="submit">はじめる</button></form></div>';
  }

  function soldoutTab() {
    if (!state.menu) return '<p class="empty">…</p>';
    return '<p class="lead">押すと品切れになり、お客さまの画面から20秒ほどで注文できなくなります。もう一度押すと戻ります。</p>' +
      state.menu.dishes.map(function (d) {
        var out = !!state.out[d.id];
        return '<button class="tog" data-dish="' + esc(d.id) + '" aria-pressed="' + out + '"><span>' + esc(d.name.ja) +
          "<small>" + (out ? "品切れ" : "提供中") + " ・ " + yen(d.price) + '</small></span><span class="sw"></span></button>';
      }).join("");
  }

  function ordersTab() {
    if (!state.orders) return '<p class="empty">…</p>';
    if (!state.orders.length) return '<p class="empty">今日の注文はまだありません。</p>';
    return '<p class="lead">お客さまのスマホで「注文を受けました」を押した注文です。間違いは取り消せます（月の合計から外れます）。</p>' +
      state.orders.map(function (o) {
        var items = o.items.map(function (l) { return esc(dishName(l.id)) + " ×" + l.qty; }).join("、");
        return '<div class="ord' + (o.voided ? " void" : "") + '"><div class="head"><span class="no">No. ' + o.id + "</span>" +
          '<span class="meta">' + hhmm(o.createdAt) + " ・ " + esc(LANG_NAMES[o.lang] || o.lang) + (o.voided ? " ・ 取り消し済み" : "") + "</span></div>" +
          '<p class="items">' + items + "</p>" +
          '<div class="sum"><span>' + yen(o.subtotal) + (o.fee ? " ＋ サービス料 " + yen(o.fee) : "") + " ＝ " + yen(o.subtotal + o.fee) + "</span>" +
          '<button class="ghost" data-void="' + o.id + '" data-to="' + !o.voided + '">' + (o.voided ? "取り消しをやめる" : "取り消す") + "</button></div></div>";
      }).join("");
  }

  function monthTab() {
    var r = state.report;
    return '<div class="month"><button data-month="-1" aria-label="前の月">‹</button><b>' + esc(state.month) +
      '</b><button data-month="1" aria-label="次の月">›</button></div>' +
      (!r ? '<p class="empty">…</p>' :
        '<div class="figs">' +
          '<div class="main"><span>京都ラボへのお支払い（サービス料の合計）</span><b>' + yen(r.fee) + "</b></div>" +
          "<div><span>注文</span><b>" + r.orders + " 件</b></div>" +
          "<div><span>うち多言語メニュー</span><b>" + r.translated + " 件</b></div>" +
          '<div class="main"><span>料理の売上（小計の合計）</span><b>' + yen(r.subtotal) + "</b></div>" +
        "</div>" +
        '<p class="lead">取り消した注文は含みません。月末に、お店の記録と照らし合わせて請求書をお送りします。</p>' +
        '<button class="primary" data-csv="1">この月の注文をCSVで保存</button>');
  }

  function render() {
    var app = document.getElementById("app");
    if (!state.key) { app.innerHTML = keyForm(); bindKeyForm(); return; }
    var name = state.menu ? state.menu.name.ja : "";
    var tabs = [["soldout", "品切れ"], ["orders", "今日の注文"], ["month", "月の合計"]].map(function (t) {
      return '<button role="tab" data-tab="' + t[0] + '" aria-selected="' + (state.tab === t[0]) + '">' + t[1] + "</button>";
    }).join("");
    var body = state.tab === "orders" ? ordersTab() : state.tab === "month" ? monthTab() : soldoutTab();
    app.innerHTML = '<header class="bar"><p class="label">店舗用</p><h1>' + esc(name) + '</h1><div class="tabs" role="tablist">' + tabs + "</div></header>" +
      '<div class="body">' + (state.msg ? '<p class="msg">' + esc(state.msg) + "</p>" : "") + body +
      '<p class="foot"><button class="ghost" data-logout="1">この端末から鍵を消す</button></p></div>';
  }

  function bindKeyForm() {
    var form = document.getElementById("keyform");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var v = document.getElementById("keyinput").value.trim();
      if (!/^[A-Za-z0-9_-]{16,128}$/.test(v)) { state.msg = "鍵の形が違います。"; render(); return; }
      state.key = v;
      try { localStorage.setItem(KEY_STORE, v); } catch (err) {}
      state.msg = "";
      api("/report?month=" + state.month).then(function () { refresh(); }).catch(fail);
    });
  }

  function shiftMonth(delta) {
    var p = state.month.split("-").map(Number);
    var d = new Date(Date.UTC(p[0], p[1] - 1 + delta, 1));
    state.month = d.toISOString().slice(0, 7);
    state.report = null;
  }

  function saveCsv() {
    api("/report?format=csv&month=" + state.month, { raw: true })
      .then(function (r) { return r.blob(); })
      .then(function (blob) {
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = SHOP + "-" + state.month + ".csv";
        document.body.appendChild(a);
        a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      })
      .catch(fail);
  }

  document.getElementById("app").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b || b.form || state.busy) return;
    var ds = b.dataset;
    if (ds.tab) {
      state.tab = ds.tab;
      render();
      refresh();
    } else if (ds.dish) {
      var out = !state.out[ds.dish];
      state.busy = true;
      api("/soldout", { method: "POST", body: { dish: ds.dish, out: out } })
        .then(function (d) {
          state.busy = false;
          state.out = {};
          d.soldout.forEach(function (id) { state.out[id] = true; });
          render();
        })
        .catch(fail);
    } else if (ds.void) {
      state.busy = true;
      api("/orders/" + ds.void, { method: "POST", body: { voided: ds.to === "true" } })
        .then(function () { state.busy = false; return loadOrders(); })
        .then(render)
        .catch(fail);
    } else if (ds.month) {
      shiftMonth(Number(ds.month));
      render();
      loadReport().then(render).catch(fail);
    } else if (ds.csv) {
      saveCsv();
    } else if (ds.logout) {
      if (!confirm("この端末から鍵を消しますか？")) return;
      try { localStorage.removeItem(KEY_STORE); } catch (err) {}
      state.key = "";
      state.msg = "";
      render();
    }
  });

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") refresh();
  });
  setInterval(function () {
    if (document.visibilityState === "visible" && state.key && state.tab === "orders" && !state.busy) refresh();
  }, 30000);

  refresh();
})();
