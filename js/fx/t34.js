'use strict';
// 跃迁 3 → 4「光」：天迅速黑下来 → 远景由远到近一层层熄灭 → 只剩角色手里的点在发光
// → 光溢满屏幕 → 白色中现代界面从失焦慢慢对焦 → 卡片弹入、光核开始呼吸
G.fx.t34 = () => {
  const U = G.U, A = G.audio, e3 = G.eras[3], e4 = G.eras[4];
  const less = () => G.s.set.lessFlash;
  const startLayers = G.m.layers;
  G.setEra(4);
  G.letter.reveal(0.08); // 跃迁一开始就给：中途刷新也不会丢
  const ph0 = ((G.s.time / 300) + 0.32) % 1;
  const out = U.canvas(1600, 900), octx = out.getContext('2d');
  const small = U.canvas(64, 36), sctx = small.getContext('2d');
  let t = 0, said = {}, popped = 0, riser = null;
  const once = (k, fn) => {
    if (!said[k]) {
      said[k] = 1;
      fn();
    }
  };
  e3.setForce({ run: true, noSpawn: true, phase: ph0, layers: startLayers, glow: 0 });

  const o = {
    done: false,
    update(dt) {
      t += dt;
      // 1：天黑
      const nightTo = 0.92;
      let ph = ph0;
      const k1 = U.ease.inOutCubic(U.seg(t, 0, 2.0));
      // 沿一天往前走到深夜
      const dist = ((nightTo - ph0) + 1) % 1;
      ph = (ph0 + dist * k1) % 1;
      // 2：远景一层层熄灭（远 → 近）
      const off = Math.floor(U.seg(t, 2.0, 4.0) * (startLayers + 0.999));
      while (popped < off && popped < startLayers) {
        popped++;
        A.fm({ n: 76 - popped * 5, d: 0.6, v: 0.04, ratio: 2, index: 1.2, echo: 0.3, rev: 0.4 });
      }
      const glow = U.ease.inQuad(U.seg(t, 3.2, 5.6));
      e3.setForce({ run: true, noSpawn: true, phase: ph, layers: Math.max(0, startLayers - popped), glow });
      G.music.setVol(U.lerp(0.85, 0.15, U.seg(t, 0, 3.5)), 0.2);
      if (t >= 2.4) once('riser', () => (riser = A.sustain({ noise: 'white', bp: 400, q: 0.5, v: 0.001 })));
      if (riser) {
        riser.set(0.002 + 0.07 * U.seg(t, 2.4, 5.5), 0.1);
        riser.filter(400 + 7000 * U.seg(t, 2.4, 5.5), 0.1);
      }
      if (t >= 4.0) once('stop3', () => G.music.stop(1.5));
      if (t >= 5.6) once('drop', () => {
        if (riser) riser.stop(0.15);
        A.tone({ f: 80, f2: 26, slide: 1.6, d: 2.2, v: 0.35, type: 'sine', env: 'hold', a: 0.005, r: 0.8, force: true });
        A.noise({ d: 2.5, v: 0.05, lp: 900, env: 'hold', a: 0.01, r: 2, rev: 0.6, force: true });
      });
      if (t >= 6.2) once('music', () => e4.music());
      if (t >= 5.6) e4.setIntro(U.seg(t, 5.6, 10.0));
      if (t >= 10.2) {
        e3.setForce(null);
        o.done = true;
        setTimeout(() => G.story.say(`留言.txt 恢复到 ${G.letter.pct()}%。`, 'sys'), 600);
      }
    },
    render() {
      if (t < 5.6) {
        const src = e3.render();
        const glow = U.seg(t, 3.2, 5.6);
        const p = Object.assign({}, e3.display(), {
          bloom: 0.22 + glow * 1.4, bloomR: 4 + glow * 14, bloomT: U.lerp(0.6, 0.2, glow),
          white: less() ? U.seg(t, 4.6, 5.6) * 0.85 : U.ease.inQuad(U.seg(t, 4.8, 5.6)),
        });
        return { src, p };
      }
      // 白色中，现代界面从失焦慢慢对焦
      const src = e4.render();
      const f = U.ease.outCubic(U.seg(t, 5.6, 7.6));
      const sz = G.display.fbSize();
      if (out.width !== sz.w || out.height !== sz.h) {
        out.width = sz.w;
        out.height = sz.h;
      }
      if (f >= 1) return { src, p: e4.display() };
      const div = Math.max(1, Math.round(U.lerp(48, 1, f)));
      const sw = Math.max(2, Math.round(sz.w / div)), sh = Math.max(2, Math.round(sz.h / div));
      if (small.width !== sw || small.height !== sh) {
        small.width = sw;
        small.height = sh;
      }
      sctx.imageSmoothingEnabled = true;
      sctx.drawImage(src, 0, 0, sw, sh);
      octx.imageSmoothingEnabled = true;
      octx.drawImage(small, 0, 0, sz.w, sz.h);
      // 最后一点再和清晰图交叉淡入
      const p = Object.assign({}, e4.display(), { white: (1 - U.seg(t, 5.6, 6.9)) * (less() ? 0.85 : 1), B: src, mode: 1, mix: U.seg(f, 0.6, 1) });
      return { src: out, p };
    },
  };
  return o;
};
