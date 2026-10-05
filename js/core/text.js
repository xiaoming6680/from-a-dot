'use strict';
// 文字渲染：像素点阵字（宋体内嵌点阵 → 二值化）与矢量笔画字（Asteroids 风格）。
G.text = (() => {
  const T = {};

  // ---------------- 像素字 ----------------
  const pixelFonts = {};
  T.pixel = (size = 12, family = 'SimSun, NSimSun, "宋体", "Songti SC", monospace', bold = false) => {
    const key = size + family + bold;
    if (pixelFonts[key]) return pixelFonts[key];
    const font = `${bold ? 'bold ' : ''}${size}px ${family}`;
    const masks = new Map(); // ch -> {c: canvas, w}
    const colored = new Map();
    const meas = G.U.canvas(4, 4).getContext('2d');
    meas.font = font;
    const base = Math.round(size * 0.86);

    function mask(ch) {
      let g = masks.get(ch);
      if (g) return g;
      const w = Math.max(1, Math.round(meas.measureText(ch).width));
      const c = G.U.canvas(w + 2, size + 4);
      const x = c.getContext('2d');
      x.font = font;
      x.fillStyle = '#fff';
      x.textBaseline = 'alphabetic';
      x.fillText(ch, 0, base);
      const d = x.getImageData(0, 0, c.width, c.height);
      for (let i = 0; i < d.data.length; i += 4) {
        const a = d.data[i + 3];
        d.data[i] = d.data[i + 1] = d.data[i + 2] = 255;
        d.data[i + 3] = a >= 110 ? 255 : 0;
      }
      x.putImageData(d, 0, 0);
      g = { c, w };
      masks.set(ch, g);
      return g;
    }

    function glyph(ch, color) {
      const k = ch + color;
      let g = colored.get(k);
      if (g) return g;
      const m = mask(ch);
      const c = G.U.canvas(m.c.width, m.c.height);
      const x = c.getContext('2d');
      x.drawImage(m.c, 0, 0);
      x.globalCompositeOperation = 'source-in';
      x.fillStyle = color;
      x.fillRect(0, 0, c.width, c.height);
      g = { c, w: m.w };
      colored.set(k, g);
      return g;
    }

    const F = {
      size,
      lh: size + 2,
      width(str) {
        let w = 0;
        for (const ch of String(str)) w += mask(ch).w;
        return w;
      },
      // opt: align, shadow(颜色), max(最多显示字符数), scale
      draw(ctx, str, x, y, color = '#fff', opt = {}) {
        str = String(str);
        const sc = opt.scale || 1;
        let w = F.width(str) * sc;
        if (opt.align === 'center') x -= Math.floor(w / 2);
        else if (opt.align === 'right') x -= w;
        x = Math.round(x);
        y = Math.round(y);
        let i = 0;
        const max = opt.max === undefined ? Infinity : opt.max;
        for (const ch of str) {
          if (i++ >= max) break;
          if (ch !== ' ') {
            if (opt.shadow) {
              const s = glyph(ch, opt.shadow);
              ctx.drawImage(s.c, x + sc, y + sc, s.c.width * sc, s.c.height * sc);
            }
            const g = glyph(ch, color);
            ctx.drawImage(g.c, x, y, g.c.width * sc, g.c.height * sc);
          }
          x += mask(ch).w * sc;
        }
        return w;
      },
      wrap(str, maxW) {
        const lines = [];
        for (const para of String(str).split('\n')) {
          let line = '', lw = 0;
          for (const ch of para) {
            const cw = mask(ch).w;
            if (lw + cw > maxW && line) {
              lines.push(line);
              line = '';
              lw = 0;
            }
            line += ch;
            lw += cw;
          }
          lines.push(line);
        }
        return lines;
      },
    };
    pixelFonts[key] = F;
    return F;
  };

  // ---------------- 矢量笔画字 ----------------
  // 4×6 网格，y 向下。每个字符是若干条折线。
  const S = {
    '0': [[0, 0, 4, 0, 4, 6, 0, 6, 0, 0]],
    '1': [[1, 1, 2, 0, 2, 6], [1, 6, 3, 6]],
    '2': [[0, 0, 4, 0, 4, 3, 0, 3, 0, 6, 4, 6]],
    '3': [[0, 0, 4, 0, 4, 6, 0, 6], [0, 3, 4, 3]],
    '4': [[0, 0, 0, 3, 4, 3], [4, 0, 4, 6]],
    '5': [[4, 0, 0, 0, 0, 3, 4, 3, 4, 6, 0, 6]],
    '6': [[0, 0, 0, 6, 4, 6, 4, 3, 0, 3]],
    '7': [[0, 0, 4, 0, 4, 6]],
    '8': [[0, 0, 4, 0, 4, 6, 0, 6, 0, 0], [0, 3, 4, 3]],
    '9': [[4, 3, 0, 3, 0, 0, 4, 0, 4, 6]],
    A: [[0, 6, 0, 2, 2, 0, 4, 2, 4, 6], [0, 4, 4, 4]],
    B: [[0, 0, 0, 6, 3, 6, 4, 5, 4, 4, 3, 3, 0, 3], [0, 0, 3, 0, 4, 1, 4, 2, 3, 3]],
    C: [[4, 0, 0, 0, 0, 6, 4, 6]],
    D: [[0, 0, 0, 6, 2, 6, 4, 4, 4, 2, 2, 0, 0, 0]],
    E: [[4, 0, 0, 0, 0, 6, 4, 6], [0, 3, 3, 3]],
    F: [[4, 0, 0, 0, 0, 6], [0, 3, 3, 3]],
    G: [[4, 1, 4, 0, 0, 0, 0, 6, 4, 6, 4, 3, 2, 3]],
    H: [[0, 0, 0, 6], [4, 0, 4, 6], [0, 3, 4, 3]],
    I: [[0, 0, 4, 0], [2, 0, 2, 6], [0, 6, 4, 6]],
    J: [[4, 0, 4, 6, 2, 6, 0, 4]],
    K: [[0, 0, 0, 6], [4, 0, 0, 3, 4, 6]],
    L: [[0, 0, 0, 6, 4, 6]],
    M: [[0, 6, 0, 0, 2, 2, 4, 0, 4, 6]],
    N: [[0, 6, 0, 0, 4, 6, 4, 0]],
    O: [[0, 0, 4, 0, 4, 6, 0, 6, 0, 0]],
    P: [[0, 6, 0, 0, 4, 0, 4, 3, 0, 3]],
    Q: [[0, 0, 4, 0, 4, 4, 2, 6, 0, 6, 0, 0], [2, 4, 4, 6]],
    R: [[0, 6, 0, 0, 4, 0, 4, 3, 0, 3, 4, 6]],
    S: [[4, 0, 0, 0, 0, 3, 4, 3, 4, 6, 0, 6]],
    T: [[0, 0, 4, 0], [2, 0, 2, 6]],
    U: [[0, 0, 0, 6, 4, 6, 4, 0]],
    V: [[0, 0, 2, 6, 4, 0]],
    W: [[0, 0, 0, 6, 2, 4, 4, 6, 4, 0]],
    X: [[0, 0, 4, 6], [4, 0, 0, 6]],
    Y: [[0, 0, 2, 2, 4, 0], [2, 2, 2, 6]],
    Z: [[0, 0, 4, 0, 0, 6, 4, 6]],
    '.': [[2, 5.5, 2, 6]],
    ',': [[2, 5, 1, 7]],
    ':': [[2, 1.4, 2, 2], [2, 4.4, 2, 5]],
    '/': [[4, 0, 0, 6]],
    '-': [[1, 3, 3, 3]],
    '+': [[0.5, 3, 3.5, 3], [2, 1.5, 2, 4.5]],
    '%': [[0, 0, 1, 0, 1, 1, 0, 1, 0, 0], [4, 0, 0, 6], [3, 5, 4, 5, 4, 6, 3, 6, 3, 5]],
    '!': [[2, 0, 2, 4], [2, 5.5, 2, 6]],
    '?': [[0, 1, 0, 0, 4, 0, 4, 3, 2, 3, 2, 4], [2, 5.5, 2, 6]],
    '(': [[3, 0, 1, 2, 1, 4, 3, 6]],
    ')': [[1, 0, 3, 2, 3, 4, 1, 6]],
    '[': [[3, 0, 1, 0, 1, 6, 3, 6]],
    ']': [[1, 0, 3, 0, 3, 6, 1, 6]],
    '<': [[4, 0, 0, 3, 4, 6]],
    '>': [[0, 0, 4, 3, 0, 6]],
    '=': [[0, 2, 4, 2], [0, 4, 4, 4]],
    '_': [[0, 6, 4, 6]],
    '#': [[1, 0, 1, 6], [3, 0, 3, 6], [0, 2, 4, 2], [0, 4, 4, 4]],
    "'": [[2, 0, 2, 2]],
    '"': [[1, 0, 1, 2], [3, 0, 3, 2]],
    '*': [[0, 1, 4, 5], [4, 1, 0, 5], [2, 0, 2, 6]],
    '×': [[0.5, 1.5, 3.5, 4.5], [3.5, 1.5, 0.5, 4.5]],
    '·': [[2, 2.8, 2, 3.2]],
  };

  const isVec = (ch) => S[ch.toUpperCase()] !== undefined || ch === ' ';
  T.vec = {
    // 宽度：size 是大写字母高度（像素）
    width(ctx, str, size, weight = 300) {
      let w = 0;
      const u = size / 6;
      ctx.font = `${weight} ${Math.round(size * 1.25)}px "Microsoft YaHei UI", "Microsoft YaHei", sans-serif`;
      for (const ch of String(str)) {
        if (isVec(ch)) w += 6 * u;
        else w += ctx.measureText(ch).width + u;
      }
      return w;
    },
    // opt: align, color, lw, reveal(0..1), fill(中文实心), jitter
    draw(ctx, str, x, y, size, opt = {}) {
      str = String(str);
      const u = size / 6;
      const total = T.vec.width(ctx, str, size, opt.weight || 300);
      if (opt.align === 'center') x -= total / 2;
      else if (opt.align === 'right') x -= total;
      const chars = [...str];
      const shown = opt.reveal === undefined ? chars.length : opt.reveal * chars.length;
      ctx.save();
      ctx.strokeStyle = opt.color || '#fff';
      ctx.lineWidth = opt.lw || Math.max(1, size / 14);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.font = `${opt.weight || 300} ${Math.round(size * 1.25)}px "Microsoft YaHei UI", "Microsoft YaHei", sans-serif`;
      ctx.textBaseline = 'alphabetic';
      let cx = x;
      for (let i = 0; i < chars.length; i++) {
        if (i >= shown) break;
        const ch = chars[i];
        const part = Math.min(1, shown - i);
        const sh = S[ch.toUpperCase()];
        if (sh) {
          ctx.beginPath();
          for (const line of sh) {
            const n = line.length / 2;
            const lim = part < 1 ? Math.max(2, Math.ceil(n * part)) : n;
            for (let k = 0; k < lim; k++) {
              const px = cx + line[k * 2] * u, py = y + line[k * 2 + 1] * u;
              if (k === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            }
          }
          ctx.stroke();
          cx += 6 * u;
        } else if (ch === ' ') {
          cx += 6 * u;
        } else {
          const w = ctx.measureText(ch).width;
          const by = y + size * 1.02;
          if (opt.fill) {
            ctx.fillStyle = opt.color || '#fff';
            ctx.fillText(ch, cx, by);
          } else ctx.strokeText(ch, cx, by);
          cx += w + u;
        }
      }
      ctx.restore();
      return total;
    },
  };

  return T;
})();
