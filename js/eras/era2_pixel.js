'use strict';
// 时代 2 · 8-bit（2 维：格）—— 贪吃蛇 / 打砖块 / 调色板 / 音乐声道
(() => {
  const U = G.U, E = G.econ, I = G.input, A = G.audio;
  const W = 480, H = 270;
  const F = () => G.text.pixel(12);
  // 游戏窗口
  const GX = 6, GY = 32, GW = 240, GH = 192;
  const SW = 30, SH = 24, CELL = 8;

  // ---------------- NES 调色板 ----------------
  const NES = [
    '#7C7C7C', '#0000FC', '#0000BC', '#4428BC', '#940084', '#A80020', '#A81000', '#881400', '#503000', '#007800', '#006800', '#005800', '#004058', '#000000',
    '#BCBCBC', '#0078F8', '#0058F8', '#6844FC', '#D800CC', '#E40058', '#F83800', '#E45C10', '#AC7C00', '#00B800', '#00A800', '#00A844', '#008888',
    '#F8F8F8', '#3CBCFC', '#6888FC', '#9878F8', '#F878F8', '#F85898', '#F87858', '#FCA044', '#F8B800', '#B8F818', '#58D854', '#58F898', '#00E8D8', '#787878',
    '#FCFCFC', '#A4E4FC', '#B8B8F8', '#D8B8F8', '#F8B8F8', '#F8A4C0', '#F0D0B0', '#FCE0A8', '#F8D878', '#D8F878', '#B8F8B8', '#B8F8D8', '#00FCFC', '#F8D8F8',
  ];
  const GROUPS = [
    { id: 'red', name: '红', hue: [[340, 360], [0, 12]] },
    { id: 'blue', name: '蓝', hue: [[200, 250]] },
    { id: 'green', name: '绿', hue: [[70, 160]] },
    { id: 'yellow', name: '黄', hue: [[38, 70]] },
    { id: 'cyan', name: '青', hue: [[160, 200]] },
    { id: 'purple', name: '紫', hue: [[250, 290]] },
    { id: 'orange', name: '橙', hue: [[12, 38]] },
    { id: 'pink', name: '粉', hue: [[290, 340]] },
  ];
  function hsl(hex) {
    const [r, g, b] = U.rgb(hex).map((v) => v / 255);
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
    let h = 0, s = 0;
    if (mx !== mn) {
      const d = mx - mn;
      s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
      if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
      else if (mx === g) h = ((b - r) / d + 2) * 60;
      else h = ((r - g) / d + 4) * 60;
    }
    return [h, s, l];
  }
  const GROUP_OF = {};
  for (const c of NES) {
    const [h, s, l] = hsl(c);
    if (s < 0.2 || l < 0.06) GROUP_OF[c] = 'gray';
    else for (const g of GROUPS) if (g.hue.some(([a, b]) => h >= a && h < b)) GROUP_OF[c] = g.id;
  }
  let palKey = null, palMap = new Map(), unlockedList = [];
  function unlockedSet(groups) {
    return NES.filter((c) => GROUP_OF[c] === 'gray' || groups.has(GROUP_OF[c]));
  }
  function curGroups() {
    const g = new Set();
    for (const gr of GROUPS) if (E.has('pal_' + gr.id)) g.add(gr.id);
    return g;
  }
  let forceGroups = null; // 跃迁时临时指定（null = 按已买的）
  function C(hex) {
    const groups = forceGroups || curGroups();
    const key = [...groups].sort().join(',');
    if (key !== palKey) {
      palKey = key;
      palMap = new Map();
      unlockedList = unlockedSet(groups);
    }
    let v = palMap.get(hex);
    if (v) return v;
    const [r, g, b] = U.rgb(hex);
    let best = '#000000', bd = 1e9;
    for (const c of unlockedList) {
      const [r2, g2, b2] = U.rgb(c);
      const d = (r - r2) ** 2 * 0.3 + (g - g2) ** 2 * 0.59 + (b - b2) ** 2 * 0.11;
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    palMap.set(hex, best);
    return best;
  }

  // ---------------- 升级 ----------------
  G.econ.hook((m) => {
    m.food = 1;
    m.snakeSpeed = 1;
    m.foods = 1;
    m.gold = 0;
    m.wrap = 0;
    m.snakeAI = 0;
    m.brick = 1;
    m.padW = 1;
    m.pierce = 0;
    m.padAI = 0;
  });
  const palDefs = GROUPS.map((g, i) => ({
    id: 'pal_' + g.id, tab: 'pal', name: g.name, desc: `解锁${g.name}色。像素产出 +10%`,
    cost: { px: [60, 150, 400, 1000, 2500, 6000, 15000, 40000][i] }, tag: 'visual',
    req: i ? (s) => s.own['pal_' + GROUPS[i - 1].id] : undefined,
    mod: (m) => (m.all.px *= 1.1),
  }));
  const musDefs = [
    { id: 'ch1', name: '方波一 · 旋律', desc: '第一个声道：主旋律。像素产出 +5%', cost: { px: 100 } },
    { id: 'ch2', name: '方波二 · 和声', desc: '第二个声道：琶音。像素产出 +5%', cost: { px: 800 }, req: (s) => s.own.ch1 },
    { id: 'ch3', name: '三角波 · 低音', desc: '第三个声道：低音。像素产出 +5%', cost: { px: 3000 }, req: (s) => s.own.ch2 },
    { id: 'ch4', name: '噪声 · 鼓', desc: '第四个声道：鼓点。像素产出 +5%', cost: { px: 9000 }, req: (s) => s.own.ch3 },
  ].map((d) => Object.assign(d, { tab: 'mus', tag: 'sound', mod: (m) => (m.all.px *= 1.05), onBuy: () => updateMusic() }));

  E.define(2, [
    { id: 'sspeed', name: '蛇速', type: 'level', desc: '蛇移动更快（×1.3）', costs: [{ px: 40 }, { px: 450 }, { px: 6000 }], mod: (m, lv) => (m.snakeSpeed *= Math.pow(1.3, lv)) },
    { id: 'cart', name: '卡带', type: 'gen', desc: '+3 像素/秒', cost: { px: 50 }, prod: { px: 3 } },
    { id: 'twin', name: '双食物', desc: '同时出现两个食物', cost: { px: 120 }, mod: (m) => (m.foods = 2) },
    { id: 'sai', name: '贪吃蛇 AI', type: 'level', desc: '蛇自己走（贪心 → 寻路 → 哈密顿）', tag: 'auto',
      costs: [{ px: 200, bits: 3000 }, { px: 3500, bits: 60000 }, { px: 45000, bits: 900000 }],
      mod: (m, lv) => (m.snakeAI = lv), onBuy: (lv) => { if (lv >= 3) snakeReset(true); } },
    { id: 'wrap', name: '穿墙', desc: '从一边出去，从另一边回来', cost: { px: 300 }, mod: (m) => (m.wrap = 1) },
    { id: 'console', name: '主机', type: 'gen', desc: '+20 像素/秒', cost: { px: 600 }, prod: { px: 20 } },
    { id: 'gold', name: '金苹果', desc: '偶尔出现，价值 ×10', cost: { px: 800 }, mod: (m) => (m.gold = 1) },
    { id: 'keys', name: '键盘精灵', desc: '终端里每秒自动按 10 次键', cost: { px: 1000 }, tag: 'back', mod: (m) => (m.autoType += 10) },
    { id: 'pongx', name: '回溯 · Pong', desc: 'Pong 球速 ×1.5，击球 ×3', cost: { px: 1500 }, tag: 'back', mod: (m) => { m.ballSpeed *= 1.5; m.hit *= 3; } },
    { id: 'brk', name: '打砖块', desc: '球回来了。去看看墙后面有什么', cost: { px: 2000, vec: 6000 } },
    { id: 'padw', name: '宽挡板', desc: '挡板 ×1.5', cost: { px: 3000 }, req: (s) => s.own.brk, mod: (m) => (m.padW *= 1.5) },
    { id: 'pai', name: '挡板 AI', type: 'level', desc: '挡板自己接球（会失手 → 不会失手）', tag: 'auto', req: (s) => s.own.brk,
      costs: [{ px: 5000, vec: 25000 }, { px: 70000, vec: 300000 }], mod: (m, lv) => (m.padAI = lv) },
    { id: 'arcade', name: '街机厅', type: 'gen', desc: '+150 像素/秒', cost: { px: 8000 }, prod: { px: 150 } },
    { id: 'pierce', name: '穿透球', desc: '球能连穿 3 块砖', cost: { px: 12000 }, req: (s) => s.own.brk, mod: (m) => (m.pierce = 3) },
    { id: 'bval', name: '砖块镀金', type: 'level', desc: '砖块价值 ×3', costs: [{ px: 20000 }, { px: 250000 }], req: (s) => s.own.brk, mod: (m, lv) => (m.brick *= Math.pow(3, lv)) },
    { id: 'fval', name: '大餐', type: 'level', desc: '食物价值 ×3', costs: [{ px: 10000 }, { px: 150000 }], mod: (m, lv) => (m.food *= Math.pow(3, lv)) },
    { id: 'decode2', name: '解码 · 留言', desc: '恢复留言.txt 的一部分', cost: { px: 30000 }, tag: 'back', onBuy: () => G.letter.reveal(0.1) },
    { id: 'scroll', name: '多重卷轴', type: 'goal', desc: '让画面分成好几层，一层比一层远。', cost: { px: 5e6, vec: 2e5 }, reveal: 0.15,
      onBuy() { G.startFx('t23'); } },
  ].concat(palDefs, musDefs));

  // ---------------- 剧情 ----------------
  G.story.def([
    { id: 'e2.start', era: 2, when: (s) => s.e[2].started, say: ['我又变回一个点了。', '不过这次，我可以长大。（方向键 / WASD）'] },
    { id: 'e2.food', era: 2, when: (s) => s.stats.foods >= 1, say: '好吃。' },
    { id: 'e2.len', era: 2, when: (s) => s.stats.maxLen >= 10, say: ['我变长了。', '后面跟着的，都是我走过的路。'] },
    { id: 'e2.death', era: 2, when: (s) => s.stats.deaths >= 1, say: '我撞上了我自己的过去。' },
    { id: 'e2.red', era: 2, when: (s) => s.own.pal_red, say: '红。我决定喜欢红。' },
    { id: 'e2.blue', era: 2, when: (s) => s.own.pal_blue, say: '蓝色让我想起很远的地方。' },
    { id: 'e2.green', era: 2, when: (s) => s.own.pal_green, say: '绿色……这个我认识。是终端的颜色。' },
    { id: 'e2.yellow', era: 2, when: (s) => s.own.pal_yellow, say: '黄色是热闹的颜色。' },
    { id: 'e2.allc', era: 2, when: (s) => s.own.pal_pink, say: '原来世界有这么多颜色。' },
    { id: 'e2.ch1', era: 2, when: (s) => s.own.ch1, say: ['有旋律了！', '……这首歌，我好像在哪儿听过。'] },
    { id: 'e2.ch3', era: 2, when: (s) => s.own.ch3, say: '低音让地面变稳了。' },
    { id: 'e2.ch4', era: 2, when: (s) => s.own.ch4, say: '咚、哒、咚咚哒。是我的心跳吗？' },
    { id: 'e2.ai', era: 2, when: (s) => s.own.sai >= 1, say: '我可以自己找吃的了。你去看看别的吧。' },
    { id: 'e2.ai3', era: 2, when: (s) => s.own.sai >= 3, say: ['我学会了一条走遍所有格子的路。', '只要沿着它走，就永远不会撞到自己。'] },
    { id: 'e2.brk', era: 2, when: (s) => s.own.brk, say: ['球回来了。', '这次，我想看看墙后面有什么。'] },
    { id: 'e2.wall', era: 2, when: (s) => s.stats.walls >= 1, say: '墙后面……还是墙。' },
    { id: 'e2.keys', era: 2, when: (s) => s.own.keys, say: '终端里的我在自己打字。它在说什么呢？' },
    { id: 'e2.decode', era: 2, when: (s) => s.own.decode2, say: '留言又多了几个字。"别怕黑"……是写给我的吗？' },
    { id: 'e2.deep', era: 2, when: (s) => s.tot.px >= 1.2e6, say: ['平面也不够。', '我想知道，远处是不是还有远处。'] },
    { id: 'e2.goal', era: 2, when: (s) => s.seen.scroll, say: '多重卷轴：让画面分成好几层。' },
    { id: 'e2.ready', era: 2, when: (s) => E.canBuy(E.defs.scroll), say: '准备好了。我们去远一点的地方。' },
    { id: 'e2.fill', anyEra: true, era: 2, when: (s) => s.stats.fills >= 1, say: ['我填满了整个世界。', '……然后呢？'] },
  ]);

  // ---------------- 运行时 ----------------
  const R = {
    fb: null, ctx: null, tmp: null, tctx: null,
    tab: 'snake', shopTab: 'main', scroll: 0,
    intro: 1,
    floats: [],
    tw: { n: 0, k: 999 },
    palSweep: 1, prevGroups: null,
    hoverDef: null, hoverDock: null,
    letterOpen: 0,
    flash: 0,
    shake: 0,
    blipAcc: 0,
  };
  const SN = { body: [[15, 12]], dir: [0, 0], q: [], foods: [], gold: null, acc: 0, dead: 0, occ: new Uint8Array(SW * SH), manualT: -99, ham: null, hamIdx: null };
  const BK = { bricks: [], balls: [], px: GW / 2, level: 0, manualT: -99, lastMx: -1, init: false };

  const era = {
    id: 2, name: '8-bit', res: 'px',
    fresh: () => ({ started: 0, brkLevel: 0 }),
    init() {
      R.fb = U.canvas(W, H);
      R.ctx = R.fb.getContext('2d');
      R.tmp = U.canvas(W, H);
      R.tctx = R.tmp.getContext('2d');
      buildHam();
      snakeReset();
    },
    enter(fromFx, visiting) {
      R.tw.n = G.s.lineN || 0;
      if (G.s.e[2].started || visiting) era.music();
    },
    leave() {},
    music() {
      if (!G.s.e[2].started) return;
      if (G.music.cur && G.music.cur.song === SONG()) return G.music.setMask(musicMask(), 1);
      G.music.play(SONG(), { mask: musicMask(), fade: 1 });
    },
    update,
    render,
    display,
    renderMini,
    setIntro: (p) => (R.intro = p),
    INTRO: [0.0, 0.1, 0.2, 0.3, 0.38],
    C,
    NES,
    snakeHead: () => ({ x: GX + SN.body[0][0] * CELL + 4, y: GY + SN.body[0][1] * CELL + 4 }),
    setForceGroups: (g) => (forceGroups = g),
    dbg: () => SN,
    GAME: { x: GX, y: GY, w: GW, h: GH },
  };
  G.registerEra(era);

  // ---------------- 音乐 ----------------
  let songCache = null;
  function SONG() {
    if (songCache) return songCache;
    const M = G.music;
    const mel = M.melody(0);
    songCache = {
      bpm: 132, len: 256, vol: 0.9,
      tracks: [
        { notes: mel, inst: (o) => A.tone({ t: o.t, n: o.n, d: o.d * 0.92, v: 0.055, type: 'p25', out: o.out, env: 'adsr', a: 0.004, dec: 0.12, s: 0.55, r: 0.03, vib: o.d > 0.3 ? 0.006 : 0, vibF: 6 }) },
        { gen(st, t, spb, out) {
            const ch = M.chordAt(st);
            const n = [ch.tri[0], ch.tri[1], ch.tri[2], ch.tri[1]][st % 4] + 12;
            A.tone({ t, n, d: spb * 0.8, v: 0.022, type: 'p12', out });
          } },
        { gen(st, t, spb, out) {
            if (st % 2) return;
            const ch = M.chordAt(st);
            const n = ch.root + (st % 4 === 2 ? 12 : 0);
            A.tone({ t, n, d: spb * 1.7, v: 0.13, type: 'nestri', out, env: 'hold', r: 0.02 });
          } },
        { gen(st, t, spb, out) {
            const b = st % 16;
            if (b === 0 || b === 6 || b === 10) {
              A.noise({ t, d: 0.09, v: 0.09, buf: 'nes', rate: 0.18, rate2: 0.05, out });
              A.tone({ t, f: 140, f2: 45, d: 0.1, v: 0.1, type: 'nestri', out });
            } else if (b === 4 || b === 12) A.noise({ t, d: 0.11, v: 0.07, buf: 'nes', rate: 0.6, out });
            else if (b % 2 === 0) A.noise({ t, d: 0.025, v: 0.025, buf: 'nesShort', rate: 1.6, out });
          } },
      ],
    };
    return songCache;
  }
  function musicMask() {
    let m = 0;
    ['ch1', 'ch2', 'ch3', 'ch4'].forEach((id, i) => {
      if (E.has(id)) m |= 1 << i;
    });
    return m;
  }
  function updateMusic() {
    if (!G.s.e[2].started) return;
    if (!G.music.cur || G.music.cur.song !== SONG()) era.music();
    else G.music.setMask(musicMask(), 0.8);
  }

  // ---------------- 音效 ----------------
  const sfx = {
    eat(len) { A.tone({ n: 72 + Math.min(24, Math.floor(len / 3)), d: 0.06, v: 0.06, type: 'p25' }); A.tone({ n: 79 + Math.min(24, Math.floor(len / 3)), t: A.now() + 0.04, d: 0.06, v: 0.05, type: 'p25' }); },
    gold() { const t = A.now(); [84, 88, 91, 96].forEach((n, i) => A.tone({ n, t: t + i * 0.05, d: 0.07, v: 0.05, type: 'p12' })); },
    die() { A.noise({ d: 0.35, v: 0.09, buf: 'nes', rate: 0.4, rate2: 0.08 }); A.tone({ n: 64, f2: 80, d: 0.4, v: 0.06, type: 'p50', env: 'hold', r: 0.05 }); },
    brick(row) { A.tone({ n: 84 - row * 2, d: 0.05, v: 0.05, type: 'p25' }); },
    wall() { A.tone({ n: 60, d: 0.03, v: 0.04, type: 'p50' }); },
    paddle() { A.tone({ n: 67, d: 0.04, v: 0.05, type: 'p50' }); },
    buy() { const t = A.now(); A.tone({ n: 83, t, d: 0.07, v: 0.06, type: 'p50' }); A.tone({ n: 88, t: t + 0.07, d: 0.3, v: 0.06, type: 'p50', env: 'hold', r: 0.08 }); },
    cant() { A.tone({ n: 40, d: 0.12, v: 0.07, type: 'p50' }); },
    blip() { A.tone({ n: 84, d: 0.018, v: 0.018, type: 'p12' }); },
    move() { A.tone({ n: 96, d: 0.015, v: 0.02, type: 'p12' }); },
    clear() { const t = A.now(); [72, 76, 79, 84, 88, 91, 96].forEach((n, i) => A.tone({ n, t: t + i * 0.06, d: 0.08, v: 0.05, type: 'p25' })); },
    fill() { const t = A.now(); for (let i = 0; i < 16; i++) A.tone({ n: 60 + ((i * 5) % 36), t: t + i * 0.05, d: 0.08, v: 0.05, type: i % 2 ? 'p12' : 'p25' }); },
  };
  G.bus.on('buy', (d, n, quiet) => {
    if (d.era !== 2 || d.type === 'goal' || quiet) return;
    sfx.buy();
    if (d.tab === 'pal') {
      R.prevGroups = curGroups();
      R.prevGroups.delete(d.id.slice(4));
      R.palSweep = 0;
    }
    G.save.soon();
  });
  G.bus.on('cant', (d) => {
    if (d.era === 2) sfx.cant(), (R.shake = 0.12);
  });

  // ---------------- 贪吃蛇 ----------------
  function idx(x, y) {
    return y * SW + x;
  }
  function buildHam() {
    const order = [];
    for (let x = 0; x < SW; x++) order.push([x, 0]);
    for (let y = 1; y < SH; y++) {
      if (y % 2 === 1) for (let x = SW - 1; x >= 1; x--) order.push([x, y]);
      else for (let x = 1; x < SW; x++) order.push([x, y]);
    }
    for (let y = SH - 1; y >= 1; y--) order.push([0, y]);
    SN.ham = order;
    SN.hamIdx = new Int32Array(SW * SH);
    order.forEach(([x, y], i) => (SN.hamIdx[idx(x, y)] = i));
  }
  function snakeReset(keepPos) {
    SN.occ.fill(0);
    const h = keepPos && SN.body.length ? SN.body[0] : [15, 12];
    SN.body = [[h[0], h[1]]];
    SN.occ[idx(h[0], h[1])] = 1;
    SN.dir = [0, 0];
    SN.q = [];
    SN.foods = [];
    SN.gold = null;
    placeFoods();
  }
  function freeCell() {
    const free = [];
    for (let i = 0; i < SW * SH; i++) if (!SN.occ[i] && !SN.foods.some((f) => idx(f[0], f[1]) === i)) free.push(i);
    if (!free.length) return null;
    const i = U.pick(free);
    return [i % SW, Math.floor(i / SW)];
  }
  function placeFoods() {
    while (SN.foods.length < G.m.foods) {
      const c = freeCell();
      if (!c) break;
      SN.foods.push(c);
    }
  }
  function snakeSpeed() {
    let v = 7 * G.m.snakeSpeed;
    if (aiOn() && G.m.snakeAI >= 3) v = Math.min(70, v * 1.6 * (1 + SN.body.length / 90));
    return v;
  }
  function aiOn() {
    if (G.botAssist) return true;
    return G.m.snakeAI > 0 && G.s.time - SN.manualT > 3;
  }
  function wrapXY(x, y) {
    if (G.m.wrap) return [(x + SW) % SW, (y + SH) % SH];
    return [x, y];
  }
  function blocked(x, y, grow) {
    if (x < 0 || y < 0 || x >= SW || y >= SH) return true;
    const t = SN.body[SN.body.length - 1];
    if (!grow && t[0] === x && t[1] === y) return false;
    return !!SN.occ[idx(x, y)];
  }
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  function isFood(x, y) {
    return SN.foods.some((f) => f[0] === x && f[1] === y) || (SN.gold && SN.gold.x === x && SN.gold.y === y);
  }
  function nearestFood() {
    const h = SN.body[0];
    let best = null, bd = 1e9;
    const all = SN.foods.map((f) => f).concat(SN.gold ? [[SN.gold.x, SN.gold.y]] : []);
    for (const f of all) {
      const d = Math.abs(f[0] - h[0]) + Math.abs(f[1] - h[1]);
      if (d < bd) {
        bd = d;
        best = f;
      }
    }
    return best;
  }
  function safeMoves() {
    const h = SN.body[0];
    const out = [];
    for (const d of DIRS) {
      if (SN.body.length > 1 && d[0] === -SN.dir[0] && d[1] === -SN.dir[1]) continue;
      const [x, y] = wrapXY(h[0] + d[0], h[1] + d[1]);
      if (!blocked(x, y, isFood(x, y))) out.push({ d, x, y });
    }
    return out;
  }
  function flood(sx, sy, limit) {
    const seen = new Uint8Array(SW * SH);
    const q = [[sx, sy]];
    seen[idx(sx, sy)] = 1;
    let n = 0;
    while (q.length && n < limit) {
      const [x, y] = q.shift();
      n++;
      for (const d of DIRS) {
        const [nx, ny] = wrapXY(x + d[0], y + d[1]);
        if (nx < 0 || ny < 0 || nx >= SW || ny >= SH) continue;
        const i = idx(nx, ny);
        if (seen[i] || SN.occ[i]) continue;
        seen[i] = 1;
        q.push([nx, ny]);
      }
    }
    return n;
  }
  // BFS：从 (sx,sy) 到 (tx,ty) 的路径（不含起点）；occ 是占用表
  function bfs(sx, sy, tx, ty, occ) {
    const prev = new Int32Array(SW * SH).fill(-1);
    const start = idx(sx, sy), goal = idx(tx, ty);
    prev[start] = start;
    const q = [start];
    let qi = 0;
    while (qi < q.length) {
      const cur = q[qi++];
      if (cur === goal) break;
      const x = cur % SW, y = (cur / SW) | 0;
      for (const d of DIRS) {
        const [nx, ny] = wrapXY(x + d[0], y + d[1]);
        if (nx < 0 || ny < 0 || nx >= SW || ny >= SH) continue;
        const i = idx(nx, ny);
        if (prev[i] !== -1) continue;
        if (occ[i] && i !== goal) continue;
        prev[i] = cur;
        q.push(i);
      }
    }
    if (prev[goal] === -1) return null;
    const path = [];
    for (let c = goal; c !== start; c = prev[c]) path.push(c);
    return path.reverse();
  }
  function dirTo(cell) {
    const h = SN.body[0];
    const x = cell % SW, y = (cell / SW) | 0;
    let dx = x - h[0], dy = y - h[1];
    if (dx > 1) dx = -1;
    if (dx < -1) dx = 1;
    if (dy > 1) dy = -1;
    if (dy < -1) dy = 1;
    return [dx, dy];
  }
  function aiGreedy() {
    const f = nearestFood();
    const moves = safeMoves();
    if (!moves.length) return SN.dir[0] || SN.dir[1] ? SN.dir : [1, 0];
    if (!f) return moves[0].d;
    moves.sort((a, b) => Math.abs(a.x - f[0]) + Math.abs(a.y - f[1]) - (Math.abs(b.x - f[0]) + Math.abs(b.y - f[1])) + (Math.random() - 0.5) * 0.1);
    return moves[0].d;
  }
  function aiPath() {
    const h = SN.body[0], f = nearestFood();
    const tail = SN.body[SN.body.length - 1];
    if (f) {
      const path = bfs(h[0], h[1], f[0], f[1], SN.occ);
      if (path) {
        // 吃完以后还能不能找到自己的尾巴？
        const vb = path.slice().reverse().map((c) => [c % SW, (c / SW) | 0]).concat(SN.body).slice(0, SN.body.length + 1);
        const occ = new Uint8Array(SW * SH);
        for (const [x, y] of vb) occ[idx(x, y)] = 1;
        const vt = vb[vb.length - 1];
        occ[idx(vt[0], vt[1])] = 0;
        if (vb.length < 3 || bfs(vb[0][0], vb[0][1], vt[0], vt[1], occ)) return dirTo(path[0]);
      }
    }
    // 找不到安全路线：追着自己的尾巴走
    if (SN.body.length > 2) {
      const occ = SN.occ.slice();
      occ[idx(tail[0], tail[1])] = 0;
      const p = bfs(h[0], h[1], tail[0], tail[1], occ);
      if (p && p.length > 1) return dirTo(p[0]);
    }
    const moves = safeMoves();
    if (!moves.length) return SN.dir;
    moves.sort((a, b) => flood(b.x, b.y, 400) - flood(a.x, a.y, 400));
    return moves[0].d;
  }
  function aiHam() {
    const N = SW * SH;
    const h = SN.body[0], t = SN.body[SN.body.length - 1];
    const hi = SN.hamIdx[idx(h[0], h[1])];
    const dist = (a, b) => (b - a + N) % N;
    const next = SN.ham[(hi + 1) % N];
    let best = next, bestD = 1;
    const len = SN.body.length;
    // 目标取"沿回路最近"的食物：抄近路时绝不能跳过任何一个食物（否则会来回改目标、永远吃不到）
    let fd = Infinity;
    for (const f of SN.foods) fd = Math.min(fd, dist(hi, SN.hamIdx[idx(f[0], f[1])]));
    if (SN.gold) fd = Math.min(fd, dist(hi, SN.hamIdx[idx(SN.gold.x, SN.gold.y)]));
    if (fd < Infinity && len < N * 0.55) {
      const td = len === 1 ? N : dist(hi, SN.hamIdx[idx(t[0], t[1])]);
      for (const d of DIRS) {
        const nx = h[0] + d[0], ny = h[1] + d[1];
        if (nx < 0 || ny < 0 || nx >= SW || ny >= SH) continue;
        if (SN.occ[idx(nx, ny)]) continue;
        const dd = dist(hi, SN.hamIdx[idx(nx, ny)]);
        if (dd > bestD && dd <= fd && dd < td - 4) {
          best = [nx, ny];
          bestD = dd;
        }
      }
    }
    return [best[0] - h[0], best[1] - h[1]];
  }

  function snakeStep(fg) {
    const ai = aiOn();
    if (ai) {
      const lv = G.botAssist ? Math.max(1, G.m.snakeAI) : G.m.snakeAI;
      SN.dir = lv >= 3 ? aiHam() : lv === 2 ? aiPath() : aiGreedy();
    } else if (SN.q.length) {
      const nd = SN.q.shift();
      if (!(SN.body.length > 1 && nd[0] === -SN.dir[0] && nd[1] === -SN.dir[1])) SN.dir = nd;
    }
    if (!SN.dir[0] && !SN.dir[1]) return;
    const h = SN.body[0];
    let [nx, ny] = wrapXY(h[0] + SN.dir[0], h[1] + SN.dir[1]);
    if (nx < 0 || ny < 0 || nx >= SW || ny >= SH) return snakeDie(fg);
    const fi = SN.foods.findIndex((f) => f[0] === nx && f[1] === ny);
    const gold = SN.gold && SN.gold.x === nx && SN.gold.y === ny;
    const grow = fi >= 0 || gold;
    if (!grow) {
      const t = SN.body.pop();
      SN.occ[idx(t[0], t[1])] = 0;
    }
    if (SN.occ[idx(nx, ny)]) {
      if (!grow) {
        // 把尾巴放回去再死（画面上不会少一格）
      }
      return snakeDie(fg);
    }
    SN.body.unshift([nx, ny]);
    SN.occ[idx(nx, ny)] = 1;
    if (grow) {
      const s = G.s;
      const len = SN.body.length;
      let val = G.m.food * len;
      if (gold) {
        val *= 10;
        SN.gold = null;
      } else SN.foods.splice(fi, 1);
      const got = E.gain('px', val, ai ? 'auto' : undefined);
      s.stats.foods++;
      if (len > s.stats.maxLen) s.stats.maxLen = len;
      if (fg && R.tab === 'snake') {
        R.floats.push({ x: GX + nx * CELL, y: GY + ny * CELL, v: got, t: 0, gold });
        gold ? sfx.gold() : sfx.eat(len);
      }
      placeFoods();
      if (G.m.gold && !SN.gold && Math.random() < 0.08) {
        const c = freeCell();
        if (c) SN.gold = { x: c[0], y: c[1], t: 7 };
      }
      if (len >= SW * SH || (!SN.foods.length && !freeCell())) snakeFill(fg);
    }
  }
  function snakeDie(fg) {
    G.s.stats.deaths++;
    SN.dead = 0.5;
    if (fg && R.tab === 'snake') sfx.die(), (R.shake = 0.25);
    snakeReset(false);
  }
  function snakeFill(fg) {
    const s = G.s;
    s.stats.fills++;
    E.gain('px', G.m.food * SW * SH * 60, 'bonus');
    R.flash = 1;
    if (fg) sfx.fill();
    snakeReset(false);
  }
  function updateSnake(dt, fg) {
    if (SN.dead > 0) {
      SN.dead -= dt;
      return;
    }
    if (SN.gold) {
      SN.gold.t -= dt;
      if (SN.gold.t <= 0) SN.gold = null;
    }
    SN.acc += dt * snakeSpeed();
    let n = 0;
    while (SN.acc >= 1 && n++ < 80) {
      SN.acc -= 1;
      snakeStep(fg);
    }
  }

  // ---------------- 打砖块 ----------------
  const ROWC = ['#F83800', '#FCA044', '#F8B800', '#58D854', '#3CBCFC', '#9878F8'];
  function brkWall() {
    BK.bricks = [];
    const hp = 1 + Math.floor(BK.level / 3);
    for (let r = 0; r < 6; r++) for (let c = 0; c < 10; c++) BK.bricks.push({ x: 1 + c * 24, y: 20 + r * 10, w: 22, h: 8, hp, row: r });
  }
  function padW() {
    return Math.round(30 * G.m.padW);
  }
  function brkBalls() {
    const n = U.clamp(G.m.balls, 1, 5);
    while (BK.balls.length < n) BK.balls.push({ x: BK.px, y: 178, vx: 0, vy: 0, stuck: 0.6 + BK.balls.length * 0.3, pierce: 0 });
    while (BK.balls.length > n) BK.balls.pop();
  }
  function padAuto() {
    if (G.botAssist && R.tab === 'brk') return true;
    return G.m.padAI > 0 && G.s.time - BK.manualT > 2.5;
  }
  function updateBreakout(dt, fg) {
    if (!BK.init) {
      BK.level = G.s.e[2].brkLevel || 0;
      brkWall();
      BK.init = true;
    }
    brkBalls();
    const pw = padW();
    // 挡板控制
    if (fg && R.tab === 'brk' && !padAuto() && !G.ui.blocked) {
      const mx = G.ui.mx - GX;
      if (G.ui.over(GX, GY, GW, GH) && Math.abs(mx - BK.lastMx) > 0.3) {
        BK.px = mx;
        BK.manualT = G.s.time;
      }
      BK.lastMx = mx;
      if (I.held.ArrowLeft || I.held.KeyA) (BK.px -= 240 * dt), (BK.manualT = G.s.time);
      if (I.held.ArrowRight || I.held.KeyD) (BK.px += 240 * dt), (BK.manualT = G.s.time);
    } else if (fg && R.tab === 'brk' && (I.held.ArrowLeft || I.held.ArrowRight || I.held.KeyA || I.held.KeyD)) BK.manualT = G.s.time;
    if (padAuto()) {
      let tgt = null, ty = -1;
      for (const b of BK.balls) if (!b.stuck && b.vy > 0 && b.y > ty) (ty = b.y), (tgt = b);
      if (tgt) {
        let x = tgt.x;
        if (G.m.padAI >= 2) {
          const t = (182 - tgt.y) / tgt.vy;
          x = tgt.x + tgt.vx * t;
          const span = GW - 4;
          x = (((x - 2) % (2 * span)) + 2 * span) % (2 * span);
          if (x > span) x = 2 * span - x;
          x += 2;
        }
        const sp = G.m.padAI >= 2 ? 600 : 170;
        BK.px += U.clamp(x - BK.px, -sp * dt, sp * dt);
      }
    }
    BK.px = U.clamp(BK.px, pw / 2, GW - pw / 2);
    const speed = 135 * (1 + Math.min(1, BK.level * 0.05));
    const SUB = 3;
    for (const b of BK.balls) {
      if (b.stuck > 0) {
        b.stuck -= dt;
        b.x = BK.px;
        b.y = 178;
        if (b.stuck <= 0) {
          const a = U.rand(-0.6, 0.6);
          b.vx = Math.sin(a) * speed;
          b.vy = -Math.cos(a) * speed;
        }
        continue;
      }
      for (let k = 0; k < SUB; k++) {
        const h = dt / SUB;
        b.x += b.vx * h;
        b.y += b.vy * h;
        if (b.x < 2) (b.x = 2), (b.vx = Math.abs(b.vx)), fg && R.tab === 'brk' && sfx.wall();
        if (b.x > GW - 2) (b.x = GW - 2), (b.vx = -Math.abs(b.vx)), fg && R.tab === 'brk' && sfx.wall();
        if (b.y < 2) (b.y = 2), (b.vy = Math.abs(b.vy)), fg && R.tab === 'brk' && sfx.wall();
        // 挡板
        if (b.vy > 0 && b.y >= 180 && b.y <= 186 && Math.abs(b.x - BK.px) <= pw / 2 + 2) {
          const off = U.clamp((b.x - BK.px) / (pw / 2), -1, 1);
          const sp = Math.hypot(b.vx, b.vy);
          b.vx = Math.sin(off * 1.05) * sp;
          b.vy = -Math.cos(off * 1.05) * sp;
          b.y = 179;
          b.pierce = G.m.pierce;
          if (fg && R.tab === 'brk') sfx.paddle();
        }
        // 砖块
        for (const br of BK.bricks) {
          if (br.hp <= 0) continue;
          if (b.x < br.x - 1 || b.x > br.x + br.w + 1 || b.y < br.y - 1 || b.y > br.y + br.h + 1) continue;
          br.hp--;
          if (br.hp <= 0) {
            const val = G.m.brick * (6 - br.row) * Math.pow(1.6, BK.level);
            const got = E.gain('px', val, padAuto() ? 'auto' : undefined);
            G.s.stats.bricks++;
            if (fg && R.tab === 'brk') {
              R.floats.push({ x: GX + br.x + 4, y: GY + br.y, v: got, t: 0, brk: true });
              sfx.brick(br.row);
            }
          }
          if (b.pierce > 0 && br.hp <= 0) b.pierce--;
          else {
            const ox = Math.min(Math.abs(b.x - br.x), Math.abs(b.x - br.x - br.w));
            const oy = Math.min(Math.abs(b.y - br.y), Math.abs(b.y - br.y - br.h));
            if (ox < oy) b.vx = -b.vx;
            else b.vy = -b.vy;
          }
          break;
        }
        if (b.y > GH + 4) {
          b.stuck = 0.9;
          break;
        }
      }
    }
    if (BK.bricks.every((br) => br.hp <= 0)) {
      const bonus = G.m.brick * 21 * 10 * 10 * Math.pow(1.6, BK.level);
      E.gain('px', bonus, 'bonus');
      G.s.stats.walls = (G.s.stats.walls || 0) + 1;
      BK.level++;
      G.s.e[2].brkLevel = BK.level;
      brkWall();
      if (fg && R.tab === 'brk') sfx.clear(), (R.flash = 0.6);
    }
  }

  // ---------------- 更新 ----------------
  function update(dt, fg) {
    const st = G.s.e[2];
    if (!st.started) {
      if (fg && R.intro >= 1) {
        const k = I.take((k) => !k.repeat && k.key !== 'Escape');
        if (k || G.ui.click(0, 0, W, H)) {
          st.started = 1;
          G.s.flags.e2started = 1;
          A.tone({ n: 88, d: 0.25, v: 0.06, type: 'p25', env: 'hold', r: 0.1 });
          era.music();
        }
      }
      return;
    }
    // 输入
    if (fg) {
      for (const k of I.keys) {
        if (k.repeat) continue;
        const map = { ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] };
        const d = map[k.code];
        if (d && R.tab === 'snake') {
          if (SN.q.length < 3) SN.q.push(d);
          SN.manualT = G.s.time;
        }
        if (k.code === 'Tab' && E.has('brk')) R.tab = R.tab === 'snake' ? 'brk' : 'snake';
      }
    }
    if (G.botAssist && fg && E.has('brk') && Math.random() < dt / 40) R.tab = R.tab === 'snake' ? 'brk' : 'snake';
    const snakeRun = (fg && R.tab === 'snake') || G.m.snakeAI > 0;
    if (snakeRun) updateSnake(dt, fg);
    if (E.has('brk')) {
      const brkRun = (fg && R.tab === 'brk') || G.m.padAI > 0;
      if (brkRun) updateBreakout(dt, fg);
    }
    for (const f of R.floats) f.t += dt;
    R.floats = R.floats.filter((f) => f.t < 0.9);
    R.palSweep = Math.min(1, R.palSweep + dt / 0.8);
    R.flash = Math.max(0, R.flash - dt * 1.5);
    R.shake = Math.max(0, R.shake - dt);
    const n = G.s.lineN || 0;
    if (R.tw.n < n) {
      R.tw.n = n;
      R.tw.k = 0;
    }
    const before = Math.floor(R.tw.k);
    R.tw.k += dt * 24;
    if (fg && Math.floor(R.tw.k) !== before && Math.floor(R.tw.k) % 2 === 0) {
      const last = lastLine();
      if (last && R.tw.k < [...last.text].length + 1) sfx.blip();
    }
  }
  function lastLine() {
    const l = G.s.log;
    for (let i = l.length - 1; i >= 0; i--) if (l[i].kind === 'dot' || l[i].kind === 'sys') return l[i];
    return null;
  }

  // ---------------- 绘制 ----------------
  function box(ctx, x, y, w, h, fill = '#0000BC') {
    ctx.fillStyle = C('#000000');
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = C('#FCFCFC');
    ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    ctx.fillStyle = C(fill);
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    // 圆角：抠掉四个角
    ctx.fillStyle = C('#000000');
    ctx.fillRect(x + 1, y + 1, 1, 1);
    ctx.fillRect(x + w - 2, y + 1, 1, 1);
    ctx.fillRect(x + 1, y + h - 2, 1, 1);
    ctx.fillRect(x + w - 2, y + h - 2, 1, 1);
  }
  function text(ctx, str, x, y, col = '#FCFCFC', opt = {}) {
    return F().draw(ctx, str, x, y, C(col), Object.assign({ shadow: opt.noShadow ? undefined : C('#000000') }, opt));
  }
  function dropY(i) {
    // 开场：面板像方块一样掉下来
    if (R.intro >= 1) return 0;
    const t0 = era.INTRO[i];
    const u = U.clamp((R.intro - t0) / 0.22, 0, 1);
    if (u <= 0) return -400;
    const b = (t) => {
      const n1 = 7.5625, d1 = 2.75;
      if (t < 1 / d1) return n1 * t * t;
      if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
      if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    };
    return -Math.round((1 - b(u)) * 280);
  }

  function render() {
    G.ui.space(W, H);
    R.hoverDef = null;
    R.hoverDock = null;
    // 调色板扫过：旧调色板画一份，新调色板画一份，按扫描线拼起来
    if (R.palSweep < 1 && R.prevGroups) {
      const blk = G.ui.blocked;
      forceGroups = R.prevGroups;
      G.ui.blocked = true;
      draw(R.tctx);
      G.ui.blocked = blk;
      forceGroups = null;
      draw(R.ctx);
      const y = Math.floor(U.ease.inOutQuad(R.palSweep) * H);
      R.ctx.drawImage(R.tmp, 0, y, W, H - y, 0, y, W, H - y);
      R.ctx.fillStyle = '#FCFCFC';
      R.ctx.fillRect(0, y, W, 1);
    } else draw(R.ctx);
    return R.fb;
  }

  function draw(ctx) {
    const s = G.s, st = s.e[2];
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = C('#000000');
    ctx.fillRect(0, 0, W, H);
    if (R.shake > 0) ctx.translate(Math.round(U.rand(-2, 2)), Math.round(U.rand(-1, 1)));
    const blocked0 = G.ui.blocked;
    if (R.letterOpen) G.ui.blocked = true;

    drawTop(ctx, dropY(0));
    drawGame(ctx, dropY(1));
    drawShop(ctx, dropY(2));
    drawDock(ctx, dropY(3));
    drawMsg(ctx, dropY(4));
    if (G.visiting(2)) drawBack(ctx);
    G.ui.blocked = blocked0;
    if (R.letterOpen) drawLetter(ctx);
    if (R.flash > 0) {
      ctx.globalAlpha = R.flash * 0.6;
      ctx.fillStyle = C('#FCFCFC');
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
    if (R.intro >= 1) drawCursor(ctx);
  }

  function drawTop(ctx, oy) {
    if (oy <= -300) return;
    const s = G.s;
    ctx.fillStyle = C('#000000');
    ctx.fillRect(0, oy, W, 16);
    ctx.fillStyle = C('#3CBCFC');
    ctx.fillRect(0, oy + 15, W, 1);
    let x = 4;
    x += text(ctx, '像素 ', x, oy + 2, '#BCBCBC');
    x += text(ctx, U.fmt(s.res.px), x, oy + 2, '#F8B800');
    x += text(ctx, ' +' + U.fmt(E.shown('px'), 1) + '/秒', x, oy + 2, '#7C7C7C');
    text(ctx, '向量 ' + U.fmt(s.res.vec), 196, oy + 2, '#A4E4FC');
    text(ctx, '比特 ' + U.fmt(s.res.bits), 290, oy + 2, '#58D854');
    if (s.msg > 0) {
      const t = `留言${G.letter.pct()}%`;
      const hov = G.ui.over(380, oy, 56, 15);
      text(ctx, t, 382, oy + 2, hov ? '#F8B800' : '#7C7C7C');
      if (G.ui.click(380, oy, 56, 15)) R.letterOpen = 1;
    }
    const hov = G.ui.over(442, oy, 38, 15);
    text(ctx, '菜单', 448, oy + 2, hov ? '#F8B800' : '#BCBCBC');
    if (G.ui.click(442, oy, 38, 15)) G.ui.openMenu();
  }

  function drawGame(ctx, oy) {
    if (oy <= -300) return;
    const st = G.s.e[2];
    // 页签
    const tabs = [['snake', '贪吃蛇']];
    if (E.has('brk')) tabs.push(['brk', '打砖块']);
    let tx = GX - 2;
    for (const [id, name] of tabs) {
      const w = F().width(name) + 10;
      const on = R.tab === id;
      ctx.fillStyle = C(on ? '#FCFCFC' : '#7C7C7C');
      ctx.fillRect(tx, oy + 18, w, 12);
      ctx.fillStyle = C(on ? '#0000BC' : '#000000');
      ctx.fillRect(tx + 1, oy + 19, w - 2, 11);
      text(ctx, name, tx + 5, oy + 18, on ? '#FCFCFC' : '#7C7C7C', { noShadow: true });
      if (G.ui.click(tx, oy + 18, w, 12)) R.tab = id;
      tx += w + 2;
    }
    if (tabs.length > 1) text(ctx, 'Tab', tx + 2, oy + 18, '#787878', { noShadow: true });
    // 外框
    ctx.fillStyle = C('#FCFCFC');
    ctx.fillRect(GX - 2, GY - 2 + oy, GW + 4, GH + 4);
    ctx.fillStyle = C('#000000');
    ctx.fillRect(GX - 1, GY - 1 + oy, GW + 2, GH + 2);
    ctx.save();
    ctx.beginPath();
    ctx.rect(GX, GY + oy, GW, GH);
    ctx.clip();
    ctx.translate(0, oy);
    if (!st.started) drawStart(ctx);
    else if (R.tab === 'snake') drawSnake(ctx);
    else drawBreakout(ctx);
    // 飘字
    for (const f of R.floats) {
      const y = Math.round(f.y - 6 - f.t * 18);
      if (!!f.brk === (R.tab === 'brk')) text(ctx, '+' + U.fmt(f.v), f.x, y, f.gold ? '#F8B800' : '#FCFCFC');
    }
    ctx.restore();
  }

  function drawStart(ctx) {
    if (R.intro < 0.75) return;
    const blink = Math.floor(G.t * 2.5) % 2 === 0;
    text(ctx, '从一个点开始', GX + GW / 2, GY + 70, '#FCFCFC', { align: 'center', scale: 2 });
    if (blink && R.intro >= 1) text(ctx, '按任意键开始', GX + GW / 2, GY + 120, '#FCFCFC', { align: 'center' });
    ctx.fillStyle = C('#FCFCFC');
    ctx.fillRect(GX + GW / 2 - 1, GY + 150, 3, 3);
  }

  function cellRect(ctx, x, y, col, inset = 1) {
    ctx.fillStyle = C(col);
    ctx.fillRect(GX + x * CELL, GY + y * CELL, CELL - inset, CELL - inset);
  }
  function drawSnake(ctx) {
    // 格子底纹
    ctx.fillStyle = C('#000000');
    ctx.fillRect(GX, GY, GW, GH);
    ctx.fillStyle = C('#202020');
    for (let y = 0; y < SH; y += 1) for (let x = (y % 2); x < SW; x += 2) ctx.fillRect(GX + x * CELL + 3, GY + y * CELL + 3, 1, 1);
    // 食物：苹果
    for (const f of SN.foods) {
      cellRect(ctx, f[0], f[1], '#F83800', 2);
      ctx.fillStyle = C('#58D854');
      ctx.fillRect(GX + f[0] * CELL + 3, GY + f[1] * CELL - 1, 2, 2);
    }
    if (SN.gold && (SN.gold.t > 2 || Math.floor(G.t * 8) % 2)) {
      cellRect(ctx, SN.gold.x, SN.gold.y, '#F8B800', 1);
      ctx.fillStyle = C('#FCFCFC');
      ctx.fillRect(GX + SN.gold.x * CELL + 1, GY + SN.gold.y * CELL + 1, 2, 2);
    }
    // 蛇
    const dead = SN.dead > 0 && Math.floor(G.t * 12) % 2;
    if (!dead) {
      const n = SN.body.length;
      for (let i = n - 1; i >= 0; i--) {
        const [x, y] = SN.body[i];
        const col = i === 0 ? '#FCFCFC' : i % 4 === 0 ? '#00A800' : '#58D854';
        cellRect(ctx, x, y, col, 1);
      }
      // 眼睛
      const [hx, hy] = SN.body[0];
      if (n > 1 || SN.dir[0] || SN.dir[1]) {
        ctx.fillStyle = C('#000000');
        const dx = SN.dir[0], dy = SN.dir[1];
        const cx = GX + hx * CELL + 3 + dx * 2, cy = GY + hy * CELL + 3 + dy * 2;
        ctx.fillRect(cx - (dy ? 1 : 0), cy - (dx ? 1 : 0), 1, 1);
        ctx.fillRect(cx + (dy ? 1 : 0), cy + (dx ? 1 : 0), 1, 1);
      }
    }
    // 状态
    const ai = aiOn() ? ['', '贪心', '寻路', '哈密顿'][G.m.snakeAI] : '';
    ctx.restore();
    ctx.save();
    text(ctx, `长度 ${SN.body.length}` + (ai ? ` AI:${ai}` : ''), GX + GW, GY - 14, '#BCBCBC', { align: 'right' });
    ctx.beginPath();
    ctx.rect(GX, GY, GW, GH);
    ctx.clip();
    if (!SN.dir[0] && !SN.dir[1] && !aiOn() && SN.body.length === 1 && Math.floor(G.t * 2) % 2)
      text(ctx, '方向键 / WASD', GX + GW / 2, GY + GH / 2 + 14, '#BCBCBC', { align: 'center' });
  }

  function drawBreakout(ctx) {
    ctx.fillStyle = C('#000000');
    ctx.fillRect(GX, GY, GW, GH);
    for (const br of BK.bricks) {
      if (br.hp <= 0) continue;
      const col = ROWC[br.row];
      ctx.fillStyle = C(col);
      ctx.fillRect(GX + br.x, GY + br.y, br.w, br.h);
      ctx.fillStyle = C('#FCFCFC');
      ctx.fillRect(GX + br.x, GY + br.y, br.w, 1);
      if (br.hp > 1) {
        ctx.fillStyle = C('#000000');
        ctx.fillRect(GX + br.x + 9, GY + br.y + 3, 4, 2);
      }
    }
    const pw = padW();
    ctx.fillStyle = C('#BCBCBC');
    ctx.fillRect(Math.round(GX + BK.px - pw / 2), GY + 182, pw, 4);
    ctx.fillStyle = C('#FCFCFC');
    ctx.fillRect(Math.round(GX + BK.px - pw / 2), GY + 182, pw, 1);
    for (const b of BK.balls) {
      ctx.fillStyle = C('#FCFCFC');
      ctx.fillRect(Math.round(GX + b.x - 1), Math.round(GY + b.y - 1), 3, 3);
    }
    const ai = padAuto() ? ' AI' : '';
    ctx.restore();
    ctx.save();
    text(ctx, `第 ${BK.level + 1} 面墙${ai}`, GX + GW, GY - 14, '#BCBCBC', { align: 'right' });
    ctx.beginPath();
    ctx.rect(GX, GY, GW, GH);
    ctx.clip();
  }

  const TABS = [['main', '升级'], ['pal', '调色板'], ['mus', '音乐']];
  function drawShop(ctx, oy) {
    if (oy <= -300) return;
    const x = 254, y = 17 + oy, w = 222, h = 210;
    box(ctx, x, y, w, h);
    // 页签
    let tx = x + 4;
    for (const [id, name] of TABS) {
      const list = E.list(2, id);
      if (!list.length && id !== 'main') continue;
      const tw = F().width(name) + 8;
      const on = R.shopTab === id;
      const can = list.some((d) => E.canBuy(d));
      if (on) {
        ctx.fillStyle = C('#FCFCFC');
        ctx.fillRect(tx, y + 3, tw, 13);
      }
      text(ctx, name, tx + 4, y + 3, on ? '#0000BC' : can ? '#F8B800' : '#BCBCBC', { noShadow: on });
      if (G.ui.click(tx, y + 3, tw, 13)) {
        R.shopTab = id;
        R.scroll = 0;
        sfx.move();
      }
      tx += tw + 4;
    }
    ctx.fillStyle = C('#FCFCFC');
    ctx.fillRect(x + 3, y + 17, w - 6, 1);
    // 列表
    const list = E.list(2, R.shopTab, R.shopTab !== 'main');
    const RH = 15, top = y + 20, vis = Math.floor((h - 24) / RH);
    const maxS = Math.max(0, list.length - vis);
    if (G.ui.over(x, y, w, h) && I.wheel) R.scroll = U.clamp(R.scroll + Math.sign(I.wheel), 0, maxS);
    R.scroll = U.clamp(R.scroll, 0, maxS);
    if (!list.length) {
      text(ctx, '还买不起任何东西。', x + 10, top + 4, '#BCBCBC');
      text(ctx, '吃点东西吧。', x + 10, top + 20, '#BCBCBC');
    }
    list.slice(R.scroll, R.scroll + vis).forEach((d, i) => {
      const ry = top + i * RH;
      const r = G.ui.buy(d, x + 3, ry, w - 6, RH);
      const owned = E.maxed(d);
      const col = owned ? '#787878' : r.can ? (d.type === 'goal' ? '#F8B800' : '#FCFCFC') : '#7C7C7C';
      if (r.hover) {
        R.hoverDef = d;
        // RPG 菜单光标
        const bx = x + 4 + (Math.floor(G.t * 4) % 2);
        ctx.fillStyle = C('#FCFCFC');
        for (let k = 0; k < 4; k++) ctx.fillRect(bx + k, ry + 3 + k, 1, 8 - k * 2);
      }
      let name = d.name;
      const lv = E.lv(d.id);
      if (d.type === 'level') name += ' ' + ['I', 'II', 'III', 'IV'][Math.min(lv, d.costs.length - 1)];
      if (d.type === 'gen' && lv) name += ' ×' + lv;
      if (d.tab === 'pal') {
        // 色块预览
        const g = GROUPS.find((g) => 'pal_' + g.id === d.id);
        const cols = NES.filter((c) => GROUP_OF[c] === g.id).slice(0, 4);
        cols.forEach((c, k) => {
          ctx.fillStyle = E.has(d.id) ? C(c) : '#7C7C7C';
          ctx.fillRect(x + 30 + k * 7, ry + 3, 6, 8);
        });
        text(ctx, name, x + 12, ry + 1, col);
      } else text(ctx, name, x + 12, ry + 1, col);
      const c = E.cost(d);
      const ct = owned ? (d.tab === 'mus' || d.tab === 'pal' ? '已有' : '已满') : Object.keys(c).map((k) => U.fmt(c[k]) + (k === 'px' ? '' : E.NAME[k])).join('+');
      text(ctx, ct, x + w - 8, ry + 1, col, { align: 'right' });
    });
    if (maxS > 0) {
      const sh = Math.max(8, Math.floor((h - 24) * (vis / list.length)));
      const sy = top + Math.floor((h - 26 - sh) * (R.scroll / maxS));
      ctx.fillStyle = C('#BCBCBC');
      ctx.fillRect(x + w - 4, sy, 1, sh);
    }
  }

  function drawDock(ctx, oy) {
    if (oy <= -300) return;
    const items = [
      { id: 0, x: 4, y: 231, w: 64, h: 36, name: '终端' },
      { id: 1, x: 72, y: 231, w: 64, h: 36, name: 'Pong' },
    ];
    for (const it of items) {
      const y = it.y + oy;
      const hov = G.ui.over(it.x, y, it.w, it.h);
      ctx.fillStyle = C(hov ? '#F8B800' : '#BCBCBC');
      ctx.fillRect(it.x - 1, y - 1, it.w + 2, it.h + 2);
      if (it.id === 0) G.eras[0].renderMini(ctx, it.x, y, it.w, it.h, { pixel: true, colors: [C('#58D854'), C('#007800')] });
      else G.eras[1].renderMini(ctx, it.x, y, it.w, it.h, { pixel: true, color: C('#FCFCFC') });
      if (hov) R.hoverDock = it;
      if (G.ui.click(it.x, y, it.w, it.h)) {
        const k = G.VW / W;
        G.visit(it.id, [it.x * k, it.y * k, it.w * k, it.h * k]);
      }
    }
  }

  function drawMsg(ctx, oy) {
    if (oy <= -300) return;
    const x = 140, y = 229 + oy, w = 336, h = 40;
    box(ctx, x, y, w, h);
    const F12 = F();
    const d = R.hoverDef;
    if (d) {
      const c = E.cost(d);
      text(ctx, d.name, x + 8, y + 5, '#F8B800');
      const ct = E.maxed(d) ? '' : E.costText(c);
      text(ctx, ct, x + w - 8, y + 5, E.afford(c) ? '#FCFCFC' : '#F87858', { align: 'right' });
      text(ctx, d.desc + (d.type === 'gen' ? '（Shift 买满）' : ''), x + 8, y + 21, '#FCFCFC');
      return;
    }
    if (R.hoverDock) {
      text(ctx, `点击回到「${R.hoverDock.name}」。旧时代一直在运转。`, x + 8, y + 13, '#FCFCFC');
      return;
    }
    const lines = G.s.log.filter((l) => l.kind === 'dot' || l.kind === 'sys').slice(-2);
    lines.forEach((l, i) => {
      const newest = i === lines.length - 1;
      let str = (l.kind === 'sys' ? '※' : '') + l.text;
      const max = Math.floor((w - 20) / 12);
      if ([...str].length > max) str = [...str].slice(0, max - 1).join('') + '…';
      const shown = newest && l.n === R.tw.n ? Math.floor(R.tw.k) : 999;
      text(ctx, str, x + 8, y + 5 + (lines.length === 1 ? 8 : i * 16), newest ? '#FCFCFC' : '#7C7C7C', { max: shown });
    });
    if (R.tw.k > 40 && Math.floor(G.t * 2) % 2) {
      ctx.fillStyle = C('#FCFCFC');
      ctx.fillRect(x + w - 10, y + h - 8, 4, 2);
      ctx.fillRect(x + w - 9, y + h - 6, 2, 1);
    }
  }

  function drawBack(ctx) {
    const hov = G.ui.over(380, 1, 100, 14);
    ctx.fillStyle = C('#000000');
    ctx.fillRect(372, 0, 108, 15);
    text(ctx, '◀ 返回 Esc', 380, 2, hov ? '#F8B800' : '#FCFCFC');
    if (G.ui.click(372, 0, 108, 15)) G.unvisit();
  }

  function drawLetter(ctx) {
    box(ctx, 40, 60, 400, 130);
    text(ctx, `留言.txt（${G.letter.pct()}% 可读）`, 52, 68, '#F8B800');
    const txt = G.letter.view(G.s.msg, '■');
    const lines = F().wrap(txt, 372);
    lines.forEach((l, i) => text(ctx, l, 52, 88 + i * 16, '#FCFCFC'));
    text(ctx, '（点击关闭）', 428, 172, '#BCBCBC', { align: 'right' });
    if (G.input.pressed && !G.input.used) {
      G.input.used = true;
      R.letterOpen = 0;
    }
  }

  const CURSOR = [
    'X.........',
    'XX........',
    'XWX.......',
    'XWWX......',
    'XWWWX.....',
    'XWWWWX....',
    'XWWWWWX...',
    'XWWWWWWX..',
    'XWWWXXXXX.',
    'XWXWX.....',
    'XX.XWX....',
    '....XX....',
  ];
  function drawCursor(ctx) {
    if (!G.input.inside || G.ui.menuOpen()) return;
    const mx = Math.round(G.ui.mx), my = Math.round(G.ui.my);
    for (let y = 0; y < CURSOR.length; y++)
      for (let x = 0; x < CURSOR[y].length; x++) {
        const c = CURSOR[y][x];
        if (c === '.') continue;
        ctx.fillStyle = c === 'X' ? C('#000000') : C('#FCFCFC');
        ctx.fillRect(mx + x, my + y, 1, 1);
      }
  }

  function display() {
    return { nearest: true, curve: 0.022, scan: 0.2, scanN: 270, vig: 0.35, corner: 0.02, bloom: 0.18, bloomR: 3, bloomT: 0.5, chroma: 0.7, noise: 0.018 };
  }

  // ---------------- 小窗 ----------------
  function renderMini(ctx, x, y, w, h, opt = {}) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = '#000';
    ctx.fillRect(x, y, w, h);
    const cw = w / SW, ch = h / SH;
    const col = (c) => (opt.raw ? c : C(c));
    if (R.tab === 'brk' && !opt.snake) {
      const sx = w / GW, sy = h / GH;
      for (const br of BK.bricks) {
        if (br.hp <= 0) continue;
        ctx.fillStyle = col(ROWC[br.row]);
        ctx.fillRect(x + br.x * sx, y + br.y * sy, br.w * sx, Math.max(1, br.h * sy));
      }
      ctx.fillStyle = col('#FCFCFC');
      ctx.fillRect(x + (BK.px - padW() / 2) * sx, y + 182 * sy, padW() * sx, Math.max(1, 3 * sy));
      for (const b of BK.balls) ctx.fillRect(x + b.x * sx - 1, y + b.y * sy - 1, 2, 2);
    } else {
      for (const f of SN.foods) {
        ctx.fillStyle = col('#F83800');
        ctx.fillRect(x + f[0] * cw, y + f[1] * ch, Math.max(1, cw), Math.max(1, ch));
      }
      SN.body.forEach(([bx, by], i) => {
        ctx.fillStyle = col(i === 0 ? '#FCFCFC' : '#58D854');
        ctx.fillRect(x + bx * cw, y + by * ch, Math.max(1, cw - (cw > 3 ? 1 : 0)), Math.max(1, ch - (ch > 3 ? 1 : 0)));
      });
    }
    ctx.restore();
  }
})();
