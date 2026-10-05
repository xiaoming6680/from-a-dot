'use strict';
// 跃迁 2 → 3「纵深」：8-bit 画面卷动 → 切成 4 条以不同速度滑动 → 像素软化 → 整个界面向后倒下成为 Mode 7 地面
// → 16-bit 的天空和远山从地平线升起 → 点落地开始奔跑 → 远景一层层退去（只是一瞥）
G.fx.t23 = () => {
  const U = G.U, A = G.audio, e2 = G.eras[2], e3 = G.eras[3];
  G.setEra(3);
  G.letter.reveal(0.08); // 跃迁一开始就给：中途刷新也不会丢
  const a = U.canvas(480, 270), actx = a.getContext('2d');
  const b = U.canvas(640, 360), bctx = b.getContext('2d');
  const m7 = U.canvas(640, 360), m7ctx = m7.getContext('2d');
  let t = 0, said = {}, tex = null, frame = null, popped = 0;
  const once = (k, fn) => {
    if (!said[k]) {
      said[k] = 1;
      fn();
    }
  };
  const V = e3.VIEW;
  // 把 480×270 的纹理当作一块板：底边固定，绕底边向后倒 th 弧度；cy 是投影中心行
  let timg = null;
  function tilt(c, tex, th, cy, fwd) {
    const w = 640, h = 360, f = 400, D = 400, k = (640 / 480) * (D / f);
    if (!timg) timg = c.createImageData(w, h);
    const out = timg.data, td = tex.data, tw = 480, tht = 270;
    const sn = Math.sin(th), cs = Math.cos(th);
    const Yb = ((h - cy) / f) * D;
    for (let y = 0; y < h; y++) {
      const v = (y - cy) / f;
      const den = v * sn + cs;
      const row = y * w * 4;
      if (den <= 0.002) {
        for (let x = 0; x < w; x++) out[row + x * 4 + 3] = 0;
        continue;
      }
      const tt = (Yb * sn + D * cs) / den;
      const b = sn > 0.5 ? (tt - D) / sn : (Yb - tt * v) / cs;
      let ty = Math.floor(tht - b / k - fwd);
      ty = ((ty % tht) + tht) % tht;
      const fog = U.clamp((tt - D) / 5200, 0, 0.85);
      const sc = tt / (f * k);
      for (let x = 0; x < w; x++) {
        let tx = Math.floor(240 + (x - 320) * sc);
        tx = ((tx % tw) + tw) % tw;
        const ti = (ty * tw + tx) * 4, oi = row + x * 4;
        out[oi] = td[ti] + (203 - td[ti]) * fog;
        out[oi + 1] = td[ti + 1] + (232 - td[ti + 1]) * fog;
        out[oi + 2] = td[ti + 2] + (255 - td[ti + 2]) * fog;
        out[oi + 3] = 255;
      }
    }
    c.putImageData(timg, 0, 0);
  }

  const o = {
    done: false,
    update(dt) {
      t += dt;
      if (t >= 3.0) once('song', () => G.music.play(e3.SONG(), { mask: 0xf, fade: 2.5, fadeOut: 2 }));
      if (t >= 4.4) once('whoosh', () => A.noise({ d: 3, v: 0.07, bp: 200, f2: 2400, q: 1.2, env: 'hold', a: 1.2, r: 1.2, rev: 0.4 }));
      if (t >= 7.0) once('chord', () => {
        const t0 = A.now();
        [57, 64, 69, 72, 76].forEach((n, i) => A.fm({ n, t: t0 + i * 0.05, d: 2.4, v: 0.035, ratio: 2, index: 1.2, index2: 0.2, env: 'hold', a: 0.05, r: 1.5, echo: 0.3, rev: 0.5 }));
      });
      if (t >= 8.2) {
        e3.setIntro(U.seg(t, 8.2, 10.4));
      }
      if (t >= 8.2 && t < 10.6) e3.setGlimpse(5);
      if (t >= 10.6) {
        // 远景一层层退去
        const n = 5 - Math.min(5, Math.floor((t - 10.6) / 0.16));
        while (popped < 5 - n) {
          popped++;
          A.tone({ n: 84 - popped * 3, d: 0.08, v: 0.04, type: 'sine', echo: 0.3 });
        }
        e3.setGlimpse(n > 0 ? n : 0);
      }
      if (t >= 11.6) {
        e3.setGlimpse(0);
        G.music.setMask(1 | (((1 << G.econ.lv('fmv')) - 1) << 1), 1.5);
        o.done = true;
        setTimeout(() => {
          G.story.say('……刚才，远处好像有山。', 'dot');
          G.story.say(`留言.txt 恢复到 ${G.letter.pct()}%。`, 'sys');
        }, 400);
      }
    },
    render() {
      if (t < 3.0) {
        // 1、2：卷动，再切成 4 条视差带
        frame = e2.render();
        actx.imageSmoothingEnabled = false;
        actx.fillStyle = '#000';
        actx.fillRect(0, 0, 480, 270);
        const base = U.ease.inQuad(U.seg(t, 0, 3)) * 900;
        const split = U.seg(t, 0.9, 1.4);
        const speeds = [0.35, 0.65, 1.0, 1.6];
        for (let i = 0; i < 4; i++) {
          const y0 = Math.floor((i * 270) / 4), hh = Math.ceil(270 / 4);
          const sp = U.lerp(1, speeds[i], split);
          let off = Math.floor((base * sp) % 480);
          actx.drawImage(frame, 0, y0, 480, hh, -off, y0, 480, hh);
          actx.drawImage(frame, 0, y0, 480, hh, 480 - off, y0, 480, hh);
        }
        const p = Object.assign({}, e2.display());
        return { src: a, p };
      }
      if (t < 4.5) {
        // 3：调色板限制解除，像素软化
        const k = U.seg(t, 3.0, 4.5);
        const base = 900 + (t - 3) * 600;
        const speeds = [0.35, 0.65, 1.0, 1.6];
        actx.fillStyle = '#000';
        actx.fillRect(0, 0, 480, 270);
        for (let i = 0; i < 4; i++) {
          const y0 = Math.floor((i * 270) / 4), hh = Math.ceil(270 / 4);
          let off = Math.floor((base * speeds[i]) % 480);
          actx.drawImage(frame, 0, y0, 480, hh, -off, y0, 480, hh);
          actx.drawImage(frame, 0, y0, 480, hh, 480 - off, y0, 480, hh);
        }
        // 渐变色雾慢慢浮上来
        const g = actx.createLinearGradient(0, 0, 0, 270);
        g.addColorStop(0, 'rgba(90,160,255,' + 0.5 * k + ')');
        g.addColorStop(1, 'rgba(255,210,138,' + 0.35 * k + ')');
        actx.fillStyle = g;
        actx.fillRect(0, 0, 480, 270);
        const p = Object.assign({}, e2.display(), { nearest: k < 0.3, bloom: 0.2 + k * 0.6, bloomR: 3 + k * 6, scan: 0.2 * (1 - k) });
        if (!tex && t > 4.3) {
          tex = actx.getImageData(0, 0, 480, 270);
        }
        return { src: a, p };
      }
      if (t >= 8.9) return { src: e3.render(), p: e3.display() };
      if (!tex) tex = e2.render().getContext('2d').getImageData(0, 0, 480, 270);
      // 4、5：旧界面绕底边向后倒下，变成一片地面（真正的平面旋转投影）
      const k = U.ease.inOutCubic(U.seg(t, 4.5, 7.8));
      const th = k * 1.4; // 最多约 80°
      const cy = U.lerp(180, 300, U.ease.inOutQuad(U.seg(t, 5.5, 8.2)));
      const fwd = U.ease.inQuad(U.seg(t, 5.2, 9)) * 1600;
      const ph = 0.42;
      const horY = Math.sin(th) > 0.01 ? cy - 400 * (Math.cos(th) / Math.sin(th)) : -1e9;
      bctx.imageSmoothingEnabled = false;
      bctx.fillStyle = '#000';
      bctx.fillRect(0, 0, 640, 360);
      if (horY > -40) {
        e3.drawSky(bctx, 640, Math.max(1, Math.floor(horY) + 2), ph);
        const rise = U.seg(horY, 0, 200);
        if (rise > 0) {
          bctx.save();
          bctx.translate(0, Math.floor(horY - 196 * (360 / 252) * 0.9 + (1 - rise) * 50 + 20));
          e3.drawLayers(bctx, 640, 360 * 0.9, fwd * 0.6, Math.min(4, Math.floor(rise * 6)));
          bctx.restore();
        }
      }
      tilt(m7ctx, tex, th, cy, fwd);
      bctx.drawImage(m7, 0, 0);
      if (t < 8.2) return { src: b, p: Object.assign({}, e3.display(), { nearest: true, bloom: 0.3 }) };
      // 6：16-bit 界面登场（交叉淡入）
      const src = e3.render();
      const mix = U.seg(t, 8.2, 8.9);
      return { src: b, p: Object.assign({}, e3.display(), { B: src, mode: 1, mix, nearestB: true }) };
    },
  };
  return o;
};
