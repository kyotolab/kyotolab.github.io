/* 京都ラボ お品書き: お客さん画面と編集画面で共通の辞書と読み込み */
(function(root){
  "use strict";

  var LANGS = [
    {k:"ja", n:"日本語"}, {k:"en", n:"English"}, {k:"zh", n:"中文"}, {k:"ko", n:"한국어"}
  ];

  // 食品表示基準の特定原材料8品目（表示義務）と、表示を推奨する20品目
  var ALLERGENS = [
    {k:"shrimp",    req:true, ja:"えび",       en:"Shrimp / prawn",    zh:"蝦",       ko:"새우"},
    {k:"crab",      req:true, ja:"かに",       en:"Crab",              zh:"蟹",       ko:"게"},
    {k:"walnut",    req:true, ja:"くるみ",     en:"Walnut",            zh:"核桃",     ko:"호두"},
    {k:"wheat",     req:true, ja:"小麦",       en:"Wheat",             zh:"小麥",     ko:"밀"},
    {k:"buckwheat", req:true, ja:"そば",       en:"Buckwheat (soba)",  zh:"蕎麥",     ko:"메밀"},
    {k:"egg",       req:true, ja:"卵",         en:"Egg",               zh:"雞蛋",     ko:"계란"},
    {k:"milk",      req:true, ja:"乳",         en:"Milk / dairy",      zh:"乳製品",   ko:"우유"},
    {k:"peanut",    req:true, ja:"落花生",     en:"Peanut",            zh:"花生",     ko:"땅콩"},
    {k:"almond",    ja:"アーモンド",   en:"Almond",       zh:"杏仁",     ko:"아몬드"},
    {k:"abalone",   ja:"あわび",       en:"Abalone",      zh:"鮑魚",     ko:"전복"},
    {k:"squid",     ja:"いか",         en:"Squid",        zh:"魷魚",     ko:"오징어"},
    {k:"ikura",     ja:"いくら",       en:"Salmon roe",   zh:"鮭魚卵",   ko:"연어알"},
    {k:"orange",    ja:"オレンジ",     en:"Orange",       zh:"柳橙",     ko:"오렌지"},
    {k:"cashew",    ja:"カシューナッツ", en:"Cashew",     zh:"腰果",     ko:"캐슈너트"},
    {k:"kiwi",      ja:"キウイフルーツ", en:"Kiwi fruit", zh:"奇異果",   ko:"키위"},
    {k:"beef",      ja:"牛肉",         en:"Beef",         zh:"牛肉",     ko:"소고기"},
    {k:"sesame",    ja:"ごま",         en:"Sesame",       zh:"芝麻",     ko:"참깨"},
    {k:"salmon",    ja:"さけ",         en:"Salmon",       zh:"鮭魚",     ko:"연어"},
    {k:"mackerel",  ja:"さば",         en:"Mackerel",     zh:"鯖魚",     ko:"고등어"},
    {k:"soy",       ja:"大豆",         en:"Soy",          zh:"大豆",     ko:"대두"},
    {k:"chicken",   ja:"鶏肉",         en:"Chicken",      zh:"雞肉",     ko:"닭고기"},
    {k:"banana",    ja:"バナナ",       en:"Banana",       zh:"香蕉",     ko:"바나나"},
    {k:"pork",      ja:"豚肉",         en:"Pork",         zh:"豬肉",     ko:"돼지고기"},
    {k:"macadamia", ja:"マカダミアナッツ", en:"Macadamia", zh:"夏威夷豆", ko:"마카다미아"},
    {k:"peach",     ja:"もも",         en:"Peach",        zh:"桃子",     ko:"복숭아"},
    {k:"yam",       ja:"やまいも",     en:"Yam (yamaimo)", zh:"山藥",    ko:"마"},
    {k:"apple",     ja:"りんご",       en:"Apple",        zh:"蘋果",     ko:"사과"},
    {k:"gelatin",   ja:"ゼラチン",     en:"Gelatin",      zh:"明膠",     ko:"젤라틴"}
  ];

  // アレルゲンではないが、食べられるかどうかに効くもの
  var CONTAINS = [
    {k:"dashi",   ja:"魚のだし（かつお等）", en:"Fish broth (bonito etc.)", zh:"魚高湯（柴魚等）", ko:"생선 육수(가쓰오 등)"},
    {k:"alcohol", ja:"みりん・酒",           en:"Mirin / sake / alcohol",  zh:"味醂・酒",         ko:"미림·술"}
  ];

  var ICONS = {
    donburi: '<svg viewBox="0 0 60 52" aria-hidden="true"><path d="M8 22 h44 a2 2 0 0 1 2 2 c0 12-10 21-24 21 S6 36 6 24 a2 2 0 0 1 2-2 z"/><path d="M14 22 c4-5 12-7 16-7 s12 2 16 7"/><path d="M24 11 c-3-3 1-5-1-8"/><path d="M34 12 c-3-3 1-6-1-9"/><path d="M12 34 h36"/></svg>',
    tamago:  '<svg viewBox="0 0 60 52" aria-hidden="true"><rect x="8" y="18" width="15" height="20" rx="3"/><rect x="24" y="18" width="15" height="20" rx="3"/><rect x="40" y="18" width="12" height="20" rx="3"/><path d="M12 24 c3 2 3 8 0 10"/><path d="M28 24 c3 2 3 8 0 10"/><path d="M6 42 h48"/></svg>',
    sushi:   '<svg viewBox="0 0 60 52" aria-hidden="true"><rect x="9" y="20" width="42" height="9" rx="2"/><rect x="9" y="29" width="42" height="10" rx="2"/><path d="M23 20 v19"/><path d="M37 20 v19"/><path d="M14 24 c4-3 9-3 13 0"/><path d="M6 44 h48"/></svg>',
    soup:    '<svg viewBox="0 0 60 52" aria-hidden="true"><path d="M14 24 h32 a2 2 0 0 1 2 2 c0 9-8 16-18 16 s-18-7-18-16 a2 2 0 0 1 2-2 z"/><path d="M22 24 c2-3 6-4 8-4 s6 1 8 4"/><path d="M27 15 c-2-2 1-4-1-6"/><path d="M34 16 c-2-2 1-4-1-6"/></svg>',
    tempura: '<svg viewBox="0 0 60 52" aria-hidden="true"><ellipse cx="30" cy="36" rx="24" ry="7"/><path d="M6 36 c0 5 11 8 24 8 s24-3 24-8"/><path d="M16 32 c-3-6 1-11 5-11 s7 4 5 10"/><path d="M30 30 c-4-7 0-13 4-13 s7 5 4 12"/><path d="M42 33 c-3-5 0-9 3-9 s5 4 3 8"/></svg>',
    pickles: '<svg viewBox="0 0 60 52" aria-hidden="true"><ellipse cx="30" cy="35" rx="25" ry="8"/><path d="M12 28 l7-8 7 8 z"/><path d="M26 30 l6-11 6 11 z"/><path d="M38 30 l5-7 5 7 z"/></svg>',
    sweet:   '<svg viewBox="0 0 60 52" aria-hidden="true"><path d="M13 22 h34 a2 2 0 0 1 2 2 c0 10-8 17-19 17 s-19-7-19-17 a2 2 0 0 1 2-2 z"/><rect x="20" y="24" width="9" height="8" rx="1.5"/><rect x="31" y="26" width="9" height="8" rx="1.5"/><path d="M24 18 c1-3 5-3 6 0"/><path d="M33 19 c1-3 5-3 6 0"/></svg>',
    noodle:  '<svg viewBox="0 0 60 52" aria-hidden="true"><path d="M8 24 h44 a2 2 0 0 1 2 2 c0 11-10 19-24 19 S6 37 6 26 a2 2 0 0 1 2-2 z"/><path d="M16 24 c2-6 5-6 6 0"/><path d="M24 24 c2-6 5-6 6 0"/><path d="M32 24 c2-6 5-6 6 0"/><path d="M40 6 l-8 18"/><path d="M46 8 l-10 16"/></svg>',
    grill:   '<svg viewBox="0 0 60 52" aria-hidden="true"><path d="M6 40 h48"/><path d="M10 36 h40 l-4 4 h-32 z"/><ellipse cx="30" cy="28" rx="16" ry="6"/><path d="M20 26 l4 4"/><path d="M28 24 l4 4"/><path d="M36 24 l4 4"/></svg>',
    cup:     '<svg viewBox="0 0 60 52" aria-hidden="true"><path d="M16 18 h28 l-3 24 h-22 z"/><path d="M44 22 c6 0 8 3 8 7 s-3 7-9 7"/><path d="M24 12 c-2-2 1-4-1-6"/><path d="M32 12 c-2-2 1-4-1-6"/><path d="M12 46 h36"/></svg>'
  };

  // 訳がないときは英語、それもなければ日本語で出す
  function pick(obj, lang){
    if(!obj) return "";
    if(typeof obj === "string") return obj;
    return obj[lang] || obj.en || obj.ja || "";
  }

  function esc(s){
    return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }

  function yen(n){ return "¥" + Number(n || 0).toLocaleString("en-US"); }

  // 形式を整える（古い形や書きかけのデータでも落ちないように）
  function normalize(m){
    m = m || {};
    m.shop = m.shop || {};
    m.shop.name = m.shop.name || {ja:""};
    m.shop.notice = m.shop.notice || {};
    if(m.shop.taxIncluded == null) m.shop.taxIncluded = true;
    m.shop.pay = m.shop.pay || [];
    m.categories = (m.categories || []).filter(function(c){ return c && c.id; });
    m.dishes = (m.dishes || []).filter(function(d){ return d && d.id; }).map(function(d){
      d.name = d.name || {ja:""};
      d.desc = d.desc || {};
      d.allergens = d.allergens || [];
      d.contains = d.contains || [];
      d.veg = d.veg || "";
      d.price = Number(d.price) || 0;
      return d;
    });
    return m;
  }

  var DRAFT_KEY = "kyotolab-menu-draft";

  // ?shop=<id> なら shops/<id>.json、?preview=1 なら編集画面の下書きを読む
  function load(base){
    var q = new URLSearchParams(location.search);
    if(q.get("preview")){
      try{
        var raw = localStorage.getItem(DRAFT_KEY);
        if(raw) return Promise.resolve({menu: normalize(JSON.parse(raw)), preview: true});
      }catch(e){}
    }
    var id = (q.get("shop") || "demo").replace(/[^a-z0-9-]/gi, "");
    return fetch(base + "shops/" + id + ".json", {cache: "no-cache"})
      .then(function(r){ if(!r.ok) throw new Error(r.status); return r.json(); })
      .then(function(j){ return {menu: normalize(j), preview: false, id: id}; });
  }

  /* ---- 品切れの受け口 ----
     menu.live が Apps Script のURLなら、そこに品切れを問い合わせる（live/soldout.gs）。
     "demo" なら、同じブラウザの中だけで切り替わる見本として動く。 */
  var DEMO_KEY = "kyotolab-menu-live-demo";

  function demoState(list){
    if(list){ try{ localStorage.setItem(DEMO_KEY, JSON.stringify({soldout:list, updated:new Date().toISOString()})); }catch(e){} }
    var s = null;
    try{ s = JSON.parse(localStorage.getItem(DEMO_KEY)); }catch(e){}
    return s || {soldout:null, updated:""};
  }

  function liveUrl(menu){
    var u = menu && menu.live;
    // 手元で試すときだけ localhost も通す
    return (u === "demo" || /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(u || "") ||
      /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(u || "")) ? u : "";
  }

  function liveGet(menu){
    var u = liveUrl(menu);
    if(!u) return Promise.reject(new Error("no live"));
    if(u === "demo") return Promise.resolve(demoState());
    return fetch(u + "?t=" + Date.now(), {cache:"no-store"}).then(function(r){ return r.json(); })
      .then(function(j){ if(!j || !j.ok) throw new Error("live"); return j; });
  }

  // action: "check" | "set" | "clear"
  function livePost(menu, body){
    var u = liveUrl(menu);
    if(!u) return Promise.reject(new Error("no live"));
    if(u === "demo"){
      if(String(body.pin) !== "0000") return Promise.resolve({ok:false, error:"pin"});
      var cur = demoState().soldout;
      if(!cur) cur = menu.dishes.filter(function(d){ return d.soldout; }).map(function(d){ return d.id; });
      if(body.action === "set"){
        cur = cur.filter(function(x){ return x !== body.id; });
        if(body.soldout) cur.push(body.id);
      }
      if(body.action === "clear") cur = [];
      var s = demoState(cur);
      return Promise.resolve({ok:true, soldout:s.soldout, updated:s.updated});
    }
    // text/plain にして、ブラウザの事前確認（CORS のプリフライト）を起こさない
    return fetch(u, {method:"POST", headers:{"Content-Type":"text/plain;charset=utf-8"}, body:JSON.stringify(body)})
      .then(function(r){ return r.json(); });
  }

  // 問い合わせた品切れを、お品書きのデータに重ねる
  function applySoldout(menu, list){
    if(!list) return;
    menu.dishes.forEach(function(d){
      if(list.indexOf(d.id) > -1) d.soldout = true; else delete d.soldout;
    });
  }

  root.KLMenu = {
    LANGS: LANGS, ALLERGENS: ALLERGENS, CONTAINS: CONTAINS, ICONS: ICONS,
    pick: pick, esc: esc, yen: yen, normalize: normalize, load: load, DRAFT_KEY: DRAFT_KEY,
    liveUrl: liveUrl, liveGet: liveGet, livePost: livePost, applySoldout: applySoldout, DEMO_KEY: DEMO_KEY
  };
})(window);
