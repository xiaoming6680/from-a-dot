'use strict';
// 结局：宇宙满了 → 立方体转到第六面 → 第六面是一块屏幕，屏幕外面是你 → 留言全文 → 选择
// 【收拢】写一句话留给下一个点 → 一切塌缩成一个点 → 倒放的制作名单（3D → 现代 → 16-bit → 8-bit → 矢量 → 终端）→ 新周目
// 【停留】宇宙保持现状，随时可以再收拢
G.fx.ending = (opt = {}) => {
  const U = G.U, A = G.audio, e5 = G.eras[5];
  const R = e5.R;
  const s = G.s;
  const FONT = '"Microsoft YaHei UI", "Segoe UI", sans-serif';
  const less = () => s.set.lessFlash;
  s.flags.noMenu = 1;
  e5.scene({ freeze: true, camLock: true, faceHi: U.canvas(1024, 1024), faceHiIdx: 5 });
  const LINES = [
    '原来第六面是一块屏幕。',
    '屏幕外面……是你。',
    '你一直都在对面。',
    '每一个球，你都接住了。',
  ];
  const T_TURN = 5, T_LINES = 7, PER = 3.3;
  const T_LETTER = T_LINES + LINES.length * PER + 0.5;
  const T_PREV = T_LETTER + 7.5;
  const T_CHOICE = T_PREV + 3.5;
  let t = opt.skipTo === 'choice' ? T_CHOICE : 0;
  let phase = 'story'; // story → choice → write → collapse → credits → title
  let pt = 0; // 当前阶段内的时间
  let said = {}, written = '', hoverBtn = null, keyArmed = false;
  const once = (k, fn) => {
    if (!said[k]) {
      said[k] = 1;
      fn();
    }
  };
  const y0 = e5.cam.yaw;
  const fb = U.canvas(1600, 900), ctx = fb.getContext('2d');
  const pix = U.canvas(480, 270), pctx = pix.getContext('2d');
  const snes = U.canvas(640, 360), sctx = snes.getContext('2d');

  // 第六面：一个闪烁的光标，然后像开场那样打出"你好？"
  R.face6 = (x, S) => {
    x.fillStyle = '#000';
    x.fillRect(0, 0, S, S);
    const k = t - T_TURN;
    if (k < 0) return;
    x.fillStyle = '#41ff86';
    x.font = '34px Consolas, "SimHei", monospace';
    x.textBaseline = 'middle';
    const msg = '> 你好？';
    const n = Math.max(0, Math.floor((k - 1.5) * 5));
    const shown = [...msg].slice(0, n).join('');
    x.fillText(shown, 150, S / 2);
    const w = x.measureText(shown).width;
    if (Math.floor(G.t * 2) % 2 === 0) x.fillRect(150 + w + 4, S / 2 - 18, 18, 36);
  };

  // 音乐盒版主旋律（制作名单用）
  function musicBox() {
    const M = G.music;
    return {
      bpm: 76, len: 256, vol: 1,
      tracks: [
        { notes: M.melody(12), inst: (o) => A.tone({ t: o.t, n: o.n, d: Math.min(1.6, o.d * 2), v: 0.05, type: 'bell', out: o.out, rev: 0.5, echo: 0.2 }) },
        { gen(st, t0, spb, out) {
            if (st % 4 !== 0) return;
            const ch = M.chordAt(st);
            const n = ch.tri[(st / 4) % 3];
            A.tone({ t: t0, n: n + 12, d: 1.2, v: 0.018, type: 'bell', out, rev: 0.5 });
          } },
      ],
    };
  }

  const CREDITS = [
    { era: 4, lines: () => [`光子 ${U.fmt(s.tot.lux)}`, `导入的光 ${U.fmt(s.stats.photons)} 束`, '光让一切连在了一起。'] },
    { era: 3, lines: () => [`跑了 ${U.fmt(s.stats.dist)} 米`, `跳了 ${U.fmt(s.stats.jumps)} 次，摔了 ${U.fmt(s.stats.falls)} 次`, `飞过 ${s.e[3].flights} 次地平线`] },
    { era: 2, lines: () => [`吃了 ${U.fmt(s.stats.foods)} 个苹果`, `最长的时候 ${s.stats.maxLen} 格`, `打碎 ${U.fmt(s.stats.bricks)} 块砖`] },
    { era: 1, lines: () => [`击球 ${U.fmt(s.stats.hits)} 次`, `最长连击 ${s.stats.maxCombo}`, '对面一个也没有漏。'] },
    { era: 0, lines: () => [`按键 ${U.fmt(s.stats.keys)} 次`, `回答信号 ${s.stats.signals} 个`, `一共 ${U.time(s.time)}`, '', '从一个点开始', '制作 · XM', '画面和声音全部实时生成', '谢谢你。'] },
  ];
  const CPER = 8.5;

  function lerpCam(yaw, pitch, dist, k) {
    const c = e5.cam;
    c.yaw = U.lerp(c.yaw, yaw, k);
    c.pitch = U.lerp(c.pitch, pitch, k);
    c.dist = U.lerp(c.dist, dist, k);
    c.ty = c.yaw;
    c.tp = c.pitch;
    c.td = c.dist;
  }

  const o = {
    done: false,
    interactive: true,
    update(dt) {
      t += dt;
      pt += dt;
      if (phase === 'story' || phase === 'choice') {
        // 镜头转到第六面（-z）
        const target = Math.round((y0 - Math.PI) / (Math.PI * 2)) * Math.PI * 2 + Math.PI;
        const k = U.ease.inOutCubic(U.seg(t, 0.5, T_TURN));
        const dist = U.lerp(9, 4.2, k) - U.seg(t, T_LINES, T_CHOICE) * 1.0;
        lerpCam(U.lerp(y0, target, k), U.lerp(e5.cam.pitch, 0.04, Math.min(1, dt * 1.5)), dist, Math.min(1, dt * 6));
        R.faceBright[5] = 1;
        e5.scene({ hudA: Math.max(0, 1 - t / 1.5) });
        if (t > 0.3) once('fade', () => G.music.setVol(0.35, 3));
        if (t > T_TURN) once('cur', () => A.tone({ f: 1000, d: 0.25, v: 0.05, type: 'square', env: 'hold', r: 0.05 }));
        LINES.forEach((l, i) => {
          if (t > T_LINES + i * PER) once('l' + i, () => A.tone({ n: [76, 79, 81, 84][i], d: 2.5, v: 0.035, type: 'sine', rev: 0.6, echo: 0.3 }));
        });
        if (t > T_LETTER) once('letter', () => {
          G.letter.reveal(1, true);
          const t0 = A.now();
          [69, 76, 81, 84, 88].forEach((n, i) => A.tone({ n, t: t0 + i * 0.12, d: 3, v: 0.03, type: 'sine', rev: 0.7 }));
        });
        if (t > T_CHOICE && phase === 'story') {
          phase = 'choice';
          pt = 0;
        }
      } else if (phase === 'write') {
        // 等 DOM 输入框回车
      } else if (phase === 'collapse') {
        const k = U.ease.inCubic(U.seg(pt, 0, 3.2));
        e5.scene({ collapse: k });
        lerpCam(e5.cam.yaw + dt * (0.5 + k * 4), 0.3, 6, 0.5);
        if (pt > 3.4) {
          phase = 'credits';
          pt = 0;
          G.music.play(musicBox(), { fade: 0.5, fadeOut: 0.3 });
        }
      } else if (phase === 'credits') {
        if (pt > CREDITS.length * CPER) {
          phase = 'title';
          pt = 0;
        }
      } else if (phase === 'title') {
        if (pt > 3) keyArmed = true;
        if (keyArmed && (G.input.keys.length || G.input.pressed)) {
          G.input.keys.length = 0;
          finishNewGame();
        }
      }
    },
    render() {
      const k = () => fb.width / G.VW;
      if (phase === 'story' || phase === 'choice' || phase === 'write' || phase === 'collapse') {
        const src = e5.render();
        const c = src.getContext('2d');
        c.setTransform(src.width / G.VW, 0, 0, src.width / G.VW, 0, 0);
        if (phase !== 'collapse') overlayStory(c);
        if (phase === 'choice') drawChoice(c);
        if (phase === 'write') {
          c.font = `300 24px ${FONT}`;
          c.textAlign = 'center';
          c.fillStyle = 'rgba(255,255,255,0.85)';
          c.fillText('写一句话，留给下一个点。', 800, 470);
        }
        const p = Object.assign({}, e5.display());
        if (phase === 'collapse') {
          p.white = less() ? 0 : U.ease.inQuad(U.seg(pt, 2.6, 3.2)) * 0.9;
          p.fade = less() ? U.seg(pt, 2.6, 3.4) : 0;
        }
        return { src, p };
      }
      if (phase === 'credits') return credits();
      return titleCard();
    },
  };

  function overlayStory(c) {
    c.save();
    c.textAlign = 'center';
    c.textBaseline = 'alphabetic';
    // 台词
    const i = Math.floor((t - T_LINES) / PER);
    if (t > T_LINES && t < T_LETTER) {
      const lt = (t - T_LINES) % PER;
      const line = LINES[Math.min(i, LINES.length - 1)];
      const n = Math.floor(lt * 12);
      const a = Math.min(1, lt / 0.3) * (1 - U.clamp((lt - PER + 0.6) / 0.6, 0, 1));
      c.globalAlpha = a;
      c.font = `300 34px ${FONT}`;
      c.fillStyle = '#ffffff';
      c.fillText([...line].slice(0, n).join(''), 800, 790);
    }
    // 留言全文
    if (t > T_LETTER) {
      const lt = t - T_LETTER;
      const a = Math.min(1, lt / 1.2);
      c.globalAlpha = a * (phase === 'choice' ? 0.55 : 1);
      c.fillStyle = 'rgba(0,0,0,0.45)';
      c.fillRect(0, 230, 1600, 300);
      c.globalAlpha = a;
      c.font = `400 15px ${FONT}`;
      c.fillStyle = 'rgba(210,218,245,0.6)';
      c.fillText('留言.txt · 100%', 800, 280);
      c.font = `300 30px ${FONT}`;
      c.fillStyle = '#ffffff';
      const text = G.letter.text();
      const lines = U.wrap(c, text, 1000);
      // 未解开的字逐个"翻"出来
      const total = [...text].length;
      const shown = Math.floor(lt * 14);
      let idx = 0;
      lines.forEach((l, j) => {
        let out = '';
        for (const ch of l) {
          out += idx < shown ? ch : '·';
          idx++;
        }
        c.fillText(out, 800, 340 + j * 50);
      });
      if (t > T_PREV) {
        const pa = Math.min(1, (t - T_PREV) / 0.8);
        c.globalAlpha = pa;
        c.font = `300 26px ${FONT}`;
        c.fillStyle = '#ffe9b0';
        c.fillText('上一个点……就是上一个我。', 800, 600);
      }
      void total;
    }
    c.restore();
  }

  function drawChoice(c) {
    const a = Math.min(1, pt / 0.8);
    c.save();
    c.globalAlpha = a;
    c.textAlign = 'center';
    c.font = `300 24px ${FONT}`;
    c.fillStyle = 'rgba(255,255,255,0.8)';
    c.fillText('要把这一切收拢回一个点，留给下一个点吗？', 800, 680);
    const btns = [
      { id: 'collapse', x: 560, label: '收拢', sub: '写一句话，重新开始' },
      { id: 'stay', x: 840, label: '停留', sub: '留在这个宇宙里' },
    ];
    G.ui.space(G.VW, G.VH);
    hoverBtn = null;
    for (const b of btns) {
      const hov = G.ui.over(b.x, 720, 200, 74);
      if (hov) hoverBtn = b.id;
      U.rrect(c, b.x, 720, 200, 74, 37);
      c.fillStyle = hov ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.06)';
      c.fill();
      c.strokeStyle = hov ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.3)';
      c.lineWidth = 1.5;
      c.stroke();
      c.font = `400 26px ${FONT}`;
      c.fillStyle = '#ffffff';
      c.fillText(b.label, b.x + 100, 758);
      c.font = `300 13px ${FONT}`;
      c.fillStyle = 'rgba(220,226,255,0.6)';
      c.fillText(b.sub, b.x + 100, 781);
      if (pt > 0.8 && G.ui.click(b.x, 720, 200, 74)) choose(b.id);
    }
    // 光标
    if (G.input.inside) {
      c.strokeStyle = 'rgba(230,240,255,0.85)';
      c.beginPath();
      c.arc(G.input.mx, G.input.my, 9, 0, Math.PI * 2);
      c.stroke();
    }
    c.restore();
  }

  function choose(id) {
    A.tone({ n: 81, d: 1.5, v: 0.04, type: 'sine', rev: 0.6 });
    if (id === 'stay') {
      s.ending = 'stay';
      delete s.flags.noMenu;
      e5.scene({ freeze: false, camLock: false, hudA: 1, face6: null, faceHi: null });
      G.music.setVol(0.9, 2);
      G.story.say('好。那我们就待在这里。想收拢的时候，点上面的「收拢」。', 'dot');
      o.done = true;
      return;
    }
    phase = 'write';
    pt = 0;
    const box = document.getElementById('letter');
    const inp = document.getElementById('letter-input');
    box.classList.add('open');
    document.body.classList.add('modal');
    inp.value = '';
    setTimeout(() => inp.focus(), 50);
    inp.onkeydown = (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        written = inp.value.trim().slice(0, 60);
        box.classList.remove('open');
        document.body.classList.remove('modal');
        inp.onkeydown = null;
        if (written) G.letter.store(written);
        startCollapse();
      }
    };
  }

  function startCollapse() {
    phase = 'collapse';
    pt = 0;
    G.music.stop(2);
    A.noise({ d: 3.2, v: 0.09, bp: 300, f2: 6000, q: 0.8, env: 'hold', a: 2.8, r: 0.2, force: true });
    A.tone({ f: 60, f2: 400, slide: 3.2, d: 3.2, v: 0.08, type: 'sine', env: 'hold', a: 2.5, r: 0.2, force: true });
  }

  function finishNewGame() {
    const letter = written || G.letter.saved();
    G.save.newGame(letter);
    G.save.blocked = true;
    location.reload();
  }

  // ---------------- 制作名单（倒放的历史） ----------------
  function credits() {
    const i = Math.min(CREDITS.length - 1, Math.floor(pt / CPER));
    const ct = pt - i * CPER;
    const cr = CREDITS[i];
    const lines = cr.lines();
    const fadeIn = Math.min(1, ct / 0.8), fadeOut = 1 - U.clamp((ct - CPER + 0.8) / 0.8, 0, 1);
    const shownLines = Math.floor((ct - 0.6) / 0.9) + 1;
    if (ct < 0.05) once('cs' + i, () => creditSound(cr.era));
    let src, p;
    if (cr.era === 4) {
      ensureHi();
      const c = ctx, K = fb.width / 1600;
      c.setTransform(1, 0, 0, 1, 0, 0);
      const g = c.createLinearGradient(0, 0, fb.width, fb.height);
      g.addColorStop(0, '#0d1030');
      g.addColorStop(1, '#2a1240');
      c.fillStyle = g;
      c.fillRect(0, 0, fb.width, fb.height);
      c.setTransform(K, 0, 0, K, 0, 0);
      U.rrect(c, 500, 300, 600, 300, 28);
      c.fillStyle = 'rgba(255,255,255,0.06)';
      c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.2)';
      c.stroke();
      c.textAlign = 'center';
      lines.forEach((l, j) => {
        if (j >= shownLines) return;
        c.font = `${j === 0 ? 600 : 300} ${j === 0 ? 40 : 22}px ${FONT}`;
        c.fillStyle = j === 0 ? '#c6b8ff' : 'rgba(240,244,255,0.85)';
        c.fillText(l, 800, 390 + j * 60);
      });
      src = fb;
      p = { bloom: 0.5, bloomR: 10, bloomT: 0.5, vig: 0.3 };
    } else if (cr.era === 3) {
      const c = sctx;
      c.imageSmoothingEnabled = false;
      for (let y = 0; y < 360; y += 12) {
        c.fillStyle = U.mix('#0b0b2e', '#ff8a5c', y / 360);
        c.fillRect(0, y, 640, 12);
      }
      c.fillStyle = '#3a2818';
      c.fillRect(0, 300, 640, 60);
      c.fillStyle = '#2c5a30';
      c.fillRect(0, 300, 640, 3);
      const hero = G.eras[3].hero();
      c.drawImage(hero, Math.floor(((ct * 60) % 760) - 60), 284);
      win(c, 170, 90, 300, 150);
      const F = G.text.pixel(12);
      lines.forEach((l, j) => j < shownLines && F.draw(c, l, 320, 116 + j * 26, '#ffffff', { align: 'center', shadow: '#10102a' }));
      src = snes;
      p = { nearest: true, scan: 0.1, scanN: 360, vig: 0.25, bloom: 0.2, bloomR: 4, bloomT: 0.6 };
    } else if (cr.era === 2) {
      const c = pctx;
      c.imageSmoothingEnabled = false;
      c.fillStyle = '#000000';
      c.fillRect(0, 0, 480, 270);
      // 一条蛇在下面走
      const n = 18;
      for (let k2 = 0; k2 < n; k2++) {
        const x = Math.floor(((ct * 40 - k2 * 8) % 520)) - 20;
        c.fillStyle = k2 === 0 ? '#FCFCFC' : k2 % 4 ? '#58D854' : '#00A800';
        c.fillRect(x, 220, 7, 7);
      }
      c.fillStyle = '#F83800';
      c.fillRect(400, 220, 6, 6);
      const F = G.text.pixel(12);
      lines.forEach((l, j) => j < shownLines && F.draw(c, l, 240, 80 + j * 24, j === 0 ? '#F8B800' : '#FCFCFC', { align: 'center' }));
      src = pix;
      p = { nearest: true, curve: 0.022, scan: 0.2, scanN: 270, vig: 0.35, corner: 0.02, chroma: 0.7, bloom: 0.18, bloomR: 3, bloomT: 0.5 };
    } else if (cr.era === 1) {
      ensureHi();
      const c = ctx, K = fb.width / 1600;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.fillStyle = '#000';
      c.fillRect(0, 0, fb.width, fb.height);
      c.setTransform(K, 0, 0, K, 0, 0);
      c.strokeStyle = '#e9f6ff';
      c.lineWidth = 6;
      const by = 450 + Math.sin(ct * 3) * 140;
      const bx = 800 + Math.sin(ct * 2.2) * 560;
      c.beginPath();
      c.moveTo(150, by - 50);
      c.lineTo(150, by + 50);
      c.moveTo(1450, 450 + Math.sin(ct * 3 + 0.3) * 140 - 50);
      c.lineTo(1450, 450 + Math.sin(ct * 3 + 0.3) * 140 + 50);
      c.stroke();
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(bx, 450 + Math.cos(ct * 2.9) * 200, 7, 0, Math.PI * 2);
      c.fill();
      lines.forEach((l, j) => j < shownLines && G.text.vec.draw(c, l, 800, 330 + j * 70, j === 0 ? 34 : 24, { align: 'center', color: '#e9f6ff', lw: 1.8 }));
      src = fb;
      p = { bloom: 0.95, bloomR: 9, bloomT: 0.1, vig: 0.3, curve: 0.018, corner: 0.035 };
    } else {
      ensureHi();
      const c = ctx, K = fb.width / 1600;
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.fillStyle = '#010402';
      c.fillRect(0, 0, fb.width, fb.height);
      c.setTransform(K, 0, 0, K, 0, 0);
      c.font = '30px Consolas, "Microsoft YaHei Mono", "SimHei", monospace';
      c.textAlign = 'left';
      c.textBaseline = 'middle';
      let typed = Math.floor((ct - 0.4) * 22);
      lines.forEach((l, j) => {
        const str = (l ? '> ' : '') + l;
        const chars = [...str];
        const n = Math.max(0, Math.min(chars.length, typed));
        typed -= chars.length + 4;
        c.fillStyle = j >= 4 ? '#c4ffd8' : '#41ff86';
        c.fillText(chars.slice(0, n).join(''), 260, 220 + j * 52);
      });
      if (Math.floor(G.t * 2) % 2) {
        c.fillStyle = '#41ff86';
        c.fillRect(260, 220 + lines.length * 52 - 16, 16, 32);
      }
      src = fb;
      p = { bloom: 0.55, bloomR: 5, bloomT: 0.16, curve: 0.075, scan: 0.26, scanN: 340, vig: 0.6, chroma: 1.1, noise: 0.03, flick: 0.018, corner: 0.07 };
    }
    p.fade = 1 - Math.min(fadeIn, fadeOut);
    return { src, p };
  }

  function creditSound(era) {
    const t0 = A.now();
    if (era === 0) A.tone({ f: 1000, t: t0, d: 0.12, v: 0.05, type: 'square' });
    if (era === 1) A.tone({ n: 81, t: t0, d: 0.2, v: 0.05, type: 'square' });
    if (era === 2) [72, 76, 79].forEach((n, i) => A.tone({ n, t: t0 + i * 0.05, d: 0.08, v: 0.04, type: 'p25' }));
    if (era === 3) A.fm({ n: 69, t: t0, d: 0.8, v: 0.04, ratio: 2, index: 2, echo: 0.3 });
  }

  function win(c, x, y, w, h) {
    c.fillStyle = '#0c0c20';
    c.fillRect(x, y, w, h);
    for (let i = 0; i < h - 4; i++) {
      c.fillStyle = U.mix('#3b5bd0', '#141e66', i / (h - 4));
      c.fillRect(x + 2, y + 2 + i, w - 4, 1);
    }
    c.fillStyle = '#e8ecff';
    c.fillRect(x + 2, y + 1, w - 4, 1);
    c.fillRect(x + 1, y + 2, 1, h - 4);
  }

  function ensureHi() {
    const sz = G.display.fbSize();
    if (fb.width !== sz.w || fb.height !== sz.h) {
      fb.width = sz.w;
      fb.height = sz.h;
    }
  }

  function titleCard() {
    ensureHi();
    const c = ctx, K = fb.width / 1600;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = '#000';
    c.fillRect(0, 0, fb.width, fb.height);
    c.setTransform(K, 0, 0, K, 0, 0);
    const on = Math.floor(G.t * 1.6) % 2 === 0;
    c.fillStyle = '#ffffff';
    if (on || pt < 1) c.fillRect(793, 443, 14, 14);
    const a = U.seg(pt, 1.0, 2.5);
    c.globalAlpha = a;
    c.textAlign = 'center';
    c.font = `200 44px ${FONT}`;
    c.fillText('从一个点开始', 800, 360);
    c.globalAlpha = U.seg(pt, 3, 4) * 0.5;
    c.font = `300 16px ${FONT}`;
    c.fillText('按任意键，从一个点开始', 800, 560);
    c.globalAlpha = 1;
    return { src: fb, p: { bloom: 0.4, bloomR: 6, bloomT: 0.3 } };
  }

  return o;
};
