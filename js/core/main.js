'use strict';
// 主循环与场景：当前时代 / 跃迁演出 / 回到过去（缩放进入旧时代小窗）。
(() => {
  const U = G.U;
  const scene = (G.scene = { fx: null, visit: null });
  G.dt = 0;

  // 当前在前台显示的时代
  G.fgEra = () => (scene.visit && scene.visit.phase !== 'in' && scene.visit.phase !== 'out2' ? scene.visit.id : G.s.era);
  G.visiting = (id) => !!(scene.visit && scene.visit.id === id);
  G.inFx = () => !!scene.fx;

  G.startFx = (name, arg) => {
    const f = G.fx[name];
    if (!f) return;
    if (scene.visit) scene.visit = null;
    G.s.sq.length = 0; // 上一时代还没说出口的台词不带进新时代
    scene.fx = f(arg);
    G.save.write();
  };
  G.endFx = () => {
    scene.fx = null;
    const e = G.eras[G.s.era];
    if (e && e.enter) e.enter(true);
    G.save.write();
  };
  // 切换当前时代（由跃迁在合适的时刻调用）
  G.setEra = (n) => {
    const old = G.eras[G.s.era];
    if (old && old.leave) old.leave();
    G.s.era = n;
    G.econ.recompute();
  };

  // ---------- 回到过去 ----------
  // rect: 小窗在虚拟坐标里的位置 [x,y,w,h]
  G.visit = (id, rect) => {
    if (scene.fx || scene.visit || id >= G.s.era) return;
    scene.visit = { id, rect, phase: 'in', t: 0 };
    G.bus.emit('visit', id);
  };
  G.unvisit = () => {
    const v = scene.visit;
    if (!v || v.phase !== 'on') return;
    v.phase = 'out1';
    v.t = 0;
    G.bus.emit('unvisit', v.id);
  };
  const VIN = 0.5, VOUT = 0.45, VFADE = 0.22;
  function visitUpdate(dt) {
    const v = scene.visit;
    if (!v) return;
    v.t += dt;
    if (v.phase === 'in' && v.t >= VIN) {
      v.phase = 'on';
      v.t = 0;
      const e = G.eras[v.id];
      if (e.enter) e.enter(false, true);
      if (e.music) e.music();
      else G.music.stop(0.4);
    } else if (v.phase === 'out1' && v.t >= VFADE) {
      const e = G.eras[v.id];
      if (e.leave) e.leave(true);
      v.phase = 'out2';
      v.t = 0;
    } else if (v.phase === 'out2' && v.t >= VOUT) {
      scene.visit = null;
      const h = G.eras[G.s.era];
      if (h.music) h.music();
      else G.music.stop(0.4);
    }
  }
  function zoomRect(rect, k) {
    const r = [rect[0] / G.VW, rect[1] / G.VH, rect[2] / G.VW, rect[3] / G.VH];
    return [U.lerp(0, r[0], k), U.lerp(0, r[1], k), U.lerp(1, r[2], k), U.lerp(1, r[3], k)];
  }

  // ---------- 更新 ----------
  function update(dt) {
    const s = G.s;
    s.time += dt;
    s.stats.eraTime[s.era] = (s.stats.eraTime[s.era] || 0) + dt;
    G.econ.tick(dt);
    const fg = G.fgEra();
    for (let i = 0; i <= s.era; i++) {
      const e = G.eras[i];
      if (e && e.update) e.update(dt, i === fg && !scene.fx);
    }
    if (scene.fx) {
      scene.fx.update(dt);
      if (scene.fx && scene.fx.done) G.endFx();
    }
    visitUpdate(dt);
    G.story.update(dt);
    G.save.update(dt);
  }

  function globalKeys() {
    const I = G.input;
    if (I.take((k) => k.code === 'Escape')) {
      if (G.ui.menuOpen()) G.ui.closeMenu();
      else if (scene.visit && scene.visit.phase === 'on') G.unvisit();
      else if (!scene.fx && !G.s.flags.noMenu) G.ui.openMenu();
    }
  }

  // ---------- 渲染 ----------
  function render() {
    G.ui.begin();
    let src, p;
    const v = scene.visit;
    if (scene.fx) {
      G.ui.blocked = !scene.fx.interactive;
      const fr = scene.fx.render();
      G.ui.blocked = false;
      src = fr.src;
      p = fr.p;
    } else if (v && (v.phase === 'in' || v.phase === 'out2')) {
      const e = G.eras[G.s.era];
      G.ui.blocked = true;
      src = e.render();
      G.ui.blocked = false;
      p = Object.assign({}, e.display());
      const k = v.phase === 'in' ? U.ease.inOutCubic(U.clamp(v.t / VIN, 0, 1)) : 1 - U.ease.inOutCubic(U.clamp(v.t / VOUT, 0, 1));
      p.zoom = zoomRect(v.rect, k);
      p.curve = (p.curve || 0) * (1 - k);
      p.fade = Math.max(p.fade || 0, U.smooth((k - 0.75) / 0.25) * 0.9);
    } else if (v) {
      const e = G.eras[v.id];
      src = e.render();
      p = Object.assign({}, e.display());
      if (v.phase === 'on') p.fade = Math.max(p.fade || 0, 1 - U.clamp(v.t / VFADE, 0, 1));
      else p.fade = Math.max(p.fade || 0, U.clamp(v.t / VFADE, 0, 1));
    } else {
      const e = G.eras[G.s.era];
      src = e.render();
      p = e.display();
    }
    G.display.present(src, p);
  }

  // ---------- 自适应画质 ----------
  const perf = { acc: 0, n: 0, slow: 0 };
  function watchPerf(dt) {
    if (document.hidden || dt > 0.25) return;
    perf.acc += dt;
    perf.n++;
    if (perf.acc < 2) return;
    const fps = perf.n / perf.acc;
    perf.acc = 0;
    perf.n = 0;
    if (fps < 45 && G.display.quality > 0.55) {
      perf.slow++;
      if (perf.slow >= 2) {
        G.display.quality = Math.max(0.55, +(G.display.quality - 0.15).toFixed(2));
        perf.slow = 0;
        console.info('帧率偏低，自动降低画质到', G.display.quality);
      }
    } else perf.slow = 0;
  }

  // ---------- 主循环 ----------
  let last = performance.now();
  function frame(now) {
    let dt = (now - last) / 1000;
    last = now;
    watchPerf(dt);
    G.t += Math.min(dt, 0.25);
    if (dt > 1.5 && !scene.fx) {
      // 标签页切回来：用自动化平均速率补发
      const sec = Math.min(dt, 7200);
      const got = G.econ.idle(sec);
      G.s.time += sec;
      if (sec > 20) G.bus.emit('offline', sec, got);
      dt = 1 / 60;
    }
    dt = Math.min(dt, 0.25); // 低帧率时按子步补足，不让游戏变慢动作
    G.dt = dt;
    globalKeys();
    if (!G.ui.menuOpen()) {
      const total = dt * G.speed;
      const steps = Math.min(120, Math.max(1, Math.ceil(total / (1 / 30))));
      for (let i = 0; i < steps; i++) {
        update(total / steps);
        if (i === 0) G.input.keys.length = 0; // 按键只交给第一步，避免低帧率时一个键被处理多次
      }
    } else {
      G.input.keys.length = 0;
    }
    render();
    G.input.endFrame();
    requestAnimationFrame(frame);
  }

  // 测试用：手动推进模拟（页面隐藏时 rAF 不跑）
  G.step = (sec = 1, dt = 1 / 60, draw = true) => {
    let n = Math.ceil(sec / dt);
    while (n-- > 0) {
      G.t += dt;
      G.dt = dt;
      globalKeys();
      update(dt);
      G.input.endFrame();
    }
    if (draw) render();
  };
  G.frame = () => {
    G.dt = 1 / 60;
    globalKeys();
    update(1 / 60);
    render();
    G.input.endFrame();
  };

  G.boot = () => {
    G.display.init(document.getElementById('screen'));
    let s = G.save.load();
    const isNew = !s;
    if (!s) s = G.save.fresh();
    G.s = s;
    G.econ.recompute();
    for (const e of G.eras) if (e && e.init) e.init();
    // 离线收益
    if (!isNew) {
      const away = (Date.now() - (s.savedAt || Date.now())) / 1000;
      if (away > 30) {
        const sec = Math.min(away, 7200);
        const got = G.econ.idle(sec);
        setTimeout(() => G.bus.emit('offline', away, got), 600);
      }
      // 跃迁进行中被关掉：直接进入新时代
      if (s.flags.pendingFx) {
        delete s.flags.pendingFx;
      }
    }
    delete s.flags.noMenu;
    const e = G.eras[s.era];
    if (e && e.enter) e.enter(false);
    if (s.era === 5 && s.own.final && !s.ending) setTimeout(() => G.startFx('ending', { skipTo: 'choice' }), 300);
    if (G.debugInit) G.debugInit();
    requestAnimationFrame((t) => {
      last = t;
      requestAnimationFrame(frame);
    });
  };

  // 离线/后台归来的提示：各时代都用自己的画风说
  G.bus.on('offline', (sec, got) => {
    const parts = [];
    for (const r of G.econ.RES) if (got[r] >= 1) parts.push(G.U.fmt(got[r]) + ' ' + G.econ.NAME[r]);
    if (!parts.length) return;
    G.story.say(`离开了 ${G.U.time(sec)}${sec > 7200 ? '（只补了 2 小时）' : ''}。期间：+${parts.join('，+')}`, 'sys');
  });

  window.addEventListener('load', G.boot);
})();
