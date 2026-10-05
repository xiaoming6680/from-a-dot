'use strict';
// 经济系统：资源、升级定义、价格、购买、倍率重算、速率统计。
// 升级定义（各时代文件里用 G.econ.define 声明）字段：
//   id, name, desc, type: 'gen'|'one'|'level'|'goal'
//   cost: {res: n}（gen 为基础价）| costs: [{...}, ...]（level）| cost(lv) 函数
//   growth: 1.15（gen 价格增长）, max, prod: {res: 每秒}（gen）
//   mod(m, lv): 修改修正值, onBuy(lv): 购买后回调, req(s): 前置, reveal: 0.5
//   tab: 分页, tag: 'visual'|'sound'|'auto'|'back'（显示用）
G.econ = (() => {
  const E = { defs: {}, order: [], hooks: [] };
  E.RES = ['bits', 'vec', 'px', 'dust', 'lux', 'dots'];
  E.NAME = { bits: '比特', vec: '向量', px: '像素', dust: '星屑', lux: '光子', dots: '点' };
  E.ERA_RES = ['bits', 'vec', 'px', 'dust', 'lux', 'dots'];

  E.define = (era, list) => {
    for (const d of list) {
      d.era = era;
      d.type = d.type || 'one';
      E.defs[d.id] = d;
      E.order.push(d);
    }
  };
  // 时代注册默认修正值
  E.hook = (fn) => E.hooks.push(fn);

  E.lv = (id) => (G.s.own[id] || 0);
  E.has = (id) => E.lv(id) > 0;

  E.cost = (d, lv) => {
    if (lv === undefined) lv = E.lv(d.id);
    if (typeof d.cost === 'function') return d.cost(lv);
    if (d.type === 'gen') {
      const r = d.growth || 1.15;
      const o = {};
      for (const k in d.cost) o[k] = Math.ceil(d.cost[k] * Math.pow(r, lv) * (G.m && G.m.costMult ? G.m.costMult[k] || 1 : 1));
      return o;
    }
    if (d.type === 'level') return d.costs[Math.min(lv, d.costs.length - 1)];
    return d.cost;
  };

  E.maxed = (d) => {
    const lv = E.lv(d.id);
    if (d.type === 'gen') return d.max !== undefined && lv >= d.max;
    if (d.type === 'level') return lv >= d.costs.length;
    return lv >= 1;
  };

  E.afford = (c) => {
    for (const k in c) if ((G.s.res[k] || 0) + 1e-9 < c[k]) return false;
    return true;
  };
  // 离买得起还差多少（0..1，取最短板）
  E.frac = (c) => {
    let f = 1;
    for (const k in c) f = Math.min(f, c[k] > 0 ? (G.s.res[k] || 0) / c[k] : 1);
    return Math.max(0, f);
  };
  E.pay = (c) => {
    for (const k in c) G.s.res[k] -= c[k];
  };

  E.unlocked = (d) => !d.req || d.req(G.s);
  E.visible = (d) => {
    if (G.s.seen[d.id]) return true;
    if (!E.unlocked(d)) return false;
    const show = d.show ? d.show(G.s) : E.frac(E.cost(d)) >= (d.reveal === undefined ? 0.5 : d.reveal);
    if (show) {
      G.s.seen[d.id] = 1;
      G.bus.emit('reveal', d);
    }
    return show;
  };
  // 某时代当前可见的升级（可按 tab 过滤），已满级的排到后面或隐藏
  E.list = (era, tab, keepMaxed = false) => {
    const out = [];
    for (const d of E.order) {
      if (d.era !== era) continue;
      if (tab !== undefined && (d.tab || 'main') !== tab) continue;
      if (!E.visible(d)) continue;
      if (E.maxed(d) && !keepMaxed && d.type !== 'gen') continue;
      out.push(d);
    }
    return out;
  };

  E.canBuy = (d) => E.unlocked(d) && !E.maxed(d) && E.afford(E.cost(d));

  // quiet：自动购买（调度器）——不触发各时代的音效和日志
  E.buy = (id, n = 1, quiet) => {
    const d = typeof id === 'string' ? E.defs[id] : id;
    if (!d) return 0;
    let bought = 0;
    for (let i = 0; i < n; i++) {
      if (!E.canBuy(d)) break;
      E.pay(E.cost(d));
      G.s.own[d.id] = E.lv(d.id) + 1;
      G.s.seen[d.id] = 1;
      bought++;
      if (d.type !== 'gen') break;
    }
    if (bought) {
      E.recompute();
      if (d.onBuy) d.onBuy(E.lv(d.id), bought);
      G.bus.emit('buy', d, bought, !!quiet);
    }
    return bought;
  };
  E.buyMax = (id) => E.buy(id, 1000);

  E.recompute = () => {
    const m = { prod: {}, mult: {}, all: {}, gen: {}, costMult: {} };
    for (const r of E.RES) {
      m.prod[r] = 0;
      m.mult[r] = 1;
      m.all[r] = 1;
    }
    for (const fn of E.hooks) fn(m);
    // 新周目：全程 ×2
    if (G.s && G.s.ng > 0) for (const r of E.RES) m.all[r] *= 2;
    // 第一遍：修正值
    for (const d of E.order) {
      const lv = E.lv(d.id);
      if (lv && d.mod) d.mod(m, lv);
    }
    // 第二遍：发生器产出
    for (const d of E.order) {
      const lv = E.lv(d.id);
      if (!lv || d.type !== 'gen' || !d.prod) continue;
      const gm = m.gen[d.id] === undefined ? 1 : m.gen[d.id];
      for (const k in d.prod) m.prod[k] += d.prod[k] * lv * gm;
    }
    m.rate = {};
    for (const r of E.RES) m.rate[r] = m.prod[r] * m.mult[r] * m.all[r];
    G.m = m;
    return m;
  };

  // ---------- 收入与速率统计 ----------
  const track = {};
  for (const r of E.RES) track[r] = { cur: 0, auto: 0, hist: [0, 0, 0, 0, 0] };
  let acc = 0;

  // src: 'auto' 表示自动化产出（离线/后台补发时按它的平均速率算）
  E.gain = (res, amt, src) => {
    if (!(amt > 0)) return 0;
    amt *= G.m.all[res];
    G.s.res[res] = (G.s.res[res] || 0) + amt;
    G.s.tot[res] = (G.s.tot[res] || 0) + amt;
    track[res].cur += amt;
    if (src === 'auto') track[res].auto += amt;
    return amt;
  };
  // 被动产出（发生器）
  E.tick = (dt) => {
    for (const r of E.RES) {
      const a = G.m.rate[r] * dt;
      if (a > 0) {
        G.s.res[r] = (G.s.res[r] || 0) + a;
        G.s.tot[r] = (G.s.tot[r] || 0) + a;
        track[r].cur += a;
      }
    }
    acc += dt;
    if (acc >= 1) {
      const k = acc;
      acc = 0;
      for (const r of E.RES) {
        const t = track[r];
        t.hist.shift();
        t.hist.push(t.cur / k);
        const ar = G.s.autoRate[r] || 0;
        G.s.autoRate[r] = ar * 0.85 + (t.auto / k) * 0.15;
        t.cur = 0;
        t.auto = 0;
      }
    }
  };
  // 显示用速率：最近 5 秒平均（含主动收入），至少等于被动速率
  E.shown = (res) => {
    const h = track[res].hist;
    let s = 0;
    for (const v of h) s += v;
    return Math.max(s / h.length, G.m ? G.m.rate[res] : 0);
  };
  // 离线 / 后台补发：被动 + 自动化平均
  E.idle = (sec) => {
    const got = {};
    for (const r of E.RES) {
      if (E.idleSkip && E.idleSkip[r]) continue;
      const a = (G.m.rate[r] + (G.s.autoRate[r] || 0)) * sec;
      if (a > 0) {
        G.s.res[r] = (G.s.res[r] || 0) + a;
        G.s.tot[r] = (G.s.tot[r] || 0) + a;
        got[r] = a;
      }
    }
    // 时代自己的离线规则（例如 3D 时代的指数膨胀）
    for (const e of G.eras) {
      if (e && e.offline && e.id <= G.s.era) {
        const r = e.res, before = G.s.res[r] || 0;
        e.offline(sec);
        const d = (G.s.res[r] || 0) - before;
        if (d > 0) got[r] = (got[r] || 0) + d;
      }
    }
    return got;
  };

  // 价格文本："1,234 比特 + 5 向量"
  E.costText = (c, short) => {
    const parts = [];
    for (const k in c) parts.push(G.U.fmt(c[k]) + (short ? '' : ' ') + E.NAME[k]);
    return parts.join(' + ');
  };

  return E;
})();
