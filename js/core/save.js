'use strict';
// 存档：localStorage 自动存档、版本迁移、离线收益、导入导出。
G.save = (() => {
  const SV = { KEY: 'yigedian.save', V: 1, timer: 0 };

  SV.fresh = () => {
    const s = {
      v: SV.V,
      era: 0,
      time: 0, // 游戏内累计秒数
      created: Date.now(),
      savedAt: Date.now(),
      res: {},
      tot: {},
      own: {},
      seen: {},
      flags: {},
      log: [],
      sq: [],
      e: {},
      msg: 0, // 留言解码进度 0..1
      autoRate: {},
      stats: {
        keys: 0, clicks: 0, signals: 0, hits: 0, maxCombo: 0, misses: 0,
        foods: 0, maxLen: 1, bricks: 0, walls: 0, deaths: 0, fills: 0,
        dist: 0, jumps: 0, falls: 0, photons: 0, stars: 0, constell: 0,
        eraTime: [0, 0, 0, 0, 0, 0],
      },
      set: { master: 0.8, music: 0.7, sfx: 0.8, lessFlash: false },
      ng: 0,
      letter: '',
      ending: null,
    };
    for (const r of G.econ.RES) {
      s.res[r] = 0;
      s.tot[r] = 0;
      s.autoRate[r] = 0;
    }
    for (const e of G.eras) if (e && e.fresh) s.e[e.id] = e.fresh();
    return s;
  };

  // 补齐旧存档缺的字段
  function migrate(s) {
    const f = SV.fresh();
    for (const k in f) if (s[k] === undefined) s[k] = f[k];
    for (const k in f.stats) if (s.stats[k] === undefined) s.stats[k] = f.stats[k];
    for (const k in f.set) if (s.set[k] === undefined) s.set[k] = f.set[k];
    for (const r of G.econ.RES) {
      if (s.res[r] === undefined) s.res[r] = 0;
      if (s.tot[r] === undefined) s.tot[r] = 0;
      if (s.autoRate[r] === undefined) s.autoRate[r] = 0;
    }
    for (const e of G.eras) {
      if (!e || !e.fresh) continue;
      const fe = e.fresh();
      if (!s.e[e.id]) s.e[e.id] = fe;
      else for (const k in fe) if (s.e[e.id][k] === undefined) s.e[e.id][k] = fe[k];
    }
    s.v = SV.V;
    return s;
  }

  SV.load = () => {
    try {
      const raw = localStorage.getItem(SV.KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || typeof s !== 'object' || s.v === undefined) return null;
      return migrate(s);
    } catch (e) {
      console.warn('读档失败', e);
      return null;
    }
  };

  SV.write = () => {
    if (!G.s || SV.blocked) return;
    G.s.savedAt = Date.now();
    try {
      localStorage.setItem(SV.KEY, JSON.stringify(G.s));
    } catch (e) {
      console.warn('存档失败', e);
    }
  };

  SV.update = (dt) => {
    SV.timer += dt;
    if (SV.timer > 10) {
      SV.timer = 0;
      SV.write();
    }
  };
  SV.soon = () => {
    SV.timer = Math.max(SV.timer, 9);
  };

  SV.reset = () => {
    SV.blocked = true;
    try {
      localStorage.removeItem(SV.KEY);
    } catch (e) {}
    location.reload();
  };

  // 新周目：保留设置、周目数、玩家写的留言
  SV.newGame = (letter) => {
    const old = G.s;
    const s = SV.fresh();
    s.set = old.set;
    s.ng = (old.ng || 0) + 1;
    s.letter = letter || '';
    G.s = s;
    SV.write();
  };

  SV.exportStr = () => {
    SV.write();
    return btoa(unescape(encodeURIComponent(JSON.stringify(G.s))));
  };
  SV.importStr = (str) => {
    try {
      const s = JSON.parse(decodeURIComponent(escape(atob(str.trim()))));
      if (!s || s.v === undefined) throw new Error('bad');
      SV.blocked = true;
      localStorage.setItem(SV.KEY, JSON.stringify(s));
      location.reload();
      return true;
    } catch (e) {
      return false;
    }
  };

  window.addEventListener('beforeunload', () => SV.write());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) SV.write();
  });

  return SV;
})();
