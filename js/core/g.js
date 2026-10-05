'use strict';
// 全局命名空间。所有脚本都是普通 <script>（file:// 下不能用 ES module），通过 G 互相访问。
const G = (window.G = {
  VW: 1600, // 虚拟画布宽（高清时代的绘制坐标系）
  VH: 900,
  eras: [], // 已注册的时代模块，按 id 索引
  fx: {}, // 跃迁 / 结局演出
  s: null, // 当前存档状态
  m: null, // 由已购升级重算出的修正值
  t: 0, // 运行以来的真实秒数
  debug: false,
  speed: 1,
});

G.U = (() => {
  const U = {};
  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  U.lerp = (a, b, t) => a + (b - a) * t;
  U.inv = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
  U.remap = (v, a, b, c, d) => c + (d - c) * U.clamp(U.inv(a, b, v), 0, 1);
  U.smooth = (t) => {
    t = U.clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  };
  U.ease = {
    inQuad: (t) => t * t,
    outQuad: (t) => 1 - (1 - t) * (1 - t),
    inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
    inCubic: (t) => t * t * t,
    outCubic: (t) => 1 - Math.pow(1 - t, 3),
    inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
    inExpo: (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
    outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    outBack: (t) => {
      const c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
    outElastic: (t) => {
      if (t <= 0) return 0;
      if (t >= 1) return 1;
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
    },
  };
  // 片段进度：在 [a,b] 区间内从 0 走到 1
  U.seg = (t, a, b) => U.clamp((t - a) / (b - a), 0, 1);
  U.rand = (a = 0, b = 1) => a + Math.random() * (b - a);
  U.randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  U.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  U.chance = (p) => Math.random() < p;
  U.dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
  // 可复现的伪随机
  U.rng = (seed) => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  U.hash = (n) => {
    const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  U.shuffle = (arr, r = Math.random) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  // ---------- 数字：中文大数单位（万进制） ----------
  const UNITS = [
    ['无量大数', 68], ['不可思议', 64], ['那由他', 60], ['阿僧祇', 56], ['恒河沙', 52],
    ['极', 48], ['载', 44], ['正', 40], ['涧', 36], ['沟', 32], ['穰', 28], ['秭', 24],
    ['垓', 20], ['京', 16], ['兆', 12], ['亿', 8], ['万', 4],
  ];
  U.UNITS = UNITS;
  U.int = (n) => {
    n = Math.floor(n);
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };
  U.fmt = (n, dec = 0) => {
    if (n === undefined || n === null || isNaN(n)) return '0';
    if (!isFinite(n)) return '∞';
    const neg = n < 0;
    n = Math.abs(n);
    let out;
    if (n < 1e4) {
      if (dec > 0 && n < 100 && Math.floor(n) !== n) out = n.toFixed(dec).replace(/\.?0+$/, '') || '0';
      else out = U.int(n);
    } else {
      const e = Math.floor(Math.log10(n) + 1e-9);
      let unit = null;
      for (const u of UNITS) if (e >= u[1]) { unit = u; break; }
      let v = n / Math.pow(10, unit[1]);
      if (v >= 1e4) {
        // 超过无量大数：直接科学计数
        out = n.toExponential(2).replace('e+', 'e');
      } else {
        const d = v < 10 ? 2 : v < 100 ? 1 : 0;
        v = Math.floor(v * Math.pow(10, d)) / Math.pow(10, d);
        out = v.toFixed(d) + unit[0];
      }
    }
    return (neg ? '-' : '') + out;
  };
  U.rate = (n) => U.fmt(n, 1) + '/秒';
  U.time = (sec) => {
    sec = Math.max(0, Math.floor(sec));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    if (h > 0) return `${h} 小时 ${m} 分`;
    if (m > 0) return `${m} 分 ${s} 秒`;
    return `${s} 秒`;
  };

  // ---------- 颜色 ----------
  U.hex = (r, g, b) => '#' + [r, g, b].map((v) => U.clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
  U.rgb = (hex) => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  U.mix = (h1, h2, t) => {
    const a = U.rgb(h1), b = U.rgb(h2);
    return U.hex(U.lerp(a[0], b[0], t), U.lerp(a[1], b[1], t), U.lerp(a[2], b[2], t));
  };
  U.rgba = (hex, a) => {
    const c = U.rgb(hex);
    return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  };
  U.hsl = (h, s, l, a = 1) => `hsla(${h},${s}%,${l}%,${a})`;

  // ---------- 画布 ----------
  U.canvas = (w, h) => {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    return c;
  };
  U.rrect = (ctx, x, y, w, h, r) => {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };
  // 简单自动换行（按字符宽度），返回行数组
  U.wrap = (ctx, text, maxW) => {
    const lines = [];
    for (const para of String(text).split('\n')) {
      let line = '';
      for (const ch of para) {
        const test = line + ch;
        if (ctx.measureText(test).width > maxW && line) {
          lines.push(line);
          line = ch;
        } else line = test;
      }
      lines.push(line);
    }
    return lines;
  };
  return U;
})();

// 简单事件总线
G.bus = {
  h: {},
  on(name, fn) {
    (this.h[name] || (this.h[name] = [])).push(fn);
  },
  emit(name, a, b) {
    const l = this.h[name];
    if (l) for (const fn of l) fn(a, b);
  },
};

G.registerEra = (era) => {
  G.eras[era.id] = era;
};
