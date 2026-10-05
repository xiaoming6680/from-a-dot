'use strict';
// 时代 4 · 现代（光）—— 引力导流：旧时代卡片喷出光子，鼠标是引力井，把光导进光核
(() => {
  const U = G.U, E = G.econ, I = G.input, A = G.audio;
  const FONT = '"Microsoft YaHei UI", "Segoe UI", "PingFang SC", sans-serif';
  const NUMF = '"Segoe UI", "Microsoft YaHei UI", sans-serif';
  const PA = { x: 40, y: 150, w: 1100, h: 700 }; // 场地
  const CORE = { x: 590, y: 500 };
  const CARD_W = 250, CARD_H = 141;
  const CARDS = [
    { id: 0, x: 70, y: 175, col: '#41ff86', name: '终端', res: 'bits' },
    { id: 1, x: 860, y: 175, col: '#dff4ff', name: 'Pong', res: 'vec' },
    { id: 2, x: 70, y: 690, col: '#f8b800', name: '8-bit', res: 'px' },
    { id: 3, x: 860, y: 690, col: '#ff9ad0', name: '16-bit', res: 'dust' },
  ];
  const NES_POP = ['#F83800', '#FCA044', '#F8B800', '#58D854', '#3CBCFC', '#9878F8', '#F878F8', '#FCFCFC'];

  // ---------------- 升级 ----------------
  G.econ.hook((m) => {
    m.lux = 1;
    m.emit = 1;
    m.coreR = 1;
    m.lens = 0;
    m.lensPow = 1;
    m.sched = 0;
    m.glass = 0;
    m.grad = 0;
    m.voices = 0;
  });
  E.define(4, [
    { id: 'fiber', name: '光纤', type: 'gen', desc: '+3 光子/秒', cost: { lux: 25 }, prod: { lux: 3 } },
    { id: 'lens', name: '透镜', type: 'gen', desc: '在场上放一块透镜，自动把光聚向光核（可拖动）', cost: { lux: 60 }, growth: 2.6, max: 8, tag: 'auto',
      mod: (m, lv) => (m.lens = lv), onBuy: () => syncLenses() },
    { id: 'glass', name: '毛玻璃', desc: '卡片后面的东西变得朦胧', cost: { lux: 90 }, tag: 'visual', mod: (m) => (m.glass = 1) },
    { id: 'amp', name: '放大器', type: 'gen', desc: '所有光子 ×3', cost: { lux: 300 }, growth: 4.0, tag: 'mult',
      mod: (m, lv) => (m.all.lux *= Math.pow(3, lv)) },
    { id: 'voice', name: '声部', type: 'level', desc: '音乐多一层（琶音 → 鼓 → 贝斯 → 旋律）。光子 +10%', tag: 'sound',
      costs: [{ lux: 150 }, { lux: 3000 }, { lux: 6e4 }, { lux: 1.2e6 }],
      mod: (m, lv) => { m.voices = lv; m.all.lux *= Math.pow(1.1, lv); }, onBuy: () => updateMusic() },
    { id: 'grad', name: '渐变', desc: '颜色之间不再有边界', cost: { lux: 600 }, tag: 'visual', mod: (m) => (m.grad = 1) },
    { id: 'dense', name: '粒子密度', type: 'level', desc: '旧时代喷出更多的光（×1.6）', costs: [{ lux: 1500 }, { lux: 8e4 }, { lux: 4e6 }],
      mod: (m, lv) => (m.emit *= Math.pow(1.6, lv)) },
    { id: 'core', name: '光核扩容', type: 'level', desc: '光核更大，每颗光子 ×2', costs: [{ lux: 4000 }, { lux: 3e5 }, { lux: 2e7 }],
      mod: (m, lv) => { m.coreR *= Math.pow(1.14, lv); m.lux *= Math.pow(2, lv); } },
    { id: 'lensp', name: '透镜镀膜', type: 'level', desc: '透镜更强、更大', costs: [{ lux: 2e4 }, { lux: 2e6 }], req: (s) => s.own.lens,
      mod: (m, lv) => (m.lensPow *= Math.pow(1.6, lv)) },
    { id: 'sched', name: '调度器', desc: '每秒自动替旧时代买一个最便宜的发生器', cost: { lux: 5e4 }, tag: 'auto', mod: (m) => (m.sched = 1) },
    { id: 'back4', name: '回溯 · 一切', desc: '比特、向量、像素、星屑产出全部 ×10', cost: { lux: 2e5 }, tag: 'back',
      mod: (m) => { for (const r of ['bits', 'vec', 'px', 'dust']) m.all[r] *= 10; } },
    { id: 'decode4', name: '解码 · 留言', desc: '恢复留言.txt 的一部分', cost: { lux: 1e7 }, tag: 'back', onBuy: () => G.letter.reveal(0.1) },
    { id: 'depth', name: '纵深', type: 'goal', desc: '转过去，看看背面。', cost: { lux: 1e16, dust: 2e7 }, reveal: 0.02, onBuy() { G.startFx('t45'); } },
  ]);

  // ---------------- 剧情 ----------------
  G.story.def([
    { id: 'e4.start', era: 4, when: (s) => s.e[4].started, say: ['光。', '……原来我一直都在发光。'] },
    { id: 'e4.hint', era: 4, when: (s) => s.e[4].started && s.time - s.e[4].at > 6 && s.stats.photons < 30, say: '按住鼠标，光会跟着你走。把它们带到中间。' },
    { id: 'e4.abs', era: 4, when: (s) => s.stats.photons >= 30, say: '收进来了。好暖。' },
    { id: 'e4.cards', era: 4, when: (s) => s.time - s.e[4].at > 40, say: ['终端、Pong、贪吃蛇、跑酷……它们都还在。', '过去没有消失。它们只是被我装进了自己里面。'] },
    { id: 'e4.river', era: 4, when: () => R.bestCombo >= 60, say: '像一条河。' },
    { id: 'e4.glass', era: 4, when: (s) => s.own.glass, say: '玻璃后面的东西变柔和了。' },
    { id: 'e4.grad', era: 4, when: (s) => s.own.grad, say: '颜色和颜色之间，原来没有边界。' },
    { id: 'e4.lens', era: 4, when: (s) => s.own.lens >= 1, say: '透镜会替我把光聚起来。你可以把它拖到更好的位置。' },
    { id: 'e4.amp', era: 4, when: (s) => s.own.amp >= 1, say: '放大。再放大。' },
    { id: 'e4.big', era: 4, when: (s) => s.res.lux >= 1e12, say: ['万、亿、兆……', '我已经数不过来了。'] },
    { id: 'e4.sched', era: 4, when: (s) => s.own.sched, say: '旧的那些我，现在会自己长大了。' },
    { id: 'e4.flat', era: 4, when: (s) => s.tot.lux >= 1e14, say: ['这么多光，可它们都在同一个平面上。', '我想看看……背面。'] },
    { id: 'e4.goal', era: 4, when: (s) => s.seen.depth, say: '纵深：转过去。' },
    { id: 'e4.ready', era: 4, when: (s) => E.canBuy(E.defs.depth), say: '准备好了。' },
  ]);

  // ---------------- 运行时 ----------------
  const R = {
    fb: null, ctx: null, bg: null, bgx: null, glow: {},
    parts: [], lenses: [], drag: null,
    intro: 1, scroll: 0,
    shown: 0, // 滚动显示的数字
    combo: [], bestCombo: 0, flare: 0, ripples: [],
    toasts: [], lastN: 0,
    hover: null, hoverCard: null,
    letterOpen: 0,
    spring: {},
    emitAcc: [0, 0, 0, 0],
    schedT: 0,
    minis: {},
    beatPulse: 0,
    rateHist: [],
  };

  const era = {
    id: 4, name: '现代', res: 'lux',
    fresh: () => ({ started: 0, at: 0, lenses: [] }),
    init() {
      R.fb = U.canvas(1600, 900);
      R.ctx = R.fb.getContext('2d');
      R.bg = U.canvas(200, 113);
      R.bgx = R.bg.getContext('2d');
      for (const c of CARDS) R.minis[c.id] = U.canvas(c.id === 2 ? 120 : c.id === 3 ? 224 : 250, c.id === 2 ? 68 : c.id === 3 ? 126 : 141);
      syncLenses();
    },
    enter(fromFx, visiting) {
      R.lastN = G.s.lineN || 0;
      if (G.s.e[4].started || visiting) era.music();
    },
    leave() {},
    music() {
      if (G.music.cur && G.music.cur.song === SONG()) return G.music.setMask(musicMask(), 1);
      G.music.play(SONG(), { mask: musicMask(), fade: 1.5 });
    },
    update,
    render,
    display,
    renderMini,
    setIntro: (p) => (R.intro = p),
    SONG: () => SONG(),
    CORE,
    cards: () => CARDS,
  };
  G.registerEra(era);

  // ---------------- 音乐 ----------------
  let songCache = null;
  function SONG() {
    if (songCache) return songCache;
    const M = G.music;
    const melody = M.melody(0);
    let duck = null, duckOut = null;
    songCache = {
      bpm: 120, len: 256, vol: 0.8,
      tracks: [
        { gen(st, t, spb, out) {
            if (duckOut !== out) {
              duck = A.ctx.createGain();
              duck.connect(out);
              duckOut = out;
            }
            if (st % 4 === 0) {
              duck.gain.setValueAtTime(0.35, t);
              duck.gain.linearRampToValueAtTime(1, t + spb * 3.2);
            }
            if (st % 16 !== 0) return;
            const ch = M.chordAt(st);
            ch.tri.forEach((n, i) => A.pad({ t, n: n, d: spb * 15.5, v: 0.03, lp: 1600, lp2: 900, a: 0.25, r: 0.8, out: duck, rev: 0.35, pan: (i - 1) * 0.4, voices: 4, spread: 18 }));
            A.pad({ t, n: ch.root + 12, d: spb * 15.5, v: 0.025, lp: 700, a: 0.3, r: 0.8, out: duck, voices: 3, spread: 10 });
          } },
        { gen(st, t, spb, out) {
            const ch = M.chordAt(st);
            const seq = [0, 1, 2, 1, 2, 0, 1, 2];
            const n = ch.tri[seq[st % 8]] + (st % 16 >= 8 ? 12 : 0);
            A.tone({ t, n, d: spb * 0.9, v: 0.022, type: 'sawtooth', lp: 2600, lp2: 500, q: 4, out, echo: 0.18, pan: st % 2 ? 0.3 : -0.3 });
          } },
        { gen(st, t, spb, out) {
            const b = st % 16;
            if (b % 4 === 0) A.tone({ t, f: 150, f2: 38, slide: 0.12, d: 0.28, v: 0.3, type: 'sine', out });
            if (b === 4 || b === 12) A.noise({ t, d: 0.14, v: 0.08, bp: 1400, q: 0.9, out, rev: 0.2 });
            if (b % 4 === 2) A.noise({ t, d: 0.05, v: 0.03, hp: 7500, out });
            if (b % 2 === 1) A.noise({ t, d: 0.02, v: 0.012, hp: 9000, out });
          } },
        { gen(st, t, spb, out) {
            if (st % 2) return;
            const ch = M.chordAt(st);
            A.tone({ t: t + 0.02, n: ch.root - 12 + (st % 8 === 6 ? 12 : 0), d: spb * 1.5, v: 0.1, type: 'sawtooth', lp: 380, q: 2, out, env: 'hold', a: 0.01, r: 0.05 });
          } },
        { notes: melody, inst: (o) => {
            A.tone({ t: o.t, n: o.n, d: Math.min(o.d, 0.5), v: 0.04, type: 'triangle', out: o.out, echo: 0.25, rev: 0.25 });
            A.tone({ t: o.t, n: o.n + 12, d: Math.min(o.d, 0.3), v: 0.012, type: 'sine', out: o.out });
          } },
      ],
      onStep(st, t) {
        if (st % 4 === 0) setTimeout(() => (R.beatPulse = 1), Math.max(0, (t - A.ctx.currentTime) * 1000));
      },
    };
    return songCache;
  }
  function musicMask() {
    return 1 | (((1 << E.lv('voice')) - 1) << 1);
  }
  function updateMusic() {
    if (G.fgEra() !== 4) return;
    if (!G.music.cur || G.music.cur.song !== SONG()) era.music();
    else G.music.setMask(musicMask(), 1.2);
  }

  // ---------------- 音效 ----------------
  let lastAbsSfx = 0;
  const sfx = {
    absorb(k) {
      if (G.t - lastAbsSfx < 0.045) return;
      lastAbsSfx = G.t;
      const sc = [69, 72, 76, 79, 81, 84, 88, 91];
      A.tone({ n: sc[k % sc.length] + 12, d: 0.12, v: 0.018, type: 'sine', rev: 0.3 });
    },
    buy() {
      const t = A.now();
      [76, 83, 88].forEach((n, i) => A.tone({ n, t: t + i * 0.05, d: 0.4, v: 0.035, type: 'sine', rev: 0.4 }));
    },
    cant() { A.tone({ f: 180, f2: 140, d: 0.15, v: 0.05, type: 'sine' }); },
    hover() { A.tone({ n: 100, d: 0.02, v: 0.008, type: 'sine' }); },
    toast() { A.tone({ n: 88, d: 0.25, v: 0.025, type: 'sine', rev: 0.4 }); A.tone({ n: 95, t: A.now() + 0.08, d: 0.3, v: 0.02, type: 'sine', rev: 0.4 }); },
  };
  G.bus.on('buy', (d, n, quiet) => {
    if (d.era !== 4 || d.type === 'goal' || quiet) return;
    sfx.buy();
    R.flare = Math.max(R.flare, 0.6);
    G.save.soon();
  });
  G.bus.on('cant', (d) => {
    if (d.era === 4) sfx.cant();
  });

  // ---------------- 透镜 ----------------
  function syncLenses() {
    const st = G.s ? G.s.e[4] : null;
    const n = G.m ? G.m.lens || 0 : 0;
    if (!st) return;
    const spots = [[330, 360], [850, 360], [330, 640], [850, 640], [590, 300], [590, 700], [380, 500], [800, 500]];
    while (st.lenses.length < n) st.lenses.push(spots[st.lenses.length].slice());
    R.lenses = st.lenses;
  }

  // ---------------- 粒子 ----------------
  function coreR() {
    return 58 * G.m.coreR * (1 + R.flare * 0.15);
  }
  function emit(dt) {
    let alive = R.parts.length;
    CARDS.forEach((c, i) => {
      const rate = E.shown(c.res);
      const per = (2.2 + Math.log10(1 + rate) * 0.9) * G.m.emit;
      R.emitAcc[i] += dt * per;
      while (R.emitAcc[i] >= 1) {
        R.emitAcc[i]--;
        if (alive > 2600) continue;
        alive++;
        const cx = c.x + CARD_W / 2, cy = c.y + CARD_H / 2;
        const ang = Math.atan2(CORE.y - cy, CORE.x - cx) + U.rand(-0.9, 0.9);
        const sp = U.rand(40, 110);
        const col = c.id === 2 ? U.pick(NES_POP) : c.col;
        R.parts.push({ x: cx + U.rand(-CARD_W / 2, CARD_W / 2) * 0.8, y: cy + U.rand(-CARD_H / 2, CARD_H / 2) * 0.8, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: U.rand(7, 11), c: col, s: U.rand(0.7, 1.3), src: c.id });
      }
    });
  }
  function absorb(p, by) {
    const now = G.s.time;
    R.combo.push(now);
    const combo = R.combo.length;
    if (combo > R.bestCombo) R.bestCombo = combo;
    const mult = 1 + Math.min(4, combo / 40);
    const got = E.gain('lux', G.m.lux * mult, by === 'auto' ? 'auto' : undefined);
    G.s.stats.photons++;
    R.flare = Math.min(1, R.flare + 0.02);
    if (G.fgEra() === 4 && !G.inFx()) {
      sfx.absorb(combo);
      if (Math.random() < 0.08) R.ripples.push({ t: 0, c: p.c });
    }
    return got;
  }
  function updateParts(dt, fg) {
    let press = fg && G.input.down && G.input.inside && !R.drag && !G.ui.blocked && inField(G.input.mx, G.input.my);
    let hover = fg && G.input.inside && inField(G.input.mx, G.input.my) && !R.drag;
    let mx = G.input.mx, my = G.input.my;
    if (G.botAssist && fg) {
      // 2.4 秒一个来回：从某张卡片拖到光核
      const ph = (G.s.time / 2.4) % 1, c = CARDS[Math.floor(G.s.time / 2.4) % 4];
      const k = U.ease.inOutQuad(U.clamp((ph - 0.35) / 0.6, 0, 1));
      mx = U.lerp(c.x + CARD_W / 2, CORE.x, k);
      my = U.lerp(c.y + CARD_H / 2, CORE.y, k);
      press = hover = true;
    }
    const cr = coreR();
    const lensR = 52 * Math.sqrt(G.m.lensPow);
    const drag = Math.pow(0.62, dt);
    for (const p of R.parts) {
      // 光核的微弱引力
      let dx = CORE.x - p.x, dy = CORE.y - p.y;
      let d = Math.hypot(dx, dy) + 1;
      const g = 2600 / Math.max(80, d);
      p.vx += (dx / d) * g * dt;
      p.vy += (dy / d) * g * dt;
      // 鼠标：悬停是微弱引力，按住是强引力井
      if (hover || press) {
        const ex = mx - p.x, ey = my - p.y;
        const ed = Math.hypot(ex, ey) + 1;
        const R0 = press ? 300 : 150;
        if (ed < R0) {
          const f = (press ? 5200 : 900) * (1 - ed / R0);
          p.vx += (ex / ed) * f * dt;
          p.vy += (ey / ed) * f * dt;
          // 绕着鼠标转一点
          if (press) {
            p.vx += (-ey / ed) * f * 0.25 * dt;
            p.vy += (ex / ed) * f * 0.25 * dt;
          }
          p.held = press;
        } else p.held = false;
      } else p.held = false;
      // 透镜：把经过的光折向光核
      for (const L of R.lenses) {
        const lx = p.x - L[0], ly = p.y - L[1];
        if (lx * lx + ly * ly < lensR * lensR) {
          const sp = Math.max(160, Math.hypot(p.vx, p.vy));
          const tx = CORE.x - p.x, ty = CORE.y - p.y, tl = Math.hypot(tx, ty) + 1;
          const k = Math.min(1, dt * 6 * G.m.lensPow);
          p.vx = U.lerp(p.vx, (tx / tl) * sp * 1.15, k);
          p.vy = U.lerp(p.vy, (ty / tl) * sp * 1.15, k);
          p.lensed = true;
        }
      }
      p.vx *= drag;
      p.vy *= drag;
      const vmax = 900;
      const v = Math.hypot(p.vx, p.vy);
      if (v > vmax) {
        p.vx *= vmax / v;
        p.vy *= vmax / v;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      dx = CORE.x - p.x;
      dy = CORE.y - p.y;
      if (dx * dx + dy * dy < cr * cr) {
        p.dead = true;
        absorb(p, p.held ? 'hand' : 'auto');
      } else if (p.life <= 0 || p.x < PA.x - 60 || p.x > PA.x + PA.w + 60 || p.y < PA.y - 60 || p.y > PA.y + PA.h + 60) p.dead = true;
    }
    R.parts = R.parts.filter((p) => !p.dead);
    const now = G.s.time;
    while (R.combo.length && now - R.combo[0] > 1.2) R.combo.shift();
  }
  function inField(x, y) {
    return x > PA.x && x < PA.x + PA.w && y > PA.y && y < PA.y + PA.h;
  }

  // ---------------- 调度器 ----------------
  function scheduler(dt) {
    if (!G.m.sched) return;
    R.schedT += dt;
    if (R.schedT < 1) return;
    R.schedT = 0;
    let best = null, bc = Infinity;
    for (const d of E.order) {
      if (d.era > 3 || d.type !== 'gen' || !E.canBuy(d)) continue;
      const c = E.cost(d);
      const r = Object.keys(c)[0];
      const rel = c[r] / Math.max(1, G.s.res[r]);
      if (rel > 0.1) continue; // 只花小钱，不把旧资源掏空
      if (rel < bc) {
        bc = rel;
        best = d;
      }
    }
    if (best) E.buy(best, 1, true);
  }

  // ---------------- 更新 ----------------
  function update(dt, fg) {
    const st = G.s.e[4];
    if (!st.started) {
      if (R.intro >= 1) {
        st.started = 1;
        st.at = G.s.time;
        if (fg && (!G.music.cur || G.music.cur.song !== SONG())) era.music();
      }
      if (R.intro < 0.7) return;
    }
    syncLenses();
    emit(dt);
    updateParts(dt, fg);
    scheduler(dt);
    R.flare = Math.max(0, R.flare - dt * 0.5);
    R.beatPulse = Math.max(0, R.beatPulse - dt * 3);
    for (const r of R.ripples) r.t += dt;
    R.ripples = R.ripples.filter((r) => r.t < 1.2);
    // 数字平滑滚动
    const target = G.s.res.lux;
    R.shown = R.shown <= 0 || Math.abs(target - R.shown) / Math.max(1, target) > 0.5 ? target : U.lerp(R.shown, target, Math.min(1, dt * 8));
    // 新台词 → 通知
    const n = G.s.lineN || 0;
    if (n > R.lastN) {
      for (const l of G.s.log) {
        if ((l.n || 0) > R.lastN && (l.kind === 'dot' || l.kind === 'sys')) {
          R.toasts.push({ text: l.text, kind: l.kind, t: 0 });
          if (fg) sfx.toast();
        }
      }
      R.lastN = n;
      while (R.toasts.length > 3) R.toasts.shift();
    }
    for (const t of R.toasts) t.t += dt;
    R.toasts = R.toasts.filter((t) => t.t < 7);
    // 光子速率历史（芯片里的小折线）
    R.histT = (R.histT || 0) + dt;
    if (R.histT > 1) {
      R.histT = 0;
      R.rateHist.push(E.shown('lux'));
      if (R.rateHist.length > 40) R.rateHist.shift();
    }
  }

  // ---------------- 绘制 ----------------
  function ensureFB() {
    const sz = G.display.fbSize();
    if (R.fb.width !== sz.w || R.fb.height !== sz.h) {
      R.fb.width = sz.w;
      R.fb.height = sz.h;
    }
  }
  function glowSprite(col, size = 32) {
    const key = col + size;
    if (R.glow[key]) return R.glow[key];
    const c = U.canvas(size, size);
    const x = c.getContext('2d');
    const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.18, col);
    g.addColorStop(0.5, U.rgba(col, 0.25));
    g.addColorStop(1, U.rgba(col, 0));
    x.fillStyle = g;
    x.fillRect(0, 0, size, size);
    R.glow[key] = c;
    return c;
  }
  function spring(key, target, k = 14) {
    const s = R.spring[key] || (R.spring[key] = { v: target, vel: 0 });
    const dt = Math.min(0.05, G.dt || 0.016);
    s.vel += (target - s.v) * k * k * dt - s.vel * 2 * k * 0.55 * dt;
    s.v += s.vel * dt;
    return s.v;
  }
  function intro(a, b) {
    return U.clamp((R.intro - a) / (b - a), 0, 1);
  }

  function render() {
    ensureFB();
    R.frameN = (R.frameN || 0) + 1;
    const ctx = R.ctx, k = R.fb.width / G.VW;
    G.ui.space(G.VW, G.VH);
    R.hover = null;
    R.hoverCard = null;
    const blocked0 = G.ui.blocked;
    if (R.letterOpen) G.ui.blocked = true;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawBG(ctx, k);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    drawField(ctx);
    drawHeader(ctx);
    drawPanel(ctx);
    drawToasts(ctx);
    if (G.visiting(4)) drawBack(ctx);
    G.ui.blocked = blocked0;
    if (R.letterOpen) drawLetter(ctx);
    if (R.intro >= 1) drawCursor(ctx);
    return R.fb;
  }

  function drawBG(ctx, k) {
    const W = R.fb.width, H = R.fb.height;
    const grad = G.m.grad;
    ctx.fillStyle = '#07080f';
    ctx.fillRect(0, 0, W, H);
    // 低分辨率背景层：极光 + 粒子模糊（也作为毛玻璃的底）
    const b = R.bgx;
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.globalCompositeOperation = 'source-over';
    b.fillStyle = '#07080f';
    b.fillRect(0, 0, 200, 113);
    const t = G.t * 0.15;
    const blobs = grad
      ? [['#3b5bff', 0.35 + Math.sin(t) * 0.1, 0.3, 0.55], ['#b04cff', 0.7 + Math.cos(t * 1.3) * 0.1, 0.65, 0.5], ['#00d4c8', 0.45, 0.8 + Math.sin(t * 0.7) * 0.08, 0.45]]
      : [['#1a2140', 0.4, 0.4, 0.6], ['#1d1530', 0.7, 0.7, 0.5]];
    b.globalCompositeOperation = 'lighter';
    for (const [c, x, y, r] of blobs) {
      const g = b.createRadialGradient(x * 200, y * 113, 0, x * 200, y * 113, r * 200);
      g.addColorStop(0, U.rgba(c, grad ? 0.55 : 0.6));
      g.addColorStop(1, U.rgba(c, 0));
      b.fillStyle = g;
      b.fillRect(0, 0, 200, 113);
    }
    // 光核光晕
    const cr = coreR();
    const g2 = b.createRadialGradient((CORE.x / 1600) * 200, (CORE.y / 900) * 113, 0, (CORE.x / 1600) * 200, (CORE.y / 900) * 113, (cr * 3.2) / 8);
    g2.addColorStop(0, `rgba(255,240,220,${0.18 + R.flare * 0.14})`);
    g2.addColorStop(1, 'rgba(255,200,160,0)');
    b.fillStyle = g2;
    b.fillRect(0, 0, 200, 113);
    // 粒子（模糊版）
    for (let i = 0; i < R.parts.length; i += 3) {
      const p = R.parts[i];
      b.fillStyle = U.rgba(p.c, 0.5);
      b.fillRect((p.x / 8) | 0, (p.y / 8) | 0, 1, 1);
    }
    b.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(R.bg, 0, 0, W, H);
    // 细网格
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.strokeStyle = 'rgba(255,255,255,0.025)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= 1600; x += 50) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 900);
    }
    for (let y = 0; y <= 900; y += 50) {
      ctx.moveTo(0, y);
      ctx.lineTo(1600, y);
    }
    ctx.stroke();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // 圆角玻璃卡片
  function card(ctx, x, y, w, h, r = 18, opt = {}) {
    ctx.save();
    U.rrect(ctx, x, y, w, h, r);
    if (G.m.glass) {
      ctx.save();
      ctx.clip();
      ctx.globalAlpha = 0.9;
      ctx.filter = 'none';
      ctx.drawImage(R.bg, (x / 1600) * 200, (y / 900) * 113, (w / 1600) * 200, (h / 900) * 113, x, y, w, h);
      ctx.restore();
      U.rrect(ctx, x, y, w, h, r);
      ctx.fillStyle = 'rgba(255,255,255,0.055)';
    } else ctx.fillStyle = 'rgba(18,20,32,0.92)';
    ctx.fill();
    if (G.m.grad) {
      const g = ctx.createLinearGradient(x, y, x + w, y + h);
      g.addColorStop(0, 'rgba(255,255,255,0.28)');
      g.addColorStop(0.5, 'rgba(255,255,255,0.06)');
      g.addColorStop(1, 'rgba(160,140,255,0.22)');
      ctx.strokeStyle = g;
    } else ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = opt.lw || 1.2;
    ctx.stroke();
    ctx.restore();
  }
  function txt(ctx, s, x, y, size, col, opt = {}) {
    ctx.font = `${opt.w || 400} ${size}px ${opt.num ? NUMF : FONT}`;
    ctx.textAlign = opt.align || 'left';
    ctx.textBaseline = opt.base || 'alphabetic';
    ctx.fillStyle = col;
    ctx.fillText(s, x, y);
    return ctx.measureText(s).width;
  }
  function gradText(ctx, s, x, y, size, w) {
    ctx.font = `${w || 600} ${size}px ${NUMF}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    const tw = ctx.measureText(s).width;
    if (G.m.grad) {
      const g = ctx.createLinearGradient(x, y - size, x + tw, y);
      g.addColorStop(0, '#7cf6ff');
      g.addColorStop(0.5, '#a78bff');
      g.addColorStop(1, '#ff8fd8');
      ctx.fillStyle = g;
    } else ctx.fillStyle = '#e8ecff';
    ctx.fillText(s, x, y);
    return tw;
  }

  function drawField(ctx) {
    const ip = U.ease.outCubic(intro(0.1, 0.6));
    // 粒子
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of R.parts) {
      const a = Math.min(1, p.life / 1.5);
      const sz = 12 * p.s;
      ctx.globalAlpha = a;
      ctx.drawImage(glowSprite(p.c), p.x - sz / 2, p.y - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    // 卡片：旧时代的实时小窗
    CARDS.forEach((c, i) => {
      const s0 = spring('card' + i, R.intro < 1 ? (intro(0.15 + i * 0.08, 0.55 + i * 0.08) > 0 ? 1 : 0.6) : G.ui.over(c.x, c.y, CARD_W, CARD_H) ? 1.04 : 1, 12);
      const a = intro(0.15 + i * 0.08, 0.45 + i * 0.08);
      if (a <= 0) return;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.translate(c.x + CARD_W / 2, c.y + CARD_H / 2);
      ctx.scale(s0, s0);
      ctx.translate(-CARD_W / 2, -CARD_H / 2);
      card(ctx, -6, -6, CARD_W + 12, CARD_H + 36, 16);
      ctx.save();
      U.rrect(ctx, 0, 0, CARD_W, CARD_H, 10);
      ctx.clip();
      drawMini(ctx, c);
      ctx.restore();
      txt(ctx, c.name, 4, CARD_H + 21, 15, 'rgba(235,240,255,0.92)', { w: 600 });
      txt(ctx, '+' + U.fmt(E.shown(c.res), 1) + '/秒 ' + G.econ.NAME[c.res], CARD_W, CARD_H + 21, 13, 'rgba(200,210,240,0.6)', { align: 'right', num: true });
      ctx.restore();
      if (G.ui.over(c.x, c.y, CARD_W, CARD_H)) R.hoverCard = c;
      // 点一下（不拖动）= 回到过去；按住拖动 = 引力井（从卡片里把光拖出来）
      if (R.intro >= 1 && G.input.pressed && !G.input.used && G.ui.over(c.x, c.y, CARD_W, CARD_H)) R.cardPress = { c, x: G.input.mx, y: G.input.my };
      if (R.cardPress && R.cardPress.c === c && !G.input.down) {
        const moved = Math.hypot(G.input.mx - R.cardPress.x, G.input.my - R.cardPress.y);
        R.cardPress = null;
        if (moved < 10 && G.ui.over(c.x, c.y, CARD_W, CARD_H)) G.visit(c.id, [c.x, c.y, CARD_W, CARD_H]);
      }
    });
    // 透镜
    const lensR = 52 * Math.sqrt(G.m.lensPow);
    R.lenses.forEach((L, i) => {
      const hov = G.ui.over(L[0] - lensR, L[1] - lensR, lensR * 2, lensR * 2) && Math.hypot(G.input.mx - L[0], G.input.my - L[1]) < lensR;
      if (hov && G.input.pressed && !G.input.used && !G.ui.blocked) {
        G.input.used = true;
        R.drag = { i, ox: G.input.mx - L[0], oy: G.input.my - L[1] };
      }
      ctx.save();
      ctx.beginPath();
      ctx.arc(L[0], L[1], lensR, 0, Math.PI * 2);
      const g = ctx.createRadialGradient(L[0] - lensR * 0.3, L[1] - lensR * 0.3, 2, L[0], L[1], lensR);
      g.addColorStop(0, 'rgba(255,255,255,0.18)');
      g.addColorStop(0.7, 'rgba(160,200,255,0.06)');
      g.addColorStop(1, 'rgba(160,200,255,0.16)');
      ctx.fillStyle = g;
      ctx.fill();
      ctx.strokeStyle = hov || (R.drag && R.drag.i === i) ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(L[0], L[1], lensR * 0.78, Math.PI * 1.1, Math.PI * 1.45);
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.stroke();
      ctx.restore();
    });
    if (R.drag) {
      if (!G.input.down) R.drag = null;
      else {
        const L = R.lenses[R.drag.i];
        L[0] = U.clamp(G.input.mx - R.drag.ox, PA.x + 40, PA.x + PA.w - 40);
        L[1] = U.clamp(G.input.my - R.drag.oy, PA.y + 40, PA.y + PA.h - 40);
      }
    }
    // 光核
    const cr = coreR() * U.ease.outBack(intro(0.0, 0.4)) * (1 + R.beatPulse * 0.04);
    if (cr > 1) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(CORE.x, CORE.y, 0, CORE.x, CORE.y, cr * 1.9);
      g.addColorStop(0, 'rgba(255,255,255,0.85)');
      g.addColorStop(0.2, G.m.grad ? 'rgba(255,220,250,0.38)' : 'rgba(240,240,255,0.38)');
      g.addColorStop(0.5, G.m.grad ? 'rgba(160,140,255,0.12)' : 'rgba(180,190,230,0.1)');
      g.addColorStop(1, 'rgba(120,120,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(CORE.x, CORE.y, cr * 1.9, 0, Math.PI * 2);
      ctx.fill();
      for (const r of R.ripples) {
        ctx.strokeStyle = U.rgba(r.c, (1 - r.t / 1.2) * 0.5);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(CORE.x, CORE.y, cr + r.t * 160, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
      ctx.beginPath();
      ctx.arc(CORE.x, CORE.y, cr * 0.32, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
    // 连击
    const combo = R.combo.length;
    if (combo >= 10) {
      const mult = 1 + Math.min(4, combo / 40);
      txt(ctx, '×' + mult.toFixed(2), CORE.x, CORE.y + coreR() + 46, 22, 'rgba(255,255,255,0.85)', { align: 'center', w: 600, num: true });
      txt(ctx, `光流 ${combo}`, CORE.x, CORE.y + coreR() + 68, 13, 'rgba(220,225,255,0.55)', { align: 'center' });
    }
  }

  // 旧时代小窗：画进缓存画布，每 3 帧刷新一次（四个小窗每帧全量重绘太贵）
  function drawMini(ctx, c) {
    const mc = R.minis[c.id];
    const mx = mc.getContext('2d');
    R.miniTick = R.miniTick || {};
    const due = (R.frameN - (R.miniTick[c.id] || -99)) >= 3;
    if (due) {
      R.miniTick[c.id] = R.frameN;
      mx.setTransform(1, 0, 0, 1, 0, 0);
      if (c.id === 2 || c.id === 3) {
        mx.imageSmoothingEnabled = false;
        G.eras[c.id].renderMini(mx, 0, 0, mc.width, mc.height, { snake: true });
      } else {
        // 高清小窗：按设备像素缓存
        const k = R.fb.width / G.VW;
        const W = Math.round(CARD_W * k), H = Math.round(CARD_H * k);
        if (mc.width !== W || mc.height !== H) {
          mc.width = W;
          mc.height = H;
        }
        mx.setTransform(k, 0, 0, k, 0, 0);
        mx.textAlign = 'left';
        G.eras[c.id].renderMini(mx, 0, 0, CARD_W, CARD_H);
      }
    }
    ctx.imageSmoothingEnabled = !(c.id === 2 || c.id === 3);
    ctx.drawImage(mc, 0, 0, CARD_W, CARD_H);
    ctx.imageSmoothingEnabled = true;
  }

  function drawHeader(ctx) {
    const a = U.ease.outCubic(intro(0.35, 0.75));
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(0, (1 - a) * -30);
    txt(ctx, '光子', 44, 62, 18, 'rgba(220,226,255,0.6)', { w: 400 });
    gradText(ctx, U.fmt(R.shown), 42, 122, 58, 600);
    txt(ctx, '+' + U.fmt(E.shown('lux'), 1) + ' / 秒', 46, 146, 16, 'rgba(200,210,240,0.55)', { num: true });
    // 资源芯片
    const chips = [['星屑', 'dust', '#ffd860'], ['像素', 'px', '#ffb060'], ['向量', 'vec', '#a4e4fc'], ['比特', 'bits', '#70e090']];
    let x = 640;
    for (const [name, r, col] of chips) {
      const w = 150;
      card(ctx, x, 40, w, 56, 14);
      txt(ctx, name, x + 14, 62, 12, 'rgba(220,226,255,0.55)');
      txt(ctx, U.fmt(G.s.res[r]), x + 14, 84, 17, col, { w: 600, num: true });
      x += w + 10;
    }
    // 留言、菜单
    if (G.s.msg > 0) {
      const hov = G.ui.over(1250, 40, 150, 56);
      card(ctx, 1250, 40, 150, 56, 14, { lw: hov ? 2 : 1.2 });
      txt(ctx, '留言.txt', 1264, 62, 12, 'rgba(220,226,255,0.55)');
      txt(ctx, G.letter.pct() + '%', 1264, 84, 17, '#ffffff', { w: 600, num: true });
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      U.rrect(ctx, 1320, 74, 66, 6, 3);
      ctx.fill();
      ctx.fillStyle = '#a78bff';
      U.rrect(ctx, 1320, 74, 66 * G.s.msg, 6, 3);
      ctx.fill();
      if (G.ui.click(1250, 40, 150, 56)) R.letterOpen = 1;
    }
    const mh = G.ui.over(1500, 40, 56, 56);
    card(ctx, 1500, 40, 56, 56, 14, { lw: mh ? 2 : 1.2 });
    ctx.fillStyle = mh ? '#ffffff' : 'rgba(230,235,255,0.75)';
    for (let i = 0; i < 3; i++) {
      U.rrect(ctx, 1515, 55 + i * 10, 26, 3, 1.5);
      ctx.fill();
    }
    if (G.ui.click(1500, 40, 56, 56)) G.ui.openMenu();
    ctx.restore();
  }

  function drawPanel(ctx) {
    const a = U.ease.outCubic(intro(0.45, 0.9));
    if (a <= 0) return;
    const x = 1170 + (1 - a) * 420, y = 120, w = 390, h = 740;
    ctx.save();
    card(ctx, x, y, w, h, 22);
    txt(ctx, '升级', x + 24, y + 42, 20, '#ffffff', { w: 600 });
    txt(ctx, 'Shift 点击买满', x + w - 24, y + 42, 12, 'rgba(220,226,255,0.4)', { align: 'right' });
    const list = E.list(4);
    const RH = 74, top = y + 62, vis = h - 74;
    const maxS = Math.max(0, list.length * RH - vis);
    if (G.ui.over(x, y, w, h) && I.wheel) R.scroll = U.clamp(R.scroll + I.wheel * 0.8, 0, maxS);
    R.scroll = U.clamp(R.scroll, 0, maxS);
    ctx.beginPath();
    ctx.rect(x, top, w, vis);
    ctx.clip();
    list.forEach((d, i) => {
      const ry = top + i * RH - R.scroll;
      if (ry < top - RH || ry > top + vis) return;
      const visible = ry >= top - 4 && ry + RH - 10 <= top + vis + 4;
      const r = visible ? G.ui.buy(d, x + 12, ry, w - 24, RH - 10) : { hover: false, can: E.canBuy(d) };
      if (r.hover) R.hover = d;
      const hv = spring('row' + d.id, r.hover ? 1 : 0, 18);
      ctx.save();
      U.rrect(ctx, x + 12, ry, w - 24, RH - 10, 14);
      ctx.fillStyle = `rgba(255,255,255,${0.03 + hv * 0.06})`;
      ctx.fill();
      if (d.type === 'goal') {
        ctx.strokeStyle = r.can ? 'rgba(255,220,140,0.8)' : 'rgba(255,220,140,0.3)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      ctx.restore();
      // 图标
      const ic = { visual: '#a78bff', sound: '#7cf6ff', auto: '#7dffb0', back: '#ffd27c', mult: '#ff8fd8' }[d.tag] || 'rgba(255,255,255,0.7)';
      ctx.beginPath();
      ctx.arc(x + 40, ry + 32, 13, 0, Math.PI * 2);
      ctx.fillStyle = U.rgba(ic.startsWith('#') ? ic : '#ffffff', 0.16);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x + 40, ry + 32, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = ic;
      ctx.fill();
      const lv = E.lv(d.id);
      let name = d.name;
      if (d.type === 'level') name += ' ' + ['I', 'II', 'III', 'IV'][Math.min(lv, d.costs.length - 1)];
      txt(ctx, name, x + 64, ry + 26, 16, r.can ? '#ffffff' : 'rgba(230,235,255,0.55)', { w: 600 });
      if (d.type === 'gen' && lv) txt(ctx, '×' + lv, x + 64 + ctx.measureText(name).width + 8, ry + 26, 13, 'rgba(220,226,255,0.5)', { num: true });
      ctx.save();
      ctx.font = `400 12px ${FONT}`;
      let desc = d.desc;
      while (ctx.measureText(desc).width > w - 200 && desc.length > 4) desc = desc.slice(0, -2);
      if (desc !== d.desc) desc += '…';
      ctx.restore();
      txt(ctx, desc, x + 64, ry + 48, 12, 'rgba(210,218,245,0.5)');
      // 价格胶囊
      const c = E.cost(d);
      const ct = E.maxed(d) ? '已满' : Object.keys(c).map((k) => U.fmt(c[k]) + (k === 'lux' ? '' : ' ' + E.NAME[k])).join(' + ');
      ctx.font = `600 13px ${NUMF}`;
      const pw = ctx.measureText(ct).width + 24;
      const px = x + w - 24 - pw, py = ry + 18;
      U.rrect(ctx, px, py, pw, 28, 14);
      if (r.can) {
        const g = ctx.createLinearGradient(px, py, px + pw, py);
        g.addColorStop(0, G.m.grad ? '#5b7bff' : '#4a5aa0');
        g.addColorStop(1, G.m.grad ? '#b04cff' : '#4a5aa0');
        ctx.fillStyle = g;
      } else ctx.fillStyle = 'rgba(255,255,255,0.07)';
      ctx.fill();
      txt(ctx, ct, px + pw / 2, py + 19, 13, r.can ? '#ffffff' : 'rgba(230,235,255,0.45)', { align: 'center', w: 600, num: true });
      // 进度条
      if (!r.can && !E.maxed(d)) {
        const f = E.frac(c);
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(x + 64, ry + RH - 18, w - 100, 2);
        ctx.fillStyle = G.m.grad ? '#7cf6ff' : 'rgba(200,210,255,0.6)';
        ctx.fillRect(x + 64, ry + RH - 18, (w - 100) * f, 2);
      }
    });
    ctx.restore();
  }

  function drawToasts(ctx) {
    let y = 850;
    for (let i = R.toasts.length - 1; i >= 0; i--) {
      const t = R.toasts[i];
      const inA = U.ease.outBack(U.clamp(t.t / 0.45, 0, 1));
      const outA = 1 - U.clamp((t.t - 6.3) / 0.7, 0, 1);
      ctx.save();
      ctx.font = `400 16px ${FONT}`;
      const w = Math.min(760, ctx.measureText(t.text).width + 70);
      const x = 590 - w / 2;
      ctx.globalAlpha = Math.min(1, inA) * outA;
      ctx.translate(0, (1 - inA) * 30);
      card(ctx, x, y - 44, w, 44, 22);
      ctx.beginPath();
      ctx.arc(x + 24, y - 22, 4, 0, Math.PI * 2);
      ctx.fillStyle = t.kind === 'sys' ? '#ffd27c' : '#ffffff';
      ctx.fill();
      txt(ctx, t.text, x + 42, y - 16, 16, t.kind === 'sys' ? 'rgba(255,230,180,0.9)' : 'rgba(240,244,255,0.95)');
      ctx.restore();
      y -= 54;
    }
    if (R.hoverCard && R.intro >= 1) {
      txt(ctx, `点击回到「${R.hoverCard.name}」`, R.hoverCard.x + CARD_W / 2, R.hoverCard.y - 14, 13, 'rgba(255,255,255,0.7)', { align: 'center' });
    }
  }

  function drawBack(ctx) {
    const hov = G.ui.over(40, 830, 180, 44);
    card(ctx, 40, 830, 180, 44, 22, { lw: hov ? 2 : 1.2 });
    txt(ctx, '← 返回（Esc）', 130, 858, 15, '#ffffff', { align: 'center' });
    if (G.ui.click(40, 830, 180, 44)) G.unvisit();
  }

  function drawLetter(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(5,6,12,0.6)';
    ctx.fillRect(0, 0, 1600, 900);
    card(ctx, 400, 270, 800, 300, 26);
    txt(ctx, `留言.txt · ${G.letter.pct()}%`, 440, 320, 18, 'rgba(220,226,255,0.6)', { w: 600 });
    const txtv = G.letter.view(G.s.msg, '·');
    ctx.font = `400 24px ${FONT}`;
    const lines = U.wrap(ctx, txtv, 720);
    lines.forEach((l, i) => txt(ctx, l, 440, 370 + i * 40, 24, '#ffffff'));
    txt(ctx, '点击任意处关闭', 1160, 545, 13, 'rgba(220,226,255,0.4)', { align: 'right' });
    ctx.restore();
    if (G.input.pressed && !G.input.used) {
      G.input.used = true;
      R.letterOpen = 0;
    }
  }

  function drawCursor(ctx) {
    if (!G.input.inside || G.ui.menuOpen() || G.ui.blocked) return;
    const mx = G.input.mx, my = G.input.my;
    const inF = inField(mx, my) && !R.hoverCard;
    const press = G.input.down && inF && !R.drag;
    const r = spring('cursor', press ? 300 : inF ? 18 : 8, 16);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = press ? 'rgba(200,220,255,0.35)' : 'rgba(255,255,255,0.8)';
    ctx.lineWidth = press ? 1.5 : 1.8;
    ctx.beginPath();
    ctx.arc(mx, my, Math.max(3, r), 0, Math.PI * 2);
    ctx.stroke();
    if (press) {
      const g = ctx.createRadialGradient(mx, my, 0, mx, my, r);
      g.addColorStop(0, 'rgba(160,180,255,0.18)');
      g.addColorStop(1, 'rgba(160,180,255,0)');
      ctx.fillStyle = g;
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(mx, my, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();
  }

  function display() {
    return { bloom: G.m.grad ? 0.5 : 0.4, bloomR: 10, bloomT: 0.66, vig: 0.25, noise: 0.006 };
  }

  // ---------------- 小窗（给 3D 时代当立方体的一面） ----------------
  function renderMini(ctx, x, y, w, h) {
    // 直接把整个现代界面缩小画进去（不画鼠标）
    const blk = G.ui.blocked;
    G.ui.blocked = true;
    const src = render();
    G.ui.blocked = blk;
    ctx.drawImage(src, x, y, w, h);
  }
})();
