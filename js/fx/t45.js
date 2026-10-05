'use strict';
// 跃迁 4 → 5「体积」：现代界面开始倾斜——原来它只是一个平面 → 镜头后拉，它是立方体的一面
// → 其余的面依次亮起（终端、矢量、8-bit、16-bit）→ 第六面是黑的 → 星空渐亮，点从中心飞出成为第一颗星
G.fx.t45 = () => {
  const U = G.U, A = G.audio, e4 = G.eras[4], e5 = G.eras[5];
  G.setEra(5);
  G.letter.reveal(0.08); // 跃迁一开始就给：中途刷新也不会丢
  const R = e5.R;
  const hi = U.canvas(1024, 1024);
  e5.scene({ faceHi: hi, faceHiIdx: 0, faceUpdate: 'front', faceBright: [1, 0, 0, 0, 0, 0], starsA: 0, hudA: 0, camLock: true, freeze: true, collapse: 0 });
  const D0 = 0.5625 / Math.tan(0.45); // 让正面刚好铺满屏幕的距离
  let t = 0, said = {}, lit = 0;
  const once = (k, fn) => {
    if (!said[k]) {
      said[k] = 1;
      fn();
    }
  };
  // 亮起的顺序跟着镜头走：终端(+x) → 8-bit(+y) → 矢量(-x) → 16-bit(-y)
  const LIGHT = [
    { at: 5.0, face: 1, snd: () => A.tone({ f: 1000, d: 0.5, v: 0.06, type: 'square', env: 'hold', r: 0.3, rev: 0.4 }) },
    { at: 6.2, face: 3, snd: () => { const t0 = A.now(); [76, 79, 84].forEach((n, i) => A.tone({ n, t: t0 + i * 0.06, d: 0.5, v: 0.05, type: 'p12', rev: 0.4 })); } },
    { at: 7.4, face: 2, snd: () => A.tone({ n: 81, d: 0.6, v: 0.06, type: 'p25', echo: 0.3, rev: 0.4 }) },
    { at: 8.6, face: 4, snd: () => A.fm({ n: 69, d: 1.2, v: 0.06, ratio: 2, index: 2, echo: 0.35, rev: 0.4 }) },
  ];
  // 镜头关键帧：时间, yaw, pitch, dist
  const KEYS = [
    [0.0, 0, 0, D0 + 1],
    [1.2, 0, 0, D0 + 1],
    [3.2, 0.45, 0.15, 3.4],
    [5.0, 1.3, 0.15, 6.5],
    [6.2, 0.9, 1.0, 7.0],
    [7.4, -1.3, 0.2, 7.2],
    [8.6, -0.6, -0.95, 7.5],
    [10.4, 0.7, 0.35, 9.0],
  ];
  function camAt(tt) {
    for (let i = 0; i < KEYS.length - 1; i++) {
      const a = KEYS[i], b = KEYS[i + 1];
      if (tt <= b[0]) {
        const k = U.ease.inOutCubic(U.clamp((tt - a[0]) / (b[0] - a[0]), 0, 1));
        return [U.lerp(a[1], b[1], k), U.lerp(a[2], b[2], k), U.lerp(a[3], b[3], k)];
      }
    }
    const l = KEYS[KEYS.length - 1];
    return [l[1], l[2], l[3]];
  }

  const o = {
    done: false,
    update(dt) {
      t += dt;
      if (t >= 0.8) once('fade4', () => G.music.stop(2.5));
      const [y, p, d] = camAt(t);
      Object.assign(e5.cam, { yaw: y, pitch: p, dist: d, ty: y, tp: p, td: d });
      for (const L of LIGHT) {
        if (t >= L.at && lit < LIGHT.indexOf(L) + 1) {
          lit++;
          L.snd();
        }
      }
      const fb = R.faceBright;
      fb[0] = 1;
      LIGHT.forEach((L) => (fb[L.face] = U.ease.outCubic(U.seg(t, L.at, L.at + 0.8))));
      fb[5] = 0;
      // 前 3 秒正面要跟着现代界面实时更新；之后轮流更新
      if (t > 3.2 && R.faceHi) {
        e5.scene({ faceHi: null, faceUpdate: true });
        e5.updateFace(0);
      }
      if (t >= 9.6) once('chord', () => {
        const t0 = A.now();
        A.tone({ f: 1000 / 2, t: t0, d: 3, v: 0.03, type: 'square', env: 'hold', a: 0.4, r: 2, rev: 0.6 });
        A.tone({ n: 69, t: t0, d: 3, v: 0.03, type: 'p25', env: 'hold', a: 0.4, r: 2, rev: 0.6 });
        A.tone({ n: 64, t: t0, d: 3, v: 0.05, type: 'nestri', env: 'hold', a: 0.4, r: 2, rev: 0.6 });
        A.fm({ n: 57, t: t0, d: 3, v: 0.04, ratio: 2, index: 1, env: 'hold', a: 0.4, r: 2, rev: 0.6 });
        A.pad({ n: 72, t: t0, d: 3, v: 0.03, a: 0.6, r: 2.5, rev: 0.6 });
      });
      if (t >= 11.0) once('music', () => e5.music());
      e5.scene({ starsA: U.seg(t, 10.2, 12.4) });
      // 点从立方体中心飞出
      if (t >= 10.8) {
        const k = U.ease.outCubic(U.seg(t, 10.8, 12.6));
        e5.scene({ dotPos: [U.lerp(0, 2.6, k), U.lerp(0, 1.5, k), U.lerp(0, 3.2, k)], dotSize: U.lerp(2, 9, Math.sin(k * Math.PI)) + 4 });
      }
      e5.scene({ hudA: U.seg(t, 12.6, 13.8) });
      if (t >= 13.9) {
        e5.scene({ dotPos: null, camLock: false, freeze: false });
        e5.addUserStar([2.6, 1.5, 3.2]);
        e5.setIntro(1);
        o.done = true;
        setTimeout(() => G.story.say(`留言.txt 恢复到 ${G.letter.pct()}%。`, 'sys'), 800);
      }
    },
    render() {
      if (t < 1.2) {
        const src = e4.render();
        return { src, p: e4.display() };
      }
      const src = e5.render();
      const p = Object.assign({}, e5.display());
      // 2D → 3D 的瞬间交叉淡入
      if (t < 1.5) {
        p.B = src;
        p.mode = 1;
        p.mix = U.seg(t, 1.2, 1.5);
        return { src: e4.render(), p: Object.assign(p, e4.display(), { B: src, mode: 1, mix: U.seg(t, 1.2, 1.5) }) };
      }
      return { src, p };
    },
  };
  e5.setIntro(0);
  return o;
};
