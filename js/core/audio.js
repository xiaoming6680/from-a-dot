'use strict';
// 音频：全部 WebAudio 实时合成，不加载任何音频文件。
G.audio = (() => {
  const A = {
    ctx: null,
    ready: false,
    master: null,
    sfxBus: null,
    musicBus: null,
    revIn: null,
    echoIn: null,
    waves: {},
    bufs: {},
    loops: new Set(),
  };

  const midiHz = (n) => 440 * Math.pow(2, (n - 69) / 12);
  A.midiHz = midiHz;
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  A.note = (name) => {
    const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
    if (!m) return 60;
    let n = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
    return n + (parseInt(m[3], 10) + 1) * 12;
  };

  // 游戏内是否允许发声：时代 0 买到 beep 之前完全静音
  A.allowed = () => A.ready && G.s && G.s.flags.sound;

  A.init = () => {
    if (A.ctx) {
      if (A.ctx.state === 'suspended') A.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const c = (A.ctx = new AC());
    const comp = c.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 12;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.2;
    A.master = c.createGain();
    A.master.connect(comp);
    comp.connect(c.destination);
    A.sfxBus = c.createGain();
    A.musicBus = c.createGain();
    A.sfxBus.connect(A.master);
    A.musicBus.connect(A.master);

    // 混响（程序生成脉冲响应）
    const rev = c.createConvolver();
    rev.buffer = impulse(c, 2.8, 2.6);
    A.revIn = c.createGain();
    A.revIn.gain.value = 1;
    const revOut = c.createGain();
    revOut.gain.value = 0.55;
    A.revIn.connect(rev);
    rev.connect(revOut);
    revOut.connect(A.master);

    // 回声（SNES 风格：延迟 + 反馈 + 低通）
    const dl = c.createDelay(1.0);
    dl.delayTime.value = 0.27;
    const fb = c.createGain();
    fb.gain.value = 0.38;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2600;
    A.echoIn = c.createGain();
    A.echoIn.connect(dl);
    dl.connect(lp);
    lp.connect(fb);
    fb.connect(dl);
    const echoOut = c.createGain();
    echoOut.gain.value = 0.5;
    lp.connect(echoOut);
    echoOut.connect(A.master);

    buildWaves(c);
    A.ready = true;
    A.applyVolume();
    G.bus.emit('audio-ready');
  };

  function impulse(c, sec, decay) {
    const len = Math.floor(c.sampleRate * sec);
    const b = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return b;
  }

  function fourier(c, fn, harmonics = 64, M = 2048) {
    const real = new Float32Array(harmonics + 1), imag = new Float32Array(harmonics + 1);
    const xs = new Float32Array(M);
    for (let k = 0; k < M; k++) xs[k] = fn(k / M);
    for (let n = 1; n <= harmonics; n++) {
      let re = 0, im = 0;
      for (let k = 0; k < M; k++) {
        const a = (2 * Math.PI * n * k) / M;
        re += xs[k] * Math.cos(a);
        im += xs[k] * Math.sin(a);
      }
      real[n] = (2 / M) * re;
      imag[n] = (2 / M) * im;
    }
    return c.createPeriodicWave(real, imag);
  }

  function buildWaves(c) {
    A.waves.p12 = fourier(c, (t) => (t < 0.125 ? 1 : -1));
    A.waves.p25 = fourier(c, (t) => (t < 0.25 ? 1 : -1));
    A.waves.p50 = fourier(c, (t) => (t < 0.5 ? 1 : -1));
    // NES 三角波：32 级阶梯
    A.waves.nestri = fourier(c, (t) => {
      const step = Math.floor(t * 32);
      const v = step < 16 ? 15 - step : step - 16;
      return v / 7.5 - 1;
    });
    // 偏"有机"的音色（用于结局八音盒）
    A.waves.bell = fourier(c, (t) => Math.sin(2 * Math.PI * t) + 0.35 * Math.sin(4 * Math.PI * t) + 0.12 * Math.sin(10 * Math.PI * t), 16);
    // 噪声缓冲
    const sr = c.sampleRate;
    const white = c.createBuffer(1, sr * 2, sr);
    const wd = white.getChannelData(0);
    for (let i = 0; i < wd.length; i++) wd[i] = Math.random() * 2 - 1;
    A.bufs.white = white;
    // NES 噪声：15 位线性反馈移位寄存器
    const lfsr = (short) => {
      const n = 32767;
      const b = c.createBuffer(1, n, 44100);
      const d = b.getChannelData(0);
      let r = 1;
      for (let i = 0; i < n; i++) {
        const bit = (r & 1) ^ ((r >> (short ? 6 : 1)) & 1);
        r = (r >> 1) | (bit << 14);
        d[i] = r & 1 ? 0.8 : -0.8;
      }
      return b;
    };
    A.bufs.nes = lfsr(false);
    A.bufs.nesShort = lfsr(true);
  }

  A.applyVolume = () => {
    if (!A.ctx || !G.s) return;
    const st = G.s.set;
    const t = A.ctx.currentTime;
    A.master.gain.setTargetAtTime(st.master, t, 0.05);
    A.sfxBus.gain.setTargetAtTime(st.sfx, t, 0.05);
    A.musicBus.gain.setTargetAtTime(st.music, t, 0.05);
  };

  A.now = () => (A.ctx ? A.ctx.currentTime : 0);

  function outFor(o) {
    if (o.out) return o.out;
    return o.bus === 'music' ? A.musicBus : A.sfxBus;
  }

  function sends(node, o) {
    if (o.rev) {
      const g = A.ctx.createGain();
      g.gain.value = o.rev;
      node.connect(g);
      g.connect(A.revIn);
    }
    if (o.echo) {
      const g = A.ctx.createGain();
      g.gain.value = o.echo;
      node.connect(g);
      g.connect(A.echoIn);
    }
  }

  function envelope(g, o, t, d) {
    const v = o.v === undefined ? 0.2 : o.v;
    const a = o.a === undefined ? 0.003 : o.a;
    const r = o.r === undefined ? 0.06 : o.r;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + a);
    if (o.env === 'hold') {
      g.gain.setValueAtTime(v, t + Math.max(a, d));
      g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a, d) + r);
      return t + Math.max(a, d) + r;
    }
    if (o.env === 'adsr') {
      const s = (o.s === undefined ? 0.5 : o.s) * v;
      const dec = o.dec || 0.1;
      g.gain.setTargetAtTime(Math.max(s, 0.0001), t + a, dec / 3);
      g.gain.setValueAtTime(Math.max(s, 0.0001), t + Math.max(a + dec, d));
      g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a + dec, d) + r);
      return t + Math.max(a + dec, d) + r;
    }
    // 默认：拨弦式指数衰减
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(a + 0.005, d));
    return t + Math.max(a + 0.005, d);
  }

  // 单个音：{f|n, type, d, v, a, r, env, f2, pan, lp, hp, q, rev, echo, bus, out, t, detune, vib, vibF}
  A.tone = (o) => {
    if (!A.ready || (!o.force && !A.allowed())) return null;
    const c = A.ctx;
    const t = o.t === undefined ? c.currentTime : o.t;
    const d = o.d === undefined ? 0.1 : o.d;
    const f = o.f || midiHz(o.n || 69);
    const osc = c.createOscillator();
    const type = o.type || 'square';
    if (A.waves[type]) osc.setPeriodicWave(A.waves[type]);
    else osc.type = type;
    osc.frequency.setValueAtTime(f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), t + (o.slide || d));
    if (o.detune) osc.detune.value = o.detune;
    let node = osc;
    if (o.vib) {
      const lfo = c.createOscillator();
      const lg = c.createGain();
      lfo.frequency.value = o.vibF || 5.5;
      lg.gain.value = f * o.vib;
      lfo.connect(lg);
      lg.connect(osc.frequency);
      lfo.start(t);
      lfo.stop(t + d + 1.5);
    }
    if (o.lp || o.hp || o.bp) {
      const fl = c.createBiquadFilter();
      fl.type = o.lp ? 'lowpass' : o.hp ? 'highpass' : 'bandpass';
      fl.frequency.setValueAtTime(o.lp || o.hp || o.bp, t);
      if (o.lp2) fl.frequency.exponentialRampToValueAtTime(o.lp2, t + d);
      fl.Q.value = o.q || 0.7;
      node.connect(fl);
      node = fl;
    }
    const g = c.createGain();
    const end = envelope(g, o, t, d);
    node.connect(g);
    let last = g;
    if (o.pan) {
      const p = c.createStereoPanner();
      p.pan.value = o.pan;
      g.connect(p);
      last = p;
    }
    last.connect(outFor(o));
    sends(last, o);
    osc.start(t);
    osc.stop(end + 0.05);
    return osc;
  };

  // 噪声：{buf:'white'|'nes'|'nesShort', rate, d, v, lp, hp, bp, q, ...}
  A.noise = (o) => {
    if (!A.ready || (!o.force && !A.allowed())) return null;
    const c = A.ctx;
    const t = o.t === undefined ? c.currentTime : o.t;
    const d = o.d === undefined ? 0.1 : o.d;
    const src = c.createBufferSource();
    src.buffer = A.bufs[o.buf || 'white'];
    src.loop = true;
    src.playbackRate.setValueAtTime(o.rate || 1, t);
    if (o.rate2) src.playbackRate.exponentialRampToValueAtTime(o.rate2, t + d);
    let node = src;
    if (o.lp || o.hp || o.bp) {
      const fl = c.createBiquadFilter();
      fl.type = o.lp ? 'lowpass' : o.hp ? 'highpass' : 'bandpass';
      fl.frequency.setValueAtTime(o.lp || o.hp || o.bp, t);
      if (o.f2) fl.frequency.exponentialRampToValueAtTime(o.f2, t + d);
      fl.Q.value = o.q || 0.8;
      node.connect(fl);
      node = fl;
    }
    const g = c.createGain();
    const end = envelope(g, o, t, d);
    node.connect(g);
    let last = g;
    if (o.pan) {
      const p = c.createStereoPanner();
      p.pan.value = o.pan;
      g.connect(p);
      last = p;
    }
    last.connect(outFor(o));
    sends(last, o);
    src.start(t, Math.random());
    src.stop(end + 0.05);
    return src;
  };

  // 2 算子 FM：{n|f, ratio, index, index2, d, v, ...}
  A.fm = (o) => {
    if (!A.ready || (!o.force && !A.allowed())) return null;
    const c = A.ctx;
    const t = o.t === undefined ? c.currentTime : o.t;
    const d = o.d === undefined ? 0.3 : o.d;
    const f = o.f || midiHz(o.n || 69);
    const car = c.createOscillator();
    car.type = o.type || 'sine';
    car.frequency.setValueAtTime(f, t);
    const mod = c.createOscillator();
    mod.type = 'sine';
    mod.frequency.setValueAtTime(f * (o.ratio || 2), t);
    const mg = c.createGain();
    const idx = (o.index === undefined ? 3 : o.index) * f;
    mg.gain.setValueAtTime(idx, t);
    mg.gain.exponentialRampToValueAtTime(Math.max(1, (o.index2 === undefined ? 0.3 : o.index2) * f), t + (o.mdec || d));
    mod.connect(mg);
    mg.connect(car.frequency);
    const g = c.createGain();
    const end = envelope(g, o, t, d);
    let node = car;
    if (o.lp) {
      const fl = c.createBiquadFilter();
      fl.type = 'lowpass';
      fl.frequency.value = o.lp;
      car.connect(fl);
      node = fl;
    }
    node.connect(g);
    let last = g;
    if (o.pan) {
      const p = c.createStereoPanner();
      p.pan.value = o.pan;
      g.connect(p);
      last = p;
    }
    last.connect(outFor(o));
    sends(last, o);
    car.start(t);
    mod.start(t);
    car.stop(end + 0.05);
    mod.stop(end + 0.05);
    return car;
  };

  // 超锯齿 pad：{n, d, v, a, r, lp, voices, spread}
  A.pad = (o) => {
    if (!A.ready || (!o.force && !A.allowed())) return null;
    const c = A.ctx;
    const t = o.t === undefined ? c.currentTime : o.t;
    const d = o.d === undefined ? 1 : o.d;
    const f = o.f || midiHz(o.n || 57);
    const fl = c.createBiquadFilter();
    fl.type = 'lowpass';
    fl.frequency.setValueAtTime(o.lp || 1800, t);
    if (o.lp2) fl.frequency.linearRampToValueAtTime(o.lp2, t + d);
    fl.Q.value = o.q || 0.6;
    const g = c.createGain();
    const end = envelope(g, Object.assign({ env: 'hold', a: 0.3, r: 0.8 }, o), t, d);
    const voices = o.voices || 5, spread = o.spread || 14;
    const oscs = [];
    for (let i = 0; i < voices; i++) {
      const osc = c.createOscillator();
      osc.type = o.type || 'sawtooth';
      osc.frequency.value = f;
      osc.detune.value = (i - (voices - 1) / 2) * spread * (2 / Math.max(1, voices - 1));
      osc.connect(fl);
      osc.start(t);
      osc.stop(end + 0.1);
      oscs.push(osc);
    }
    const vg = c.createGain();
    vg.gain.value = 1 / Math.sqrt(voices);
    fl.connect(vg);
    vg.connect(g);
    let last = g;
    if (o.pan) {
      const p = c.createStereoPanner();
      p.pan.value = o.pan;
      g.connect(p);
      last = p;
    }
    last.connect(outFor(o));
    sends(last, o);
    return oscs[0];
  };

  // 持续音（底噪、风扇、嗡鸣）：返回可调的句柄
  A.sustain = (o) => {
    if (!A.ready) return null;
    const c = A.ctx;
    const g = c.createGain();
    g.gain.value = 0.0001;
    let src;
    if (o.noise) {
      src = c.createBufferSource();
      src.buffer = A.bufs[o.noise];
      src.loop = true;
      if (o.rate) src.playbackRate.value = o.rate;
    } else {
      src = c.createOscillator();
      if (A.waves[o.type]) src.setPeriodicWave(A.waves[o.type]);
      else src.type = o.type || 'sine';
      src.frequency.value = o.f || 110;
    }
    let node = src;
    let fl = null;
    if (o.lp || o.hp || o.bp) {
      fl = c.createBiquadFilter();
      fl.type = o.lp ? 'lowpass' : o.hp ? 'highpass' : 'bandpass';
      fl.frequency.value = o.lp || o.hp || o.bp;
      fl.Q.value = o.q || 0.7;
      node.connect(fl);
      node = fl;
    }
    node.connect(g);
    let last = g;
    if (o.pan) {
      const p = c.createStereoPanner();
      p.pan.value = o.pan;
      g.connect(p);
      last = p;
    }
    last.connect(outFor(o));
    sends(last, o);
    src.start();
    const h = {
      src, g, fl, alive: true,
      set(v, time = 0.2) {
        if (!h.alive) return;
        g.gain.setTargetAtTime(Math.max(0.0001, v), c.currentTime, time / 3);
      },
      freq(f, time = 0.1) {
        if (h.alive && src.frequency) src.frequency.setTargetAtTime(f, c.currentTime, time / 3);
      },
      filter(f, time = 0.1) {
        if (h.alive && fl) fl.frequency.setTargetAtTime(f, c.currentTime, time / 3);
      },
      rate(r, time = 0.1) {
        if (h.alive && src.playbackRate) src.playbackRate.setTargetAtTime(r, c.currentTime, time / 3);
      },
      stop(fade = 0.3) {
        if (!h.alive) return;
        h.alive = false;
        g.gain.setTargetAtTime(0.0001, c.currentTime, fade / 3);
        try {
          src.stop(c.currentTime + fade + 0.1);
        } catch (e) {}
        A.loops.delete(h);
      },
    };
    A.loops.add(h);
    if (o.v) h.set(o.v, o.fadeIn || 0.3);
    return h;
  };

  A.stopAllLoops = (fade = 0.3) => {
    for (const h of [...A.loops]) h.stop(fade);
  };

  document.addEventListener('visibilitychange', () => {
    if (!A.ctx) return;
    if (document.hidden) A.ctx.suspend();
    else A.ctx.resume();
  });
  G.bus.on('gesture', () => A.init());

  return A;
})();
