/* 京都ラボ お品書き: 品切れの状態を持つ小さな受け口（Google Apps Script）
   1店に1つ作る。手順は同じフォルダの README.md。

   GET  → {ok, soldout:[料理のID...], updated}
   POST → 本文はJSON {pin, action:"check"|"set"|"clear", id, soldout}
          PIN が合えば品切れを書き換えて、GET と同じ形で返す */

var PROPS = PropertiesService.getScriptProperties();
var MAX_FAILS = 20;        // PIN を続けて間違えたら10分止める
var ID_RE = /^[a-z0-9_-]{1,40}$/i;

function doGet() {
  return json_(state_(read_()));
}

function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ok: false, error: "bad_request"}); }

  var cache = CacheService.getScriptCache();
  var fails = Number(cache.get("fails") || 0);
  if (fails >= MAX_FAILS) return json_({ok: false, error: "locked"});
  if (!body || !body.pin || String(body.pin) !== String(PROPS.getProperty("PIN"))) {
    cache.put("fails", String(fails + 1), 600);
    return json_({ok: false, error: "pin"});
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    var list = read_();
    if (body.action === "set") {
      if (!ID_RE.test(String(body.id || ""))) return json_({ok: false, error: "bad_id"});
      list = list.filter(function (x) { return x !== body.id; });
      if (body.soldout) list.push(body.id);
      write_(list);
    } else if (body.action === "clear") {
      write_([]);
      list = [];
    } else if (body.action !== "check") {
      return json_({ok: false, error: "bad_action"});
    }
    return json_(state_(list));
  } finally {
    lock.releaseLock();
  }
}

// 毎朝の時刻指定トリガーから呼ぶ（README の手順4）
function resetDaily() {
  write_([]);
}

function read_() {
  try { return JSON.parse(PROPS.getProperty("soldout") || "[]"); } catch (err) { return []; }
}
function write_(list) {
  PROPS.setProperty("soldout", JSON.stringify(list.slice(0, 500)));
  PROPS.setProperty("updated", new Date().toISOString());
}
function state_(list) {
  return {ok: true, soldout: list, updated: PROPS.getProperty("updated") || ""};
}
function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
