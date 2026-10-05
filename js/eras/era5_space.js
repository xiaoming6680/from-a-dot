'use strict';
// 时代 5 · 3D（3 维：体）—— 点亮宇宙。立方体的五个面是前五个时代的实时画面，第六面是黑的。
(() => {
  const U = G.U, E = G.econ, I = G.input, A = G.audio, M = G.gl3d;
  const FONT = '"Microsoft YaHei UI", "Segoe UI", sans-serif';
  const NUMF = '"Segoe UI", "Microsoft YaHei UI", sans-serif';
  const GOAL = 1e68;
  const MAXSTARS = 20000;

  // ---------------- 升级 ----------------
  G.econ.hook((m) => {
    m.r = 0.025; // 宇宙膨胀率（每秒）
    m.click = 1;
    m.lines = 0;
    m.neb = 0;
    m.gal = 0;
    m.weaver = 0;
  });
  E.define(5, [
    { id: 'grav', name: '引力', type: 'gen', desc: '膨胀率 +1%/秒', cost: { dots: 6 }, growth: 9, mod: (m, lv) => (m.r += 0.01 * lv) },
    { id: 'obs', name: '观测者', type: 'level', desc: '每次点击至少多放 10 倍的点', costs: [{ dots: 30 }, { dots: 1e5 }, { dots: 1e11 }], mod: (m, lv) => (m.click *= Math.pow(10, lv)) },
    { id: 'line', name: '线 · 星座', type: 'level', desc: '星星之间连起线。膨胀率 ×1.2', tag: 'visual',
      costs: [{ dots: 60 }, { dots: 1e6 }, { dots: 1e14 }, { dots: 1e24 }], mod: (m, lv) => { m.lines = lv; m.rMul = (m.rMul || 1) * Math.pow(1.2, lv); } },
    { id: 'neb', name: '面 · 星云', type: 'level', desc: '彩色的星云。膨胀率 ×1.2', tag: 'visual',
      costs: [{ dots: 3000 }, { dots: 1e9 }, { dots: 1e18 }, { dots: 1e30 }], mod: (m, lv) => { m.neb = lv; m.rMul = (m.rMul || 1) * Math.pow(1.2, lv); } },
    { id: 'gal', name: '体 · 星系', type: 'level', desc: '旋转的星系。膨胀率 ×1.2', tag: 'visual',
      costs: [{ dots: 2e5 }, { dots: 1e12 }, { dots: 1e22 }, { dots: 1e36 }], mod: (m, lv) => { m.gal = lv; m.rMul = (m.rMul || 1) * Math.pow(1.2, lv); } },
    { id: 'weaver', name: '星座编织者', desc: '自动完成星座', cost: { dots: 1e8 }, tag: 'auto', mod: (m) => (m.weaver = 1) },
    { id: 'dark', name: '暗能量', type: 'gen', desc: '膨胀率 +4%/秒', cost: { dots: 1e10 }, growth: 1000, max: 8, mod: (m, lv) => (m.r += 0.04 * lv) },
    { id: 'back5', name: '回溯 · 立方体', desc: '五个面上的旧时代全部 ×1000', cost: { dots: 1e15 }, tag: 'back',
      mod: (m) => { for (const r of ['bits', 'vec', 'px', 'dust', 'lux']) m.all[r] *= 1000; } },
    { id: 'decode5', name: '解码 · 留言', desc: '只差最后几个字了', cost: { dots: 1e20 }, tag: 'back', onBuy: () => G.letter.reveal(0.25) },
    { id: 'final', name: '无量大数', type: 'goal', desc: '宇宙满了。', cost: { dots: GOAL }, reveal: 1e-30,
      onBuy() { G.s.res.dots = GOAL; G.startFx('ending'); } },
  ]);

  // ---------------- 剧情 ----------------
  G.story.def([
    { id: 'e5.start', era: 5, when: (s) => s.e[5].started, say: ['我是第一颗星。', '点一下空的地方，放下更多的点。拖动可以转身。'] },
    { id: 'e5.first', era: 5, when: (s) => s.stats.stars >= 3, say: '它们会自己变多。宇宙在膨胀。' },
    { id: 'e5.line', era: 5, when: (s) => s.own.line >= 1, say: '点连成线。我记得这个。' },
    { id: 'e5.neb', era: 5, when: (s) => s.own.neb >= 1, say: '线围成面。有颜色的面。' },
    { id: 'e5.gal', era: 5, when: (s) => s.own.gal >= 1, say: '面叠成体。它们在转。' },
    { id: 'e5.cube', era: 5, when: (s) => s.time - s.e[5].at > 50, say: ['那个立方体……是我所有的过去。', '终端、线、格子、远方、光。（点一面就能回去看看）', '只有一面是黑的。'] },
    { id: 'e5.con', era: 5, when: (s) => s.stats.constell >= 1, say: '一个星座。我们一起画的。' },
    { id: 'e5.big', era: 5, when: (s) => s.res.dots >= 1e52, say: '恒河沙。比河里的沙子还多。' },
    { id: 'e5.near', era: 5, when: (s) => s.res.dots >= 1e64, say: ['不可思议。', '快满了。'] },
    { id: 'e5.goal', era: 5, when: (s) => E.canBuy(E.defs.final), say: '无量。……准备好了吗？' },
  ]);

  // ---------------- 运行时 ----------------
  const R = {
    fb: null, ctx: null, cv: null, gl: null, ok: false,
    P: {}, B: {}, tex: [], faceCv: [], faceIdx: 0,
    cam: { yaw: 0.7, pitch: 0.35, dist: 9, ty: 0.7, tp: 0.35, td: 9 },
    intro: 1, hudA: 1, starsA: 1,
    faceBright: [1, 1, 1, 1, 1, 1],
    face6: null, // 第六面的内容（结局用）
    collapse: 0, // 0..1 星星被吸回中心
    freeze: false,
    user: [], userBuf: null, userDirty: true,
    vp: null, view: null, proj: null,
    drag: null, scroll: 0, hover: null,
    challenge: null, nextCh: 40,
    unitIdx: -1, unitCard: null,
    subs: [], lastN: 0,
    lineCount: 0,
    dotFly: null,
    letterOpen: 0,
    pointMax: 64,
  };

  const era = {
    id: 5, name: '3D', res: 'dots',
    fresh: () => ({ started: 0, at: 0 }),
    init() {
      R.fb = U.canvas(1600, 900);
      R.ctx = R.fb.getContext('2d');
      R.cv = U.canvas(1600, 900);
      for (let i = 0; i < 6; i++) R.faceCv[i] = U.canvas(512, 512);
      try {
        initGL();
      } catch (e) {
        console.warn('3D 初始化失败', e);
        R.ok = false;
      }
    },
    enter(fromFx, visiting) {
      R.lastN = G.s.lineN || 0;
      era.music();
    },
    leave() {},
    music() {
      if (G.music.cur && G.music.cur.song === SONG()) return G.music.setMask(musicMask(), 1);
      G.music.play(SONG(), { mask: musicMask(), fade: 3 });
    },
    update,
    render,
    display,
    renderMini: () => {},
    offline(sec) {
      if (G.s.era < 5 || !G.s.e[5].started) return;
      const s = G.s;
      const g = Math.min(Math.log(GOAL / Math.max(1, s.res.dots)), rate() * sec);
      if (g > 0) {
        const before = s.res.dots;
        s.res.dots = Math.min(GOAL, s.res.dots * Math.exp(g));
        s.tot.dots += s.res.dots - before;
      }
    },
    setIntro: (p) => (R.intro = p),
    scene: (o) => Object.assign(R, o),
    updateFace: (i) => R.ok && updateFace(i),
    addUserStar: (p) => {
      R.user.push({ p, t: 0, col: [1, 1, 1] });
      R.userDirty = true;
    },
    cam: R.cam,
    faces: () => R.faceBright,
    R,
    dotsVisible,
  };
  G.registerEra(era);
  G.econ.idleSkip = { dots: true };

  function rate() {
    return G.m.r * (G.m.rMul || 1);
  }

  // ---------------- 音乐：氛围 ----------------
  let songCache = null;
  function SONG() {
    if (songCache) return songCache;
    const Mu = G.music;
    // 主旋律放慢一倍
    const mel = Mu.melody(0).map(([st, n, len]) => [st * 2, n - 12, len * 2]);
    songCache = {
      bpm: 66, len: 512, vol: 0.9,
      tracks: [
        { gen(st, t, spb, out) {
            if (st % 32 !== 0) return;
            const ch = Mu.CHORD[Mu.THEME.chords[Math.floor(st / 32) % 16]];
            ch.tri.forEach((n, i) => A.pad({ t, n: n - 12, d: spb * 31, v: 0.028, type: 'sine', voices: 3, spread: 7, a: 2.2, r: 3, lp: 2200, out, rev: 0.7, pan: (i - 1) * 0.5 }));
            A.pad({ t, n: ch.root, d: spb * 31, v: 0.03, type: 'triangle', voices: 2, spread: 4, a: 2.5, r: 3, lp: 600, out, rev: 0.4 });
          } },
        { gen(st, t, spb, out) {
            if (st % 6 !== 0) return;
            const ch = Mu.CHORD[Mu.THEME.chords[Math.floor(st / 32) % 16]];
            const n = ch.tri[(st / 6) % 3] + 24;
            A.tone({ t, n, d: 1.4, v: 0.012, type: 'sine', out, echo: 0.4, rev: 0.6, pan: Math.sin(st) * 0.6 });
          } },
        { notes: mel, inst: (o) => A.tone({ t: o.t, n: o.n + 12, d: Math.min(2.4, o.d), v: 0.035, type: 'triangle', out: o.out, env: 'adsr', a: 0.08, dec: 0.4, s: 0.5, r: 1.2, rev: 0.6, echo: 0.25 }) },
        { gen(st, t, spb, out) {
            if (st % 16 === 0) A.tone({ t, f: 55, d: 1.5, v: 0.08, type: 'sine', out, env: 'hold', a: 0.3, r: 1.0 });
            if (st % 32 === 16) A.noise({ t, d: 3, v: 0.012, lp: 700, env: 'hold', a: 1.4, r: 1.4, out, rev: 0.5 });
          } },
      ],
    };
    return songCache;
  }
  function musicMask() {
    let m = 1;
    if (E.has('line')) m |= 2;
    if (E.has('neb')) m |= 4;
    if (E.has('gal')) m |= 8;
    return m;
  }
  G.bus.on('buy', (d, n, quiet) => {
    if (d.era !== 5 || d.type === 'goal' || quiet) return;
    const t = A.now();
    [81, 88, 93].forEach((n, i) => A.tone({ n, t: t + i * 0.09, d: 1.2, v: 0.03, type: 'sine', rev: 0.6, echo: 0.3 }));
    if (G.fgEra() === 5 && G.music.cur && G.music.cur.song === SONG()) G.music.setMask(musicMask(), 2);
    G.save.soon();
  });

  // ---------------- WebGL ----------------
  const VS_BG = `attribute vec2 aPos; varying vec2 vUv; void main(){ vUv = aPos*0.5+0.5; gl_Position = vec4(aPos,0.,1.); }`;
  const FS_BG = `precision highp float; varying vec2 vUv; uniform float uT; uniform vec2 uRot; uniform float uNeb; uniform float uA;
float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y); }
float fbm(vec2 p){ float s=0., a=.5; for(int i=0;i<5;i++){ s+=a*n(p); p*=2.03; a*=.5; } return s; }
void main(){
  vec2 p = vUv*vec2(1.7778,1.) + uRot*vec2(0.6,0.4);
  vec3 c = mix(vec3(0.012,0.014,0.04), vec3(0.03,0.02,0.07), vUv.y);
  float f = fbm(p*1.6 + uT*0.01);
  float g = fbm(p*3.1 - uT*0.015 + f);
  vec3 neb = mix(vec3(0.25,0.1,0.45), vec3(0.05,0.35,0.5), g) * smoothstep(0.45, 0.95, f) * (0.25 + uNeb*0.35);
  gl_FragColor = vec4((c + neb) * uA, 1.);
}`;
  const VS_PT = `attribute vec3 aPos; attribute vec3 aCol; attribute float aSize; attribute float aPh;
uniform mat4 uVP; uniform float uT; uniform float uScale; uniform float uSpin; uniform vec3 uCenter; uniform float uCollapse; uniform float uMax;
varying vec3 vCol;
void main(){
  vec3 p = aPos;
  if (uSpin != 0.) {
    vec3 q = p - uCenter; float r = length(q.xz); float a = uSpin * uT / (0.4 + r*0.25);
    float c = cos(a), s = sin(a); q.xz = vec2(c*q.x - s*q.z, s*q.x + c*q.z); p = uCenter + q;
  }
  p *= (1. - uCollapse);
  gl_Position = uVP * vec4(p,1.);
  float tw = 0.75 + 0.25*sin(uT*(1.5+aPh*2.) + aPh*40.);
  gl_PointSize = clamp(aSize * uScale / max(0.5, gl_Position.w), 2., uMax);
  vCol = aCol * tw;
}`;
  const FS_PT = `precision mediump float; varying vec3 vCol; uniform float uA;
void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); float core = 1. - smoothstep(0.12, 0.42, r); float halo = smoothstep(0.5, 0.0, r); float a = core * 0.85 + halo * halo * 0.35; gl_FragColor = vec4(vCol * a * uA, 1.); }`;
  const VS_LN = `attribute vec3 aPos; uniform mat4 uVP; uniform float uCollapse; void main(){ gl_Position = uVP * vec4(aPos*(1.-uCollapse),1.); }`;
  const FS_LN = `precision mediump float; uniform vec4 uCol; void main(){ gl_FragColor = vec4(uCol.rgb*uCol.a, 1.); }`;
  const VS_TX = `attribute vec3 aPos; attribute vec2 aUv; uniform mat4 uVP; uniform float uScale; varying vec2 vUv; void main(){ vUv = aUv; gl_Position = uVP * vec4(aPos*uScale,1.); }`;
  const FS_TX = `precision mediump float; varying vec2 vUv; uniform sampler2D uTex; uniform float uB; uniform float uT;
void main(){ vec3 c = texture2D(uTex, vUv).rgb; float e = max(smoothstep(0.985,1.,abs(vUv.x*2.-1.)), smoothstep(0.985,1.,abs(vUv.y*2.-1.)));
  vec3 base = c * uB + vec3(0.02,0.02,0.04);
  gl_FragColor = vec4(base + vec3(0.6,0.75,1.)*e*(0.35+0.25*sin(uT*1.3)), 1.); }`;

  function initGL() {
    const gl = R.cv.getContext('webgl', { antialias: true, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('no webgl');
    R.gl = gl;
    R.P.bg = M.program(gl, VS_BG, FS_BG);
    R.P.pt = M.program(gl, VS_PT, FS_PT);
    R.P.ln = M.program(gl, VS_LN, FS_LN);
    R.P.tx = M.program(gl, VS_TX, FS_TX);
    R.pointMax = Math.min(96, gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE)[1] || 64);
    R.B.quad = M.buffer(gl, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]));
    // 星星
    const rng = U.rng(77);
    const st = new Float32Array(MAXSTARS * 8);
    const pos = [];
    for (let i = 0; i < MAXSTARS; i++) {
      // 偏向一个倾斜的盘面
      const r = 7 + Math.pow(rng(), 0.6) * 70;
      const th = rng() * Math.PI * 2;
      const y = (rng() - 0.5) * (rng() < 0.7 ? 12 : 90);
      let x = Math.cos(th) * r, z = Math.sin(th) * r;
      const tilt = 0.35;
      const y2 = y * Math.cos(tilt) - z * Math.sin(tilt), z2 = y * Math.sin(tilt) + z * Math.cos(tilt);
      pos.push([x, y2, z2]);
      const k = rng();
      const col = k < 0.15 ? [0.75, 0.85, 1.0] : k < 0.3 ? [1.0, 0.9, 0.7] : k < 0.35 ? [1.0, 0.7, 0.6] : [0.95, 0.95, 1.0];
      st.set([x, y2, z2, col[0], col[1], col[2], 1.2 + Math.pow(rng(), 3) * 4.5, rng()], i * 8);
    }
    R.B.stars = M.buffer(gl, st);
    R.starPos = pos;
    // 星座连线：每颗星连向最近的一两颗
    const segs = [];
    const N = 2400;
    for (let i = 0; i < N; i++) {
      let best = -1, bd = 1e9;
      for (let j = 0; j < N; j++) {
        if (j === i) continue;
        const a = pos[i], b = pos[j];
        const d = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
        if (d < bd) {
          bd = d;
          best = j;
        }
      }
      if (best >= 0 && bd < 40) segs.push(...pos[i], ...pos[best]);
    }
    R.B.lines = M.buffer(gl, new Float32Array(segs));
    R.lineMax = segs.length / 6;
    // 星云：若干团彩色大点
    const neb = [];
    const NC = [[1.0, 0.35, 0.75], [0.3, 0.8, 1.0], [1.0, 0.6, 0.25], [0.55, 0.4, 1.0], [0.3, 1.0, 0.7], [1.0, 0.3, 0.4], [0.4, 0.6, 1.0], [0.9, 0.9, 0.4]];
    for (let c = 0; c < 8; c++) {
      const cx = (rng() - 0.5) * 90, cy = (rng() - 0.5) * 40, cz = (rng() - 0.5) * 90;
      for (let i = 0; i < 260; i++) {
        const r = Math.pow(rng(), 1.5) * 12;
        const a = rng() * Math.PI * 2, b = (rng() - 0.5) * Math.PI;
        const col = NC[c].map((v) => v * (0.07 + rng() * 0.08));
        neb.push(cx + Math.cos(a) * Math.cos(b) * r * 1.6, cy + Math.sin(b) * r * 0.7, cz + Math.sin(a) * Math.cos(b) * r, col[0], col[1], col[2], 40 + rng() * 90, rng());
      }
    }
    R.B.neb = M.buffer(gl, new Float32Array(neb));
    R.nebPer = 260;
    // 星系：旋臂
    const gal = [];
    R.galCenters = [];
    for (let g = 0; g < 4; g++) {
      const cx = [-55, 60, 20, -30][g], cy = [18, -14, 35, -30][g], cz = [-40, 35, -70, 65][g];
      R.galCenters.push([cx, cy, cz]);
      for (let i = 0; i < 1600; i++) {
        const arm = i % 2;
        const t = Math.pow(rng(), 0.7) * 3.2;
        const a = t * 2.2 + arm * Math.PI + (rng() - 0.5) * 0.5;
        const r = t * 4.2 + rng() * 0.8;
        const warm = 1 - t / 3.2;
        gal.push(cx + Math.cos(a) * r, cy + (rng() - 0.5) * 0.8, cz + Math.sin(a) * r, 0.6 + warm * 0.4, 0.6 + warm * 0.25, 1.0 - warm * 0.3, 1 + rng() * 2.4 + warm * 2, rng());
      }
    }
    R.B.gal = M.buffer(gl, new Float32Array(gal));
    R.galPer = 1600;
    // 立方体六个面
    const F = [];
    const face = (o, u, v) => {
      const p = (s, t) => [o[0] + u[0] * s + v[0] * t, o[1] + u[1] * s + v[1] * t, o[2] + u[2] * s + v[2] * t];
      const a = p(-1, -1), b = p(1, -1), c = p(1, 1), d = p(-1, 1);
      // uv：纹理 y 向下
      F.push(...a, 0, 1, ...b, 1, 1, ...c, 1, 0, ...a, 0, 1, ...c, 1, 0, ...d, 0, 0);
    };
    face([0, 0, 1], [1, 0, 0], [0, 1, 0]); // +z 现代
    face([1, 0, 0], [0, 0, -1], [0, 1, 0]); // +x 终端
    face([-1, 0, 0], [0, 0, 1], [0, 1, 0]); // -x 矢量
    face([0, 1, 0], [1, 0, 0], [0, 0, -1]); // +y 8-bit
    face([0, -1, 0], [1, 0, 0], [0, 0, 1]); // -y 16-bit
    face([0, 0, -1], [-1, 0, 0], [0, 1, 0]); // -z 第六面
    R.B.cube = M.buffer(gl, new Float32Array(F));
    const E12 = [];
    const v = [-1, 1];
    for (const a of v) for (const b of v) {
      E12.push(-1, a, b, 1, a, b);
      E12.push(a, -1, b, a, 1, b);
      E12.push(a, b, -1, a, b, 1);
    }
    R.B.edges = M.buffer(gl, new Float32Array(E12));
    for (let i = 0; i < 6; i++) R.tex[i] = M.texture(gl);
    R.B.user = gl.createBuffer();
    R.ok = true;
  }

  // 面 → 时代：0 现代 1 终端 2 矢量 3 8-bit 4 16-bit 5 第六面
  const FACE_ERA = [4, 0, 1, 2, 3, -1];
  function updateFace(i) {
    const c = R.faceHi && i === (R.faceHiIdx || 0) ? R.faceHi : R.faceCv[i], x = c.getContext('2d');
    const S = c.width, k = S / 512;
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.fillStyle = '#000';
    x.fillRect(0, 0, S, S);
    x.setTransform(k, 0, 0, k, 0, 0);
    const e = FACE_ERA[i];
    if (e >= 0) {
      const blk = G.ui.blocked;
      G.ui.blocked = true;
      x.save();
      x.textAlign = 'left';
      x.imageSmoothingEnabled = e === 4 || e <= 1;
      if (e === 2 || e === 3) {
        const tmp = updateFace.tmp || (updateFace.tmp = U.canvas(e === 2 ? 240 : 320, e === 2 ? 135 : 180));
        tmp.width = e === 2 ? 240 : 448;
        tmp.height = e === 2 ? 135 : 252;
        const tx = tmp.getContext('2d');
        tx.imageSmoothingEnabled = false;
        G.eras[e].renderMini(tx, 0, 0, tmp.width, tmp.height, { snake: true });
        x.imageSmoothingEnabled = false;
        x.drawImage(tmp, 0, 112, 512, 288);
      } else if (e === 4 && k > 1) {
        x.setTransform(1, 0, 0, 1, 0, 0);
        G.eras[e].renderMini(x, 0, 112 * k, S, 288 * k);
      } else G.eras[e].renderMini(x, 0, 112, 512, 288);
      x.restore();
      G.ui.blocked = blk;
    } else if (R.face6) R.face6(x, 512);
    const gl = R.gl;
    gl.bindTexture(gl.TEXTURE_2D, R.tex[i]);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
  }

  // ---------------- 视觉数量 ----------------
  function dotsVisible() {
    const n = Math.max(1, G.s.res.dots);
    return Math.min(MAXSTARS, Math.max(1, Math.floor(Math.pow(Math.log10(n + 1), 1.35) * 67)));
  }

  // ---------------- 更新 ----------------
  function update(dt, fg) {
    const s = G.s, st = s.e[5];
    if (!st.started) {
      if (R.intro >= 1) {
        st.started = 1;
        st.at = s.time;
        if (s.res.dots < 1) E.gain('dots', 1);
      }
      return;
    }
    if (!R.freeze) {
      // 宇宙膨胀
      const N = s.res.dots;
      if (N < GOAL) {
        const g = Math.min(GOAL - N, N * (Math.exp(rate() * dt) - 1));
        E.gain('dots', g, 'auto');
      } else s.res.dots = Math.min(s.res.dots, GOAL * 1.0001);
    }
    // 镜头
    const c = R.cam;
    if (!R.drag && !R.camLock && performance.now() - I.lastInput > 6000) c.ty += dt * 0.03;
    c.yaw = U.lerp(c.yaw, c.ty, Math.min(1, dt * 6));
    c.pitch = U.lerp(c.pitch, c.tp, Math.min(1, dt * 6));
    c.dist = U.lerp(c.dist, c.td, Math.min(1, dt * 4));
    // 星座挑战
    if (!R.freeze && fg) {
      if (!R.challenge) {
        R.nextCh -= dt;
        if (R.nextCh <= 0 && dotsVisible() > 60 && R.ok) startChallenge();
      } else {
        const ch = R.challenge;
        ch.t += dt;
        if (G.m.weaver && ch.t > 2.5 && ch.k < ch.ids.length) {
          ch.auto = (ch.auto || 0) + dt;
          if (ch.auto > 0.35) {
            ch.auto = 0;
            hitChallenge(ch.ids[ch.k]);
          }
        }
        if (ch.t > ch.dur && R.challenge) {
          R.challenge = null;
          R.nextCh = U.rand(40, 70);
        }
      }
    }
    // 单位卡（万、亿……无量大数）
    const e = Math.floor(Math.log10(Math.max(1, s.res.dots)) / 4);
    if (e !== R.unitIdx) {
      if (e > R.unitIdx && R.unitIdx >= 0 && e >= 1 && fg) {
        const u = U.UNITS.find((x) => x[1] === Math.min(68, e * 4));
        if (u) {
          R.unitCard = { name: u[0], pow: u[1], t: 0 };
          A.tone({ n: 69 + (e % 8) * 2, d: 2, v: 0.03, type: 'sine', rev: 0.7, echo: 0.3 });
        }
      }
      R.unitIdx = e;
    }
    if (R.unitCard) {
      R.unitCard.t += dt;
      if (R.unitCard.t > 3) R.unitCard = null;
    }
    // 字幕
    const n = s.lineN || 0;
    if (n > R.lastN) {
      for (const l of s.log) if ((l.n || 0) > R.lastN && (l.kind === 'dot' || l.kind === 'sys')) R.subs.push({ text: l.text, kind: l.kind, t: 0 });
      R.lastN = n;
      while (R.subs.length > 2) R.subs.shift();
    }
    for (const sb of R.subs) sb.t += dt;
    R.subs = R.subs.filter((x) => x.t < 7);
    if (G.botAssist && fg && !R.freeze && R.vp) {
      R.botAcc = (R.botAcc || 0) + dt * 1.5;
      while (R.botAcc >= 1) {
        R.botAcc--;
        placeStar(U.rand(420, 1500), U.rand(150, 800));
      }
      if (R.challenge && R.challenge.t > 3 && !R.challenge.botTried) {
        R.challenge.botTried = true;
        if (Math.random() < 0.6) while (R.challenge) hitChallenge(R.challenge.ids[R.challenge.k]);
      }
    }
    if (R.dotFly) R.dotFly.t += dt;
    for (const u of R.user) u.t += dt;
  }

  // ---------------- 交互 ----------------
  function camEye() {
    const c = R.cam;
    return [Math.cos(c.pitch) * Math.sin(c.yaw) * c.dist, Math.sin(c.pitch) * c.dist, Math.cos(c.pitch) * Math.cos(c.yaw) * c.dist];
  }
  function project(p) {
    if (!R.vp) return null;
    const v = M.xform(R.vp, p[0] * (1 - R.collapse), p[1] * (1 - R.collapse), p[2] * (1 - R.collapse));
    if (v[3] <= 0.05) return null;
    return { x: (v[0] / v[3] * 0.5 + 0.5) * 1600, y: (1 - (v[1] / v[3] * 0.5 + 0.5)) * 900, z: v[3] };
  }
  // 鼠标射线（世界坐标）
  function ray(mx, my) {
    const eye = R.eyeOverride || camEye();
    const nx = (mx / 1600) * 2 - 1, ny = 1 - (my / 900) * 2;
    const th = Math.tan(0.45), asp = 16 / 9;
    const tg = R.target || [0, 0, 0];
    let fwd = [tg[0] - eye[0], tg[1] - eye[1], tg[2] - eye[2]];
    const fl = Math.hypot(fwd[0], fwd[1], fwd[2]) || 1;
    fwd = fwd.map((v) => v / fl);
    let right = [-fwd[2], 0, fwd[0]];
    const rl = Math.hypot(right[0], right[2]) || 1;
    right = right.map((v) => v / rl);
    const up = [right[1] * fwd[2] - right[2] * fwd[1], right[2] * fwd[0] - right[0] * fwd[2], right[0] * fwd[1] - right[1] * fwd[0]];
    const dir = [0, 1, 2].map((k) => fwd[k] + right[k] * nx * th * asp + up[k] * ny * th);
    const dl = Math.hypot(dir[0], dir[1], dir[2]);
    return { eye, dir: dir.map((v) => v / dl) };
  }
  // 点到立方体的哪一面？返回面编号或 -1
  function hitCube(mx, my) {
    const { eye, dir } = ray(mx, my);
    const s = 1 - R.collapse;
    let t0 = -Infinity, t1 = Infinity;
    for (let k = 0; k < 3; k++) {
      if (Math.abs(dir[k]) < 1e-9) {
        if (eye[k] < -s || eye[k] > s) return -1;
        continue;
      }
      let a = (-s - eye[k]) / dir[k], b = (s - eye[k]) / dir[k];
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a);
      t1 = Math.min(t1, b);
    }
    if (t0 > t1 || t1 < 0) return -1;
    const p = [0, 1, 2].map((k) => eye[k] + dir[k] * t0);
    const ax = [0, 1, 2].reduce((m, k) => (Math.abs(p[k]) > Math.abs(p[m]) ? k : m), 0);
    const sg = p[ax] > 0;
    return ax === 2 ? (sg ? 0 : 5) : ax === 0 ? (sg ? 1 : 2) : sg ? 3 : 4;
  }
  function faceRect(f) {
    const corners = {
      0: [[-1, -1, 1], [1, 1, 1]], 1: [[1, -1, -1], [1, 1, 1]], 2: [[-1, -1, -1], [-1, 1, 1]],
      3: [[-1, 1, -1], [1, 1, 1]], 4: [[-1, -1, -1], [1, -1, 1]],
    }[f];
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    const [a, b] = corners;
    for (const x of [a[0], b[0]]) for (const y of [a[1], b[1]]) for (const z of [a[2], b[2]]) {
      const q = project([x, y, z]);
      if (!q) continue;
      x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x); y1 = Math.max(y1, q.y);
    }
    if (x0 > x1) return [500, 280, 600, 337.5];
    x0 = U.clamp(x0, 0, 1500); y0 = U.clamp(y0, 0, 800);
    const w = Math.max(100, Math.min(1600 - x0, x1 - x0)), h = Math.max(56, Math.min(900 - y0, y1 - y0));
    // 保持 16:9，避免缩放时变形
    const hh = (w * 9) / 16;
    return [x0, y0 + (h - hh) / 2, w, hh];
  }
  function placeStar(mx, my) {
    // 沿鼠标射线放一颗星
    const eye = camEye();
    const nx = (mx / 1600) * 2 - 1, ny = 1 - (my / 900) * 2;
    const fov = 0.9, asp = 16 / 9, th = Math.tan(fov / 2);
    const c = R.cam;
    const tg = R.target || [0, 0, 0];
    let fwd = [tg[0] - eye[0], tg[1] - eye[1], tg[2] - eye[2]];
    const fl = Math.hypot(fwd[0], fwd[1], fwd[2]) || 1;
    fwd = fwd.map((v) => v / fl);
    // right = forward × worldUp，up = right × forward（与 lookAt 一致）
    let right = [-fwd[2], 0, fwd[0]];
    const rl = Math.hypot(right[0], right[2]) || 1;
    right = right.map((v) => v / rl);
    const up = [right[1] * fwd[2] - right[2] * fwd[1], right[2] * fwd[0] - right[0] * fwd[2], right[0] * fwd[1] - right[1] * fwd[0]];
    const dir = [0, 1, 2].map((k) => fwd[k] + right[k] * nx * th * asp + up[k] * ny * th);
    const dl = Math.hypot(dir[0], dir[1], dir[2]);
    const d = c.dist * U.rand(0.7, 1.6);
    const p = [0, 1, 2].map((k) => eye[k] + (dir[k] / dl) * d);
    if (Math.hypot(p[0], p[1], p[2]) < 1.8) return;
    R.user.push({ p, t: 0, col: U.pick([[1, 1, 1], [0.8, 0.9, 1], [1, 0.9, 0.7], [1, 0.75, 0.9]]) });
    if (R.user.length > 1500) R.user.shift();
    R.userDirty = true;
    const got = E.gain('dots', Math.max(G.m.click, G.s.res.dots * 0.02));
    G.s.stats.stars++;
    const sc = [69, 72, 74, 76, 79, 81, 84, 86, 88, 91];
    A.tone({ n: U.pick(sc) + 12, d: 1.6, v: 0.04, type: 'sine', rev: 0.6, echo: 0.35 });
    A.tone({ n: U.pick(sc) + 24, d: 0.8, v: 0.012, type: 'sine', rev: 0.5 });
    R.flashes = R.flashes || [];
    R.flashes.push({ x: mx, y: my, t: 0, v: got });
  }
  function startChallenge() {
    const cand = [];
    const vis = dotsVisible();
    for (let k = 0; k < 200; k++) {
      const i = Math.floor(Math.random() * Math.min(vis, 4000));
      const q = project(R.starPos[i]);
      if (!q || q.x < 200 || q.x > 1250 || q.y < 140 || q.y > 760) continue;
      if (cand.some((c) => Math.hypot(c.q.x - q.x, c.q.y - q.y) < 110)) continue;
      cand.push({ i, q });
      if (cand.length >= 5) break;
    }
    if (cand.length < 4) {
      R.nextCh = 8;
      return;
    }
    R.challenge = { ids: cand.map((c) => c.i), k: 0, t: 0, dur: 18 };
    A.tone({ n: 88, d: 1, v: 0.03, type: 'sine', rev: 0.6 });
  }
  function hitChallenge(i) {
    const ch = R.challenge;
    if (!ch || ch.ids[ch.k] !== i) return false;
    ch.k++;
    A.tone({ n: [76, 79, 81, 84, 88][Math.min(4, ch.k - 1)], d: 1.2, v: 0.04, type: 'sine', rev: 0.6, echo: 0.3 });
    if (ch.k >= ch.ids.length) {
      const got = E.gain('dots', G.s.res.dots * 0.6, 'bonus');
      G.s.stats.constell++;
      R.flashes = R.flashes || [];
      R.flashes.push({ x: 800, y: 450, t: 0, v: got, big: true });
      ch.done = true;
      R.challenge = null;
      R.nextCh = U.rand(40, 70);
      const t = A.now();
      [69, 76, 81, 88, 93].forEach((n, k) => A.tone({ n, t: t + k * 0.08, d: 2, v: 0.03, type: 'sine', rev: 0.7 }));
    }
    return true;
  }
  function interact() {
    const inp = G.input;
    if (G.ui.blocked || R.freeze) return;
    const overPanel = G.ui.over(30, 120, 330, 700);
    if (inp.pressed && !inp.used && inp.inside && !overPanel) {
      inp.used = true;
      R.drag = { x: inp.mx, y: inp.my, moved: 0, yaw: R.cam.ty, pitch: R.cam.tp };
    }
    if (R.drag) {
      if (inp.down) {
        const dx = inp.mx - R.drag.x, dy = inp.my - R.drag.y;
        R.drag.moved = Math.max(R.drag.moved, Math.hypot(dx, dy));
        if (R.drag.moved > 6) {
          R.cam.ty = R.drag.yaw - dx * 0.006;
          R.cam.tp = U.clamp(R.drag.pitch + dy * 0.005, -1.35, 1.35);
        }
      } else {
        if (R.drag.moved <= 6) {
          // 点击：先看是不是星座挑战的星
          let used = false;
          if (R.challenge) {
            const i = R.challenge.ids[R.challenge.k];
            const q = project(R.starPos[i]);
            if (q && Math.hypot(q.x - inp.mx, q.y - inp.my) < 30) used = hitChallenge(i);
          }
          // 点到立方体：回到那个时代
          if (!used) {
            const f = hitCube(inp.mx, inp.my);
            if (f === 5) {
              if (G.t - (R.blackSaid || -99) > 20) {
                R.blackSaid = G.t;
                G.story.say('这一面是黑的。什么也没有……还没有。', 'dot');
              }
              used = true;
            } else if (f >= 0) {
              G.visit(FACE_ERA[f], faceRect(f));
              used = true;
            }
          }
          if (!used) placeStar(inp.mx, inp.my);
        }
        R.drag = null;
      }
    }
    if (inp.wheel && !overPanel) R.cam.td = U.clamp(R.cam.td * Math.pow(1.0012, inp.wheel), 3.2, 60);
  }

  // ---------------- 绘制 ----------------
  function ensureFB() {
    const sz = G.display.fbSize();
    if (R.fb.width !== sz.w || R.fb.height !== sz.h) {
      R.fb.width = R.cv.width = sz.w;
      R.fb.height = R.cv.height = sz.h;
    }
  }
  function render() {
    ensureFB();
    G.ui.space(G.VW, G.VH);
    R.hover = null;
    const ctx = R.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (R.ok) {
      draw3D();
      ctx.drawImage(R.cv, 0, 0);
    } else {
      ctx.fillStyle = '#05060f';
      ctx.fillRect(0, 0, R.fb.width, R.fb.height);
    }
    const k = R.fb.width / G.VW;
    ctx.setTransform(k, 0, 0, k, 0, 0);
    if (!R.ok) {
      ctx.fillStyle = '#fff';
      ctx.font = `20px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('这个浏览器不支持 WebGL，3D 时代无法显示。', 800, 450);
    }
    const blocked0 = G.ui.blocked;
    if (R.letterOpen) G.ui.blocked = true;
    if (R.freeze) G.ui.blocked = true; // 演出/结局期间 HUD 只看不能点
    if (R.hudA > 0) drawHUD(ctx);
    G.ui.blocked = blocked0;
    if (R.letterOpen) drawLetter(ctx);
    if (!R.freeze && R.hudA > 0.5) interact();
    if (R.hudA > 0 && !R.freeze) drawCursor(ctx);
    return R.fb;
  }

  function draw3D() {
    const gl = R.gl, P = R.P, B = R.B;
    gl.viewport(0, 0, R.cv.width, R.cv.height);
    const c = R.cam;
    const eye = R.eyeOverride || camEye();
    const target = R.target || [0, 0, 0];
    R.view = M.lookAt(eye, target, [0, 1, 0]);
    R.proj = M.persp(0.9, R.cv.width / R.cv.height, 0.05, 500);
    R.vp = M.mul(R.proj, R.view);
    const t = G.t;
    // 背景
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.useProgram(P.bg.p);
    M.attribs(gl, P.bg, B.quad, [['aPos', 2]]);
    gl.uniform1f(P.bg.u.uT, t);
    gl.uniform2f(P.bg.u.uRot, c.yaw, c.pitch);
    gl.uniform1f(P.bg.u.uNeb, G.m.neb / 4);
    gl.uniform1f(P.bg.u.uA, R.starsA * (1 - R.collapse * 0.8));
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    M.disableAttribs(gl, P.bg);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    // 立方体
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
    gl.useProgram(P.tx.p);
    M.attribs(gl, P.tx, B.cube, [['aPos', 3], ['aUv', 2]]);
    gl.uniformMatrix4fv(P.tx.u.uVP, false, R.vp);
    gl.uniform1f(P.tx.u.uScale, 1 - R.collapse);
    gl.uniform1f(P.tx.u.uT, t);
    // 每帧轮流更新一面
    if (R.faceUpdate === 'front') updateFace(0);
    else if (R.faceUpdate !== false) {
      updateFace(R.faceIdx);
      R.faceIdx = (R.faceIdx + 1) % 6;
    }
    gl.activeTexture(gl.TEXTURE0);
    gl.uniform1i(P.tx.u.uTex, 0);
    for (let i = 0; i < 6; i++) {
      gl.bindTexture(gl.TEXTURE_2D, R.tex[i]);
      gl.uniform1f(P.tx.u.uB, R.faceBright[i]);
      gl.drawArrays(gl.TRIANGLES, i * 6, 6);
    }
    M.disableAttribs(gl, P.tx);
    // 发光的棱
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.depthMask(false);
    gl.useProgram(P.ln.p);
    M.attribs(gl, P.ln, B.edges, [['aPos', 3]]);
    gl.uniformMatrix4fv(P.ln.u.uVP, false, R.vp);
    gl.uniform1f(P.ln.u.uCollapse, R.collapse);
    gl.uniform4f(P.ln.u.uCol, 0.6, 0.8, 1, 0.5);
    gl.drawArrays(gl.LINES, 0, 24);
    // 星座线
    const vis = Math.floor(dotsVisible() * R.starsA);
    if (G.m.lines > 0 && vis > 10) {
      const nl = Math.min(R.lineMax, Math.floor((vis / 2400) * R.lineMax * [0, 0.25, 0.5, 0.8, 1][G.m.lines]));
      M.attribs(gl, P.ln, B.lines, [['aPos', 3]]);
      gl.uniform4f(P.ln.u.uCol, 0.55, 0.7, 1, 0.22 * R.starsA);
      gl.drawArrays(gl.LINES, 0, Math.max(0, nl) * 2);
    }
    M.disableAttribs(gl, P.ln);
    // 点
    gl.useProgram(P.pt.p);
    gl.uniformMatrix4fv(P.pt.u.uVP, false, R.vp);
    gl.uniform1f(P.pt.u.uT, t);
    gl.uniform1f(P.pt.u.uScale, (R.cv.height / 900) * 28);
    gl.uniform1f(P.pt.u.uCollapse, R.collapse);
    gl.uniform1f(P.pt.u.uMax, R.pointMax);
    gl.uniform1f(P.pt.u.uSpin, 0);
    gl.uniform1f(P.pt.u.uA, R.starsA);
    const lay = [['aPos', 3], ['aCol', 3], ['aSize', 1], ['aPh', 1]];
    // 星云
    if (G.m.neb > 0) {
      M.attribs(gl, P.pt, B.neb, lay);
      gl.drawArrays(gl.POINTS, 0, R.nebPer * Math.min(8, G.m.neb * 2));
    }
    // 星系
    if (G.m.gal > 0) {
      M.attribs(gl, P.pt, B.gal, lay);
      for (let g = 0; g < G.m.gal; g++) {
        gl.uniform3f(P.pt.u.uCenter, R.galCenters[g][0], R.galCenters[g][1], R.galCenters[g][2]);
        gl.uniform1f(P.pt.u.uSpin, 0.35);
        gl.drawArrays(gl.POINTS, g * R.galPer, R.galPer);
      }
      gl.uniform1f(P.pt.u.uSpin, 0);
    }
    // 星
    M.attribs(gl, P.pt, B.stars, lay);
    gl.drawArrays(gl.POINTS, 0, vis);
    // 玩家放下的星
    if (R.user.length) {
      if (R.userDirty) {
        const a = new Float32Array(R.user.length * 8);
        R.user.forEach((u, i) => a.set([u.p[0], u.p[1], u.p[2], u.col[0], u.col[1], u.col[2], 4.5, Math.random()], i * 8));
        gl.bindBuffer(gl.ARRAY_BUFFER, B.user);
        gl.bufferData(gl.ARRAY_BUFFER, a, gl.DYNAMIC_DRAW);
        R.userDirty = false;
      }
      M.attribs(gl, P.pt, B.user, lay);
      gl.drawArrays(gl.POINTS, 0, R.user.length);
    }
    // 飞出的点（开场）
    if (R.dotPos) {
      const a = new Float32Array([R.dotPos[0], R.dotPos[1], R.dotPos[2], 1, 1, 1, R.dotSize || 10, 0.5]);
      gl.bindBuffer(gl.ARRAY_BUFFER, B.user);
      gl.bufferData(gl.ARRAY_BUFFER, a, gl.DYNAMIC_DRAW);
      M.attribs(gl, P.pt, B.user, lay);
      gl.drawArrays(gl.POINTS, 0, 1);
      R.userDirty = true;
    }
    M.disableAttribs(gl, P.pt);
    gl.depthMask(true);
    gl.disable(gl.BLEND);
  }

  function txt(ctx, s, x, y, size, col, opt = {}) {
    ctx.font = `${opt.w || 400} ${size}px ${opt.num ? NUMF : FONT}`;
    ctx.textAlign = opt.align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = col;
    ctx.fillText(s, x, y);
    return ctx.measureText(s).width;
  }

  function drawHUD(ctx) {
    const s = G.s;
    ctx.save();
    ctx.globalAlpha = R.hudA;
    // 顶部：点数
    const N = s.res.dots;
    txt(ctx, '点', 800, 54, 16, 'rgba(220,226,255,0.55)', { align: 'center' });
    const str = U.fmt(N);
    const m = /^([\d.,]+)(.*)$/.exec(str) || [str, str, ''];
    ctx.font = `300 56px ${NUMF}`;
    const w1 = ctx.measureText(m[1]).width;
    ctx.font = `400 34px ${FONT}`;
    const w2 = ctx.measureText(m[2]).width;
    const x0 = 800 - (w1 + w2 + 8) / 2;
    txt(ctx, m[1], x0, 112, 56, '#ffffff', { w: 300, num: true });
    if (m[2]) {
      const g = ctx.createLinearGradient(x0 + w1, 80, x0 + w1 + w2, 112);
      g.addColorStop(0, '#9fe8ff');
      g.addColorStop(1, '#d6a8ff');
      txt(ctx, m[2], x0 + w1 + 8, 110, 34, g);
    }
    const pct = (rate() * 100).toFixed(1);
    txt(ctx, `膨胀 +${pct}% / 秒`, 800, 140, 14, 'rgba(210,218,245,0.55)', { align: 'center' });
    // 进度：log 刻度到无量大数
    const f = U.clamp(Math.log10(Math.max(1, N)) / 68, 0, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(600, 154, 400, 2);
    const gg = ctx.createLinearGradient(600, 0, 1000, 0);
    gg.addColorStop(0, '#7cf6ff');
    gg.addColorStop(1, '#d6a8ff');
    ctx.fillStyle = gg;
    ctx.fillRect(600, 154, 400 * f, 2);
    txt(ctx, '无量大数', 1008, 160, 11, 'rgba(210,218,245,0.4)');
    if (s.ending === 'stay') {
      const hov = G.ui.over(740, 172, 120, 34);
      U.rrect(ctx, 740, 172, 120, 34, 17);
      ctx.fillStyle = hov ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.06)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.stroke();
      txt(ctx, '收拢', 800, 195, 15, '#ffffff', { align: 'center' });
      if (G.ui.click(740, 172, 120, 34)) G.startFx('ending', { skipTo: 'choice' });
    }
    // 右上：旧资源、留言、菜单
    const chips = [['光子', 'lux'], ['星屑', 'dust'], ['像素', 'px'], ['向量', 'vec'], ['比特', 'bits']];
    chips.forEach(([n, r], i) => {
      txt(ctx, n, 1420, 50 + i * 22, 12, 'rgba(210,218,245,0.4)', { align: 'right' });
      txt(ctx, U.fmt(s.res[r]), 1430, 50 + i * 22, 12, 'rgba(235,240,255,0.7)', { num: true });
    });
    if (s.msg > 0) {
      const hov = G.ui.over(1300, 168, 260, 26);
      txt(ctx, `留言.txt ${G.letter.pct()}%`, 1555, 186, 13, hov ? '#ffffff' : 'rgba(210,218,245,0.6)', { align: 'right' });
      if (G.ui.click(1300, 168, 260, 26)) R.letterOpen = 1;
    }
    const mh = G.ui.over(1530, 20, 50, 30);
    txt(ctx, '☰', 1555, 44, 22, mh ? '#ffffff' : 'rgba(230,235,255,0.6)', { align: 'center' });
    if (G.ui.click(1530, 20, 50, 30)) G.ui.openMenu();
    // 左侧：升级
    drawPanel(ctx);
    // 星座挑战
    if (R.challenge) {
      const ch = R.challenge;
      const pts = ch.ids.map((i) => project(R.starPos[i]));
      ctx.strokeStyle = 'rgba(180,210,255,0.25)';
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      pts.forEach((q, k) => q && (k ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(200,230,255,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      pts.slice(0, ch.k + 1).forEach((q, k) => q && (k ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      ctx.stroke();
      pts.forEach((q, k) => {
        if (!q) return;
        const done = k < ch.k, cur = k === ch.k;
        ctx.beginPath();
        ctx.arc(q.x, q.y, cur ? 16 + Math.sin(G.t * 6) * 3 : 12, 0, Math.PI * 2);
        ctx.strokeStyle = done ? 'rgba(160,255,200,0.9)' : cur ? '#ffffff' : 'rgba(200,210,255,0.5)';
        ctx.lineWidth = cur ? 2 : 1.2;
        ctx.stroke();
        txt(ctx, String(k + 1), q.x, q.y - 22, 13, 'rgba(230,236,255,0.85)', { align: 'center', num: true });
      });
      txt(ctx, `星座：按顺序点亮 ${ch.ids.length} 颗星（剩 ${Math.ceil(ch.dur - ch.t)} 秒）`, 800, 200, 15, 'rgba(230,236,255,0.8)', { align: 'center' });
    }
    // 点击闪光
    R.flashes = (R.flashes || []).filter((f) => (f.t += G.dt) < 1.4);
    for (const fl of R.flashes) {
      const a = 1 - fl.t / 1.4;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const rr = (fl.big ? 300 : 40) * U.ease.outCubic(fl.t / 1.4);
      ctx.strokeStyle = `rgba(200,220,255,${a * 0.6})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(fl.x, fl.y, rr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      txt(ctx, '+' + U.fmt(fl.v), fl.x, fl.y - 18 - fl.t * 30, fl.big ? 22 : 14, `rgba(235,240,255,${a})`, { align: 'center', num: true });
    }
    // 单位卡
    if (R.unitCard) {
      const u = R.unitCard;
      const a = Math.min(1, u.t / 0.4) * (1 - U.clamp((u.t - 2.2) / 0.8, 0, 1));
      ctx.globalAlpha = a * R.hudA;
      txt(ctx, u.name, 800, 470, 64, '#ffffff', { align: 'center', w: 300 });
      txt(ctx, `10^${u.pow}`, 800, 510, 16, 'rgba(210,218,245,0.7)', { align: 'center', num: true });
      ctx.globalAlpha = R.hudA;
    }
    // 字幕
    R.subs.forEach((sb, i) => {
      const a = Math.min(1, sb.t / 0.6) * (1 - U.clamp((sb.t - 6) / 1, 0, 1));
      const y = 820 + (i - (R.subs.length - 1)) * 34;
      ctx.globalAlpha = a * R.hudA;
      txt(ctx, sb.text, 800, y, 20, sb.kind === 'sys' ? 'rgba(255,230,180,0.95)' : '#ffffff', { align: 'center', w: 300 });
    });
    ctx.globalAlpha = 1;
    if (G.visiting(5)) {
      // 不会出现（3D 是最后一个时代）
    }
    ctx.restore();
  }

  function drawPanel(ctx) {
    const x = 30, y = 120, w = 330;
    const list = E.list(5);
    const RH = 58;
    const h = Math.min(700, Math.max(1, list.length) * RH + 50);
    ctx.save();
    U.rrect(ctx, x, y, w, h, 16);
    ctx.fillStyle = 'rgba(8,10,24,0.55)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(180,200,255,0.15)';
    ctx.stroke();
    txt(ctx, '宇宙', x + 18, y + 30, 15, 'rgba(230,236,255,0.8)', { w: 600 });
    if (!list.length) txt(ctx, '点击空的地方，放下一颗星。', x + 20, y + 74, 13, 'rgba(210,218,245,0.5)');
    const maxS = Math.max(0, list.length * RH - (h - 50));
    if (G.ui.over(x, y, w, h) && I.wheel) R.scroll = U.clamp(R.scroll + I.wheel * 0.6, 0, maxS);
    R.scroll = U.clamp(R.scroll, 0, maxS);
    ctx.beginPath();
    ctx.rect(x, y + 44, w, h - 48);
    ctx.clip();
    list.forEach((d, i) => {
      const ry = y + 46 + i * RH - R.scroll;
      if (ry < y + 20 || ry > y + h) return;
      const r = G.ui.buy(d, x + 8, ry, w - 16, RH - 6);
      if (r.hover) {
        U.rrect(ctx, x + 8, ry, w - 16, RH - 6, 10);
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fill();
      }
      const lv = E.lv(d.id);
      let name = d.name;
      if (d.type === 'level') name += ' ' + ['I', 'II', 'III', 'IV'][Math.min(lv, d.costs.length - 1)];
      if (d.type === 'gen' && lv) name += ' ×' + lv;
      const goal = d.type === 'goal';
      txt(ctx, name, x + 20, ry + 22, 14, r.can ? (goal ? '#ffe2a0' : '#ffffff') : 'rgba(225,232,255,0.45)', { w: 600 });
      txt(ctx, d.desc, x + 20, ry + 42, 11, 'rgba(210,218,245,0.42)');
      const c = E.cost(d);
      const ct = E.maxed(d) ? '已满' : U.fmt(c.dots);
      txt(ctx, ct, x + w - 20, ry + 22, 13, r.can ? '#9fe8ff' : 'rgba(210,218,245,0.4)', { align: 'right', num: true });
      if (!r.can && !E.maxed(d)) {
        const f = U.clamp(Math.log10(Math.max(1, G.s.res.dots)) / Math.log10(Math.max(10, c.dots)), 0, 1);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fillRect(x + w - 90, ry + 30, 70, 2);
        ctx.fillStyle = 'rgba(159,232,255,0.7)';
        ctx.fillRect(x + w - 90, ry + 30, 70 * f, 2);
      }
    });
    ctx.restore();
  }

  function drawLetter(ctx) {
    ctx.save();
    ctx.fillStyle = 'rgba(2,3,10,0.7)';
    ctx.fillRect(0, 0, 1600, 900);
    txt(ctx, `留言.txt · ${G.letter.pct()}%`, 800, 320, 16, 'rgba(210,218,245,0.6)', { align: 'center' });
    ctx.font = `300 26px ${FONT}`;
    const lines = U.wrap(ctx, G.letter.view(G.s.msg, '·'), 760);
    lines.forEach((l, i) => txt(ctx, l, 800, 380 + i * 44, 26, '#ffffff', { align: 'center', w: 300 }));
    txt(ctx, '点击关闭', 800, 600, 13, 'rgba(210,218,245,0.4)', { align: 'center' });
    ctx.restore();
    if (G.input.pressed && !G.input.used) {
      G.input.used = true;
      R.letterOpen = 0;
    }
  }

  function drawCursor(ctx) {
    if (!G.input.inside || G.ui.menuOpen() || G.ui.blocked) return;
    const mx = G.input.mx, my = G.input.my;
    ctx.save();
    ctx.strokeStyle = 'rgba(230,240,255,0.8)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(mx, my, 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.fillRect(mx - 1, my - 1, 2, 2);
    ctx.restore();
  }

  function display() {
    return { bloom: 0.6, bloomR: 8, bloomT: 0.35, vig: 0.35, noise: 0.008 };
  }
})();
