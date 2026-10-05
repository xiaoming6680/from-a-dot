'use strict';
// 调试面板：网址加 ?debug 打开。F2 切换倍速，F4 直接达成当前时代目标。
(() => {
  const q = new URLSearchParams(location.search);
  G.debug = q.has('debug');
  if (q.has('speed')) G.speed = +q.get('speed') || 1;

  // 给资源：把当前时代及之前所有资源按"至少 x"补满
  G.cheat = {
    give(mult = 10) {
      for (let i = 0; i <= G.s.era; i++) {
        const r = G.econ.ERA_RES[i];
        G.s.res[r] = Math.max(G.s.res[r] * mult, G.s.res[r] + 1000 * Math.pow(100, i));
      }
    },
    // 买下当前时代目标（先补足资源）
    goal() {
      const d = G.econ.order.find((x) => x.era === G.s.era && x.type === 'goal' && !G.econ.maxed(x));
      if (!d) return;
      G.s.seen[d.id] = 1;
      const c = G.econ.cost(d);
      for (const k in c) G.s.res[k] = Math.max(G.s.res[k], c[k]);
      G.econ.buy(d);
    },
    // 测试：快进到第 n 个时代（直接走完跃迁）
    toEra(n) {
      let guard = 0;
      while (G.s.era < n && guard++ < 20) {
        G.cheat.give(1000);
        G.cheat.buyAll();
        G.cheat.goal();
        let k = 0;
        while (G.scene.fx && k++ < 4000) G.step(0.05);
        const e = G.s.e[G.s.era];
        if (e && e.started === 0) e.started = 1;
      }
    },
    // 自动买下当前时代所有买得起的东西（不含目标）
    buyAll(rounds = 50) {
      for (let k = 0; k < rounds; k++) {
        let any = false;
        for (const d of G.econ.order) {
          if (d.era > G.s.era || d.type === 'goal') continue;
          if (G.econ.canBuy(d)) any = G.econ.buy(d) > 0 || any;
        }
        if (!any) break;
      }
    },
  };

  G.debugInit = () => {
    if (!G.debug) return;
    const el = document.getElementById('debug');
    el.classList.add('open');
    const speeds = [1, 5, 20, 60];
    el.innerHTML = `
<div class="line">DEBUG <span id="d-fps"></span></div>
<div class="line">倍速 ${speeds.map((s) => `<button data-s="${s}">×${s}</button>`).join('')}</div>
<div class="line"><button id="d-give">+资源</button><button id="d-buy">全买</button><button id="d-goal">达成目标</button></div>
<div class="line"><button id="d-save">存档</button><button id="d-reset">清档</button></div>
<div class="line" id="d-info"></div>`;
    el.querySelectorAll('[data-s]').forEach((b) => (b.onclick = () => (G.speed = +b.dataset.s)));
    el.querySelector('#d-give').onclick = () => G.cheat.give();
    el.querySelector('#d-buy').onclick = () => G.cheat.buyAll();
    el.querySelector('#d-goal').onclick = () => G.cheat.goal();
    el.querySelector('#d-save').onclick = () => G.save.write();
    el.querySelector('#d-reset').onclick = () => G.save.reset();
    let frames = 0, acc = 0;
    const info = el.querySelector('#d-info'), fps = el.querySelector('#d-fps');
    (function tick(t) {
      frames++;
      if (performance.now() - acc > 500) {
        fps.textContent = Math.round((frames * 1000) / (performance.now() - acc)) + 'fps';
        frames = 0;
        acc = performance.now();
        const s = G.s;
        info.textContent = `时代 ${s.era} · ${G.U.time(s.time)} · ×${G.speed}`;
      }
      requestAnimationFrame(tick);
    })();
    window.addEventListener('keydown', (e) => {
      if (e.code === 'F2') {
        const i = speeds.indexOf(G.speed);
        G.speed = speeds[(i + 1) % speeds.length];
      } else if (e.code === 'F4') G.cheat.goal();
      else if (e.code === 'F6') G.cheat.give();
    });
  };
})();
