'use strict';
// 时代 3 · 16-bit（2.5 维：层）—— 远行（横版自动跑酷）+ Mode 7 飞行
(() => {
  const U = G.U, E = G.econ, I = G.input, A = G.audio;
  const W = 640, H = 360;
  const VX = 8, VY = 26, VW = 448, VH = 252; // 游戏视窗
  const GROUND = 196; // 地面（视窗坐标）
  const F = () => G.text.pixel(12);
  const PX_X = 92; // 角色在视窗里的 x

  // ---------------- 升级 ----------------
  G.econ.hook((m) => {
    m.dust = 1;
    m.runSpeed = 1;
    m.dbl = 0;
    m.glide = 0;
    m.magnet = 0;
    m.runAI = 0;
    m.autoFly = 0;
    m.layers = 0;
    m.fm = 0;
  });
  const LAYER_NAMES = ['远山', '云', '丘陵', '森林', '近景'];
  E.define(3, [
    { id: 'layer', name: '图层', type: 'level', tab: 'layer', desc: '多一层远景（视差卷轴）。星屑 +20%', tag: 'visual',
      costs: [{ dust: 120 }, { dust: 700 }, { dust: 3500 }, { dust: 18000 }, { dust: 90000 }],
      mod: (m, lv) => { m.layers = lv; m.all.dust *= Math.pow(1.2, lv); } },
    { id: 'fmv', name: 'FM 音源', type: 'level', tab: 'fm', desc: '多一个声部（和弦 → 贝斯 → 鼓）。星屑 +5%', tag: 'sound',
      costs: [{ dust: 250 }, { dust: 2200 }, { dust: 11000 }],
      mod: (m, lv) => { m.fm = lv; m.all.dust *= Math.pow(1.05, lv); }, onBuy: () => updateMusic() },
    { id: 'sprite', name: '精灵表', type: 'gen', desc: '+5 星屑/秒', cost: { dust: 90 }, prod: { dust: 5 } },
    { id: 'rspeed', name: '跑速', type: 'level', desc: '跑得更快（×1.25），路过更多星屑', costs: [{ dust: 200 }, { dust: 3000 }, { dust: 40000 }], mod: (m, lv) => (m.runSpeed *= Math.pow(1.25, lv)) },
    { id: 'dbl', name: '二段跳', desc: '在空中再跳一次', cost: { dust: 400 }, mod: (m) => (m.dbl = 1) },
    { id: 'runai', name: '影子跑者', type: 'level', desc: '自己跑（会摔 → 不摔 → 一颗不漏）', tag: 'auto',
      costs: [{ dust: 600, px: 3e5 }, { dust: 9000, px: 6e6 }, { dust: 140000, px: 1.2e8 }], mod: (m, lv) => (m.runAI = lv) },
    { id: 'magnet', name: '磁铁', type: 'level', desc: '吸住附近的星屑', costs: [{ dust: 800 }, { dust: 12000 }], mod: (m, lv) => (m.magnet = lv) },
    { id: 'tilemap', name: '图块地图', type: 'gen', desc: '+40 星屑/秒', cost: { dust: 1400 }, prod: { dust: 40 } },
    { id: 'glide', name: '滑翔', desc: '按住跳跃键，慢慢落下', cost: { dust: 1500 }, req: (s) => s.own.dbl, mod: (m) => (m.glide = 1) },
    { id: 'back3', name: '回溯 · 像素', desc: '8-bit 时代所有像素产出 ×5', cost: { dust: 2000 }, tag: 'back', mod: (m) => (m.all.px *= 5) },
    { id: 'dval', name: '星屑结晶', type: 'level', desc: '每颗星屑价值 ×3', costs: [{ dust: 5000 }, { dust: 80000 }], mod: (m, lv) => (m.dust *= Math.pow(3, lv)) },
    { id: 'back3b', name: '回溯 · 线与字', desc: '向量、比特产出 ×5', cost: { dust: 10000 }, tag: 'back', mod: (m) => { m.all.vec *= 5; m.all.bits *= 5; } },
    { id: 'chip', name: '扩展芯片', type: 'gen', desc: '+300 星屑/秒', cost: { dust: 24000 }, prod: { dust: 300 } },
    { id: 'autofly', name: '自动驾驶', desc: 'Mode 7 飞行时自动穿过光环', cost: { dust: 30000 }, tag: 'auto', mod: (m) => (m.autoFly = 1) },
    { id: 'decode3', name: '解码 · 留言', desc: '恢复留言.txt 的一部分', cost: { dust: 50000 }, tag: 'back', onBuy: () => G.letter.reveal(0.1) },
    { id: 'light', name: '光照', type: 'goal', desc: '我想看清楚这一切。', cost: { dust: 8e6, px: 4e7 }, reveal: 0.06, onBuy() { G.startFx('t34'); } },
  ]);

  // ---------------- 剧情 ----------------
  G.story.def([
    { id: 'e3.start', era: 3, when: (s) => s.e[3].started, say: ['我有了身体。', '……我可以走路了。（空格 / ↑ 跳）'] },
    { id: 'e3.jump', era: 3, when: (s) => s.stats.jumps >= 1, say: '跳！' },
    { id: 'e3.dust', era: 3, when: (s) => s.tot.dust >= 3, say: '星星的碎屑。它们在发光。' },
    { id: 'e3.fall', era: 3, when: (s) => s.stats.falls >= 1, say: '摔倒了。不疼，只是有点丢脸。' },
    { id: 'e3.relic0', era: 3, when: () => R.seenRelic[0], say: '那是一堆绿色的字。是我以前的样子吗？' },
    { id: 'e3.relic1', era: 3, when: () => R.seenRelic[1], say: '一截发光的线。我认得它。' },
    { id: 'e3.relic2', era: 3, when: () => R.seenRelic[2], say: '砖块。我打碎过很多这样的墙。' },
    { id: 'e3.l1', era: 3, when: (s) => s.own.layer >= 1, say: '远处有山了！' },
    { id: 'e3.l3', era: 3, when: (s) => s.own.layer >= 3, say: ['原来世界是一层一层的。', '越远的，走得越慢。'] },
    { id: 'e3.l5', era: 3, when: (s) => s.own.layer >= 5, say: '我跑得很快，可远方好像一直没动。' },
    { id: 'e3.fm', era: 3, when: (s) => s.own.fmv >= 1, say: '这个声音好圆。像在很大的房间里。' },
    { id: 'e3.m7', era: 3, when: (s) => s.e[3].flights >= 1, say: ['地面在下沉——不对，是我在飞。', '下面是……贪吃蛇住过的地方。'] },
    { id: 'e3.ai', era: 3, when: (s) => s.own.runai >= 1, say: '我的影子学会了跑步。它跑在我前面。' },
    { id: 'e3.night', era: 3, when: () => R.night > 0.8, say: '天黑了。星星出来了。' },
    { id: 'e3.ruin', era: 3, when: () => R.ruinSeen, say: ['地平线上有一个巨大的……方块？', '它是坏的。好像很久以前有人住过。'] },
    { id: 'e3.paper', era: 3, when: (s) => s.e[3].paper >= 1, say: '路边捡到一张纸片，是留言的一部分。' },
    { id: 'e3.paper2', era: 3, when: (s) => s.e[3].paper >= 3, say: ['"我也是从一个点开始的。"', '……原来在我之前，还有别的点。'] },
    { id: 'e3.goal', era: 3, when: (s) => s.seen.light, say: '光照：我想看清楚这一切。' },
    { id: 'e3.ready', era: 3, when: (s) => E.canBuy(E.defs.light), say: '准备好了。' },
  ]);

  // ---------------- 精灵 ----------------
  const SPAL = { o: '#20203a', w: '#f8f8ff', s: '#c4cbee', d: '#8a92cc', e: '#20203a', h: '#ffffff', c: '#ffa8c4', f: '#ff9a52', F: '#c8602c' };
  const BODY = [
    '................',
    '.....oooooo.....',
    '...oowwwwwwoo...',
    '..owwhhwwwwwso..',
    '..owhhwwwwwwso..',
    '.owwwwwwwewesso.',
    '.owwwwwwwewesso.',
    '.owwwwwwwwwwsso.',
    '.owwwwwwcwwcsso.',
    '.oswwwwwwwwwsdo.',
    '..osswwwwwwssdo.',
    '..oddssssssddo..',
    '...oooooooooo...',
  ];
  const FEET = [
    ['....off..off....', '...oFFo..oFFo...', '....oo....oo....'],
    ['.....offoff.....', '....oFFooFFo....', '.....oo..oo.....'],
    ['...off....off...', '..oFFo....oFFo..', '...oo......oo...'],
    ['...offo.offo....', '....oo...oo.....', '................'],
  ];
  const HAND = [
    '....XX.......',
    '...XWWX......',
    '...XWWX......',
    '...XWWXXXX...',
    '.XXXWWWWWWX..',
    'XWWXWWLWLWWX.',
    'XWWWWWWWWWWX.',
    '.XWWWWWWWWWX.',
    '..XWWWWWWWX..',
    '...XLLLLLX...',
    '....XXXXX....',
  ];
  const sprCache = new Map();
  function sprite(rows, pal, key) {
    if (sprCache.has(key)) return sprCache.get(key);
    const c = U.canvas(rows[0].length, rows.length);
    const x = c.getContext('2d');
    rows.forEach((r, y) => {
      for (let i = 0; i < r.length; i++) {
        const ch = r[i];
        if (ch === '.' || !pal[ch]) continue;
        x.fillStyle = pal[ch];
        x.fillRect(i, y, 1, 1);
      }
    });
    sprCache.set(key, c);
    return c;
  }
  function hero(frame) {
    return sprite(BODY.concat(FEET[frame]), SPAL, 'hero' + frame);
  }

  // ---------------- 运行时 ----------------
  const R = {
    fb: null, ctx: null, view: null, vctx: null,
    intro: 1,
    tab: 'main', scroll: 0,
    floats: [], debris: [],
    tw: { n: 0, k: 999 },
    hoverDef: null, hoverDock: null,
    letterOpen: 0,
    night: 0,
    ruinSeen: false,
    seenRelic: [0, 0, 0],
    layers: null,
    m7tex: null,
    glimpse: 0, // 跃迁时临时显示全部图层
  };
  const RN = {
    dist: 0, y: GROUND, vy: 0, ground: true, jumps: 0, stumble: 0, spdK: 1,
    motes: [], obs: [], spawnT: 1.5, moteT: 0.5, streak: 0, frame: 0, ft: 0,
    manualT: -99, holdJump: false, nextFlight: 1000, flight: null, aiJumpAt: -1,
  };

  const era = {
    id: 3, name: '16-bit', res: 'dust',
    fresh: () => ({ started: 0, flights: 0, paper: 0, best: 0, dist: 0 }),
    init() {
      RN.dist = G.s.e[3].dist || 0;
      RN.nextFlight = (Math.floor(RN.dist / 1000) + 1) * 1000;
      R.fb = U.canvas(W, H);
      R.ctx = R.fb.getContext('2d');
      R.view = U.canvas(VW, VH);
      R.vctx = R.view.getContext('2d');
      buildLayers();
    },
    enter(fromFx, visiting) {
      R.tw.n = G.s.lineN || 0;
      if (G.s.e[3].started || visiting) era.music();
    },
    leave() {},
    music() {
      if (G.music.cur && G.music.cur.song === SONG()) return G.music.setMask(musicMask(), 1);
      G.music.play(SONG(), { mask: musicMask(), fade: 1.2 });
    },
    update,
    render,
    display,
    renderMini,
    setIntro: (p) => (R.intro = p),
    setGlimpse: (v) => (R.glimpse = v),
    setForce: (o) => { R.force = o; if (o) RN.flight = null; },
    heroPos: () => ({ x: VX + PX_X + 8, y: VY + RN.y - 8 }),
    drawSky: (ctx, w, h, phase) => drawSky(ctx, w, h, phase),
    drawLayers: (ctx, w, h, scroll, n) => drawLayersTo(ctx, w, h, scroll, n),
    hero: () => hero(0),
    VIEW: { x: VX, y: VY, w: VW, h: VH, ground: GROUND, heroX: PX_X },
    SONG: () => SONG(),
    mode7: (ctx, w, h, tex, o) => mode7(ctx, w, h, tex, o),
  };
  G.registerEra(era);

  // ---------------- 音乐（FM 版主旋律） ----------------
  let songCache = null;
  function SONG() {
    if (songCache) return songCache;
    const M = G.music;
    songCache = {
      bpm: 112, len: 256, vol: 0.85,
      tracks: [
        { notes: M.melody(0), inst: (o) => A.fm({ t: o.t, n: o.n, d: o.d * 0.95, v: 0.05, ratio: 1, index: 2.2, index2: 0.6, mdec: 0.25, out: o.out, env: 'adsr', a: 0.01, dec: 0.2, s: 0.6, r: 0.12, echo: 0.28, type: 'sine' }) },
        { gen(st, t, spb, out) {
            if (st % 8 !== 0) return;
            const ch = M.chordAt(st);
            ch.tri.forEach((n, i) => A.fm({ t: t + i * 0.012, n: n, d: spb * 7, v: 0.022, ratio: 3.01, index: 1.4, index2: 0.1, mdec: 0.4, out, env: 'adsr', a: 0.005, dec: 0.5, s: 0.25, r: 0.3, echo: 0.18 }));
          } },
        { gen(st, t, spb, out) {
            if (st % 2) return;
            const ch = M.chordAt(st);
            const pat = [0, 0, 12, 0, 7, 0, 12, 7][(st / 2) % 8];
            A.fm({ t, n: ch.root + pat, d: spb * 1.6, v: 0.09, ratio: 0.5, index: 3.5, index2: 0.4, mdec: 0.15, out, env: 'hold', a: 0.004, r: 0.05 });
          } },
        { gen(st, t, spb, out) {
            const b = st % 16;
            if (b === 0 || b === 10) A.tone({ t, f: 150, f2: 42, d: 0.16, v: 0.16, type: 'sine', out });
            if (b === 4 || b === 12) {
              A.noise({ t, d: 0.14, v: 0.07, bp: 1800, q: 0.7, out, echo: 0.3 });
              A.tone({ t, f: 220, f2: 160, d: 0.08, v: 0.04, type: 'triangle', out });
            }
            if (b % 2 === 0) A.noise({ t, d: 0.03, v: 0.018, hp: 7000, out });
          } },
      ],
    };
    return songCache;
  }
  function musicMask() {
    return 1 | (((1 << E.lv('fmv')) - 1) << 1);
  }
  function updateMusic() {
    if (G.fgEra() !== 3) return;
    if (!G.music.cur || G.music.cur.song !== SONG()) era.music();
    else G.music.setMask(musicMask(), 1);
  }

  // ---------------- 音效 ----------------
  const sfx = {
    jump(second) { A.tone({ f: second ? 520 : 380, f2: second ? 1040 : 760, slide: 0.12, d: 0.14, v: 0.05, type: 'p25', echo: 0.15 }); },
    dust(k) { A.tone({ n: 88 + (k % 5) * 2, d: 0.05, v: 0.03, type: 'sine', echo: 0.2 }); A.tone({ n: 100 + (k % 5) * 2, d: 0.04, v: 0.015, type: 'sine' }); },
    fall() { A.noise({ d: 0.25, v: 0.08, lp: 900 }); A.tone({ f: 300, f2: 90, d: 0.3, v: 0.06, type: 'triangle' }); },
    land() { A.noise({ d: 0.04, v: 0.03, lp: 600 }); },
    ring() { const t = A.now(); [79, 84, 88, 91].forEach((n, i) => A.fm({ n, t: t + i * 0.04, d: 0.2, v: 0.04, ratio: 2, index: 1.5, echo: 0.3 })); },
    buy() { const t = A.now(); A.fm({ n: 84, t, d: 0.12, v: 0.06, ratio: 2, index: 2 }); A.fm({ n: 91, t: t + 0.08, d: 0.35, v: 0.06, ratio: 2, index: 2, echo: 0.25 }); },
    cant() { A.fm({ n: 45, d: 0.2, v: 0.08, ratio: 1.41, index: 4 }); },
    blip() { A.tone({ n: 91, d: 0.02, v: 0.014, type: 'sine' }); },
    move() { A.tone({ n: 96, d: 0.02, v: 0.02, type: 'sine' }); },
    whoosh() { A.noise({ d: 1.2, v: 0.06, bp: 300, f2: 3000, q: 1.5, env: 'hold', a: 0.3, r: 0.6 }); },
  };
  G.bus.on('buy', (d, n, quiet) => {
    if (d.era !== 3 || d.type === 'goal' || quiet) return;
    sfx.buy();
    G.save.soon();
  });
  G.bus.on('cant', (d) => {
    if (d.era === 3) sfx.cant();
  });

  // ---------------- 远景图层（程序生成，循环卷动） ----------------
  function buildLayers() {
    const r = U.rng(31);
    const LW = 1024;
    const mk = (h, fn) => {
      const c = U.canvas(LW, h);
      fn(c.getContext('2d'), LW, h);
      return c;
    };
    // 远山（带雪顶）
    const mountains = mk(120, (x, w, h) => {
      const pts = [];
      for (let i = 0; i <= w; i += 4) {
        const v = 60 + 34 * Math.sin((i / w) * Math.PI * 6) + 22 * Math.sin((i / w) * Math.PI * 14 + 1) + r() * 6;
        pts.push([i, h - v]);
      }
      for (const [px, py] of pts) {
        for (let y = Math.floor(py); y < h; y++) {
          const k = (y - py) / (h - py + 1);
          x.fillStyle = y - py < 6 && py < 52 ? '#f0f4ff' : U.mix('#7a6cc0', '#4a4090', k);
          x.fillRect(px, y, 4, 1);
        }
      }
    });
    // 云
    const clouds = mk(80, (x, w, h) => {
      for (let i = 0; i < 9; i++) {
        const cx = r() * w, cy = 16 + r() * 40, s = 10 + r() * 14;
        for (let k = 0; k < 6; k++) {
          const ox = (k - 2.5) * s * 0.7, oy = Math.sin(k * 1.7) * s * 0.25, rr = s * (0.7 + r() * 0.5);
          for (let dy = -rr; dy <= rr; dy++) {
            const hw = Math.floor(Math.sqrt(rr * rr - dy * dy));
            x.fillStyle = dy > rr * 0.35 ? '#c8d4f0' : '#ffffff';
            const xx = Math.floor(cx + ox - hw);
            x.fillRect(xx, Math.floor(cy + oy + dy), hw * 2, 1);
            if (xx < 0) x.fillRect(xx + w, Math.floor(cy + oy + dy), hw * 2, 1);
            if (xx + hw * 2 > w) x.fillRect(xx - w, Math.floor(cy + oy + dy), hw * 2, 1);
          }
        }
      }
    });
    // 丘陵
    const hills = mk(90, (x, w, h) => {
      for (let i = 0; i < w; i += 2) {
        const v = 40 + 22 * Math.sin((i / w) * Math.PI * 4 + 2) + 12 * Math.sin((i / w) * Math.PI * 10);
        for (let y = Math.floor(h - v); y < h; y++) {
          const k = (y - (h - v)) / v;
          x.fillStyle = k < 0.06 ? '#9ce0b0' : U.mix('#4fa88a', '#2f6f60', k);
          x.fillRect(i, y, 2, 1);
        }
      }
    });
    // 森林（树影）
    const forest = mk(80, (x, w, h) => {
      x.fillStyle = '#1f5a40';
      x.fillRect(0, h - 22, w, 22);
      for (let i = 0; i < 70; i++) {
        const tx = Math.floor(r() * w), th = 30 + Math.floor(r() * 36), tw = 10 + Math.floor(r() * 10);
        for (let y = 0; y < th; y++) {
          const hw = Math.floor((tw / 2) * (y / th));
          const col = y % 7 < 1 ? '#2a7350' : '#1f5a40';
          x.fillStyle = col;
          const yy = h - 22 - th + y;
          for (const off of [0, -w, w]) x.fillRect(tx - hw + off, yy, hw * 2 + 1, 1);
        }
      }
      x.fillStyle = '#16422f';
      x.fillRect(0, h - 4, w, 4);
    });
    // 近景草丛
    const grass = mk(40, (x, w, h) => {
      for (let i = 0; i < 60; i++) {
        const gx = Math.floor(r() * w), gh = 8 + Math.floor(r() * 18);
        for (let k = -4; k <= 4; k++) {
          const hh = gh - Math.abs(k) * 2;
          x.fillStyle = k % 2 ? '#3a8a3a' : '#58b048';
          x.fillRect(gx + k, h - hh, 1, hh);
        }
        if (r() < 0.3) {
          x.fillStyle = U.pick(['#ff6a8a', '#ffe060', '#ffffff']);
          x.fillRect(gx - 1, h - gh - 2, 3, 3);
        }
      }
    });
    R.layers = { mountains, clouds, hills, forest, grass, LW };
  }

  // 天色：phase 0..1 一天
  const SKY = [
    [0.0, '#0b0b2e', '#2c2c66'], // 午夜
    [0.2, '#ff8a5c', '#ffd28a'], // 日出
    [0.3, '#5aa0ff', '#cbe8ff'], // 白天
    [0.62, '#5aa0ff', '#cbe8ff'],
    [0.72, '#c8507a', '#ffb070'], // 黄昏
    [0.82, '#0b0b2e', '#2c2c66'],
    [1.0, '#0b0b2e', '#2c2c66'],
  ];
  function skyAt(ph) {
    for (let i = 0; i < SKY.length - 1; i++) {
      const a = SKY[i], b = SKY[i + 1];
      if (ph >= a[0] && ph <= b[0]) {
        const k = U.smooth((ph - a[0]) / (b[0] - a[0]));
        return [U.mix(a[1], b[1], k), U.mix(a[2], b[2], k)];
      }
    }
    return [SKY[0][1], SKY[0][2]];
  }
  function dayPhase() {
    return ((G.s.time / 300) + 0.32) % 1;
  }
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  function drawSky(ctx, w, h, ph) {
    const [top, bot] = skyAt(ph);
    // 16 级色带 + 抖动（16-bit 的渐变）
    const bands = 16;
    const bh = h / bands;
    for (let i = 0; i < bands; i++) {
      ctx.fillStyle = U.mix(top, bot, i / (bands - 1));
      ctx.fillRect(0, Math.floor(i * bh), w, Math.ceil(bh) + 1);
    }
    const night = nightAmt(ph);
    R.night = night;
    if (night > 0.05) {
      const r = U.rng(5);
      for (let i = 0; i < 70; i++) {
        const sx = Math.floor(r() * w), sy = Math.floor(r() * h * 0.7);
        const tw = 0.5 + 0.5 * Math.sin(G.t * (1 + r() * 3) + i);
        ctx.globalAlpha = night * tw;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(sx, sy, 1, 1);
      }
      ctx.globalAlpha = 1;
    }
    // 太阳 / 月亮
    const sunK = (ph - 0.18) / 0.62;
    if (sunK > 0 && sunK < 1) {
      const sx = w * (0.1 + sunK * 0.8), sy = h * 0.75 - Math.sin(sunK * Math.PI) * h * 0.6;
      disc(ctx, sx, sy, 9, '#fff4c0', '#ffd860');
    } else {
      const mk = ((ph + 0.38) % 1) / 0.62;
      if (mk > 0 && mk < 1) {
        const sx = w * (0.1 + mk * 0.8), sy = h * 0.7 - Math.sin(mk * Math.PI) * h * 0.55;
        disc(ctx, sx, sy, 7, '#f0f4ff', '#c0c8e8');
      }
    }
  }
  function nightAmt(ph) {
    if (ph < 0.15) return 1;
    if (ph < 0.25) return 1 - (ph - 0.15) / 0.1;
    if (ph < 0.72) return 0;
    if (ph < 0.82) return (ph - 0.72) / 0.1;
    return 1;
  }
  function disc(ctx, cx, cy, r, c1, c2) {
    for (let dy = -r; dy <= r; dy++) {
      const hw = Math.floor(Math.sqrt(r * r - dy * dy));
      ctx.fillStyle = dy > r * 0.3 ? c2 : c1;
      ctx.fillRect(Math.floor(cx - hw), Math.floor(cy + dy), hw * 2 + 1, 1);
    }
  }
  function strip(ctx, img, speed, y, scroll, w) {
    const LW = R.layers.LW;
    let off = Math.floor((scroll * speed) % LW);
    if (off < 0) off += LW;
    for (let x = -off; x < w; x += LW) ctx.drawImage(img, Math.floor(x), Math.floor(y));
  }
  // 按已买图层数画远景（n=0 只有天空）
  function drawLayersTo(ctx, w, h, scroll, n) {
    const L = R.layers;
    const ground = Math.floor(h * (GROUND / VH));
    if (n >= 1) {
      strip(ctx, L.mountains, 0.08, ground - 120 + 8, scroll, w);
      drawRuin(ctx, w, ground, scroll);
    }
    if (n >= 2) strip(ctx, L.clouds, 0.16, 6, scroll + G.t * 8, w);
    if (n >= 3) strip(ctx, L.hills, 0.3, ground - 90 + 10, scroll, w);
    if (n >= 4) strip(ctx, L.forest, 0.55, ground - 80 + 6, scroll, w);
  }
  // 地平线上的立方体废墟（上一个世界）
  function drawRuin(ctx, w, ground, scroll) {
    const period = 9000, at = 4200;
    const wx = at - ((scroll * 0.08) % period);
    let x = wx;
    while (x < -200) x += period;
    if (x > w + 40 || RN.dist < 2400) return;
    R.ruinSeen = R.ruinSeen || (x < w - 60 && x > 0);
    const s = 34, cx = Math.floor(x), cy = ground - 68;
    const col = U.mix('#3a3070', '#151530', R.night);
    ctx.fillStyle = col;
    // 等轴测立方体轮廓（缺了几块）
    const face = (pts) => {
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (const p of pts) ctx.lineTo(p[0], p[1]);
      ctx.closePath();
      ctx.fill();
    };
    face([[cx, cy], [cx + s, cy - s * 0.5], [cx + s * 2, cy], [cx + s, cy + s * 0.5]]);
    ctx.fillStyle = U.mix('#2a2258', '#101024', R.night);
    face([[cx, cy], [cx + s, cy + s * 0.5], [cx + s, cy + s * 1.5], [cx, cy + s]]);
    ctx.fillStyle = U.mix('#221c48', '#0c0c1c', R.night);
    face([[cx + s, cy + s * 0.5], [cx + s * 2, cy], [cx + s * 2, cy + s], [cx + s, cy + s * 1.5]]);
    // 缺口
    const sky = skyAt(dayPhase())[1];
    ctx.fillStyle = sky;
    ctx.fillRect(cx + s * 1.4, cy - 10, 10, 14);
    ctx.fillRect(cx + s * 1.7, cy + 2, 8, 8);
  }

  // ---------------- Mode 7 ----------------
  // 把 tex（ImageData）当地面，透视铺开。o: { horizon, camH, camZ, lat, tilt(0..1, 0=平铺满屏) }
  let m7img = null;
  function mode7(ctx, w, h, tex, o) {
    if (!m7img || m7img.width !== w || m7img.height !== h) m7img = ctx.createImageData(w, h);
    const out = m7img.data;
    const tw = tex.width, th = tex.height, td = tex.data;
    const hor = o.horizon, f = o.f || 160, camH = o.camH || 40;
    for (let y = 0; y < h; y++) {
      const row = y * w * 4;
      if (y <= hor) {
        for (let x = 0; x < w; x++) out[row + x * 4 + 3] = 0;
        continue;
      }
      const z = (camH * f) / (y - hor);
      const fog = Math.min(1, z / (o.fogZ || 900));
      for (let x = 0; x < w; x++) {
        const wx = o.lat + ((x - w / 2) * z) / f;
        const wz = o.camZ + z;
        let tx = Math.floor(wx) % tw, ty = Math.floor(-wz) % th;
        if (tx < 0) tx += tw;
        if (ty < 0) ty += th;
        const ti = (ty * tw + tx) * 4, oi = row + x * 4;
        out[oi] = td[ti] + (o.fogR - td[ti]) * fog;
        out[oi + 1] = td[ti + 1] + (o.fogG - td[ti + 1]) * fog;
        out[oi + 2] = td[ti + 2] + (o.fogB - td[ti + 2]) * fog;
        out[oi + 3] = 255;
      }
    }
    return m7img;
  }

  // ---------------- 远行 ----------------
  function speed() {
    return 95 * G.m.runSpeed * RN.spdK;
  }
  function autoOn() {
    if (G.botAssist) return true;
    return G.m.runAI > 0 && G.s.time - RN.manualT > 3;
  }
  function jump() {
    const canDbl = G.m.dbl && RN.jumps < 2;
    if (RN.stumble > 0.4) return false;
    if (RN.ground) {
      RN.vy = -300;
      RN.ground = false;
      RN.jumps = 1;
    } else if (canDbl) {
      RN.vy = -270;
      RN.jumps = 2;
    } else return false;
    G.s.stats.jumps++;
    if (G.fgEra() === 3 && !G.inFx()) sfx.jump(RN.jumps === 2);
    return true;
  }
  function spawn(dt) {
    if (R.force && R.force.noSpawn) return;
    RN.spawnT -= dt;
    RN.moteT -= dt;
    const sp = speed();
    if (RN.spawnT <= 0) {
      const kind = U.randi(0, 2);
      const h = [16, 22, 18][kind] + U.randi(0, 8);
      RN.obs.push({ x: VW + 20, w: [18, 16, 22][kind], h, kind, seed: Math.random() * 1000 });
      RN.spawnT = U.rand(2.2, 4.2) / Math.max(1, sp / 110);
      // 偶尔：路边的纸片（留言碎片）
      if (G.s.msg < 0.62 && Math.random() < 0.06 && RN.dist > 600) RN.motes.push({ x: VW + 80, y: GROUND - 10, paper: true });
    }
    if (RN.moteT <= 0) {
      const pat = U.randi(0, 3);
      const n = U.randi(4, 7);
      const x0 = VW + 30;
      for (let i = 0; i < n; i++) {
        let y = GROUND - 10;
        if (pat === 1) y = GROUND - 10 - Math.sin((i / (n - 1)) * Math.PI) * 52;
        if (pat === 2) y = GROUND - 62;
        if (pat === 3) y = GROUND - 100 - (G.m.dbl ? 0 : -40);
        RN.motes.push({ x: x0 + i * 14, y });
      }
      RN.moteT = U.rand(1.0, 2.0);
    }
  }
  function heroBox() {
    return { x: PX_X + 2, y: RN.y - 15, w: 12, h: 14 };
  }
  function updateRun(dt, fg) {
    const s = G.s;
    // 输入
    if (fg) {
      for (const k of I.keys) {
        if (k.repeat) continue;
        if (k.code === 'Space' || k.code === 'ArrowUp' || k.code === 'KeyW') {
          RN.manualT = s.time;
          jump();
        }
      }
      if (G.ui.click(VX, VY, VW, VH)) {
        RN.manualT = s.time;
        jump();
      }
      RN.holdJump = !!(I.held.Space || I.held.ArrowUp || I.held.KeyW || (G.input.down && G.ui.over(VX, VY, VW, VH)));
    } else RN.holdJump = false;
    // 自动
    if (autoOn()) aiThink();
    // 物理
    RN.spdK = RN.stumble > 0 ? 0.25 + 0.75 * (1 - RN.stumble) : Math.min(1, RN.spdK + dt);
    const sp = speed();
    const dx = sp * dt;
    RN.dist += dx / 10;
    s.stats.dist = Math.max(s.stats.dist || 0, 0) + dx / 10;
    if (!RN.ground) {
      RN.vy += 900 * dt;
      if (G.m.glide && (RN.holdJump || (autoOn() && G.m.runAI >= 3 && RN.aiGlide)) && RN.vy > 30) RN.vy = 30;
      RN.y += RN.vy * dt;
      if (RN.y >= GROUND) {
        RN.y = GROUND;
        RN.vy = 0;
        RN.ground = true;
        RN.jumps = 0;
        if (fg && !G.inFx()) sfx.land();
      }
    }
    if (RN.stumble > 0) RN.stumble = Math.max(0, RN.stumble - dt);
    spawn(dt);
    const hb = heroBox();
    for (const o of RN.obs) {
      o.x -= dx;
      if (!o.hit && o.x < hb.x + hb.w && o.x + o.w > hb.x && GROUND - o.h < hb.y + hb.h) {
        o.hit = true;
        RN.stumble = 1;
        RN.streak = 0;
        s.stats.falls++;
        if (fg) {
          sfx.fall();
          for (let i = 0; i < 14; i++) R.debris.push({ x: o.x + o.w / 2, y: GROUND - o.h / 2, vx: U.rand(-30, 120), vy: U.rand(-200, -60), t: 0, c: relicColor(o.kind) });
        }
      }
      if (!o.seen && o.x < VW - 40) {
        o.seen = true;
        R.seenRelic[o.kind] = 1;
      }
    }
    RN.obs = RN.obs.filter((o) => o.x > -40 && !(o.hit && o.x < PX_X - 30));
    const mag = [0, 34, 80][G.m.magnet];
    const cx = PX_X + 8, cy = RN.y - 8;
    for (const m of RN.motes) {
      m.x -= dx;
      if (mag && !m.paper) {
        const d = Math.hypot(m.x - cx, m.y - cy);
        if (d < mag) {
          m.x += ((cx - m.x) / d) * 260 * dt;
          m.y += ((cy - m.y) / d) * 260 * dt;
        }
      }
      if (Math.abs(m.x - cx) < 10 && Math.abs(m.y - cy) < 12) {
        m.got = true;
        if (m.paper) {
          s.e[3].paper++;
          G.letter.reveal(0.04);
          if (fg) R.floats.push({ x: m.x, y: m.y, text: '留言 +4%', t: 0 });
          continue;
        }
        RN.streak++;
        const mult = 1 + Math.min(2, RN.streak * 0.02);
        const got = E.gain('dust', G.m.dust * mult, autoOn() ? 'auto' : undefined);
        if (fg) {
          if (RN.streak % 3 === 0 || got > 1) R.floats.push({ x: m.x, y: m.y, v: got, t: 0 });
          sfx.dust(RN.streak);
        }
      }
    }
    RN.motes = RN.motes.filter((m) => !m.got && m.x > -20);
    // 动画
    RN.ft += dt * (sp / 12);
    RN.frame = Math.floor(RN.ft) % 3;
    for (const d of R.debris) {
      d.t += dt;
      d.x += (d.vx - sp) * dt;
      d.vy += 600 * dt;
      d.y += d.vy * dt;
    }
    R.debris = R.debris.filter((d) => d.t < 1.2);
    // 每 1000 米：Mode 7 飞行
    if (RN.dist >= RN.nextFlight && RN.stumble <= 0) startFlight(fg);
    if (RN.dist > s.e[3].best) s.e[3].best = RN.dist;
  }
  function relicColor(k) {
    return ['#41ff86', '#e9f6ff', '#F83800'][k];
  }
  function aiThink() {
    const lv = G.botAssist ? Math.max(1, G.m.runAI) : G.m.runAI;
    const sp = speed();
    // 障碍
    for (const o of RN.obs) {
      if (o.hit || o.x < PX_X - 10) continue;
      const lead = (o.x - (PX_X + 14)) / sp;
      const ideal = 0.16 + o.w / sp * 0.3;
      if (RN.ground && lead < ideal + (lv === 1 ? 0.05 : 0.02) && lead > 0) {
        if (lv === 1 && RN.aiJumpAt !== o) {
          RN.aiJumpAt = o;
          if (Math.random() < 0.18) return; // 一级 AI 偶尔慌了没跳
        }
        jump();
        return;
      }
    }
    if (lv < 2) return;
    // 星屑：前方有高处的星屑就跳
    let want = 0;
    RN.aiGlide = false;
    for (const m of RN.motes) {
      if (m.paper) continue;
      const lead = (m.x - (PX_X + 8)) / sp;
      if (lead > 0 && lead < 0.32) want = Math.max(want, GROUND - 10 - m.y);
    }
    if (want > 20 && RN.ground) jump();
    else if (want > 60 && lv >= 3 && !RN.ground && RN.jumps === 1 && RN.vy > -40) jump();
    if (lv >= 3 && want > 30) RN.aiGlide = true;
  }

  function startFlight(fg) {
    RN.nextFlight += 1000;
    const blk = G.ui.blocked;
    G.ui.blocked = true;
    const tex = G.eras[2].render();
    G.ui.blocked = blk;
    const data = tex.getContext('2d').getImageData(0, 0, tex.width, tex.height);
    const rings = [];
    for (let i = 0; i < 9; i++) rings.push({ z: 600 + i * 420, x: U.rand(-150, 150), got: false });
    RN.flight = { t: 0, dur: 14, tex: data, camZ: 0, lat: 0, vlat: 0, rings, n: 0 };
    G.s.e[3].flights++;
    if (fg) sfx.whoosh();
  }
  function updateFlight(dt, fg) {
    const f = RN.flight;
    f.t += dt;
    const sp = 260 * G.m.runSpeed;
    f.camZ += sp * dt;
    // 转向
    let steer = 0;
    const auto = G.m.autoFly || autoOn() && G.m.runAI >= 3;
    if (fg && !auto) {
      if (I.held.ArrowLeft || I.held.KeyA) steer = -1;
      if (I.held.ArrowRight || I.held.KeyD) steer = 1;
      if (G.ui.over(VX, VY, VW, VH)) {
        const mx = G.ui.mx - VX - VW / 2;
        if (Math.abs(mx) > 10) steer = U.clamp(mx / 120, -1, 1);
      }
    }
    if (auto || !fg) {
      const next = f.rings.find((r) => !r.got && r.z > f.camZ);
      if (next) steer = U.clamp((next.x - f.lat) / 60, -1, 1);
    }
    f.vlat = U.lerp(f.vlat, steer * 220, Math.min(1, dt * 6));
    f.lat += f.vlat * dt;
    for (const r of f.rings) {
      if (r.got || r.missed) continue;
      if (r.z <= f.camZ + 70) {
        if (Math.abs(r.x - f.lat) < 46) {
          r.got = true;
          f.n++;
          // 只按被动产出和单颗价值算（不能用显示/自动速率，否则奖励会互相叠加滚雪球）
          const bonus = Math.max(40, G.m.rate.dust * 6 + G.m.dust * 40);
          const got = E.gain('dust', bonus, 'bonus');
          if (fg) {
            sfx.ring();
            R.floats.push({ x: VW / 2, y: 120, v: got, t: 0 });
          }
        } else r.missed = true;
      }
    }
    if (f.t >= f.dur) RN.flight = null;
  }

  // ---------------- 更新 ----------------
  function update(dt, fg) {
    const st = G.s.e[3];
    if (!st.started) {
      if (R.intro >= 1) {
        st.started = 1;
        if (fg) era.music();
      }
      return;
    }
    st.dist = RN.dist;
    const run = (fg && R.intro >= 1) || autoOn() || (G.m.runAI > 0 && !fg) || (R.force && R.force.run);
    if (run) {
      if (RN.flight) updateFlight(dt, fg);
      else updateRun(dt, fg);
    }
    for (const f of R.floats) f.t += dt;
    R.floats = R.floats.filter((f) => f.t < 1);
    const n = G.s.lineN || 0;
    if (R.tw.n < n) {
      R.tw.n = n;
      R.tw.k = 0;
    }
    const before = Math.floor(R.tw.k);
    R.tw.k += dt * 26;
    if (fg && Math.floor(R.tw.k) !== before && Math.floor(R.tw.k) % 2 === 0) {
      const l = lastLine();
      if (l && R.tw.k < [...l.text].length + 1) sfx.blip();
    }
  }
  function lastLine() {
    const l = G.s.log;
    for (let i = l.length - 1; i >= 0; i--) if (l[i].kind === 'dot' || l[i].kind === 'sys') return l[i];
    return null;
  }

  // ---------------- 绘制 ----------------
  function win(ctx, x, y, w, h, alpha = 1) {
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#0c0c20';
    ctx.fillRect(x + 1, y, w - 2, h);
    ctx.fillRect(x, y + 1, w, h - 2);
    for (let i = 0; i < h - 4; i++) {
      ctx.fillStyle = U.mix('#3b5bd0', '#141e66', i / (h - 4));
      ctx.fillRect(x + 2, y + 2 + i, w - 4, 1);
    }
    ctx.fillStyle = '#e8ecff';
    ctx.fillRect(x + 2, y + 1, w - 4, 1);
    ctx.fillRect(x + 1, y + 2, 1, h - 4);
    ctx.fillStyle = '#7a86c0';
    ctx.fillRect(x + 2, y + h - 2, w - 4, 1);
    ctx.fillRect(x + w - 2, y + 2, 1, h - 4);
    ctx.globalAlpha = 1;
  }
  function text(ctx, str, x, y, col = '#ffffff', opt = {}) {
    return F().draw(ctx, str, x, y, col, Object.assign({ shadow: '#10102a' }, opt));
  }
  function slide(i, from) {
    if (R.intro >= 1) return 0;
    const u = U.ease.outBack(U.clamp((R.intro - 0.55 - i * 0.08) / 0.3, 0, 1));
    return Math.round((1 - u) * from);
  }

  function render() {
    G.ui.space(W, H);
    R.hoverDef = null;
    R.hoverDock = null;
    const ctx = R.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0c0c20';
    ctx.fillRect(0, 0, W, H);
    const blocked0 = G.ui.blocked;
    if (R.letterOpen) G.ui.blocked = true;
    drawView();
    ctx.drawImage(R.view, VX, VY);
    // 视窗边框
    ctx.fillStyle = '#e8ecff';
    ctx.fillRect(VX - 2, VY - 2, VW + 4, 1);
    ctx.fillRect(VX - 2, VY + VH + 1, VW + 4, 1);
    ctx.fillRect(VX - 2, VY - 2, 1, VH + 4);
    ctx.fillRect(VX + VW + 1, VY - 2, 1, VH + 4);
    drawTop(ctx, slide(0, -30));
    drawShop(ctx, slide(1, 200));
    drawBottom(ctx, slide(2, 100));
    if (G.visiting(3)) drawBack(ctx);
    G.ui.blocked = blocked0;
    if (R.letterOpen) drawLetter(ctx);
    if (R.intro >= 1) drawCursor(ctx);
    return R.fb;
  }

  function drawView() {
    const c = R.vctx;
    c.imageSmoothingEnabled = false;
    const ph = R.force && R.force.phase !== undefined ? R.force.phase : dayPhase();
    const f = RN.flight;
    if (f && !R.force) return drawFlight(c, f, ph);
    drawSky(c, VW, VH, ph);
    const scroll = RN.dist * 10;
    const nL = R.force && R.force.layers !== undefined ? R.force.layers : R.glimpse ? R.glimpse : G.m.layers;
    drawLayersTo(c, VW, VH, scroll, nL);
    // 地面
    const night = R.night;
    c.fillStyle = U.mix('#5cbf4c', '#2c5a30', night);
    c.fillRect(0, GROUND, VW, 3);
    c.fillStyle = U.mix('#8a5a34', '#3a2818', night);
    c.fillRect(0, GROUND + 3, VW, VH - GROUND - 3);
    c.fillStyle = U.mix('#6a4428', '#2a1c10', night);
    const go = Math.floor(scroll % 32);
    for (let x = -go; x < VW; x += 32) {
      c.fillRect(x + 4, GROUND + 10, 6, 3);
      c.fillRect(x + 20, GROUND + 24, 8, 3);
      c.fillRect(x + 12, GROUND + 40, 5, 2);
    }
    c.fillStyle = U.mix('#3f9a38', '#1e4422', night);
    for (let x = -go; x < VW; x += 16) c.fillRect(x, GROUND + 3, 8, 1);
    // 星屑
    for (const m of RN.motes) {
      if (m.paper) {
        c.fillStyle = '#f8f0d8';
        c.fillRect(Math.floor(m.x) - 4, Math.floor(m.y) - 5, 8, 10);
        c.fillStyle = '#a89878';
        c.fillRect(Math.floor(m.x) - 3, Math.floor(m.y) - 2, 6, 1);
        c.fillRect(Math.floor(m.x) - 3, Math.floor(m.y) + 1, 5, 1);
        continue;
      }
      const tw = Math.floor(G.t * 8 + m.x * 0.1) % 4;
      const x = Math.floor(m.x), y = Math.floor(m.y);
      c.fillStyle = '#fff7c0';
      c.fillRect(x - 1, y - 1, 3, 3);
      c.fillStyle = tw < 2 ? '#ffd860' : '#ffffff';
      c.fillRect(x, y - 3, 1, 7);
      c.fillRect(x - 3, y, 7, 1);
    }
    // 障碍：旧时代的残骸
    for (const o of RN.obs) drawRelic(c, o);
    // 角色
    drawHero(c);
    for (const d of R.debris) {
      c.fillStyle = d.c;
      c.fillRect(Math.floor(d.x), Math.floor(d.y), 2, 2);
    }
    // 近景
    if (nL >= 5) strip(c, R.layers.grass, 1.5, VH - 40 + 6, scroll, VW);
    // 跃迁 3→4：角色手里的那个点开始发光
    if (R.force && R.force.glow) {
      const gx = PX_X + 14, gy = RN.y - 12, gr = 3 + R.force.glow * 520;
      const g = c.createRadialGradient(gx, gy, 0, gx, gy, gr);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(Math.min(0.9, 0.08 + R.force.glow * 0.5), 'rgba(255,250,235,' + Math.min(1, 0.4 + R.force.glow) + ')');
      g.addColorStop(1, 'rgba(255,240,220,0)');
      c.fillStyle = g;
      c.fillRect(0, 0, VW, VH);
    }
    if (R.force) return;
    // 视窗内 HUD
    text(c, `${Math.floor(RN.dist)} 米`, 6, 4, '#ffffff');
    if (RN.streak >= 5) text(c, `连拾 ×${(1 + Math.min(2, RN.streak * 0.02)).toFixed(2)}`, 6, 18, '#ffd860');
    const nf = RN.nextFlight - RN.dist;
    if (nf < 150) text(c, '前方：起飞', VW - 6, 4, Math.floor(G.t * 4) % 2 ? '#ffd860' : '#ffffff', { align: 'right' });
    if (autoOn()) text(c, '影子跑者', VW - 6, VH - 16, '#c0c8ec', { align: 'right' });
    if (G.s.e[3].started && RN.dist < 30 && !autoOn()) text(c, '空格 / ↑ / 点击 跳跃', VW / 2, 70, '#ffffff', { align: 'center' });
    for (const fl of R.floats) {
      const y = Math.floor(fl.y - 10 - fl.t * 22);
      text(c, fl.text || '+' + U.fmt(fl.v), Math.floor(fl.x), y, fl.text ? '#f8f0d8' : '#ffd860', { align: 'center' });
    }
  }

  function drawHero(c) {
    const air = !RN.ground;
    let fr = air ? 3 : RN.frame;
    const img = hero(fr);
    const x = PX_X;
    let y = Math.floor(RN.y) - 16;
    if (R.intro < 0.6) {
      // 开场：点从天上落下来
      const u = U.clamp(R.intro / 0.6, 0, 1);
      y = Math.floor(U.lerp(-24, GROUND - 16, U.ease.outCubic(u)));
      if (u < 0.5) {
        c.fillStyle = '#ffffff';
        c.fillRect(x + 7, y + 7, 2, 2);
        return;
      }
    }
    if (RN.stumble > 0.4) {
      c.save();
      c.translate(x + 8, y + 8);
      c.rotate((1 - RN.stumble) * Math.PI * 4);
      c.drawImage(img, -8, -8);
      c.restore();
    } else {
      // 跳起时略微拉长，落地时压扁
      c.drawImage(img, x, y);
    }
    // 影子
    c.globalAlpha = 0.3;
    c.fillStyle = '#000';
    const sw = Math.max(4, 12 - (GROUND - RN.y) / 10);
    c.fillRect(Math.floor(x + 8 - sw / 2), GROUND - 1, Math.floor(sw), 2);
    c.globalAlpha = 1;
  }

  function drawRelic(c, o) {
    const x = Math.floor(o.x), top = GROUND - o.h;
    if (o.kind === 0) {
      // 一堆绿色字符
      const r = U.rng(Math.floor(o.seed));
      const chars = '#%&01$@*';
      for (let i = 0; i < 12; i++) {
        const cx = x + Math.floor(r() * (o.w - 4)), cy = top + Math.floor(r() * (o.h - 8));
        F().draw(c, chars[Math.floor(r() * chars.length)], cx, cy - 2, i % 3 ? '#41ff86' : '#1d7a45');
      }
      c.fillStyle = '#1d7a45';
      c.fillRect(x, GROUND - 3, o.w, 3);
    } else if (o.kind === 1) {
      // 发光线框
      c.strokeStyle = '#e9f6ff';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(x + 0.5, GROUND);
      c.lineTo(x + o.w / 2 + 0.5, top + 0.5);
      c.lineTo(x + o.w + 0.5, GROUND);
      c.moveTo(x + o.w * 0.25, (GROUND + top) / 2);
      c.lineTo(x + o.w * 0.75, (GROUND + top) / 2);
      c.stroke();
      c.fillStyle = 'rgba(200,235,255,0.25)';
      c.fillRect(x - 1, top - 1, o.w + 2, o.h + 2);
    } else {
      // NES 砖块
      const cols = ['#F83800', '#FCA044', '#3CBCFC', '#58D854'];
      for (let yy = GROUND - 7, i = 0; yy > top - 4; yy -= 7, i++) {
        c.fillStyle = cols[(i + Math.floor(o.seed)) % 4];
        c.fillRect(x + (i % 2 ? 3 : 0), yy, o.w - 3, 6);
        c.fillStyle = '#FCFCFC';
        c.fillRect(x + (i % 2 ? 3 : 0), yy, o.w - 3, 1);
      }
    }
  }

  function drawFlight(c, f, ph) {
    const hor = 74;
    drawSky(c, VW, hor + 1, ph);
    if (G.m.layers >= 1) strip(c, R.layers.mountains, 0.05, hor - 112, f.camZ * 2, VW);
    const [, fogc] = skyAt(ph);
    const [fr, fg, fb] = U.rgb(fogc);
    const img = mode7(c, VW, VH, f.tex, { horizon: hor, camH: 34, f: 150, camZ: f.camZ, lat: f.lat, fogZ: 1100, fogR: fr, fogG: fg, fogB: fb });
    // 画到临时层再叠加（保留天空）
    if (!R.m7c || R.m7c.width !== VW) {
      R.m7c = U.canvas(VW, VH);
    }
    R.m7c.getContext('2d').putImageData(img, 0, 0);
    c.drawImage(R.m7c, 0, 0);
    // 光环
    const rings = f.rings.filter((r) => !r.got && r.z > f.camZ).sort((a, b) => b.z - a.z);
    for (const r of rings) {
      const z = r.z - f.camZ;
      if (z > 1400) continue;
      const sc = 150 / z;
      const sx = VW / 2 + (r.x - f.lat) * sc, sy = hor + 34 * sc - 26 * sc;
      const rr = Math.max(2, 34 * sc);
      c.strokeStyle = r.missed ? '#806060' : Math.floor(G.t * 6) % 2 ? '#ffd860' : '#ffffff';
      c.lineWidth = Math.max(1, 4 * sc);
      c.beginPath();
      c.ellipse(Math.floor(sx), Math.floor(sy), rr, rr * 1.1, 0, 0, Math.PI * 2);
      c.stroke();
    }
    // 角色（滑翔）
    const img2 = hero(3);
    const bank = U.clamp(f.vlat / 220, -1, 1);
    c.save();
    c.translate(VW / 2, VH - 60);
    c.rotate(bank * 0.35);
    c.drawImage(img2, -8, -8);
    c.fillStyle = '#ffffff';
    c.fillRect(-14, -2, 9, 2);
    c.fillRect(5, -2, 9, 2);
    c.restore();
    text(c, `Mode 7 · 光环 ${f.n}/${f.rings.length}`, 6, 4, '#ffffff');
    const auto = G.m.autoFly || (autoOn() && G.m.runAI >= 3);
    text(c, auto ? '自动驾驶' : '← → / 鼠标 转向', VW - 6, 4, '#ffffff', { align: 'right' });
    for (const fl of R.floats) text(c, '+' + U.fmt(fl.v), VW / 2, Math.floor(fl.y - fl.t * 30), '#ffd860', { align: 'center' });
  }

  function drawTop(ctx, oy) {
    const s = G.s;
    for (let i = 0; i < 22; i++) {
      ctx.fillStyle = U.mix('#283c88', '#121a48', i / 22);
      ctx.fillRect(0, oy + i, W, 1);
    }
    ctx.fillStyle = '#8090d0';
    ctx.fillRect(0, oy + 22, W, 1);
    let x = 8;
    // 星屑图标
    ctx.fillStyle = '#ffd860';
    ctx.fillRect(x + 3, oy + 5, 1, 9);
    ctx.fillRect(x, oy + 9, 7, 1);
    ctx.fillStyle = '#fff7c0';
    ctx.fillRect(x + 2, oy + 8, 3, 3);
    x += 12;
    x += text(ctx, '星屑 ', x, oy + 4, '#c8d0ff');
    x += text(ctx, U.fmt(s.res.dust), x, oy + 4, '#ffd860');
    text(ctx, ' +' + U.fmt(E.shown('dust'), 1) + '/秒', x, oy + 4, '#a0a8d8');
    text(ctx, '像素 ' + U.fmt(s.res.px), 270, oy + 4, '#ffb060');
    text(ctx, '向量 ' + U.fmt(s.res.vec), 370, oy + 4, '#a4e4fc');
    text(ctx, '比特 ' + U.fmt(s.res.bits), 470, oy + 4, '#70e090');
    if (s.msg > 0) {
      const hov = G.ui.over(548, oy, 52, 20);
      text(ctx, `留言${G.letter.pct()}%`, 552, oy + 4, hov ? '#ffd860' : '#a0a8d8');
      if (G.ui.click(548, oy, 52, 20)) R.letterOpen = 1;
    }
    const hov = G.ui.over(604, oy, 36, 20);
    text(ctx, '菜单', 608, oy + 4, hov ? '#ffd860' : '#ffffff');
    if (G.ui.click(604, oy, 36, 20)) G.ui.openMenu();
  }

  const TABS = [['main', '升级'], ['layer', '图层'], ['fm', '音源']];
  function drawShop(ctx, ox) {
    const x = 464 + ox, y = 26, w = 168, h = 326;
    win(ctx, x, y, w, h);
    let tx = x + 6;
    for (const [id, name] of TABS) {
      const list = E.list(3, id, id !== 'main');
      if (!list.length && id !== 'main') continue;
      const tw = F().width(name) + 8;
      const on = R.tab === id;
      if (on) {
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.fillRect(tx - 2, y + 5, tw, 14);
      }
      text(ctx, name, tx + 2, y + 6, on ? '#ffffff' : list.some((d) => E.canBuy(d)) ? '#ffd860' : '#a0a8d8');
      if (G.ui.click(tx - 2, y + 5, tw, 14)) {
        R.tab = id;
        R.scroll = 0;
        sfx.move();
      }
      tx += tw + 4;
    }
    ctx.fillStyle = '#8090d0';
    ctx.fillRect(x + 5, y + 21, w - 10, 1);
    const list = E.list(3, R.tab, R.tab !== 'main');
    const RH = 28, top = y + 25, vis = Math.floor((h - 30) / RH);
    const maxS = Math.max(0, list.length - vis);
    if (G.ui.over(x, y, w, h) && I.wheel) R.scroll = U.clamp(R.scroll + Math.sign(I.wheel), 0, maxS);
    R.scroll = U.clamp(R.scroll, 0, maxS);
    if (!list.length) {
      text(ctx, '跑起来，捡星屑。', x + 10, top + 6, '#c8d0ff');
    }
    list.slice(R.scroll, R.scroll + vis).forEach((d, i) => {
      const ry = top + i * RH;
      const r = G.ui.buy(d, x + 4, ry, w - 8, RH - 2);
      const owned = E.maxed(d);
      const col = owned ? '#7078a8' : r.can ? (d.type === 'goal' ? '#ffd860' : '#ffffff') : '#8890b8';
      if (r.hover) {
        R.hoverDef = d;
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(x + 4, ry, w - 8, RH - 2);
      }
      let name = d.name;
      const lv = E.lv(d.id);
      if (d.type === 'level') name += ' ' + (d.id === 'layer' ? (LAYER_NAMES[Math.min(lv, 4)] || '') : ['I', 'II', 'III', 'IV'][Math.min(lv, d.costs.length - 1)]);
      if (d.type === 'gen' && lv) name += ' ×' + lv;
      text(ctx, name, x + 10, ry + 1, col);
      const c = E.cost(d);
      const ct = owned ? '已满' : Object.keys(c).map((k) => U.fmt(c[k]) + (k === 'dust' ? '' : E.NAME[k])).join('+');
      text(ctx, ct, x + w - 10, ry + 13, r.can ? '#ffd860' : '#7078a8', { align: 'right' });
    });
    if (maxS > 0) {
      ctx.fillStyle = '#c8d0ff';
      const sh = Math.max(10, Math.floor((h - 34) * (vis / list.length)));
      ctx.fillRect(x + w - 5, top + Math.floor((h - 34 - sh) * (R.scroll / maxS)), 2, sh);
    }
  }

  function drawBottom(ctx, oy) {
    const items = [
      { id: 0, x: 8, name: '终端' },
      { id: 1, x: 76, name: 'Pong' },
      { id: 2, x: 144, name: '8-bit' },
    ];
    const y = 290 + oy;
    for (const it of items) {
      const hov = G.ui.over(it.x, y, 64, 36);
      ctx.fillStyle = hov ? '#ffd860' : '#8090d0';
      ctx.fillRect(it.x - 1, y - 1, 66, 38);
      if (it.id === 0) G.eras[0].renderMini(ctx, it.x, y, 64, 36, { pixel: true, colors: ['#41ff86', '#1d7a45'] });
      else if (it.id === 1) G.eras[1].renderMini(ctx, it.x, y, 64, 36, { pixel: true, color: '#e9f6ff' });
      else G.eras[2].renderMini(ctx, it.x, y, 64, 36);
      text(ctx, it.name, it.x + 32, y + 40, hov ? '#ffd860' : '#a0a8d8', { align: 'center' });
      if (hov) R.hoverDock = it;
      if (G.ui.click(it.x, y, 64, 36)) {
        const k = G.VW / W;
        G.visit(it.id, [it.x * k, (290) * k, 64 * k, 36 * k]);
      }
    }
    const bx = 216, bw = 240, bh = 68, by = 284 + oy;
    win(ctx, bx, by, bw, bh);
    const d = R.hoverDef;
    if (d) {
      text(ctx, d.name, bx + 8, by + 6, '#ffd860');
      const lines = F().wrap(d.desc, bw - 16);
      lines.slice(0, 2).forEach((l, i) => text(ctx, l, bx + 8, by + 22 + i * 14, '#ffffff'));
      if (!E.maxed(d)) text(ctx, E.costText(E.cost(d)), bx + bw - 8, by + bh - 16, E.afford(E.cost(d)) ? '#ffffff' : '#ff9090', { align: 'right' });
      return;
    }
    if (R.hoverDock) {
      text(ctx, `点击回到「${R.hoverDock.name}」。`, bx + 8, by + 8, '#ffffff');
      text(ctx, '旧时代一直在运转。', bx + 8, by + 24, '#c8d0ff');
      return;
    }
    const lines = G.s.log.filter((l) => l.kind === 'dot' || l.kind === 'sys').slice(-3);
    let yy = by + 6;
    const all = [];
    lines.forEach((l, i) => {
      const newest = i === lines.length - 1;
      const wrapped = F().wrap((l.kind === 'sys' ? '※' : '') + l.text, bw - 16);
      wrapped.forEach((wl) => all.push({ wl, newest, l }));
    });
    const show = all.slice(-4);
    let typed = Math.floor(R.tw.k);
    show.forEach((it) => {
      let max = 999;
      if (it.newest && it.l.n === R.tw.n) {
        max = typed;
        typed -= [...it.wl].length;
        if (max < 0) max = 0;
      }
      text(ctx, it.wl, bx + 8, yy, it.newest ? '#ffffff' : '#9098c8', { max });
      yy += 14;
    });
  }

  function drawBack(ctx) {
    const hov = G.ui.over(8, 336, 120, 20);
    win(ctx, 8, 336, 110, 20);
    text(ctx, '◀ 返回 Esc', 16, 340, hov ? '#ffd860' : '#ffffff');
    if (G.ui.click(8, 336, 110, 20)) G.unvisit();
  }

  function drawLetter(ctx) {
    win(ctx, 60, 80, 400, 150);
    text(ctx, `留言.txt（${G.letter.pct()}% 可读）`, 74, 90, '#ffd860');
    const lines = F().wrap(G.letter.view(G.s.msg, '·'), 370);
    lines.forEach((l, i) => text(ctx, l, 74, 112 + i * 16, '#ffffff'));
    text(ctx, '（点击关闭）', 446, 210, '#a0a8d8', { align: 'right' });
    if (G.input.pressed && !G.input.used) {
      G.input.used = true;
      R.letterOpen = 0;
    }
  }

  function drawCursor(ctx) {
    if (!G.input.inside || G.ui.menuOpen()) return;
    const mx = Math.round(G.ui.mx), my = Math.round(G.ui.my);
    if (G.ui.over(VX, VY, VW, VH) && !R.letterOpen && !RN.flight) {
      // 视窗里：小十字
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(mx - 3, my, 7, 1);
      ctx.fillRect(mx, my - 3, 1, 7);
      return;
    }
    const img = sprite(HAND, { X: '#20203a', W: '#ffffff', L: '#c0c8ec' }, 'hand');
    ctx.drawImage(img, mx - 4, my);
  }

  function display() {
    return { nearest: true, curve: 0.012, scan: 0.1, scanN: 360, vig: 0.22, corner: 0.012, bloom: 0.22, bloomR: 4, bloomT: 0.6, chroma: 0.35, noise: 0.01 };
  }

  // ---------------- 小窗 ----------------
  function renderMini(ctx, x, y, w, h) {
    // 后台时也要画一遍视窗
    if (G.fgEra() !== 3 || G.inFx()) drawView();
    ctx.save();
    ctx.imageSmoothingEnabled = w < VW;
    ctx.drawImage(R.view, x, y, w, h);
    ctx.restore();
  }
})();
