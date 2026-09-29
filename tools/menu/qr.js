/* 京都ラボ お品書き: QRコードをSVGで作る（外部ライブラリなし）
   バイトモード、誤り訂正レベルM、型番1〜10（URLなら約210バイトまで）。
   使い方: KLQR.svg("https://...", {margin:4}) → "<svg ...>" */
(function(root){
  "use strict";

  // 誤り訂正レベルM、型番1〜10
  var ECC_PER_BLOCK = [0,10,16,26,18,24,16,18,22,22,26];
  var NUM_BLOCKS    = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5];

  function rawModules(ver){
    var r = (16*ver + 128)*ver + 64;
    if(ver >= 2){
      var n = Math.floor(ver/7) + 2;
      r -= (25*n - 10)*n - 55;
      if(ver >= 7) r -= 36;
    }
    return r;
  }
  function dataCodewords(ver){
    return Math.floor(rawModules(ver)/8) - ECC_PER_BLOCK[ver]*NUM_BLOCKS[ver];
  }

  function gfMul(x, y){
    var z = 0;
    for(var i = 7; i >= 0; i--){
      z = (z << 1) ^ ((z >>> 7) * 0x11D);
      z ^= ((y >>> i) & 1) * x;
    }
    return z & 0xFF;
  }
  function rsDivisor(deg){
    var r = [];
    for(var i = 0; i < deg - 1; i++) r.push(0);
    r.push(1);
    var root = 1;
    for(i = 0; i < deg; i++){
      for(var j = 0; j < r.length; j++){
        r[j] = gfMul(r[j], root);
        if(j + 1 < r.length) r[j] ^= r[j+1];
      }
      root = gfMul(root, 0x02);
    }
    return r;
  }
  function rsRemainder(data, div){
    var r = div.map(function(){ return 0; });
    data.forEach(function(b){
      var f = b ^ r.shift();
      r.push(0);
      for(var i = 0; i < div.length; i++) r[i] ^= gfMul(div[i], f);
    });
    return r;
  }

  function utf8(s){
    var out = [], e = unescape(encodeURIComponent(s));
    for(var i = 0; i < e.length; i++) out.push(e.charCodeAt(i));
    return out;
  }

  function encode(text){
    var bytes = utf8(text), ver;
    for(ver = 1; ver <= 10; ver++){
      var ccBits = ver < 10 ? 8 : 16;
      if(4 + ccBits + bytes.length*8 <= dataCodewords(ver)*8) break;
    }
    if(ver > 10) throw new Error("QR: text too long");

    // ビット列
    var bits = [];
    function put(v, n){ for(var i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); }
    put(4, 4);
    put(bytes.length, ver < 10 ? 8 : 16);
    bytes.forEach(function(b){ put(b, 8); });
    var cap = dataCodewords(ver)*8;
    put(0, Math.min(4, cap - bits.length));
    put(0, (8 - bits.length % 8) % 8);
    for(var pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) put(pad, 8);
    var data = [];
    for(var i = 0; i < bits.length; i += 8){
      var v = 0;
      for(var j = 0; j < 8; j++) v = (v << 1) | bits[i+j];
      data.push(v);
    }

    // 誤り訂正とインターリーブ
    var nb = NUM_BLOCKS[ver], el = ECC_PER_BLOCK[ver], raw = Math.floor(rawModules(ver)/8);
    var nShort = nb - raw % nb, shortLen = Math.floor(raw/nb), div = rsDivisor(el);
    var blocks = [], k = 0;
    for(i = 0; i < nb; i++){
      var dat = data.slice(k, k + shortLen - el + (i < nShort ? 0 : 1));
      k += dat.length;
      var ecc = rsRemainder(dat, div);
      if(i < nShort) dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    var cw = [];
    for(i = 0; i < blocks[0].length; i++){
      for(j = 0; j < blocks.length; j++){
        if(i !== shortLen - el || j >= nShort) cw.push(blocks[j][i]);
      }
    }

    // モジュール配置
    var size = ver*4 + 17, mod = [], fn = [];
    for(i = 0; i < size; i++){
      mod.push(new Array(size).fill(false));
      fn.push(new Array(size).fill(false));
    }
    function setF(x, y, d){ mod[y][x] = d; fn[y][x] = true; }

    for(i = 0; i < size; i++){ setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }
    [[3,3],[size-4,3],[3,size-4]].forEach(function(c){
      for(var dy = -4; dy <= 4; dy++) for(var dx = -4; dx <= 4; dx++){
        var d = Math.max(Math.abs(dx), Math.abs(dy)), x = c[0]+dx, y = c[1]+dy;
        if(x >= 0 && x < size && y >= 0 && y < size) setF(x, y, d !== 2 && d !== 4);
      }
    });
    var al = [];
    if(ver > 1){
      var na = Math.floor(ver/7) + 2;
      var step = Math.ceil((ver*4 + 4)/(na*2 - 2))*2;
      al = [6];
      for(var p = size - 7; al.length < na; p -= step) al.splice(1, 0, p);
    }
    al.forEach(function(ax, ai){
      al.forEach(function(ay, aj){
        if((ai === 0 && aj === 0) || (ai === 0 && aj === al.length-1) || (ai === al.length-1 && aj === 0)) return;
        for(var dy = -2; dy <= 2; dy++) for(var dx = -2; dx <= 2; dx++)
          setF(ax+dx, ay+dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      });
    });
    function drawFormat(mask){
      var d = (0 << 3) | mask, rem = d; // M = 0
      for(var i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
      var b = ((d << 10) | rem) ^ 0x5412;
      function bit(i){ return ((b >>> i) & 1) !== 0; }
      for(i = 0; i <= 5; i++) setF(8, i, bit(i));
      setF(8, 7, bit(6)); setF(8, 8, bit(7)); setF(7, 8, bit(8));
      for(i = 9; i < 15; i++) setF(14 - i, 8, bit(i));
      for(i = 0; i < 8; i++) setF(size - 1 - i, 8, bit(i));
      for(i = 8; i < 15; i++) setF(8, size - 15 + i, bit(i));
      setF(8, size - 8, true);
    }
    drawFormat(0);
    if(ver >= 7){
      var rem = ver;
      for(i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
      var vb = (ver << 12) | rem;
      for(i = 0; i < 18; i++){
        var bt = ((vb >>> i) & 1) !== 0, a = size - 11 + i % 3, c = Math.floor(i/3);
        setF(a, c, bt); setF(c, a, bt);
      }
    }

    var bi = 0;
    for(var right = size - 1; right >= 1; right -= 2){
      if(right === 6) right = 5;
      for(var vert = 0; vert < size; vert++){
        for(j = 0; j < 2; j++){
          var x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
          if(!fn[y][x] && bi < cw.length*8){
            mod[y][x] = ((cw[bi >>> 3] >>> (7 - (bi & 7))) & 1) !== 0;
            bi++;
          }
        }
      }
    }

    var MASKS = [
      function(x,y){ return (x + y) % 2 === 0; },
      function(x,y){ return y % 2 === 0; },
      function(x,y){ return x % 3 === 0; },
      function(x,y){ return (x + y) % 3 === 0; },
      function(x,y){ return (Math.floor(x/3) + Math.floor(y/2)) % 2 === 0; },
      function(x,y){ return x*y % 2 + x*y % 3 === 0; },
      function(x,y){ return (x*y % 2 + x*y % 3) % 2 === 0; },
      function(x,y){ return ((x + y) % 2 + x*y % 3) % 2 === 0; }
    ];
    function applyMask(m){
      for(var y = 0; y < size; y++) for(var x = 0; x < size; x++)
        if(!fn[y][x] && MASKS[m](x, y)) mod[y][x] = !mod[y][x];
    }
    // 読み取りやすさの減点（規格の4つの規則を簡略に）
    function penalty(){
      var s = 0, x, y, run, dark = 0;
      function lineScore(get){
        var sc = 0;
        for(var a = 0; a < size; a++){
          run = 1;
          for(var b = 1; b <= size; b++){
            if(b < size && get(a,b) === get(a,b-1)) run++;
            else { if(run >= 5) sc += run - 2; run = 1; }
          }
          var line = [];
          for(b = 0; b < size; b++) line.push(get(a,b) ? 1 : 0);
          var str = "0000" + line.join("") + "0000";
          var re = /(?=(00001011101|10111010000))/g, m;
          while((m = re.exec(str)) !== null){ sc += 40; re.lastIndex++; }
        }
        return sc;
      }
      s += lineScore(function(a,b){ return mod[a][b]; });
      s += lineScore(function(a,b){ return mod[b][a]; });
      for(y = 0; y < size - 1; y++) for(x = 0; x < size - 1; x++){
        var c = mod[y][x];
        if(c === mod[y][x+1] && c === mod[y+1][x] && c === mod[y+1][x+1]) s += 3;
      }
      for(y = 0; y < size; y++) for(x = 0; x < size; x++) if(mod[y][x]) dark++;
      var total = size*size;
      s += (Math.ceil(Math.abs(dark*20 - total*10)/total) - 1) * 10;
      return s;
    }
    var best = 0, bestP = Infinity;
    for(var m = 0; m < 8; m++){
      applyMask(m); drawFormat(m);
      var pn = penalty();
      if(pn < bestP){ bestP = pn; best = m; }
      applyMask(m);
    }
    applyMask(best); drawFormat(best);
    return mod;
  }

  function svg(text, opt){
    opt = opt || {};
    var mod = encode(text), n = mod.length, mg = opt.margin == null ? 4 : opt.margin, d = "";
    for(var y = 0; y < n; y++) for(var x = 0; x < n; x++)
      if(mod[y][x]) d += "M" + (x + mg) + "," + (y + mg) + "h1v1h-1z";
    var w = n + mg*2;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + w + '" shape-rendering="crispEdges"' +
      (opt.label ? ' role="img" aria-label="' + String(opt.label).replace(/"/g, "&quot;") + '"' : '') + '>' +
      '<rect width="' + w + '" height="' + w + '" fill="#fff"/><path fill="#000" d="' + d + '"/></svg>';
  }

  root.KLQR = {encode: encode, svg: svg};
  if(typeof module !== "undefined") module.exports = root.KLQR;
})(typeof window !== "undefined" ? window : this);
