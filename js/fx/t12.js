'use strict';
// 跃迁 1 → 2「颜色」：球停住 → 像素网格 → 一级级量化成大方块 → 只剩球那一块 → 缩成一个像素
// → 彩虹涟漪（NES 调色板）→ 褪回灰色 → 8-bit 面板像方块一样掉下来 → 按任意键开始
G.fx.t12 = () => {
  const U = G.U, A = G.audio, e1 = G.eras[1], e2 = G.eras[2];
  const less = () => G.s.set.lessFlash;
  G.setEra(2);
  G.letter.reveal(0.08); // 跃迁一开始就给：中途刷新也不会丢
  e1.freeze(true);
  const W = 480, H = 270;
  const fb = U.canvas(W, H);
  const ctx = fb.getContext('2d');
  const F = G.text.pixel(12);
  const ball = (e1.balls()[0] || { x: 800, y: 450 });
  // 球在 30×17 的大格子里的位置（大格 16px）
  const bx = Math.floor((ball.x / G.VW) * 30), by = Math.floor((ball.y / G.VH) * 16.875);
  const head = e2.snakeHead();
  let t = 0, said = {}, noise = null, step = -1, shrink = -1, landed = 0;

  function once(k, fn) {
    if (!said[k]) {
      said[k] = 1;
      fn();
    }
  }

  const o = {
    done: false,
    update(dt) {
      t += dt;
      if (t < 1.5) {
        if (!noise && A.ready) noise = A.sustain({ noise: 'white', bp: 1200, q: 0.8, v: 0.001 });
        if (noise) {
          noise.set(0.01 + 0.05 * U.seg(t, 0, 1.5), 0.1);
          noise.filter(800 + 4000 * U.seg(t, 0, 1.5), 0.1);
        }
      }
      if (t >= 1.5 && t < 3.5) {
        const k = Math.min(4, Math.floor(U.seg(t, 1.5, 3.5) * 5));
        if (k !== step) {
          step = k;
          if (noise) noise.set(0.05 - k * 0.01, 0.05);
          A.noise({ d: 0.07, v: 0.09, buf: 'nes', rate: 0.5 - k * 0.08, force: true });
          A.tone({ f: 220 / (k + 1), d: 0.06, v: 0.08, type: 'square', force: true });
        }
      }
      if (t >= 3.5) once('quiet', () => noise && noise.stop(0.05));
      if (t >= 4.2 && t < 4.8) {
        const k = Math.min(4, Math.floor(U.seg(t, 4.2, 4.8) * 5));
        if (k !== shrink) {
          shrink = k;
          A.tone({ n: 84 + k * 2, d: 0.03, v: 0.05, type: 'p25' });
        }
      }
      if (t >= 4.85) once('jingle', () => {
        const t0 = A.now();
        [72, 76, 79, 84].forEach((n, i) => A.tone({ n, t: t0 + i * 0.06, d: 0.06, v: 0.06, type: 'p25' }));
        [76, 76, 76, 81].forEach((n, i) => A.tone({ n, t: t0 + 0.32 + i * 0.16, d: i === 3 ? 0.6 : 0.12, v: 0.07, type: 'p25', env: 'hold', r: 0.1, vib: i === 3 ? 0.008 : 0 }));
        [52, 52, 52, 57].forEach((n, i) => A.tone({ n, t: t0 + 0.32 + i * 0.16, d: i === 3 ? 0.6 : 0.12, v: 0.12, type: 'nestri', env: 'hold', r: 0.05 }));
      });
      if (t >= 7.0) {
        const p = U.seg(t, 7.0, 9.6);
        e2.setIntro(p);
        while (landed < e2.INTRO.length && p >= e2.INTRO[landed] + 0.09) {
          landed++;
          A.noise({ d: 0.08, v: 0.08, buf: 'nes', rate: 0.15 });
          A.tone({ n: 40 + landed * 2, d: 0.08, v: 0.08, type: 'p50' });
        }
      }
      if (t >= 9.6) {
        e1.freeze(false);
        o.done = true;
        setTimeout(() => G.story.say(`留言.txt 恢复到 ${G.letter.pct()}%。`, 'sys'), 300);
      }
    },
    render() {
      if (t < 3.5) {
        const src = e1.render();
        const p = Object.assign({}, e1.display());
        p.grid = U.seg(t, 1.0, 1.5) * 0.3;
        p.edge = [0.35, 0.75, 1];
        if (t >= 1.5) {
          const k = Math.min(4, Math.floor(U.seg(t, 1.5, 3.5) * 5));
          const cells = 480 / Math.pow(2, k);
          p.pix = src.width / cells;
          p.gridN = [cells, cells * (270 / 480)];
          p.grid = 0.25;
          if (k >= 1) {
            p.quant = 2;
            p.gray = 1;
          }
          p.bloom = 0;
        } else p.shake = [U.rand(-1, 1) * 0.001 * U.seg(t, 0.3, 1.5), 0];
        return { src, p };
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      const pd = e2.display();
      if (t < 4.2) {
        // 只剩球所在的那一大格
        ctx.fillStyle = '#FCFCFC';
        ctx.fillRect(bx * 16, by * 16, 16, 16);
        return { src: fb, p: { nearest: true, grid: 0.2, gridN: [30, 16.875], edge: [0.35, 0.75, 1] } };
      }
      if (t < 4.8) {
        const k = Math.min(4, Math.floor(U.seg(t, 4.2, 4.8) * 5));
        const sz = 16 >> k;
        const u = U.ease.inOutCubic(U.seg(t, 4.2, 4.8));
        const x = Math.round(U.lerp(bx * 16 + 8, head.x, u) - sz / 2), y = Math.round(U.lerp(by * 16 + 8, head.y, u) - sz / 2);
        ctx.fillStyle = '#FCFCFC';
        ctx.fillRect(x, y, Math.max(1, sz), Math.max(1, sz));
        return { src: fb, p: { nearest: true } };
      }
      const pf = Object.assign({}, pd, { curve: pd.curve * U.seg(t, 4.8, 7), scan: pd.scan * U.seg(t, 4.8, 7) });
      if (t < 7.0) {
        // 彩虹涟漪
        const tt = t - 4.8;
        const fade = 1 - U.seg(t, 6.0, 6.6);
        const pal = e2.NES.filter((c) => c !== '#000000' && c !== '#7C7C7C' && c !== '#BCBCBC' && c !== '#787878');
        ctx.lineWidth = 6;
        for (let i = 0; i < 26; i++) {
          const r = tt * 260 - i * 9;
          if (r <= 0) continue;
          const a = fade * Math.max(0, 1 - r / 560);
          if (a <= 0) continue;
          ctx.globalAlpha = a;
          ctx.strokeStyle = pal[(i * 3 + Math.floor(tt * 24)) % pal.length];
          ctx.beginPath();
          ctx.arc(head.x, head.y, r, 0, Math.PI * 2);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#FCFCFC';
        ctx.fillRect(head.x - 1, head.y - 1, 3, 3);
        if (t > 6.3) {
          const n = Math.floor((t - 6.3) * 14);
          F.draw(ctx, '刚才……那是什么？', head.x, head.y + 18, '#BCBCBC', { align: 'center', max: n });
        }
        const flash = less() ? 0 : Math.max(0, 1 - tt / 0.25) * 0.5;
        return { src: fb, p: Object.assign(pf, { white: flash, bloom: 0.5 }) };
      }
      const src = e2.render();
      return { src, p: pd };
    },
  };
  return o;
};
