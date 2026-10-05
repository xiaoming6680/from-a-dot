'use strict';
// 时代 1 · 矢量（1 维：线）—— 合作 Pong
(() => {
  const U = G.U, E = G.econ, I = G.input, A = G.audio, V = G.text.vec;
  const FX = 40, FY = 100, FW = 1000, FH = 580; // Pong 场地
  const PX = 26; // 球拍离边的距离
  const BALL_R = 6;
  const C = { line: '#e9f6ff', dim: '#4d6878', faint: '#22323c', hot: '#ffffff', warm: '#ffe9a8', bad: '#ff8f8f' };
  const SCALE = [69, 72, 74, 76, 79, 81, 84, 86, 88, 91, 93]; // A 小调五声音阶

  // ---------------- 升级 ----------------
  G.econ.hook((m) => {
    m.hit = 2;
    m.ballSpeed = 1;
    m.paddle = 1;
    m.auto = 0; // 自动球拍等级
    m.balls = 1;
  });
  E.define(1, [
    { id: 'ball', name: '再来一个球', type: 'gen', desc: '多一个球，多说一点', cost: { vec: 30 }, growth: 2.1, max: 7,
      mod: (m, lv) => (m.balls += lv), onBuy: () => addBall() },
    { id: 'scope', name: '示波器', type: 'gen', desc: '+2 向量/秒，多一条李萨如曲线', cost: { vec: 25 }, prod: { vec: 2 } },
    { id: 'tone', name: '音阶', desc: '击球按五声音阶上行', cost: { vec: 50 }, tag: 'sound' },
    { id: 'glow0', name: '余辉', desc: '移动的东西会留下光迹', cost: { vec: 60 }, tag: 'visual' },
    { id: 'long', name: '长球拍', desc: '球拍长度 ×1.4', cost: { vec: 80 }, mod: (m) => (m.paddle *= 1.4) },
    { id: 'glow1', name: '辉光', desc: '光会溢出来', cost: { vec: 120 }, tag: 'visual', req: (s) => s.own.glow0 },
    { id: 'auto', name: '自动球拍', type: 'level', desc: '左边的球拍自己动（误差大 → 小 → 分身）',
      costs: [{ vec: 150, bits: 400 }, { vec: 2500, bits: 6000 }, { vec: 22000, bits: 40000 }], tag: 'auto',
      mod: (m, lv) => (m.auto = lv) },
    { id: 'speed', name: '加速', type: 'level', desc: '球速 ×1.25', costs: [{ vec: 200 }, { vec: 1500 }, { vec: 9000 }],
      mod: (m, lv) => (m.ballSpeed *= Math.pow(1.25, lv)) },
    { id: 'echo1', name: '回声', desc: '终端里所有进程 ×3', cost: { vec: 300 }, tag: 'back',
      mod: (m) => { for (const k of ['loop', 'fork', 'daemon']) m.gen[k] = (m.gen[k] || 1) * 3; } },
    { id: 'plot', name: '绘图仪', type: 'gen', desc: '+16 向量/秒，慢慢画一朵繁花', cost: { vec: 350 }, prod: { vec: 16 } },
    { id: 'thick', name: '粗线', type: 'level', desc: '每次击球 ×2', costs: [{ vec: 500 }, { vec: 7000 }], mod: (m, lv) => (m.hit *= Math.pow(2, lv)) },
    { id: 'reply', name: '自动回信', desc: '终端的信号自动回答', cost: { vec: 800 }, tag: 'back', req: (s) => s.own.ping, mod: (m) => (m.autoReply = 1) },
    { id: 'hills', name: '远山', desc: '背景里出现线框群山', cost: { vec: 1000 }, tag: 'visual' },
    { id: 'array', name: '矢量阵列', type: 'gen', desc: '+120 向量/秒，一个旋转的线框立方体', cost: { vec: 4500 }, prod: { vec: 120 } },
    { id: 'raster', name: '光栅化', type: 'goal', desc: '把线切成格子。我想要一个面。', cost: { vec: 40000, bits: 20000 }, reveal: 0.2,
      onBuy() { G.startFx('t12'); } },
  ]);

  // ---------------- 剧情 ----------------
  G.story.def([
    { id: 'e1.hit', era: 1, when: (s) => s.stats.hits >= 1, say: '你接住了。' },
    { id: 'e1.talk', era: 1, when: (s) => s.stats.maxCombo >= 8, say: ['我们在说话吗？', '一来，一回。'] },
    { id: 'e1.miss', era: 1, when: (s) => s.stats.misses >= 1, say: '没关系。我会回来的。' },
    { id: 'e1.ball', era: 1, when: (s) => s.own.ball >= 1, say: '再来一个。我想多说一点。' },
    { id: 'e1.scope', era: 1, when: (s) => s.own.scope >= 1, say: '两个声音叠在一起，就画出了一个形状。' },
    { id: 'e1.tone', era: 1, when: (s) => s.own.tone, say: '每接住一次，就高一个音。我们在唱歌。' },
    { id: 'e1.glow0', era: 1, when: (s) => s.own.glow0, say: '我走过的地方，会亮一会儿再暗下去。' },
    { id: 'e1.glow1', era: 1, when: (s) => s.own.glow1, say: '光会溢出来。原来线也可以很软。' },
    { id: 'e1.auto', era: 1, when: (s) => s.own.auto >= 1, say: ['你可以歇一会儿，我学会了自己接。', '……不过，我还是希望你在。'] },
    { id: 'e1.auto3', era: 1, when: (s) => s.own.auto >= 3, say: '我分成了好几个我。现在一个球也不会掉了。' },
    { id: 'e1.plot', era: 1, when: (s) => s.own.plot >= 1, say: '我在慢慢画一朵花。不急。' },
    { id: 'e1.hills', era: 1, when: (s) => s.own.hills, say: '远处有山。我不知道山后面是什么。' },
    { id: 'e1.echo', era: 1, when: (s) => s.own.echo1, say: '终端里的我也变快了。我没有忘记它。' },
    { id: 'e1.c30', era: 1, when: (s) => s.stats.maxCombo >= 30, say: '三十个来回了。你真厉害。' },
    { id: 'e1.rain', era: 1, when: (s) => s.own.ball >= 5, say: '这么多球。像在下雨。' },
    { id: 'e1.array', era: 1, when: (s) => s.own.array >= 1, say: ['这个形状……有好几个面。', '它在转。我看不全它。'] },
    { id: 'e1.thin', era: 1, when: (s) => s.tot.vec >= 15000, say: ['线太细了。', '我想要……一个面。'] },
    { id: 'e1.goal', era: 1, when: (s) => s.seen.raster, say: '光栅化：把线切成一格一格的。会疼吗？' },
    { id: 'e1.ready', era: 1, when: (s) => E.canBuy(E.defs.raster), say: '准备好了。' },
  ]);

  // ---------------- 运行时 ----------------
  const R = {
    fb: null, ctx: null, trail: null, tctx: null,
    balls: [],
    left: { y: FH / 2, ys: [], target: FH / 2, err: 0, react: 0, tgt: null },
    right: { ys: [] },
    manualT: 0, // 最近一次手动操作
    lastMy: -1,
    floats: [],
    intro: 1,
    shopScroll: 0,
    hills: null,
    spiro: { done: [], cur: null, t: 0 },
    tw: { n: 0, k: 999 },
    letterOpen: 0,
    hitFlash: 0,
  };

  const era = {
    id: 1, name: '矢量', res: 'vec',
    fresh: () => ({}),
    init() {
      R.fb = U.canvas(1600, 900);
      R.ctx = R.fb.getContext('2d');
      R.trail = U.canvas(1600, 900);
      R.tctx = R.trail.getContext('2d');
      makeHills();
    },
    enter(fromFx) {
      syncBalls();
      R.tw.n = G.s.lineN || 0;
      if (fromFx) {
        R.intro = 1;
        for (const b of R.balls) launch(b, 1);
      }
    },
    leave() {},
    update,
    render,
    display,
    renderMini,
    setIntro: (p) => (R.intro = p),
    freeze: (v) => (R.frozen = v),
    balls: () => R.balls.map((b) => ({ x: FX + b.x, y: FY + b.y })),
    FIELD: { x: FX, y: FY, w: FW, h: FH },
  };
  G.registerEra(era);

  // ---------------- Pong ----------------
  function baseSpeed() {
    return 560 * G.m.ballSpeed;
  }
  function newBall(i) {
    return { x: FW / 2, y: FH / 2, vx: 0, vy: 0, combo: 0, wait: 0.6 + i * 0.35, sp: baseSpeed(), dir: 1, id: i };
  }
  function syncBalls() {
    const n = Math.min(8, G.m.balls);
    while (R.balls.length < n) R.balls.push(newBall(R.balls.length));
    while (R.balls.length > n) R.balls.pop();
  }
  function addBall() {
    syncBalls();
  }
  function launch(b, dir) {
    const a = U.rand(-0.5, 0.5);
    b.sp = baseSpeed();
    b.vx = Math.cos(a) * b.sp * (dir || 1);
    b.vy = Math.sin(a) * b.sp;
    b.x = FW / 2;
    b.y = FH / 2 + U.rand(-60, 60);
    b.wait = 0;
  }
  function paddleLen() {
    return 92 * G.m.paddle;
  }
  // 预测球到达 x 处的 y（考虑上下墙反弹）
  function predictY(b, x) {
    if ((x - b.x) * b.vx <= 0 || b.vx === 0) return b.y;
    const t = (x - b.x) / b.vx;
    let y = b.y + b.vy * t;
    const lo = BALL_R, hi = FH - BALL_R, span = hi - lo;
    y -= lo;
    y = ((y % (2 * span)) + 2 * span) % (2 * span);
    if (y > span) y = 2 * span - y;
    return y + lo;
  }

  function autoActive() {
    if (G.botAssist) return true;
    return G.m.auto > 0 && G.s.time - R.manualT > 1.6;
  }

  function hitBall(b, side, py) {
    const s = G.s;
    const L = paddleLen();
    const off = U.clamp((b.y - py) / (L / 2 + BALL_R), -1, 1);
    const ang = off * 0.95;
    b.sp = Math.min(baseSpeed() * 1.5, b.sp * 1.025);
    const dir = side === 'L' ? 1 : -1;
    b.vx = Math.cos(ang) * b.sp * dir;
    b.vy = Math.sin(ang) * b.sp;
    b.combo++;
    s.stats.hits++;
    if (b.combo > s.stats.maxCombo) s.stats.maxCombo = b.combo;
    const val = G.m.hit * (1 + 0.2 * Math.min(b.combo, 60));
    const got = E.gain('vec', val, autoActive() ? 'auto' : undefined);
    const fg = G.fgEra() === 1 && !G.inFx();
    if (fg) {
      R.floats.push({ x: FX + (side === 'L' ? PX + 40 : FW - PX - 60), y: FY + b.y, v: got, t: 0, combo: b.combo });
      if (R.floats.length > 40) R.floats.shift();
      sfxHit(side, b.combo);
    }
  }

  function updatePong(dt, fg) {
    const L = paddleLen();
    const hasAuto = autoActive();
    // 手动：鼠标 / 方向键
    if (fg) {
      const my = G.input.my;
      const inField = G.input.inside && G.input.mx > FX - 40 && G.input.mx < FX + FW + 20 && my > FY - 40 && my < FY + FH + 40;
      if (inField && Math.abs(my - R.lastMy) > 0.5) {
        R.left.target = U.clamp(my - FY, L / 2, FH - L / 2);
        R.manualT = G.s.time;
      }
      R.lastMy = my;
      const d = I.held.ArrowUp ? -1 : I.held.ArrowDown ? 1 : 0;
      if (d) {
        R.left.target = U.clamp(R.left.y + d * 60, L / 2, FH - L / 2);
        R.manualT = G.s.time;
      }
    }
    const manual = !hasAuto;
    const lvl = G.botAssist ? Math.max(1, G.m.auto) : G.m.auto;
    // 左拍
    if (hasAuto && lvl >= 3) {
      // 分身：每个球一个球拍
      R.left.ys = R.balls.map((b, i) => {
        const prev = R.left.ys[i] === undefined ? FH / 2 : R.left.ys[i];
        const tgt = b.vx < 0 && !b.wait ? predictY(b, PX + 4) : FH / 2;
        return prev + U.clamp(tgt - prev, -2400 * dt, 2400 * dt);
      });
    } else {
      if (hasAuto) {
        // 找最先到达的球
        let best = null, bt = 1e9;
        for (const b of R.balls) {
          if (b.wait || b.vx >= 0) continue;
          const t = (b.x - PX) / -b.vx;
          if (t < bt) {
            bt = t;
            best = b;
          }
        }
        if (best !== R.left.tgt) {
          R.left.tgt = best;
          R.left.err = U.rand(-1, 1) * (lvl === 1 ? 48 : 14);
          R.left.react = lvl === 1 ? 0.2 : 0.07;
        }
        R.left.react -= dt;
        if (best && R.left.react <= 0) R.left.target = U.clamp(predictY(best, PX + 4) + R.left.err, L / 2, FH - L / 2);
        else if (!best) R.left.target = U.lerp(R.left.target, FH / 2, dt);
      }
      const maxV = manual ? 4200 : lvl === 1 ? 560 : 950;
      R.left.y += U.clamp(R.left.target - R.left.y, -maxV * dt, maxV * dt);
      R.left.y = U.clamp(R.left.y, L / 2, FH - L / 2);
      R.left.ys = [R.left.y];
    }
    // 右拍（对面）：每个球一个，永不失手
    R.right.ys = R.balls.map((b, i) => {
      const prev = R.right.ys[i] === undefined ? FH / 2 : R.right.ys[i];
      const tgt = b.vx > 0 && !b.wait ? predictY(b, FW - PX - 4) : b.y;
      return prev + U.clamp(tgt - prev, -1500 * dt, 1500 * dt);
    });

    // 球
    const SUB = 4;
    const h = dt / SUB;
    for (const b of R.balls) {
      if (b.wait > 0) {
        b.wait -= dt;
        if (b.wait <= 0) launch(b, 1);
        continue;
      }
      for (let k = 0; k < SUB; k++) {
        const px = b.x;
        b.x += b.vx * h;
        b.y += b.vy * h;
        if (b.y < BALL_R) {
          b.y = BALL_R;
          b.vy = Math.abs(b.vy);
          if (fg && R.intro >= 1) sfxWall();
        } else if (b.y > FH - BALL_R) {
          b.y = FH - BALL_R;
          b.vy = -Math.abs(b.vy);
          if (fg && R.intro >= 1) sfxWall();
        }
        // 左拍
        const lx = PX + 4;
        if (b.vx < 0 && px - BALL_R >= lx && b.x - BALL_R < lx) {
          const ys = R.left.ys;
          const i = ys.length > 1 ? R.balls.indexOf(b) : 0;
          const py = ys[Math.min(i, ys.length - 1)];
          if (Math.abs(b.y - py) <= L / 2 + BALL_R) {
            b.x = lx + BALL_R;
            hitBall(b, 'L', py);
          }
        }
        // 右拍（永远接得住：判定时把它放到球的位置）
        const rx = FW - PX - 4;
        if (b.vx > 0 && px + BALL_R <= rx && b.x + BALL_R > rx) {
          const i = R.balls.indexOf(b);
          R.right.ys[i] = U.lerp(R.right.ys[i], b.y, 0.6);
          b.x = rx - BALL_R;
          hitBall(b, 'R', R.right.ys[i]);
        }
        if (b.x < -30) {
          // 漏球
          b.combo = 0;
          G.s.stats.misses++;
          b.wait = 0.8;
          b.x = FW / 2;
          b.y = FH / 2;
          if (fg) sfxMiss();
          break;
        }
      }
    }
  }

  // ---------------- 声音 ----------------
  function sfxHit(side, combo) {
    if (E.has('tone')) {
      const n = SCALE[(combo - 1) % SCALE.length] - (side === 'R' ? 12 : 0);
      A.tone({ n, d: 0.16, v: 0.07, type: side === 'L' ? 'p25' : 'square', echo: 0.12 });
    } else {
      A.tone({ f: side === 'L' ? 490 : 460, d: 0.045, v: 0.07, type: 'square' });
    }
  }
  function sfxWall() {
    A.tone({ f: 245, d: 0.03, v: 0.04, type: 'square' });
  }
  function sfxMiss() {
    A.tone({ f: 330, f2: 110, d: 0.32, v: 0.06, type: 'square', env: 'hold', r: 0.04 });
  }
  G.bus.on('buy', (d, n, quiet) => {
    if (d.era !== 1 || d.type === 'goal' || quiet) return;
    const t = A.now();
    [69, 76, 81].forEach((n, i) => A.tone({ n, t: t + i * 0.06, d: 0.08, v: 0.06, type: 'square' }));
    R.hitFlash = 1;
    G.save.soon();
  });
  G.bus.on('cant', (d) => {
    if (d.era === 1) A.tone({ f: 120, d: 0.12, v: 0.06, type: 'square' });
  });

  // ---------------- 更新 ----------------
  function update(dt, fg) {
    syncBalls();
    // 后台且没有自动化：球停在中线（不白白漏球）
    const running = !R.frozen && ((fg && R.intro >= 1) || autoActiveBg());
    if (running) updatePong(dt, fg);
    // 前台时把非球拍按键转给终端
    if (fg) {
      for (const k of I.keys) {
        if (k.code === 'ArrowUp' || k.code === 'ArrowDown') continue;
        if (k.repeat || k.ctrl || k.alt) continue;
        G.eras[0].key(k);
      }
    }
    for (const f of R.floats) f.t += dt;
    R.floats = R.floats.filter((f) => f.t < 1);
    R.spiro.t += dt * (0.25 + 0.12 * Math.sqrt(E.lv('plot')));
    R.hitFlash = Math.max(0, R.hitFlash - dt * 3);
    const n = G.s.lineN || 0;
    if (R.tw.n < n) {
      R.tw.n = n;
      R.tw.k = 0;
    }
    R.tw.k += dt * 30;
  }
  function autoActiveBg() {
    return G.m.auto > 0;
  }

  // ---------------- 绘制辅助 ----------------
  function line(ctx, x1, y1, x2, y2) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  // 按周长比例画矩形（"描出来"）
  function rectP(ctx, x, y, w, h, p = 1) {
    if (p <= 0) return;
    const per = 2 * (w + h);
    let len = per * U.clamp(p, 0, 1);
    const pts = [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]];
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let i = 1; i < pts.length && len > 0; i++) {
      const [ax, ay] = pts[i - 1], [bx, by] = pts[i];
      const seg = Math.hypot(bx - ax, by - ay);
      const k = Math.min(1, len / seg);
      ctx.lineTo(ax + (bx - ax) * k, ay + (by - ay) * k);
      len -= seg;
    }
    ctx.stroke();
  }
  function makeHills() {
    const r = U.rng(11);
    const far = [], near = [];
    for (let x = 0; x <= FW; x += 40) far.push([x, FH - 70 - r() * 110 - Math.sin(x / 140) * 40]);
    for (let x = 0; x <= FW; x += 70) near.push([x, FH - 20 - r() * 60]);
    R.hills = { far, near };
  }

  // ---------------- 绘制 ----------------
  function ensureFB() {
    const sz = G.display.fbSize();
    if (R.fb.width !== sz.w || R.fb.height !== sz.h) {
      R.fb.width = R.trail.width = sz.w;
      R.fb.height = R.trail.height = sz.h;
    }
  }

  function render() {
    ensureFB();
    const ctx = R.ctx, k = R.fb.width / G.VW;
    G.ui.space(G.VW, G.VH);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, R.fb.width, R.fb.height);
    ctx.setTransform(k, 0, 0, k, 0, 0);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const p = R.intro;
    const st = (a, b) => U.seg(p, a, b); // 开场分段进度
    const blocked0 = G.ui.blocked;
    if (R.letterOpen) G.ui.blocked = true;

    drawField(ctx, st);
    drawMoving(ctx, k, st);
    drawTop(ctx, st(0.45, 0.7));
    drawScope(ctx, st(0.5, 0.75));
    drawShop(ctx, st(0.55, 0.85));
    drawDock(ctx, st(0.7, 0.95));
    drawDialog(ctx, st(0.7, 0.95));
    if (G.visiting(1)) drawBack(ctx);
    G.ui.blocked = blocked0;
    if (R.letterOpen) drawLetter(ctx);
    if (p >= 1) drawCursor(ctx);
    return R.fb;
  }

  function drawField(ctx, st) {
    const x = FX, y = FY;
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 2;
    // 开场：上下边先有（由跃迁那条线分出来），然后两侧描出
    const sides = st(0, 0.2);
    if (R.intro < 1) {
      line(ctx, x, y, x + FW, y);
      line(ctx, x, y + FH, x + FW, y + FH);
      const hgt = FH * sides;
      line(ctx, x, y + FH / 2 - hgt / 2, x, y + FH / 2 + hgt / 2);
      line(ctx, x + FW, y + FH / 2 - hgt / 2, x + FW, y + FH / 2 + hgt / 2);
    } else {
      ctx.strokeRect(x, y, FW, FH);
    }
    // 远山
    if (E.has('hills') && R.hills) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, y, FW, FH);
      ctx.clip();
      ctx.strokeStyle = C.faint;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      R.hills.far.forEach(([hx, hy], i) => (i ? ctx.lineTo(x + hx, y + hy) : ctx.moveTo(x + hx, y + hy)));
      ctx.stroke();
      ctx.strokeStyle = '#2c4250';
      ctx.beginPath();
      R.hills.near.forEach(([hx, hy], i) => (i ? ctx.lineTo(x + hx, y + hy) : ctx.moveTo(x + hx, y + hy)));
      ctx.stroke();
      // 月亮
      ctx.strokeStyle = C.faint;
      ctx.beginPath();
      ctx.arc(x + FW * 0.78, y + 120, 34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + FW * 0.78 + 14, y + 112, 30, Math.PI * 0.55, Math.PI * 1.45);
      ctx.stroke();
      ctx.restore();
    }
    // 中线
    const dashes = 18;
    const cd = st(0.18, 0.4) * dashes;
    ctx.strokeStyle = C.dim;
    ctx.lineWidth = 3;
    for (let i = 0; i < Math.floor(cd); i++) {
      const yy = y + (i + 0.25) * (FH / dashes);
      line(ctx, x + FW / 2, yy, x + FW / 2, yy + FH / dashes / 2);
    }
  }

  function drawMoving(ctx, k, st) {
    const L = paddleLen();
    const grow = st(0.35, 0.5);
    const glow = E.has('glow0');
    // 余辉：画到拖影层再叠加
    let c = ctx;
    if (glow) {
      const t = R.tctx;
      t.setTransform(1, 0, 0, 1, 0, 0);
      t.globalCompositeOperation = 'source-over';
      t.fillStyle = 'rgba(0,0,0,0.16)';
      t.fillRect(0, 0, R.trail.width, R.trail.height);
      t.setTransform(k, 0, 0, k, 0, 0);
      c = t;
    }
    c.strokeStyle = C.hot;
    c.lineCap = 'round';
    c.lineWidth = 8;
    // 左拍
    for (const py of R.left.ys.length ? R.left.ys : [FH / 2]) line(c, FX + PX, FY + py - (L / 2) * grow, FX + PX, FY + py + (L / 2) * grow);
    // 右拍
    c.strokeStyle = C.line;
    const rys = R.right.ys.length ? R.right.ys : [FH / 2];
    for (const py of rys) line(c, FX + FW - PX, FY + py - 40 * grow, FX + FW - PX, FY + py + 40 * grow);
    // 球（那个点）
    if (R.intro >= 0.8) {
      c.fillStyle = C.hot;
      for (const b of R.balls) {
        if (b.wait > 0 && Math.floor(G.t * 8) % 2) continue;
        c.beginPath();
        c.arc(FX + b.x, FY + b.y, BALL_R, 0, Math.PI * 2);
        c.fill();
      }
    }
    if (glow) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(R.trail, 0, 0);
      ctx.restore();
    }
    // 飘字
    for (const f of R.floats) {
      const a = 1 - f.t;
      V.draw(ctx, '+' + U.fmt(f.v), f.x, f.y - 20 - f.t * 46, 16, { color: U.rgba(f.combo >= 20 ? C.warm : C.line, a), lw: 1.5 });
    }
    // 连击
    let best = 0;
    for (const b of R.balls) best = Math.max(best, b.combo);
    if (best >= 3 && R.intro >= 1) {
      V.draw(ctx, `${best} COMBO`, FX + FW / 2 + 20, FY + 16, 14, { color: U.rgba(C.line, 0.55), lw: 1.4 });
    }
  }

  function drawTop(ctx, p) {
    if (p <= 0) return;
    const s = G.s;
    ctx.globalAlpha = p;
    V.draw(ctx, '向量', 40, 30, 22, { color: C.line, lw: 1.2, reveal: p });
    V.draw(ctx, U.fmt(s.res.vec), 132, 26, 40, { color: C.hot, lw: 2.6, reveal: p });
    V.draw(ctx, '+' + U.fmt(E.shown('vec'), 1) + '/秒', 460, 44, 18, { color: C.dim, lw: 1.3, reveal: p });
    V.draw(ctx, '比特 ' + U.fmt(s.res.bits) + '  +' + U.fmt(E.shown('bits'), 1) + '/秒', 640, 44, 16, { color: '#6ac08c', lw: 1.2, reveal: p });
    // 矢量阵列：旋转的线框立方体
    const na = E.lv('array'), n = Math.min(5, na);
    for (let i = 0; i < n; i++) cube(ctx, 1000 + i * 34, 52, 11, G.t * (0.6 + i * 0.07) + i);
    if (na > 5) V.draw(ctx, '×' + na, 1000 + 5 * 34 - 4, 44, 13, { color: C.dim, lw: 1.1 });
    // 留言 / 菜单
    if (s.msg > 0) {
      const t = `[留言 ${G.letter.pct()}%]`;
      const w = V.width(ctx, t, 16) + 10;
      ctx.strokeStyle = C.dim;
      ctx.lineWidth = 1;
      const hov = G.ui.over(1340 - w, 30, w, 34);
      V.draw(ctx, t, 1345 - w, 39, 16, { color: hov ? C.hot : C.dim, lw: 1.2 });
      if (G.ui.click(1340 - w, 30, w, 34)) R.letterOpen = R.letterOpen ? 0 : 1;
    }
    const hov = G.ui.over(1460, 28, 110, 36);
    V.draw(ctx, '[菜单]', 1470, 38, 18, { color: hov ? C.hot : C.dim, lw: 1.3 });
    if (G.ui.click(1460, 28, 110, 36)) G.ui.openMenu();
    ctx.globalAlpha = 1;
  }

  function cube(ctx, cx, cy, s, a) {
    const pts = [];
    for (let i = 0; i < 8; i++) {
      let x = i & 1 ? s : -s, y = i & 2 ? s : -s, z = i & 4 ? s : -s;
      let x2 = x * Math.cos(a) - z * Math.sin(a), z2 = x * Math.sin(a) + z * Math.cos(a);
      const b = a * 0.7;
      let y2 = y * Math.cos(b) - z2 * Math.sin(b);
      z2 = y * Math.sin(b) + z2 * Math.cos(b);
      const f = 60 / (60 + z2);
      pts.push([cx + x2 * f, cy + y2 * f]);
    }
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (const [a1, b1] of [[0, 1], [1, 3], [3, 2], [2, 0], [4, 5], [5, 7], [7, 6], [6, 4], [0, 4], [1, 5], [2, 6], [3, 7]]) {
      ctx.moveTo(pts[a1][0], pts[a1][1]);
      ctx.lineTo(pts[b1][0], pts[b1][1]);
    }
    ctx.stroke();
  }

  const LISS = [[1, 1], [1, 2], [2, 3], [3, 4], [3, 5], [4, 5], [5, 6], [1, 3], [5, 8], [7, 8]];
  function drawScope(ctx, p) {
    if (p <= 0) return;
    const x = 1080, y = 100, w = 480, h = 230;
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 2;
    rectP(ctx, x, y, w, h, p);
    if (p < 1) return;
    line(ctx, x + w / 2, y + 10, x + w / 2, y + h - 10);
    // 左：李萨如
    const n = E.lv('scope');
    const cx = x + w / 4, cy = y + h / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 2, y + 2, w / 2 - 4, h - 4);
    ctx.clip();
    if (!n) {
      ctx.strokeStyle = C.dim;
      ctx.beginPath();
      for (let i = 0; i <= 60; i++) {
        const xx = x + 12 + i * ((w / 2 - 24) / 60);
        const yy = cy + (Math.random() - 0.5) * 3;
        i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy);
      }
      ctx.stroke();
      V.draw(ctx, '无信号', cx, y + h - 34, 13, { color: C.dim, align: 'center', lw: 1 });
    } else {
      const shown = Math.min(n, LISS.length);
      for (let i = 0; i < shown; i++) {
        const [a, b] = LISS[i];
        const ph = G.t * (0.3 + i * 0.07) + i;
        const A1 = 90 - i * 4, B1 = 90 - i * 4;
        ctx.strokeStyle = U.rgba(C.line, 0.75 - i * 0.05);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        for (let k = 0; k <= 240; k++) {
          const t = (k / 240) * Math.PI * 2;
          const xx = cx + A1 * Math.sin(a * t + ph), yy = cy + B1 * Math.sin(b * t);
          k ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy);
        }
        ctx.stroke();
      }
      V.draw(ctx, '×' + n, x + 12, y + 12, 12, { color: C.dim, lw: 1 });
    }
    ctx.restore();
    // 右：繁花曲线
    const m = E.lv('plot');
    const sx = x + (w * 3) / 4, sy = y + h / 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + w / 2 + 2, y + 2, w / 2 - 4, h - 4);
    ctx.clip();
    if (!m) {
      V.draw(ctx, '绘图仪待机', sx, sy - 8, 13, { color: C.dim, align: 'center', lw: 1 });
    } else {
      const sp = R.spiro;
      if (!sp.cur) sp.cur = spiroParams(sp.done.length);
      const per = sp.cur.period;
      if (sp.t >= per) {
        sp.done.push(sp.cur);
        if (sp.done.length > 2) sp.done.shift();
        sp.cur = spiroParams(sp.done.length + Math.floor(G.t));
        sp.t = 0;
      }
      for (const d of sp.done) spiro(ctx, sx, sy, d, d.period, 0.18);
      spiro(ctx, sx, sy, sp.cur, sp.t, 0.85);
      V.draw(ctx, '×' + m, x + w / 2 + 12, y + 12, 12, { color: C.dim, lw: 1 });
    }
    ctx.restore();
  }
  function spiroParams(seed) {
    const r = U.rng(seed * 7 + 3);
    const opts = [[5, 3], [7, 4], [8, 3], [9, 5], [11, 7], [6, 5], [10, 7]];
    const [Rr, rr] = opts[Math.floor(r() * opts.length)];
    const d = 0.6 + r() * 0.8;
    const g = (a, b) => (b ? g(b, a % b) : a);
    return { R: Rr, r: rr, d, period: (2 * Math.PI * rr) / g(Rr, rr), scale: 86 / (Rr - rr + d * rr) };
  }
  function spiro(ctx, cx, cy, p, tmax, alpha) {
    ctx.strokeStyle = U.rgba(C.line, alpha);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    const steps = Math.max(2, Math.floor(tmax * 40));
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * tmax;
      const k = (p.R - p.r) / p.r;
      const x = (p.R - p.r) * Math.cos(t) + p.d * p.r * Math.cos(k * t);
      const y = (p.R - p.r) * Math.sin(t) - p.d * p.r * Math.sin(k * t);
      i ? ctx.lineTo(cx + x * p.scale, cy + y * p.scale) : ctx.moveTo(cx + x * p.scale, cy + y * p.scale);
    }
    ctx.stroke();
  }

  function drawShop(ctx, p) {
    if (p <= 0) return;
    const x = 1080, y = 350, w = 480, h = 510;
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 2;
    rectP(ctx, x, y, w, h, p);
    if (p < 1) return;
    const list = E.list(1);
    const RH = 56;
    if (!list.length) {
      V.draw(ctx, '还没有能画的东西。', x + w / 2, y + h / 2 - 30, 16, { color: C.dim, align: 'center', lw: 1.1 });
      V.draw(ctx, '接住球，攒一点向量。', x + w / 2, y + h / 2 + 4, 16, { color: C.dim, align: 'center', lw: 1.1 });
      return;
    }
    const maxScroll = Math.max(0, list.length * RH - (h - 16));
    if (G.ui.over(x, y, w, h) && I.wheel) R.shopScroll = U.clamp(R.shopScroll + I.wheel * 0.6, 0, maxScroll);
    R.shopScroll = U.clamp(R.shopScroll, 0, maxScroll);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 2, y + 2, w - 4, h - 4);
    ctx.clip();
    list.forEach((d, i) => {
      const ry = y + 8 + i * RH - R.shopScroll;
      if (ry < y - RH || ry > y + h) return;
      const visible = ry >= y && ry + RH - 6 <= y + h;
      const res = visible ? G.ui.buy(d, x + 8, ry, w - 16, RH - 6) : { hover: false, can: E.canBuy(d) };
      const can = res.can;
      const goal = d.type === 'goal';
      const col = can ? (goal ? C.warm : C.hot) : C.dim;
      ctx.strokeStyle = res.hover ? col : can ? U.rgba(C.line, 0.6) : C.faint;
      ctx.lineWidth = res.hover ? 2 : 1.2;
      if (res.hover && can) {
        ctx.fillStyle = 'rgba(200,235,255,0.06)';
        ctx.fillRect(x + 8, ry, w - 16, RH - 6);
      }
      ctx.strokeRect(x + 8, ry, w - 16, RH - 6);
      const lv = E.lv(d.id);
      let name = d.name;
      if (d.type === 'level') name = d.name + ' ' + ['I', 'II', 'III', 'IV'][Math.min(lv, 3)];
      V.draw(ctx, name, x + 20, ry + 8, 17, { color: col, lw: 1.3 });
      if (d.type === 'gen' && lv) V.draw(ctx, '×' + lv, x + 20 + V.width(ctx, name, 17) + 12, ry + 11, 13, { color: C.dim, lw: 1.1 });
      V.draw(ctx, d.desc, x + 20, ry + 32, 11, { color: can ? '#9fb8c6' : C.dim, lw: 0.9 });
      const c = E.cost(d);
      const ct = E.maxed(d) ? '已满' : Object.keys(c).map((r) => U.fmt(c[r]) + (r === 'vec' ? '' : ' ' + E.NAME[r])).join(' + ');
      V.draw(ctx, ct, x + w - 22, ry + 10, 15, { color: col, align: 'right', lw: 1.3 });
    });
    ctx.restore();
    if (maxScroll > 0) {
      const sh = (h - 20) * ((h - 16) / (list.length * RH));
      const sy = y + 10 + (h - 20 - sh) * (R.shopScroll / maxScroll);
      ctx.strokeStyle = C.dim;
      ctx.lineWidth = 2;
      line(ctx, x + w - 5, sy, x + w - 5, sy + sh);
    }
  }

  function drawDock(ctx, p) {
    if (p <= 0) return;
    const x = 40, y = 700, w = 288, h = 162;
    const off = (1 - U.ease.outCubic(p)) * 300;
    G.eras[0].renderMini(ctx, x - off, y, w, h);
    const hov = G.ui.over(x, y, w, h);
    ctx.strokeStyle = hov ? C.hot : C.dim;
    ctx.lineWidth = hov ? 2.5 : 1.5;
    ctx.strokeRect(x - off, y, w, h);
    V.draw(ctx, hov ? '点击回到终端' : '终端', x - off + 4, y + h + 8, 11, { color: hov ? C.line : C.dim, lw: 1 });
    if (G.ui.click(x, y, w, h)) G.visit(0, [x, y, w, h]);
  }

  function drawDialog(ctx, p) {
    if (p <= 0) return;
    const x = 350, y = 700, w = 690, h = 162;
    ctx.strokeStyle = C.dim;
    ctx.lineWidth = 1.5;
    rectP(ctx, x, y, w, h, p);
    if (p < 1) return;
    const lines = G.s.log.filter((l) => l.kind === 'dot' || l.kind === 'sys').slice(-4);
    lines.forEach((l, i) => {
      const newest = i === lines.length - 1;
      let text = (l.kind === 'sys' ? '[系统] ' : '> ') + l.text;
      const chars = [...text];
      let reveal = 1;
      if (newest && l.n === R.tw.n) reveal = U.clamp(R.tw.k / chars.length, 0, 1);
      const a = 0.35 + 0.65 * ((i + 1) / lines.length);
      const fs = 17;
      // 太长就截断
      if (chars.length > 34) text = chars.slice(0, 33).join('') + '…';
      V.draw(ctx, text, x + 18, y + 16 + i * 36, fs, { color: U.rgba(l.kind === 'sys' ? '#9fd4b0' : C.line, a), lw: 1.15, reveal });
    });
  }

  function drawBack(ctx) {
    const hov = G.ui.over(1300, 866, 270, 30);
    V.draw(ctx, '< 返回（ESC）', 1310, 870, 16, { color: hov ? C.hot : C.warm, lw: 1.4 });
    if (G.ui.click(1300, 866, 270, 30)) G.unvisit();
  }

  function drawLetter(ctx) {
    const w = 900, h = 300, x = 800 - w / 2, y = 300;
    ctx.fillStyle = 'rgba(0,0,0,0.92)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    V.draw(ctx, `留言.txt（${G.letter.pct()}% 可读）`, x + 30, y + 26, 18, { color: C.warm, lw: 1.3 });
    const txt = G.letter.view(G.s.msg, (i) => '░▒▓#%&'[(i + Math.floor(G.t * 3)) % 6]);
    const chars = [...txt];
    const per = 26;
    for (let i = 0; i * per < chars.length; i++) {
      V.draw(ctx, chars.slice(i * per, (i + 1) * per).join(''), x + 30, y + 80 + i * 44, 20, { color: C.line, lw: 1.2 });
    }
    V.draw(ctx, '（点击关闭）', x + w - 30, y + h - 36, 12, { color: C.dim, align: 'right', lw: 1 });
    if (G.input.pressed && !G.input.used) {
      G.input.used = true;
      R.letterOpen = 0;
    }
  }

  function drawCursor(ctx) {
    if (!G.input.inside || G.ui.menuOpen()) return;
    const mx = G.input.mx, my = G.input.my;
    const inField = mx > FX && mx < FX + FW && my > FY && my < FY + FH;
    if (inField && !R.letterOpen) return;
    ctx.strokeStyle = C.hot;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(mx, my);
    ctx.lineTo(mx, my + 22);
    ctx.lineTo(mx + 6, my + 16);
    ctx.lineTo(mx + 15, my + 16);
    ctx.closePath();
    ctx.stroke();
  }

  function display() {
    return {
      bloom: E.has('glow1') ? 0.95 : 0.35,
      bloomR: E.has('glow1') ? 9 : 6,
      bloomT: 0.1,
      vig: 0.3,
      curve: 0.018,
      corner: 0.035,
      noise: 0.012,
      tint: [0.97, 1, 1.04],
    };
  }

  // ---------------- 小窗 ----------------
  function renderMini(ctx, x, y, w, h, opt = {}) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = '#000';
    ctx.fillRect(x, y, w, h);
    const sx = w / FW, sy = h / FH;
    const col = opt.color || C.line;
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.lineWidth = Math.max(1, 2 * sx);
    if (opt.pixel) {
      // 像素版：整数坐标的方块
      const px = (v) => Math.round(v);
      for (let i = 0; i < 8; i++) ctx.fillRect(px(x + w / 2), px(y + (i + 0.25) * (h / 8)), 1, Math.max(1, px(h / 16)));
      const L = paddleLen();
      for (const py of R.left.ys.length ? R.left.ys : [FH / 2]) ctx.fillRect(px(x + PX * sx), px(y + (py - L / 2) * sy), Math.max(1, px(3 * sx)), Math.max(2, px(L * sy)));
      for (const py of R.right.ys.length ? R.right.ys : [FH / 2]) ctx.fillRect(px(x + (FW - PX) * sx), px(y + (py - 40) * sy), Math.max(1, px(3 * sx)), Math.max(2, px(80 * sy)));
      for (const b of R.balls) if (b.wait <= 0) ctx.fillRect(px(x + b.x * sx) - 1, px(y + b.y * sy) - 1, 2, 2);
    } else {
      ctx.setLineDash([h / 30, h / 30]);
      line(ctx, x + w / 2, y, x + w / 2, y + h);
      ctx.setLineDash([]);
      const L = paddleLen();
      for (const py of R.left.ys.length ? R.left.ys : [FH / 2]) line(ctx, x + PX * sx, y + (py - L / 2) * sy, x + PX * sx, y + (py + L / 2) * sy);
      for (const py of R.right.ys.length ? R.right.ys : [FH / 2]) line(ctx, x + (FW - PX) * sx, y + (py - 40) * sy, x + (FW - PX) * sx, y + (py + 40) * sy);
      for (const b of R.balls) {
        if (b.wait > 0) continue;
        ctx.beginPath();
        ctx.arc(x + b.x * sx, y + b.y * sy, Math.max(1.5, BALL_R * sx), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }
})();
