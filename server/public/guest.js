(function () {
  "use strict";

  var SHOP = location.pathname.split("/")[2];
  var API = "/api/shops/" + SHOP;
  var POLL_MS = 20000;
  var LANGS = [{ k: "ja", n: "日本語" }, { k: "en", n: "English" }, { k: "zh", n: "中文" }, { k: "ko", n: "한국어" }];

  var T = {
    ja: {
      filter: "絞り込み", veg: "ベジタリアン", nopork: "豚肉なし", noalc: "アルコールなし", soldout: "品切れ",
      ing: "アレルギー・食材", diet: "食べられるかどうか",
      vegOk: "ベジタリアン対応", vegNo: "ベジタリアン不可", porkOk: "豚肉不使用", porkNo: "豚肉を含む",
      alcOk: "アルコール不使用", alcNo: "みりん・酒を含む",
      addN: "注文に入れる", inCart: "注文に入っています", review: "注文を確認", itemsN: "品",
      order: "ご注文", lead: "この画面を店員に見せてください。", sub: "小計", fee: "サービス料（10%）", total: "合計",
      note: "金額は税込です。", staffHint: "", done: "ご注文を受け付けました", doneNote: "お会計は店でお願いします。",
      back: "メニューに戻る", close: "閉じる",
      soldOutErr: "品切れになった料理があったので、注文から外しました。", busyErr: "混み合っています。少し待ってから、もう一度お試しください。",
      netErr: "送信できませんでした。通信を確かめて、もう一度お試しください。", loadErr: "メニューを読み込めませんでした。",
      emptyT: "条件に合う料理がありません", emptyB: "だしに鰹を使う料理が多いためです。絞り込みを外してください。"
    },
    en: {
      filter: "Filter", veg: "Vegetarian", nopork: "No pork", noalc: "No alcohol", soldout: "Sold out",
      ing: "Allergens & ingredients", diet: "Can you eat this?",
      vegOk: "Vegetarian friendly", vegNo: "Not vegetarian", porkOk: "No pork", porkNo: "Contains pork",
      alcOk: "No alcohol", alcNo: "Contains mirin / sake",
      addN: "Add to order", inCart: "In your order", review: "Review order", itemsN: "items",
      order: "Your order", lead: "Please show this screen to the staff.", sub: "Subtotal", fee: "Service charge (10%)", total: "Total",
      feeBar: "Ordering from this translated menu adds a 10% service charge.",
      note: "All amounts include tax. The service charge is paid together with your bill at the shop.",
      staffHint: "The staff will tap this button.", done: "Order received", doneNote: "Please pay at the shop, including the service charge.",
      back: "Back to the menu", close: "Close",
      soldOutErr: "Some dishes just sold out and were removed from your order.", busyErr: "The shop is busy. Please try again in a moment.",
      netErr: "Could not send. Please check your connection and try again.", loadErr: "Could not load the menu.",
      emptyT: "No dishes match", emptyB: "Many dishes use bonito dashi. Try removing a filter."
    },
    zh: {
      filter: "篩選", veg: "素食", nopork: "不含豬肉", noalc: "不含酒精", soldout: "售完",
      ing: "過敏原與食材", diet: "是否可以食用",
      vegOk: "適合素食", vegNo: "不適合素食", porkOk: "不含豬肉", porkNo: "含豬肉",
      alcOk: "不含酒精", alcNo: "含味醂・清酒",
      addN: "加入點餐", inCart: "已加入點餐", review: "確認點餐", itemsN: "項",
      order: "您的點餐", lead: "請將此畫面出示給店員。", sub: "小計", fee: "服務費（10%）", total: "合計",
      feeBar: "使用本翻譯菜單點餐，將另收10%服務費。",
      note: "金額均含稅。服務費請於店內與餐費一併結帳。",
      staffHint: "此按鈕由店員點選。", done: "已收到您的點餐", doneNote: "請於店內結帳（含服務費）。",
      back: "返回菜單", close: "關閉",
      soldOutErr: "部分餐點剛剛售完，已從點餐中移除。", busyErr: "目前較為忙碌，請稍後再試。",
      netErr: "無法送出。請確認網路連線後再試一次。", loadErr: "無法載入菜單。",
      emptyT: "沒有符合條件的餐點", emptyB: "多數餐點使用柴魚高湯。請試著取消篩選條件。"
    },
    ko: {
      filter: "필터", veg: "채식", nopork: "돼지고기 없음", noalc: "알코올 없음", soldout: "품절",
      ing: "알레르기·식재료", diet: "드실 수 있는지",
      vegOk: "채식 가능", vegNo: "채식 불가", porkOk: "돼지고기 미사용", porkNo: "돼지고기 포함",
      alcOk: "알코올 미사용", alcNo: "미림·청주 포함",
      addN: "주문에 담기", inCart: "주문에 담김", review: "주문 확인", itemsN: "개",
      order: "주문 내역", lead: "이 화면을 직원에게 보여주세요.", sub: "소계", fee: "서비스 요금(10%)", total: "합계",
      feeBar: "이 번역 메뉴로 주문하시면 10%의 서비스 요금이 추가됩니다.",
      note: "모든 금액은 세금 포함입니다. 서비스 요금은 매장에서 식대와 함께 계산됩니다.",
      staffHint: "이 버튼은 직원이 누릅니다.", done: "주문이 접수되었습니다", doneNote: "서비스 요금을 포함해 매장에서 계산해 주세요.",
      back: "메뉴로 돌아가기", close: "닫기",
      soldOutErr: "방금 품절된 메뉴가 있어 주문에서 뺐습니다.", busyErr: "매장이 혼잡합니다. 잠시 후 다시 시도해 주세요.",
      netErr: "보내지 못했습니다. 연결을 확인하고 다시 시도해 주세요.", loadErr: "메뉴를 불러오지 못했습니다.",
      emptyT: "조건에 맞는 메뉴가 없습니다", emptyB: "가쓰오 다시를 쓰는 메뉴가 많습니다. 필터를 해제해 보세요."
    }
  };

  var A = {
    soy: { ja: "大豆", en: "Soy", zh: "大豆", ko: "대두" },
    wheat: { ja: "小麦", en: "Wheat", zh: "小麥", ko: "밀" },
    egg: { ja: "卵", en: "Egg", zh: "雞蛋", ko: "계란" },
    milk: { ja: "乳", en: "Milk", zh: "乳製品", ko: "우유" },
    dashi: { ja: "かつおだし", en: "Bonito dashi", zh: "柴魚高湯", ko: "가쓰오 다시" },
    fish: { ja: "魚", en: "Fish", zh: "魚", ko: "생선" },
    shrimp: { ja: "えび", en: "Shrimp", zh: "蝦", ko: "새우" },
    crab: { ja: "かに", en: "Crab", zh: "蟹", ko: "게" },
    chicken: { ja: "鶏肉", en: "Chicken", zh: "雞肉", ko: "닭고기" },
    pork: { ja: "豚肉", en: "Pork", zh: "豬肉", ko: "돼지고기" },
    beef: { ja: "牛肉", en: "Beef", zh: "牛肉", ko: "소고기" },
    sesame: { ja: "ごま", en: "Sesame", zh: "芝麻", ko: "참깨" },
    alcohol: { ja: "みりん・酒", en: "Mirin / sake", zh: "味醂・清酒", ko: "미림·청주" },
    kelp: { ja: "昆布", en: "Kelp", zh: "昆布", ko: "다시마" }
  };

  var ICONS = {
    donburi: '<svg viewBox="0 0 60 52"><path d="M8 22 h44 a2 2 0 0 1 2 2 c0 12-10 21-24 21 S6 36 6 24 a2 2 0 0 1 2-2 z"/><path d="M14 22 c4-5 12-7 16-7 s12 2 16 7"/><path d="M24 11 c-3-3 1-5-1-8"/><path d="M34 12 c-3-3 1-6-1-9"/><path d="M12 34 h36"/></svg>',
    tamago: '<svg viewBox="0 0 60 52"><rect x="8" y="18" width="15" height="20" rx="3"/><rect x="24" y="18" width="15" height="20" rx="3"/><rect x="40" y="18" width="12" height="20" rx="3"/><path d="M12 24 c3 2 3 8 0 10"/><path d="M28 24 c3 2 3 8 0 10"/><path d="M6 42 h48"/></svg>',
    sushi: '<svg viewBox="0 0 60 52"><rect x="9" y="20" width="42" height="9" rx="2"/><rect x="9" y="29" width="42" height="10" rx="2"/><path d="M23 20 v19"/><path d="M37 20 v19"/><path d="M14 24 c4-3 9-3 13 0"/><path d="M6 44 h48"/></svg>',
    soup: '<svg viewBox="0 0 60 52"><path d="M14 24 h32 a2 2 0 0 1 2 2 c0 9-8 16-18 16 s-18-7-18-16 a2 2 0 0 1 2-2 z"/><path d="M22 24 c2-3 6-4 8-4 s6 1 8 4"/><path d="M27 15 c-2-2 1-4-1-6"/><path d="M34 16 c-2-2 1-4-1-6"/></svg>',
    tempura: '<svg viewBox="0 0 60 52"><ellipse cx="30" cy="36" rx="24" ry="7"/><path d="M6 36 c0 5 11 8 24 8 s24-3 24-8"/><path d="M16 32 c-3-6 1-11 5-11 s7 4 5 10"/><path d="M30 30 c-4-7 0-13 4-13 s7 5 4 12"/><path d="M42 33 c-3-5 0-9 3-9 s5 4 3 8"/></svg>',
    pickles: '<svg viewBox="0 0 60 52"><ellipse cx="30" cy="35" rx="25" ry="8"/><path d="M12 28 l7-8 7 8 z"/><path d="M26 30 l6-11 6 11 z"/><path d="M38 30 l5-7 5 7 z"/></svg>',
    sweet: '<svg viewBox="0 0 60 52"><path d="M13 22 h34 a2 2 0 0 1 2 2 c0 10-8 17-19 17 s-19-7-19-17 a2 2 0 0 1 2-2 z"/><rect x="20" y="24" width="9" height="8" rx="1.5"/><rect x="31" y="26" width="9" height="8" rx="1.5"/><path d="M24 18 c1-3 5-3 6 0"/><path d="M33 19 c1-3 5-3 6 0"/></svg>'
  };

  var state = {
    menu: null, out: {}, lang: pickLang(), filters: { veg: false, pork: false, alc: false },
    cart: loadCart(), sheet: null, qty: 1, sending: false, notice: "", error: ""
  };

  function pickLang() {
    try {
      var saved = localStorage.getItem("kyotolab-lang");
      if (saved && T[saved]) return saved;
    } catch (e) {}
    var prefs = navigator.languages || [navigator.language || "en"];
    for (var i = 0; i < prefs.length; i++) {
      var p = String(prefs[i]).toLowerCase();
      if (p.indexOf("ja") === 0) return "ja";
      if (p.indexOf("zh") === 0) return "zh";
      if (p.indexOf("ko") === 0) return "ko";
      if (p.indexOf("en") === 0) return "en";
    }
    return "en";
  }

  function loadCart() {
    try { return JSON.parse(sessionStorage.getItem("kyotolab-cart-" + SHOP)) || {}; } catch (e) { return {}; }
  }
  function saveCart() {
    try { sessionStorage.setItem("kyotolab-cart-" + SHOP, JSON.stringify(state.cart)); } catch (e) {}
  }

  function t(k) { return T[state.lang][k] || ""; }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function yen(n) { return "¥" + n.toLocaleString("en-US"); }
  function dish(id) {
    var ds = state.menu ? state.menu.dishes : [];
    for (var i = 0; i < ds.length; i++) if (ds[i].id === id) return ds[i];
    return null;
  }
  function translated() { return state.lang !== "ja"; }

  function totals() {
    var sub = 0, n = 0;
    Object.keys(state.cart).forEach(function (id) {
      var d = dish(id);
      if (d) { sub += d.price * state.cart[id]; n += state.cart[id]; }
    });
    var fee = translated() ? Math.floor((sub * state.menu.feeRate) / 100) : 0;
    return { sub: sub, fee: fee, total: sub + fee, n: n };
  }

  function passes(d) {
    if (state.filters.veg && !d.veg) return false;
    if (state.filters.pork && d.pork) return false;
    if (state.filters.alc && d.alc) return false;
    return true;
  }

  function load() {
    return fetch(API + "/menu", { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (menu) {
        var first = !state.menu;
        var before = Object.keys(state.out).sort().join(",");
        state.menu = menu;
        state.out = {};
        menu.soldout.forEach(function (id) { state.out[id] = true; });
        var dropped = false;
        Object.keys(state.cart).forEach(function (id) {
          if (!dish(id) || state.out[id]) { delete state.cart[id]; dropped = true; }
        });
        if (dropped) { saveCart(); state.notice = t("soldOutErr"); }
        state.error = "";
        if (first || dropped || before !== menu.soldout.slice().sort().join(",")) render();
      })
      .catch(function () {
        if (!state.menu) { state.error = t("loadErr"); render(); }
      });
  }

  function header() {
    var langs = LANGS.map(function (l) {
      return '<button class="chip" data-lang="' + l.k + '" aria-pressed="' + (state.lang === l.k) + '">' + l.n + "</button>";
    }).join("");
    var fils = [["veg", "veg"], ["pork", "nopork"], ["alc", "noalc"]].map(function (p) {
      return '<button class="chip f" data-filter="' + p[0] + '" aria-pressed="' + state.filters[p[0]] + '">' + esc(t(p[1])) + "</button>";
    }).join("");
    return '<header class="bar"><h1>' + esc(state.menu.name[state.lang]) + "</h1>" +
      '<div class="row">' + langs + "</div>" +
      '<div class="row"><span class="flabel">' + esc(t("filter")) + "</span>" + fils + "</div>" +
      (translated() ? '<p class="feebar">' + esc(t("feeBar")) + "</p>" : "") +
      "</header>";
  }

  function flags(d) {
    var f = "";
    if (d.veg) f += '<span class="flag ok">' + esc(t("veg")) + "</span>";
    if (d.al.indexOf("dashi") > -1) f += '<span class="flag warn">' + esc(A.dashi[state.lang]) + "</span>";
    if (d.alc) f += '<span class="flag">' + esc(A.alcohol[state.lang]) + "</span>";
    if (state.out[d.id]) f += '<span class="flag out">' + esc(t("soldout")) + "</span>";
    return f;
  }

  function list() {
    var html = "", any = false;
    state.menu.categories.forEach(function (c) {
      var items = state.menu.dishes.filter(function (d) { return d.cat === c.id && passes(d); });
      if (!items.length) return;
      any = true;
      html += '<h2 class="cat">' + esc(c.name[state.lang]) + "</h2>";
      items.forEach(function (d) {
        var out = !!state.out[d.id], n = state.cart[d.id] || 0;
        html += '<div class="dish' + (out ? " is-out" : "") + '">' +
          '<button class="open" data-open="' + d.id + '">' +
            '<span class="art">' + (ICONS[d.icon] || "") + "</span>" +
            "<span>" + '<span class="nm">' + esc(d.name[state.lang]) + "</span>" +
              (translated() ? '<span class="ja">' + esc(d.name.ja) + "</span>" : "") +
              '<span class="desc">' + esc(d.desc[state.lang]) + "</span>" +
              '<span class="flags">' + flags(d) + "</span></span>" +
            '<span class="price">' + yen(d.price) + "</span>" +
          "</button>" +
          '<div><button class="add" data-add="' + d.id + '" aria-label="' + esc(t("addN")) + '"' + (out ? " disabled" : "") + ">+</button>" +
          (n ? '<span class="incart">×' + n + "</span>" : "") + "</div>" +
        "</div>";
      });
    });
    if (!any) html = '<p class="empty"><b>' + esc(t("emptyT")) + "</b>" + esc(t("emptyB")) + "</p>";
    return html;
  }

  function cartbar() {
    var s = totals();
    if (!s.n || state.sheet) return "";
    return '<div class="cartbar"><button data-review="1"><span>' + esc(t("review")) + " <small>" + s.n + " " + esc(t("itemsN")) +
      "</small></span><span>" + yen(s.total) + "</span></button></div>";
  }

  function dietRow(ok, okKey, noKey) {
    return '<div><span class="' + (ok ? "y" : "n") + '">' + (ok ? "○" : "×") + "</span> " + esc(t(ok ? okKey : noKey)) + "</div>";
  }

  function sheetTop(tag) {
    return '<div class="sheet-top"><span class="tag">' + esc(tag) + '</span><button class="close" data-close="1">✕ ' + esc(t("close")) + "</button></div>";
  }

  function dishSheet(d) {
    var out = !!state.out[d.id];
    var al = d.al.map(function (k) {
      var warn = k === "dashi" || k === "alcohol";
      return '<span class="flag' + (warn ? " warn" : "") + '">' + esc((A[k] || {})[state.lang] || k) + "</span>";
    }).join("");
    return sheetTop(d.name[state.lang]) +
      '<div class="big-art">' + (ICONS[d.icon] || "") + "</div>" +
      "<h2>" + esc(d.name[state.lang]) + "</h2>" +
      (translated() ? '<p class="ja">' + esc(d.name.ja) + "</p>" : "") +
      '<p class="desc">' + esc(d.desc[state.lang]) + "</p>" +
      '<p class="price" style="margin-top:10px;font-size:18px">' + yen(d.price) + "</p>" +
      '<div class="sec"><span class="tag">' + esc(t("ing")) + '</span><div class="flags">' + al + "</div></div>" +
      '<div class="sec"><span class="tag">' + esc(t("diet")) + '</span><div class="diet">' +
        dietRow(d.veg, "vegOk", "vegNo") + dietRow(!d.pork, "porkOk", "porkNo") + dietRow(!d.alc, "alcOk", "alcNo") +
      "</div></div>" +
      (out
        ? '<button class="primary" disabled>' + esc(t("soldout")) + "</button>"
        : '<div class="stepper"><button data-step="-1" aria-label="−">−</button><span class="n">' + state.qty +
          '</span><button data-step="1" aria-label="+">＋</button></div>' +
          '<button class="primary" data-addqty="' + d.id + '">' + esc(t("addN")) + " · " + yen(d.price * state.qty) + "</button>");
  }

  function orderSheet() {
    var s = totals();
    var lines = Object.keys(state.cart).map(function (id) {
      var d = dish(id);
      return '<div class="line"><div><div class="jn">' + esc(d.name.ja) + "</div>" +
        (translated() ? '<div class="gn">' + esc(d.name[state.lang]) + " · " + yen(d.price) + "</div>" : '<div class="gn">' + yen(d.price) + "</div>") +
        '</div><div class="q"><button data-dec="' + id + '" aria-label="−">−</button><b>' + state.cart[id] +
        '</b><button data-inc="' + id + '" aria-label="+">＋</button></div></div>';
    }).join("");
    return sheetTop(t("order")) +
      (state.notice ? '<p class="notice" style="margin:12px 0 0">' + esc(state.notice) + "</p>" : "") +
      '<p class="lead">' + esc(t("lead")) + "</p>" +
      '<p class="plz">すみません、これをください</p>' +
      '<div class="lines">' + lines + "</div>" +
      '<dl class="bill">' +
        "<div><dt>" + esc(t("sub")) + "</dt><dd>" + yen(s.sub) + "</dd></div>" +
        (translated() ? "<div><dt>" + esc(t("fee")) + "</dt><dd>" + yen(s.fee) + "</dd></div>" : "") +
        '<div class="sum"><dt>' + esc(t("total")) + "</dt><dd>" + yen(s.total) + "</dd></div>" +
      "</dl>" +
      '<div class="staff"><p>店員の方へ: ' +
        (translated() ? "多言語メニューからのご注文です。お会計にサービス料10%（" + yen(s.fee) + "）を加えてください。" : "") +
        "注文を受けたら、下のボタンを押してください。</p>" +
        '<button class="primary" data-send="1"' + (state.sending || !s.n ? " disabled" : "") + ">注文を受けました</button>" +
        (t("staffHint") ? '<p class="hint">' + esc(t("staffHint")) + "</p>" : "") +
      "</div>" +
      '<p class="small">' + esc(t("note")) + "</p>";
  }

  function doneSheet(o) {
    return sheetTop(t("order")) +
      '<div class="done"><h2>' + esc(t("done")) + '</h2><p class="no">No. ' + o.id + "</p>" +
      '<dl class="bill">' +
        "<div><dt>" + esc(t("sub")) + "</dt><dd>" + yen(o.subtotal) + "</dd></div>" +
        (o.fee ? "<div><dt>" + esc(t("fee")) + "</dt><dd>" + yen(o.fee) + "</dd></div>" : "") +
        '<div class="sum"><dt>' + esc(t("total")) + "</dt><dd>" + yen(o.total) + "</dd></div>" +
      "</dl>" +
      '<p class="small">' + esc(t("doneNote")) + "</p>" +
      '<button class="primary" data-close="1">' + esc(t("back")) + "</button></div>";
  }

  function render() {
    document.documentElement.lang = state.lang;
    var app = document.getElementById("app");
    if (!state.menu) {
      app.innerHTML = '<p class="empty">' + esc(state.error || "…") + "</p>";
      return;
    }
    var prev = app.querySelector(".sheet");
    var keep = prev && state.sheet && prev.dataset.key === sheetKey() ? prev.scrollTop : 0;
    var sheet = "";
    if (state.sheet) {
      var inner = state.sheet.type === "dish" ? dishSheet(dish(state.sheet.id))
        : state.sheet.type === "order" ? orderSheet() : doneSheet(state.sheet.order);
      sheet = '<div class="sheet" role="dialog" aria-modal="true" data-key="' + esc(sheetKey()) + '"><div class="sheet-in">' + inner + "</div></div>";
    }
    app.innerHTML = header() + (state.notice && !state.sheet ? '<p class="notice">' + esc(state.notice) + "</p>" : "") +
      list() + cartbar() + sheet;
    var next = app.querySelector(".sheet");
    if (next && keep) next.scrollTop = keep;
    document.body.style.overflow = state.sheet ? "hidden" : "";
  }

  function sheetKey() {
    if (!state.sheet) return "";
    return state.sheet.type + ":" + (state.sheet.id || (state.sheet.order && state.sheet.order.id) || "");
  }

  function send() {
    if (state.sending) return;
    var items = Object.keys(state.cart).map(function (id) { return { id: id, qty: state.cart[id] }; });
    if (!items.length) return;
    state.sending = true;
    state.notice = "";
    render();
    fetch(API + "/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lang: state.lang, items: items })
    })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (body) { return { status: r.status, body: body }; });
      })
      .then(function (res) {
        state.sending = false;
        if (res.status === 201) {
          state.cart = {};
          saveCart();
          state.sheet = { type: "done", order: res.body };
        } else if (res.status === 409) {
          (res.body.dishes || []).forEach(function (id) { delete state.cart[id]; state.out[id] = true; });
          saveCart();
          state.notice = t("soldOutErr");
        } else if (res.status === 429) {
          state.notice = t("busyErr");
        } else {
          state.notice = t("netErr");
        }
        render();
      })
      .catch(function () {
        state.sending = false;
        state.notice = t("netErr");
        render();
      });
  }

  document.getElementById("app").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b || b.disabled) return;
    var ds = b.dataset;
    if (ds.lang) {
      state.lang = ds.lang;
      try { localStorage.setItem("kyotolab-lang", ds.lang); } catch (err) {}
    } else if (ds.filter) {
      state.filters[ds.filter] = !state.filters[ds.filter];
    } else if (ds.open) {
      state.qty = 1;
      state.sheet = { type: "dish", id: ds.open };
    } else if (ds.add) {
      state.cart[ds.add] = Math.min(20, (state.cart[ds.add] || 0) + 1);
      saveCart();
    } else if (ds.step) {
      state.qty = Math.min(20, Math.max(1, state.qty + Number(ds.step)));
    } else if (ds.addqty) {
      state.cart[ds.addqty] = Math.min(20, (state.cart[ds.addqty] || 0) + state.qty);
      saveCart();
      state.sheet = null;
    } else if (ds.review) {
      state.notice = "";
      state.sheet = { type: "order" };
    } else if (ds.inc) {
      state.cart[ds.inc] = Math.min(20, state.cart[ds.inc] + 1);
      saveCart();
    } else if (ds.dec) {
      state.cart[ds.dec] -= 1;
      if (state.cart[ds.dec] < 1) delete state.cart[ds.dec];
      saveCart();
      if (!Object.keys(state.cart).length) state.sheet = null;
    } else if (ds.send) {
      send();
      return;
    } else if (ds.close) {
      state.sheet = null;
      state.notice = "";
    } else {
      return;
    }
    render();
  });

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") load();
  });
  setInterval(function () {
    if (document.visibilityState === "visible" && !state.sending) load();
  }, POLL_MS);

  render();
  load();
})();
