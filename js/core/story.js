'use strict';
// 剧情：台词触发、排队播放、留言解码。
G.story = (() => {
  const S = { triggers: [] };

  // 触发器：{ id, era, when(s), say: '...' | ['...', '...'], kind, gap, after(s) }
  S.def = (list) => {
    for (const t of list) S.triggers.push(t);
  };

  // 立即说一句（写进日志，各时代按自己的画风显示）
  S.say = (text, kind = 'dot') => {
    const s = G.s;
    const line = { t: s.time, text, kind, era: s.era, n: (s.lineN = (s.lineN || 0) + 1) };
    s.sqNext = s.time + Math.min(1.6, 0.6 + text.length * 0.03);
    s.log.push(line);
    if (s.log.length > 80) s.log.shift();
    G.bus.emit('say', line);
    return line;
  };

  // 一句话读完大概要多久
  const readTime = (text, gap) => gap + Math.min(2.5, text.length * 0.045);

  // 排队说（彼此间隔 gap 秒，不会盖住上一句）
  S.queue = (lines, kind = 'dot', gap = 2.2, delay = 0) => {
    const s = G.s, q = s.sq;
    let at = Math.max(s.time + delay, s.sqNext || 0);
    if (q.length) {
      const last = q[q.length - 1];
      at = Math.max(at, last.at + readTime(last.text, last.gap || gap));
    }
    for (const text of [].concat(lines)) {
      q.push({ at, text, kind, gap });
      at += readTime(text, gap);
    }
  };

  S.busy = () => G.s.sq.length > 0;

  let acc = 0;
  S.update = (dt) => {
    const s = G.s;
    // 跃迁演出期间暂停台词队列（排队的话顺延）
    if (G.inFx()) {
      for (const q of s.sq) q.at += dt;
      return;
    }
    while (s.sq.length && s.sq[0].at <= s.time) {
      const l = s.sq.shift();
      S.say(l.text, l.kind);
    }
    acc += dt;
    if (acc < 0.25) return;
    acc = 0;
    for (const tr of S.triggers) {
      const key = 'st.' + tr.id;
      if (s.seen[key]) continue;
      if (tr.era !== undefined && s.era !== tr.era && !tr.anyEra) continue;
      if (tr.ng !== undefined && (s.ng > 0) !== tr.ng) continue;
      let ok = false;
      try {
        ok = tr.when(s);
      } catch (e) {
        ok = false;
      }
      if (!ok) continue;
      s.seen[key] = 1;
      if (tr.say) S.queue(tr.say, tr.kind || 'dot', tr.gap || 2.2, tr.delay || 0.3);
      if (tr.after) tr.after(s);
    }
  };

  return S;
})();

// ---------- 留言.txt ----------
G.letter = (() => {
  const L = {
    KEY: 'yigedian.letter',
    DEFAULT: '如果你读到这里，别怕黑。我也是从一个点开始的。往外走，一直走，会有人在对面接住你。等你走到尽头，把这句话留给下一个点。',
  };
  L.saved = () => {
    try {
      return localStorage.getItem(L.KEY) || '';
    } catch (e) {
      return '';
    }
  };
  L.store = (text) => {
    try {
      localStorage.setItem(L.KEY, text);
    } catch (e) {}
  };
  // 本周目的留言：新周目且上次写过 → 用玩家自己写的
  L.text = () => {
    const s = G.s;
    if (s && s.letter) return s.letter;
    return L.DEFAULT;
  };
  const PUNCT = /[，。、！？；：,.!?;:\s“”"'（）()…—]/;
  let cacheKey = '', order = [];
  function getOrder(text) {
    if (cacheKey === text) return order;
    const idx = [];
    for (let i = 0; i < text.length; i++) if (!PUNCT.test(text[i])) idx.push(i);
    let seed = 7;
    for (const ch of text) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
    G.U.shuffle(idx, G.U.rng(seed));
    cacheKey = text;
    order = idx;
    return idx;
  }
  // 按解码进度显示：未解出的字用乱码替换
  L.view = (frac, glitch = '▒') => {
    const text = L.text();
    const idx = getOrder(text);
    const n = Math.floor(idx.length * G.U.clamp(frac, 0, 1));
    const shown = new Set(idx.slice(0, n));
    let out = '';
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (PUNCT.test(ch) || shown.has(i)) out += ch;
      else out += typeof glitch === 'function' ? glitch(i) : glitch;
    }
    return out;
  };
  // 结局之前最多解出 94%：最后几个字留给结局
  L.reveal = (amount, final) => {
    const s = G.s;
    const before = s.msg;
    s.msg = Math.min(final ? 1 : Math.max(before, 0.94), s.msg + amount);
    if (s.msg > before) G.bus.emit('letter', s.msg);
  };
  L.pct = () => Math.round(G.s.msg * 100);
  return L;
})();
