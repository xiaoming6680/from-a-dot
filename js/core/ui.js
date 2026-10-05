'use strict';
// 立即模式 UI 辅助：命中检测、购买按钮（单击/Shift 买满/按住连买）、设置菜单。
G.ui = (() => {
  const UI = { sx: 1, sy: 1, hot: null, holdId: null, holdT: 0, holdNext: 0 };

  // 设定当前坐标系（例如像素时代 480×270）
  UI.space = (w, h) => {
    UI.sx = w / G.VW;
    UI.sy = h / G.VH;
  };
  Object.defineProperty(UI, 'mx', { get: () => G.input.mx * UI.sx });
  Object.defineProperty(UI, 'my', { get: () => G.input.my * UI.sy });

  UI.over = (x, y, w, h) => {
    if (!G.input.inside || G.ui.blocked) return false;
    const mx = UI.mx, my = UI.my;
    return mx >= x && my >= y && mx < x + w && my < y + h;
  };
  UI.click = (x, y, w, h) => {
    if (G.input.pressed && !G.input.used && UI.over(x, y, w, h)) {
      G.input.used = true;
      return true;
    }
    return false;
  };
  UI.rclick = (x, y, w, h) => G.input.rpressed && UI.over(x, y, w, h);
  UI.held = (x, y, w, h) => G.input.down && UI.over(x, y, w, h);

  // 购买按钮逻辑。返回 { hover, can, bought }
  UI.buy = (d, x, y, w, h) => {
    const hover = UI.over(x, y, w, h);
    const can = G.econ.canBuy(d);
    let bought = 0;
    if (hover) UI.hot = d;
    if (UI.click(x, y, w, h)) {
      if (can) {
        bought = G.input.shift ? G.econ.buyMax(d) : G.econ.buy(d);
        UI.holdId = d.id;
        UI.holdT = 0;
        UI.holdNext = 0.42;
      } else {
        G.bus.emit('cant', d);
      }
    } else if (G.input.down && hover && UI.holdId === d.id && d.type === 'gen') {
      UI.holdT += G.dt;
      if (UI.holdT >= UI.holdNext) {
        UI.holdNext += 0.075;
        bought = G.econ.buy(d);
      }
    }
    if (!G.input.down && UI.holdId === d.id) UI.holdId = null;
    return { hover, can, bought };
  };

  // 每帧开始时清掉悬停记录（各时代读 UI.hot 画说明框）
  UI.begin = () => {
    UI.hot = null;
  };

  // ---------- 设置菜单（DOM 浮层） ----------
  const menu = { el: null };
  UI.menuOpen = () => !!(menu.el && menu.el.classList.contains('open'));
  UI.openMenu = () => {
    if (!menu.el) buildMenu();
    const s = G.s;
    menu.el.className = 'open skin-' + G.fgEra() + (G.fgEra() === 0 && !s.own.color ? ' mono' : '');
    menu.el.querySelector('#m-master').value = s.set.master;
    menu.el.querySelector('#m-music').value = s.set.music;
    menu.el.querySelector('#m-sfx').value = s.set.sfx;
    menu.el.querySelector('#m-flash').checked = !!s.set.lessFlash;
    menu.el.querySelector('#m-text').classList.remove('show');
    if (menu.resetMode) menu.resetMode();
    menu.el.querySelector('#m-msg').textContent = '';
    menu.el.querySelector('#m-stats').textContent =
      `游戏时间：${G.U.time(s.time)}　时代：${s.era}　周目：${s.ng + 1}\n留言解码：${G.letter.pct()}%`;
    document.body.classList.add('modal');
    G.input.down = false;
  };
  UI.closeMenu = () => {
    if (!menu.el) return;
    menu.el.classList.remove('open');
    document.body.classList.remove('modal');
    G.save.write();
  };

  function buildMenu() {
    const el = document.getElementById('menu');
    menu.el = el;
    el.innerHTML = `
<div class="panel">
  <h2>暂停</h2>
  <div class="row"><label>总音量</label><input id="m-master" type="range" min="0" max="1" step="0.05"></div>
  <div class="row"><label>音乐</label><input id="m-music" type="range" min="0" max="1" step="0.05"></div>
  <div class="row"><label>音效</label><input id="m-sfx" type="range" min="0" max="1" step="0.05"></div>
  <div class="row"><label>减少闪光</label><input id="m-flash" type="checkbox"><span class="hint" style="margin:0">跃迁时不白闪</span></div>
  <div class="btns">
    <button id="m-resume">继续</button>
    <button id="m-full">全屏</button>
    <button id="m-export">导出存档</button>
    <button id="m-import">导入存档</button>
    <button id="m-reset" class="danger">重新开始</button>
  </div>
  <textarea id="m-text" spellcheck="false"></textarea>
  <div id="m-msg" class="hint"></div>
  <div id="m-stats" class="stats"></div>
  <div class="hint">Esc 继续 · 自动存档 · 关掉页面也会继续挂机（最多补 2 小时）</div>
</div>`;
    const s = () => G.s.set;
    const vol = () => G.audio.applyVolume();
    el.querySelector('#m-master').oninput = (e) => { s().master = +e.target.value; vol(); };
    el.querySelector('#m-music').oninput = (e) => { s().music = +e.target.value; vol(); };
    el.querySelector('#m-sfx').oninput = (e) => { s().sfx = +e.target.value; vol(); };
    el.querySelector('#m-flash').onchange = (e) => { s().lessFlash = e.target.checked; };
    el.querySelector('#m-resume').onclick = UI.closeMenu;
    el.querySelector('#m-full').onclick = () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen().catch(() => {});
    };
    const ta = el.querySelector('#m-text');
    const msg = el.querySelector('#m-msg');
    let mode = '';
    menu.resetMode = () => (mode = '');
    el.querySelector('#m-export').onclick = () => {
      ta.value = G.save.exportStr();
      ta.classList.add('show');
      ta.select();
      mode = 'export';
      try {
        navigator.clipboard.writeText(ta.value);
        msg.textContent = '已复制到剪贴板。';
      } catch (e) {
        msg.textContent = '请手动复制上面的文字。';
      }
    };
    el.querySelector('#m-import').onclick = () => {
      if (mode !== 'import') {
        ta.value = '';
        ta.classList.add('show');
        ta.focus();
        mode = 'import';
        msg.textContent = '把存档文字粘贴进来，再点一次「导入存档」。';
        return;
      }
      if (!G.save.importStr(ta.value)) msg.textContent = '这段文字不是有效的存档。';
    };
    let resetArm = 0;
    el.querySelector('#m-reset').onclick = (e) => {
      if (Date.now() - resetArm < 3000) {
        G.save.reset();
        return;
      }
      resetArm = Date.now();
      e.target.textContent = '再点一次确认（进度会清空）';
      setTimeout(() => (e.target.textContent = '重新开始'), 3000);
    };
    // 菜单上的点击不能冒泡到 window（否则关菜单的那一下会被当成游戏里的点击）
    el.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (e.target === el) UI.closeMenu();
    });
  }

  return UI;
})();
