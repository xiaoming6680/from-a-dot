'use strict';
// 显示层：把时代的帧缓冲（Canvas2D）当纹理贴到全屏 WebGL canvas 上，
// 在 shader 里做"显示器仿真"（CRT 弧度、扫描线、辉光……）和跃迁合成。
G.display = (() => {
  const D = {
    canvas: null,
    gl: null,
    ctx2d: null, // WebGL 不可用时的退路
    view: { x: 0, y: 0, w: 1600, h: 900 }, // 内容区（CSS 像素）
    dpr: 1,
    quality: 1, // 自适应画质：帧率太低时降低高清帧缓冲的分辨率
    last: {}, // 上一帧参数（鼠标坐标反算用）
  };

  const VS = `
attribute vec2 aPos;
void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

  const FS = `
precision highp float;
uniform sampler2D uA;
uniform sampler2D uB;
uniform vec2 uRes;
uniform vec4 uView;
uniform vec4 uZoom;
uniform vec4 uZoomB;
uniform vec2 uSrcA;
uniform vec2 uSrcB;
uniform float uCurve, uScan, uScanN, uVig, uChroma, uNoise, uFlick, uBloom, uBloomT, uTime;
uniform float uBright, uGray, uWhite, uFade, uPix, uPixB, uMix, uMode, uSoft, uQuant, uGrid, uCorner;
uniform vec2 uBloomR;
uniform vec2 uCenter;
uniform vec2 uGridN;
uniform vec3 uTint;
uniform vec3 uEdge;
uniform vec3 uBezel;
uniform vec2 uShake;

float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

vec2 pixelate(vec2 uv, float px, vec2 src){
  if (px > 1.0) { vec2 cell = px / src; uv = (floor(uv / cell) + 0.5) * cell; }
  return uv;
}

void main(){
  vec2 fc = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 p = (fc - uView.xy) / uView.zw;
  if (p.x < 0.0 || p.y < 0.0 || p.x > 1.0 || p.y > 1.0) { gl_FragColor = vec4(uBezel, 1.0); return; }
  vec2 q = p * 2.0 - 1.0;
  q *= 1.0 + uCurve * (q.yx * q.yx);
  vec2 w = q * 0.5 + 0.5;
  float edge = 1.0;
  if (uCurve > 0.0) {
    vec2 e = smoothstep(vec2(0.0), vec2(0.003), w) * smoothstep(vec2(0.0), vec2(0.003), 1.0 - w);
    edge = e.x * e.y;
    if (w.x < 0.0 || w.y < 0.0 || w.x > 1.0 || w.y > 1.0) { gl_FragColor = vec4(uBezel, 1.0); return; }
  }
  w += uShake;
  vec2 uv = pixelate(uZoom.xy + w * uZoom.zw, uPix, uSrcA);

  vec3 c;
  if (uChroma > 0.0) {
    vec2 o = vec2(uChroma / 1600.0, 0.0);
    c = vec3(texture2D(uA, uv + o).r, texture2D(uA, uv).g, texture2D(uA, uv - o).b);
  } else {
    c = texture2D(uA, uv).rgb;
  }

  if (uBloom > 0.0) {
    vec3 bl = vec3(0.0);
    for (int i = 0; i < 12; i++) {
      float a = float(i) * 0.5235988 + 0.26;
      vec2 o = vec2(cos(a), sin(a)) * uBloomR;
      bl += max(texture2D(uA, uv + o).rgb - uBloomT, 0.0);
      bl += max(texture2D(uA, uv + o * 0.45).rgb - uBloomT, 0.0) * 1.3;
    }
    c += bl * uBloom / 24.0;
  }

  if (uMode > 0.5) {
    vec2 uvB = pixelate(uZoomB.xy + w * uZoomB.zw, uPixB, uSrcB);
    vec4 b4 = texture2D(uB, uvB);
    vec3 b = b4.rgb;
    float m = 0.0;
    if (uMode < 1.5) {
      m = uMix;
    } else if (uMode < 2.5) {
      float d = length((w - uCenter) * vec2(1.7778, 1.0));
      float R = uMix * 2.2;
      m = 1.0 - smoothstep(R - uSoft, R, d);
      float ring = exp(-abs(d - R) * 60.0) * step(0.001, uMix) * (1.0 - step(0.999, uMix));
      c += uEdge * ring;
      b += uEdge * ring;
    } else if (uMode < 3.5) {
      vec2 cell = floor(w * uGridN);
      m = step(hash(cell + 3.1), uMix);
    } else if (uMode < 4.5) {
      m = 1.0 - smoothstep(uMix - uSoft, uMix, w.y);
      float line = exp(-abs(w.y - uMix) * 300.0) * step(0.001, uMix) * (1.0 - step(0.999, uMix));
      b += uEdge * line;
      c += uEdge * line;
    } else {
      m = b4.a * uMix;
    }
    c = mix(c, b, m);
  }

  if (uQuant > 1.5) {
    c = floor(clamp(c, 0.0, 0.999) * uQuant) / (uQuant - 1.0);
  }
  if (uGrid > 0.0) {
    vec2 fr = fract(w * uGridN);
    vec2 t = uGridN / uView.zw * 1.2;
    float ln = max(step(fr.x, t.x), step(fr.y, t.y));
    c = mix(c, uEdge, ln * uGrid);
  }

  c = mix(c, vec3(dot(c, vec3(0.299, 0.587, 0.114))), uGray);
  c *= uTint;
  if (uScan > 0.0) c *= 1.0 - uScan * (0.5 - 0.5 * cos(6.2831853 * w.y * uScanN));
  if (uVig > 0.0) {
    float v = 16.0 * w.x * w.y * (1.0 - w.x) * (1.0 - w.y);
    c *= mix(1.0, pow(clamp(v, 0.0, 1.0), 0.28), uVig);
  }
  if (uNoise > 0.0) c += (hash(fc + fract(uTime * 7.13) * 91.0) - 0.5) * uNoise;
  if (uFlick > 0.0) c *= 1.0 - uFlick * hash(vec2(floor(uTime * 24.0), 7.0));
  if (uCorner > 0.0) {
    vec2 pos = (w * 2.0 - 1.0) * vec2(1.7778, 1.0);
    vec2 h = vec2(1.7778, 1.0) - uCorner;
    float d = length(max(abs(pos) - h, 0.0)) - uCorner;
    edge *= 1.0 - smoothstep(-0.006, 0.0, d);
  }
  c = mix(c, vec3(1.0), uWhite);
  c *= (1.0 - uFade) * uBright;
  c = mix(uBezel, c, edge);
  gl_FragColor = vec4(c, 1.0);
}`;

  const DEF = {
    curve: 0, scan: 0, scanN: 270, vig: 0, chroma: 0, noise: 0, flick: 0,
    bloom: 0, bloomT: 0.25, bloomR: 6,
    bright: 1, gray: 0, white: 0, fade: 0, pix: 0, pixB: 0,
    mix: 0, mode: 0, soft: 0.06, quant: 0, grid: 0, gridN: [480, 270], corner: 0,
    center: [0.5, 0.5], tint: [1, 1, 1], edge: [1, 1, 1], bezel: [0, 0, 0],
    zoom: [0, 0, 1, 1], zoomB: [0, 0, 1, 1], shake: [0, 0],
    nearest: false, nearestB: false,
  };
  D.DEF = DEF;

  let prog, U = {}, texA, texB;

  function compile(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(sh));
      throw new Error('shader');
    }
    return sh;
  }

  function makeTex(gl) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    return t;
  }

  D.init = (canvas) => {
    D.canvas = canvas;
    let gl = null;
    try {
      gl = canvas.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false });
    } catch (e) {
      gl = null;
    }
    if (gl) {
      try {
        prog = gl.createProgram();
        gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS));
        gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FS));
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
        gl.useProgram(prog);
        const buf = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
        const loc = gl.getAttribLocation(prog, 'aPos');
        gl.enableVertexAttribArray(loc);
        gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
        const n = gl.getProgramParameter(prog, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < n; i++) {
          const info = gl.getActiveUniform(prog, i);
          U[info.name] = gl.getUniformLocation(prog, info.name);
        }
        texA = makeTex(gl);
        texB = makeTex(gl);
        gl.uniform1i(U.uA, 0);
        gl.uniform1i(U.uB, 1);
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
        D.gl = gl;
      } catch (e) {
        console.warn('WebGL 显示层初始化失败，退回 Canvas2D', e);
        D.gl = null;
      }
    }
    if (!D.gl) D.ctx2d = canvas.getContext('2d');
    D.resize();
    window.addEventListener('resize', D.resize);
  };

  D.resize = () => {
    const W = window.innerWidth, H = window.innerHeight;
    D.dpr = Math.min(window.devicePixelRatio || 1, 2);
    D.canvas.width = Math.round(W * D.dpr);
    D.canvas.height = Math.round(H * D.dpr);
    const w = Math.min(W, (H * 16) / 9), h = (w * 9) / 16;
    D.view = { x: (W - w) / 2, y: (H - h) / 2, w, h };
    if (G.input) G.input.remap();
    G.bus.emit('resize');
  };

  // 高清时代帧缓冲的建议尺寸（设备像素，宽上限 2560）
  D.fbSize = () => {
    const s = Math.min(D.dpr, 2560 / D.view.w) * D.quality;
    return { w: Math.max(320, Math.round(D.view.w * s)), h: Math.max(180, Math.round(D.view.h * s)) };
  };

  function upload(gl, tex, unit, src, nearest) {
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    const f = nearest ? gl.NEAREST : gl.LINEAR;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
  }

  // src: 帧缓冲 canvas；p: 显示参数；p.B: 转场用的第二帧
  D.present = (src, p) => {
    p = Object.assign({}, DEF, p || {});
    D.last = p;
    const gl = D.gl;
    if (!gl) {
      const c = D.ctx2d, dpr = D.dpr, v = D.view;
      c.fillStyle = '#000';
      c.fillRect(0, 0, D.canvas.width, D.canvas.height);
      c.imageSmoothingEnabled = !p.nearest;
      const z = p.zoom;
      c.drawImage(src, z[0] * src.width, z[1] * src.height, z[2] * src.width, z[3] * src.height, v.x * dpr, v.y * dpr, v.w * dpr, v.h * dpr);
      if (p.B && p.mode && p.mix > 0) {
        c.globalAlpha = p.mix;
        c.drawImage(p.B, v.x * dpr, v.y * dpr, v.w * dpr, v.h * dpr);
        c.globalAlpha = 1;
      }
      if (p.white > 0) {
        c.fillStyle = `rgba(255,255,255,${p.white})`;
        c.fillRect(0, 0, D.canvas.width, D.canvas.height);
      }
      if (p.fade > 0) {
        c.fillStyle = `rgba(0,0,0,${p.fade})`;
        c.fillRect(0, 0, D.canvas.width, D.canvas.height);
      }
      return;
    }
    gl.viewport(0, 0, D.canvas.width, D.canvas.height);
    upload(gl, texA, 0, src, p.nearest);
    const B = p.B && p.mode ? p.B : null;
    if (B) upload(gl, texB, 1, B, p.nearestB);
    const dpr = D.dpr, v = D.view;
    gl.uniform2f(U.uRes, D.canvas.width, D.canvas.height);
    gl.uniform4f(U.uView, v.x * dpr, v.y * dpr, v.w * dpr, v.h * dpr);
    gl.uniform4f(U.uZoom, p.zoom[0], p.zoom[1], p.zoom[2], p.zoom[3]);
    gl.uniform4f(U.uZoomB, p.zoomB[0], p.zoomB[1], p.zoomB[2], p.zoomB[3]);
    gl.uniform2f(U.uSrcA, src.width, src.height);
    gl.uniform2f(U.uSrcB, B ? B.width : 1, B ? B.height : 1);
    gl.uniform1f(U.uCurve, p.curve);
    gl.uniform1f(U.uScan, p.scan);
    gl.uniform1f(U.uScanN, p.scanN);
    gl.uniform1f(U.uVig, p.vig);
    gl.uniform1f(U.uChroma, p.chroma);
    gl.uniform1f(U.uNoise, p.noise);
    gl.uniform1f(U.uFlick, p.flick);
    gl.uniform1f(U.uBloom, p.bloom);
    gl.uniform1f(U.uBloomT, p.bloomT);
    gl.uniform2f(U.uBloomR, p.bloomR / 1600, p.bloomR / 900);
    gl.uniform1f(U.uTime, G.t);
    gl.uniform1f(U.uBright, p.bright);
    gl.uniform1f(U.uGray, p.gray);
    gl.uniform1f(U.uWhite, p.white);
    gl.uniform1f(U.uFade, p.fade);
    gl.uniform1f(U.uPix, p.pix);
    gl.uniform1f(U.uPixB, p.pixB);
    gl.uniform1f(U.uMix, p.mix);
    gl.uniform1f(U.uMode, B ? p.mode : 0);
    gl.uniform1f(U.uSoft, p.soft);
    gl.uniform1f(U.uQuant, p.quant);
    gl.uniform1f(U.uGrid, p.grid);
    gl.uniform1f(U.uCorner, p.corner);
    gl.uniform2f(U.uCenter, p.center[0], p.center[1]);
    gl.uniform2f(U.uGridN, p.gridN[0], p.gridN[1]);
    gl.uniform3f(U.uTint, p.tint[0], p.tint[1], p.tint[2]);
    gl.uniform3f(U.uEdge, p.edge[0], p.edge[1], p.edge[2]);
    gl.uniform3f(U.uBezel, p.bezel[0], p.bezel[1], p.bezel[2]);
    gl.uniform2f(U.uShake, p.shake[0], p.shake[1]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };

  // 屏幕坐标 → 虚拟坐标（含弧度与缩放）
  D.toVirtual = (cx, cy) => {
    const v = D.view, p = D.last || DEF;
    let x = (cx - v.x) / v.w, y = (cy - v.y) / v.h;
    const curve = p.curve || 0;
    if (curve) {
      let qx = x * 2 - 1, qy = y * 2 - 1;
      const nx = qx * (1 + curve * qy * qy), ny = qy * (1 + curve * qx * qx);
      x = nx * 0.5 + 0.5;
      y = ny * 0.5 + 0.5;
    }
    const z = p.zoom || DEF.zoom;
    x = z[0] + x * z[2];
    y = z[1] + y * z[3];
    return { x: x * G.VW, y: y * G.VH };
  };

  return D;
})();
