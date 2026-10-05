'use strict';
// 跃迁 0 → 1「第一条线」：编译 → 静止 → 字符被吸进光标 → 光标变成点 → 点拉成线 → 线分开成场地 → 矢量界面描出来
G.fx.t01 = () => {
  const U = G.U, A = G.audio, e0 = G.eras[0], e1 = G.eras[1];
  const less = () => G.s.set.lessFlash;
  G.setEra(1);
  G.letter.reveal(0.12); // 跃迁一开始就给：中途刷新也不会丢
  G.s.flags.t01 = 1;
  const fb = U.canvas(1600, 900);
  const ctx = fb.getContext('2d');
  const COMPILE = [
    'gcc -O2 -c vector.c -o vector.o',
    'vector.c: 正在把"点"推广到"线"……',
    'vector.c:12: 警告：长度从 0 变为非 0',
    'vector.c:40: 警告：宽度仍然是 0（这是正常的）',
    'ld -o vector.drv vector.o libdot.a',
    '[##########----------] 52%',
    '[################----] 81%',
    '[####################] 100%',
  ];
  let t = 0, ci = 0, fan = null, said = {}, glyphs = null, cur = null, lastTick = 0, dashes = 0, absorbed = 0;
  const green = '#41ff86';

  function once(key, fn) {
    if (!said[key]) {
      said[key] = 1;
      fn();
    }
  }

  const o = {
    done: false,
    update(dt) {
      t += dt;
      // A：编译
      while (ci < COMPILE.length && t >= 0.05 + ci * 0.2) {
        G.story.say(COMPILE[ci], ci >= 5 ? 'ok' : 'out');
        A.tone({ f: 1400 + ci * 120, d: 0.02, v: 0.03 });
        ci++;
      }
      if (t < 1.9) {
        if (!fan && A.ready) fan = A.sustain({ noise: 'white', bp: 500, q: 0.6, v: 0.001 });
        if (fan) {
          fan.set(0.012 + 0.06 * U.seg(t, 0, 1.9), 0.1);
          fan.filter(500 + 2600 * U.seg(t, 0, 1.9), 0.1);
        }
        if (Math.random() < dt * (8 + t * 30)) A.tone({ f: U.rand(900, 2400), d: 0.012, v: 0.025 });
      }
      if (t >= 1.75) once('ok', () => G.story.say('vector.drv 已加载。', 'ok'));
      if (t >= 1.95) once('cut', () => {
        if (fan) fan.stop(0.03);
        G.story.say('我……', 'dot');
        e0.freeze(true);
      });
      // C：捕获字符
      if (t >= 2.6 && !glyphs) {
        cur = e0.cursorPos();
        const cx = cur.x + cur.w / 2, cy = cur.y + cur.h / 2;
        let maxD = 1;
        glyphs = e0.glyphs().map((g) => {
          const d = Math.hypot(g.x - cx, g.y - cy);
          maxD = Math.max(maxD, d);
          return Object.assign({}, g, { d, side: Math.random() < 0.5 ? -1 : 1, rot: U.rand(-3, 3) });
        });
        for (const g of glyphs) g.delay = 2.6 + (g.d / maxD) * 1.0 + Math.random() * 0.12;
      }
      if (glyphs && t < 4.4) {
        for (const g of glyphs) {
          if (!g.gone && t >= g.delay + 0.55) {
            g.gone = true;
            absorbed++;
            if (G.t - lastTick > 0.018) {
              lastTick = G.t;
              A.tone({ f: 900 + absorbed * 4, d: 0.012, v: 0.03 });
            }
          }
        }
      }
      if (t >= 4.3) once('hum', () => A.tone({ f: 55, d: 1.4, v: 0.08, type: 'sine', env: 'hold', a: 0.3, r: 0.5 }));
      if (t >= 4.8) once('sweep', () => A.tone({ f: 110, f2: 880, slide: 0.85, d: 0.95, v: 0.09, type: 'sine', env: 'hold', a: 0.02, r: 0.4, rev: 0.4 }));
      if (t >= 5.6) once('whoosh', () => A.noise({ d: 0.8, v: 0.05, bp: 400, f2: 2500, q: 1.2, env: 'hold', a: 0.2, r: 0.3 }));
      // G：矢量界面描出来
      if (t >= 6.4) {
        const p = U.seg(t, 6.4, 9.2);
        e1.setIntro(p);
        const d = Math.floor(U.seg(p, 0.18, 0.4) * 18);
        while (dashes < d) {
          dashes++;
          A.tone({ f: 600 + dashes * 30, d: 0.025, v: 0.04, type: 'square' });
        }
        if (p >= 0.36) once('pad', () => A.tone({ f: 220, f2: 440, slide: 0.2, d: 0.25, v: 0.05, type: 'square' }));
        if (p >= 0.5) once('arp', () => {
          const t0 = A.now();
          [76, 76, 76, 81].forEach((n, i) => A.tone({ n, t: t0 + i * 0.13, d: 0.11, v: 0.05, type: 'p25', echo: 0.2 }));
        });
      }
      if (t >= 9.2) {
        e0.freeze(false);
        o.done = true;
        setTimeout(() => {
          G.story.say('我能画线了。', 'dot');
          G.story.say(`留言.txt 恢复到 ${G.letter.pct()}%。`, 'sys');
        }, 400);
      }
    },
    render() {
      // A、B：终端本身
      if (t < 2.6) {
        const src = e0.render();
        const p = Object.assign({}, e0.display());
        if (t < 1.95) {
          p.shake = [U.rand(-1, 1) * 0.0012 * U.seg(t, 0.5, 1.9), 0];
          p.flick = 0.05 * U.seg(t, 0.8, 1.9);
        }
        return { src, p };
      }
      const sz = G.display.fbSize();
      if (fb.width !== sz.w || fb.height !== sz.h) {
        fb.width = sz.w;
        fb.height = sz.h;
      }
      const k = fb.width / G.VW;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, fb.width, fb.height);
      ctx.setTransform(k, 0, 0, k, 0, 0);
      const base = e0.display();
      if (t < 4.4) {
        // C：字符被吸进光标
        const cx = cur.x + cur.w / 2, cy = cur.y + cur.h / 2;
        ctx.textBaseline = 'middle';
        for (const g of glyphs) {
          if (g.gone) continue;
          const u = U.clamp((t - g.delay) / 0.55, 0, 1);
          const e = U.ease.inCubic(u);
          const nx = -(cy - g.y), ny = cx - g.x;
          const nl = Math.hypot(nx, ny) || 1;
          const sw = Math.sin(u * Math.PI) * 60 * g.side;
          const x = U.lerp(g.x, cx, e) + (nx / nl) * sw, y = U.lerp(g.y, cy, e) + (ny / nl) * sw;
          ctx.save();
          ctx.translate(x + 8, y + 17);
          ctx.rotate(g.rot * e);
          const sc = 1 - 0.8 * e;
          ctx.scale(sc, sc);
          ctx.font = `${g.wide ? 31 : 28}px ${e0.FONT}`;
          ctx.fillStyle = u > 0 ? U.mix(g.color, '#ffffff', e) : g.color;
          if (g.ch === '─') ctx.fillRect(-8, -1, 16, 2);
          else ctx.fillText(g.ch, -8, 0);
          ctx.restore();
        }
        const grow = 1 + Math.min(0.6, absorbed / 500);
        ctx.fillStyle = U.mix(green, '#ffffff', U.seg(t, 3.2, 4.4));
        ctx.fillRect(cx - (cur.w / 2) * grow, cur.y + 3 - (grow - 1) * 10, cur.w * grow, (cur.h - 6) * grow);
        return { src: fb, p: Object.assign({}, base, { bloom: 0.7 + absorbed / 900 }) };
      }
      const cx0 = cur.x + cur.w / 2, cy0 = cur.y + cur.h / 2;
      const fade = U.ease.inOutCubic(U.seg(t, 4.2, 5.2));
      const p = {
        bloom: 0.9, bloomR: 7, bloomT: 0.1,
        curve: base.curve * (1 - fade), scan: base.scan * (1 - fade), scanN: base.scanN, vig: U.lerp(base.vig, 0.3, fade),
        chroma: base.chroma * (1 - fade), noise: base.noise * (1 - fade), corner: U.lerp(base.corner, 0.035, fade),
      };
      if (t < 4.8) {
        // D：方块光标缩成圆点，滑到中央
        const u = U.ease.inOutCubic(U.seg(t, 4.4, 4.8));
        const x = U.lerp(cx0, 800, u), y = U.lerp(cy0, 450, u);
        const w = U.lerp(cur.w * 1.4, 12, u), h = U.lerp(cur.h, 12, u);
        ctx.fillStyle = U.mix(green, '#ffffff', 1);
        U.rrect(ctx, x - w / 2, y - h / 2, w, h, Math.min(w, h) / 2 * u);
        ctx.fill();
        return { src: fb, p };
      }
      ctx.strokeStyle = '#ffffff';
      ctx.lineCap = 'round';
      if (t < 5.6) {
        // E：点拉成一条横贯屏幕的线
        const u = U.ease.outExpo(U.seg(t, 4.8, 5.5));
        const L = 6 + u * 800;
        ctx.lineWidth = 3 + (1 - u) * 6;
        ctx.beginPath();
        ctx.moveTo(800 - L, 450);
        ctx.lineTo(800 + L, 450);
        ctx.stroke();
        const flash = less() ? 0 : Math.max(0, 1 - Math.abs(t - 5.3) / 0.18) * 0.35;
        return { src: fb, p: Object.assign(p, { white: flash, bloom: 1.2 }) };
      }
      if (t < 6.4) {
        // F：线分成两条，变成场地的上下边
        const u = U.ease.inOutCubic(U.seg(t, 5.6, 6.4));
        const F = e1.FIELD;
        const x0 = U.lerp(0, F.x, u), x1 = U.lerp(1600, F.x + F.w, u);
        const ya = U.lerp(450, F.y, u), yb = U.lerp(450, F.y + F.h, u);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x0, ya);
        ctx.lineTo(x1, ya);
        ctx.moveTo(x0, yb);
        ctx.lineTo(x1, yb);
        ctx.stroke();
        return { src: fb, p };
      }
      // G：矢量时代自己画开场
      const src = e1.render();
      return { src, p: Object.assign({}, e1.display(), { bloom: U.lerp(1.0, e1.display().bloom, U.seg(t, 6.4, 8)) }) };
    },
  };
  return o;
};
