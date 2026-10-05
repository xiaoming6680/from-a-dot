'use strict';
// 键鼠输入。坐标统一换算到虚拟画布（1600×900），已考虑黑边和 CRT 弧度。
G.input = (() => {
  const I = {
    mx: -999, my: -999, // 虚拟坐标
    cx: 0, cy: 0, // 屏幕 CSS 像素
    inside: false,
    down: false,
    pressed: false, // 本帧按下
    released: false,
    rdown: false,
    rpressed: false,
    used: false, // 本帧点击是否已被某个按钮消费
    wheel: 0,
    keys: [], // 本帧按键事件
    held: {}, // 按住的键（按 code）
    shift: false,
    ctrl: false,
    lastInput: 0,
    gestured: false,
  };

  const BLOCK = new Set([
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Tab', 'Backspace',
    'Slash', 'Quote', 'Enter', 'F1', 'F2', 'F3',
  ]);

  function remap() {
    const p = G.display ? G.display.toVirtual(I.cx, I.cy) : { x: I.cx, y: I.cy };
    I.mx = p.x;
    I.my = p.y;
    I.inside = p.x >= 0 && p.y >= 0 && p.x <= G.VW && p.y <= G.VH;
  }

  function gesture() {
    I.lastInput = performance.now();
    if (!I.gestured) {
      I.gestured = true;
      G.bus.emit('gesture');
    }
  }

  function menuOpen() {
    return document.body.classList.contains('modal');
  }

  window.addEventListener('pointermove', (e) => {
    I.cx = e.clientX;
    I.cy = e.clientY;
    remap();
  });
  window.addEventListener('pointerdown', (e) => {
    if (menuOpen()) return;
    I.cx = e.clientX;
    I.cy = e.clientY;
    I.shift = e.shiftKey;
    I.ctrl = e.ctrlKey || e.metaKey;
    remap();
    gesture();
    if (e.button === 0) {
      I.down = true;
      I.pressed = true;
    } else if (e.button === 2) {
      I.rdown = true;
      I.rpressed = true;
    }
  });
  window.addEventListener('pointerup', (e) => {
    if (e.button === 0) {
      if (I.down) I.released = true;
      I.down = false;
    } else if (e.button === 2) I.rdown = false;
  });
  window.addEventListener('pointerleave', () => {
    I.inside = false;
  });
  window.addEventListener('blur', () => {
    I.down = false;
    I.held = {};
    I.shift = false;
    I.ctrl = false;
  });
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  window.addEventListener(
    'wheel',
    (e) => {
      if (menuOpen()) return;
      I.wheel += e.deltaY;
      e.preventDefault();
    },
    { passive: false }
  );
  window.addEventListener('keydown', (e) => {
    I.shift = e.shiftKey;
    I.ctrl = e.ctrlKey || e.metaKey;
    if (e.code === 'Escape' && menuOpen() && G.ui && G.ui.menuOpen()) {
      G.ui.closeMenu();
      return;
    }
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    if (menuOpen() && e.code !== 'Escape') return;
    if (BLOCK.has(e.code) && !I.ctrl) e.preventDefault();
    gesture();
    if (!e.repeat) I.held[e.code] = true;
    I.keys.push({ key: e.key, code: e.code, repeat: e.repeat, shift: e.shiftKey, ctrl: I.ctrl, alt: e.altKey });
  });
  window.addEventListener('keyup', (e) => {
    I.shift = e.shiftKey;
    I.ctrl = e.ctrlKey || e.metaKey;
    delete I.held[e.code];
  });

  I.remap = remap;
  I.endFrame = () => {
    I.pressed = false;
    I.released = false;
    I.rpressed = false;
    I.used = false;
    I.wheel = 0;
    I.keys.length = 0;
  };
  // 方向键 / WASD 是否按住
  I.dir = () => ({
    up: !!(I.held.ArrowUp || I.held.KeyW),
    down: !!(I.held.ArrowDown || I.held.KeyS),
    left: !!(I.held.ArrowLeft || I.held.KeyA),
    right: !!(I.held.ArrowRight || I.held.KeyD),
  });
  // 消费掉本帧的某个按键（避免多个系统重复响应）
  I.take = (pred) => {
    for (let i = 0; i < I.keys.length; i++) {
      if (pred(I.keys[i])) return I.keys.splice(i, 1)[0];
    }
    return null;
  };
  return I;
})();
