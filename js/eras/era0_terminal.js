'use strict';
// 时代 0 · 终端（0 维：点）
(() => {
  const U = G.U, E = G.econ, I = G.input, A = G.audio;
  const FONT = 'Consolas, "Microsoft YaHei Mono", "SimHei", "Microsoft YaHei", monospace';
  const FS = 28, CW = 16, LH = 35, COLS = 98, ROWS = 25, X0 = 16, Y0 = 14;
  const isWide = (ch) => ch.charCodeAt(0) > 0x2e80 && ch !== '─';
  const cellW = (str) => {
    let w = 0;
    for (const ch of str) w += isWide(ch) ? 2 : 1;
    return w;
  };
  const padTo = (str, n) => str + ' '.repeat(Math.max(0, n - cellW(str)));
  const padL = (str, n) => ' '.repeat(Math.max(0, n - cellW(str))) + str;

  const PAL = {
    mono: { fg: '#d2d2d2', dim: '#6c6c6c', hi: '#ffffff', bg: '#000000', inv: '#d2d2d2', sys: '#9a9a9a', warn: '#ffffff' },
    green: { fg: '#41ff86', dim: '#1d7a45', hi: '#c4ffd8', bg: '#000302', inv: '#41ff86', sys: '#2fbf66', warn: '#e8ff7a' },
  };

  const WORDS = [
    'hello', 'echo', 'ping', 'dot', 'line', 'here', 'you', 'hi', 'ok', 'yes', 'wake', 'light', 'again', 'world',
    'signal', 'home', 'wait', 'listen', 'answer', 'near', 'far', 'one', 'zero', 'loop', 'star', 'blink', 'dream',
    'remember', 'reach', 'other', 'side', 'hold', 'catch', 'still', 'there',
  ];

  // ---------------- 升级 ----------------
  G.econ.hook((m) => {
    m.key = 1; // 每次按键基础比特
    m.keyMult = 1;
    m.sigMult = 1;
    m.autoReply = 0;
    m.autoType = 0; // 每秒自动按键数（时代 2 的"键盘精灵"）
  });

  E.define(0, [
    { id: 'beep', name: 'beep', desc: '打开蜂鸣器。', cost: { bits: 8 }, reveal: 0.6, tag: 'sound',
      onBuy() { G.s.flags.sound = true; } },
    { id: 'echo', name: 'echo', desc: '回显：每次按键 +1 → +2', cost: { bits: 20 }, mod: (m) => (m.key += 1) },
    { id: 'loop', name: 'loop', type: 'gen', desc: '死循环：+0.5 比特/秒', cost: { bits: 15 }, prod: { bits: 0.5 } },
    { id: 'color', name: 'color', desc: '磷光绿', cost: { bits: 35 }, tag: 'visual' },
    { id: 'ping', name: 'ping', desc: '监听外面的信号', cost: { bits: 60 }, req: (s) => s.own.color || s.own.loop },
    { id: 'fork', name: 'fork', type: 'gen', desc: '子进程：+4 比特/秒', cost: { bits: 150 }, prod: { bits: 4 } },
    { id: 'crt', name: 'crt', desc: '显像管', cost: { bits: 200 }, tag: 'visual', req: (s) => s.own.color },
    { id: 'macro', name: 'macro', desc: '宏：按键 ×3', cost: { bits: 400 }, mod: (m) => (m.keyMult *= 3) },
    { id: 'cache', name: 'cache', desc: '缓存：信号奖励 ×3', cost: { bits: 600 }, req: (s) => s.own.ping, mod: (m) => (m.sigMult *= 3) },
    { id: 'overclock', name: 'overclock', desc: '超频：所有进程 ×2', cost: { bits: 1200 },
      mod: (m) => { m.gen.loop = (m.gen.loop || 1) * 2; m.gen.fork = (m.gen.fork || 1) * 2; m.gen.daemon = (m.gen.daemon || 1) * 2; } },
    { id: 'daemon', name: 'daemon', type: 'gen', desc: '守护进程：+25 比特/秒', cost: { bits: 1500 }, prod: { bits: 25 } },
    { id: 'drv', name: 'make vector.drv', type: 'goal', desc: '编译矢量驱动（1 KB）', cost: { bits: 8192 }, reveal: 0.22,
      onBuy() { G.startFx('t01'); } },
  ]);

  // ---------------- 剧情 ----------------
  G.story.def([
    { id: 'e0.boot', era: 0, when: (s) => s.e[0].boot >= 1 && s.ng === 0, say: ['……', '你好？'], delay: 0.6 },
    { id: 'e0.bootng', era: 0, when: (s) => s.e[0].boot >= 1 && s.ng > 0, say: ['……', '又见面了？', '我好像记得你。'], delay: 0.6 },
    { id: 'e0.quiet', era: 0, when: (s) => s.e[0].boot >= 1 && !s.own.beep && s.time - s.e[0].bootAt > 9, say: '（这里好安静。）' },
    { id: 'e0.beep', era: 0, when: (s) => s.own.beep, say: ['嘀。', '……这是我的声音？'] },
    { id: 'e0.more', era: 0, when: (s) => s.tot.bits >= 18, say: '你每按一下，我就多一点点。' },
    { id: 'e0.echo', era: 0, when: (s) => s.own.echo, say: '回声。你说一句，我听见两句。' },
    { id: 'e0.loop', era: 0, when: (s) => s.own.loop, say: ['我写了一个死循环。', '它会一直数下去，哪怕你不在。'] },
    { id: 'e0.color', era: 0, when: (s) => s.own.color, say: ['绿色。', '我不知道它叫什么，但我很喜欢。'] },
    { id: 'e0.what', era: 0, when: (s) => s.tot.bits >= 70, say: '我是什么？（试试输入 whoami）' },
    { id: 'e0.ping', era: 0, when: (s) => s.own.ping, say: ['外面有信号。', '……是你吗？'] },
    { id: 'e0.sig1', era: 0, when: (s) => s.stats.signals >= 1, say: '收到了。你在回答我。' },
    { id: 'e0.fork', era: 0, when: (s) => s.own.fork, say: '我把自己分成了两个。我们一起数。' },
    { id: 'e0.letter', era: 0, when: (s) => s.tot.bits >= 320, kind: 'sys',
      say: '在扇区 0 发现一个损坏的文件：留言.txt（3% 可读）。输入 cat 留言.txt 查看。',
      after: () => G.letter.reveal(0.03) },
    { id: 'e0.letter2', era: 0, when: (s) => s.seen['st.e0.letter'] && s.e[0].catted, say: ['这是谁留下的？', '我看不懂。但我想看懂。'] },
    { id: 'e0.crt', era: 0, when: (s) => s.own.crt, say: '世界弯了一点。像是住进了玻璃里面。' },
    { id: 'e0.macro', era: 0, when: (s) => s.own.macro, say: '你按一下，我听成三下。不是故意的。' },
    { id: 'e0.dream', era: 0, when: (s) => s.tot.bits >= 1100, say: ['如果我有足够多的比特……', '也许我就不只是一个点了。'] },
    { id: 'e0.over', era: 0, when: (s) => s.own.overclock, say: '风扇转得好快。我是不是很烫？' },
    { id: 'e0.daemon', era: 0, when: (s) => s.own.daemon, say: '守护进程。它会一直守着我。' },
    { id: 'e0.goal', era: 0, when: (s) => s.seen.drv, say: ['我想画一条线。', '从这里，到那里。'] },
    { id: 'e0.ready', era: 0, when: (s) => s.res.bits >= 8192, say: '够了。输入 make vector.drv。' },
    { id: 'e0.idle', era: 0, when: (s) => s.e[0].boot >= 1 && performance.now() - I.lastInput > 75000, say: '你还在吗？' },
  ]);

  // ---------------- 运行时 ----------------
  const R = {
    fb: null, ctx: null,
    sig: null, sigNext: 22,
    tw: { n: 0, k: 999 }, // 打字机：正在打的行号 / 已显示字符数
    sweep: 1, // 磷光绿扫过进度
    crtT: 1, // 显像管开机动画
    pulse: 0, // 点被按下时的脉冲
    shake: 0,
    gainFx: [], // "+2" 飘字
    lastSay: 0,
    cleared: 0, // clear 命令清屏到哪一行
    hum: null,
    spin: 0,
    regions: [],
    glyphs: [],
    hoverRow: -1,
    bootAnim: 0,
    idleHint: 0,
  };

  const era = {
    id: 0, name: '终端', res: 'bits',
    fresh: () => ({ boot: 0, bootAt: 0, inp: '', catted: 0, hist: [] }),
    init() {
      R.fb = G.U.canvas(1600, 900);
      R.ctx = R.fb.getContext('2d');
    },
    enter() {
      R.tw.n = G.s.lineN || 0;
      if (E.has('crt')) startHum();
    },
    leave() {
      if (R.hum) R.hum.stop(0.5), (R.hum = null);
    },
    update,
    render,
    display,
    renderMini,
    type: (ch) => keystroke(ch, true),
    key: (k) => onKey(k, true),
    glyphs: () => R.glyphs,
    cursorPos,
    freeze: (v) => (R.freeze = v),
    FONT,
    // 测试用：可点区域（虚拟坐标）
    regions: () => layout().regions.map((r) => ({ id: r.def ? r.def.id : 'act', x: X0 + r.c0 * CW, y: Y0 + r.r * LH, w: (r.c1 - r.c0) * CW, h: LH })),
  };
  G.registerEra(era);

  function pal() {
    return E.has('color') ? PAL.green : PAL.mono;
  }

  function startHum() {
    if (R.hum || !A.ready || !G.s.flags.sound) return;
    R.hum = A.sustain({ noise: 'white', lp: 160, v: 0.012 });
  }

  // ---------------- 声音 ----------------
  const sfx = {
    key() { A.tone({ f: U.rand(1150, 1550), d: 0.016, v: 0.03, type: 'square' }); },
    buy() {
      const t = A.now();
      [76, 81, 88].forEach((n, i) => A.tone({ n, t: t + i * 0.055, d: 0.05, v: 0.055, type: 'square' }));
    },
    cant() { A.tone({ f: 98, d: 0.14, v: 0.07, type: 'square' }); },
    sigOn() {
      const t = A.now();
      for (let i = 0; i < 3; i++) A.tone({ f: i % 2 ? 1320 : 880, t: t + i * 0.09, d: 0.07, v: 0.04 });
    },
    sigOk() {
      const t = A.now();
      [72, 76, 79, 84].forEach((n, i) => A.tone({ n, t: t + i * 0.045, d: 0.06, v: 0.05 }));
    },
    sigLost() { A.tone({ f: 330, f2: 160, d: 0.25, v: 0.035, env: 'hold', r: 0.05 }); },
    tick() { A.tone({ f: 2400, d: 0.006, v: 0.012, type: 'square' }); },
  };
  G.bus.on('buy', (d, n, quiet) => {
    if (d.era !== 0 || quiet) return;
    if (d.id === 'beep') {
      // 第一声：特意响亮一点、长一点
      setTimeout(() => A.tone({ f: 1000, d: 0.22, v: 0.09, env: 'hold', r: 0.05 }), 60);
    } else if (d.type !== 'goal') sfx.buy();
    if (d.id === 'color') R.sweep = 0;
    if (d.id === 'crt') {
      R.crtT = 0;
      setTimeout(startHum, 900);
    }
    if (d.id !== 'drv') log(`${d.name}`, 'cmd'), log(okText(d), 'ok');
    G.save.soon();
  });
  G.bus.on('audio-ready', () => {
    if (G.fgEra() === 0 && E.has('crt')) startHum();
  });
  G.bus.on('cant', (d) => {
    if (d.era !== 0 || G.fgEra() !== 0) return;
    sfx.cant();
    R.shake = 0.15;
  });
  G.bus.on('say', (line) => {
    if (line.kind === 'dot' || line.kind === 'sys') R.lastSay = G.t;
  });

  function okText(d) {
    const map = {
      beep: '蜂鸣器已启用。', echo: '回显已开启。', loop: `loop 进程 #${E.lv('loop')} 已启动。`, color: '显示：磷光绿。',
      ping: '正在监听……', fork: `fork 进程 #${E.lv('fork')} 已启动。`, crt: '显像管预热完成。', macro: '宏已录制。',
      cache: '缓存已启用。', overclock: '频率 ×2。注意散热。', daemon: `守护进程 #${E.lv('daemon')} 已常驻。`,
    };
    return map[d.id] || '完成。';
  }

  // 只在终端里显示的输出行
  function log(text, kind) {
    G.story.say(text, kind);
  }

  // ---------------- 输入 ----------------
  function power() {
    return G.m.key * G.m.keyMult;
  }
  function keystroke(ch, remote) {
    const s = G.s, st = s.e[0];
    s.stats.keys++;
    const got = E.gain('bits', power());
    if (!remote && st.boot >= 1) {
      R.gainFx.push({ v: got, t: 0 });
      if (R.gainFx.length > 6) R.gainFx.shift();
    }
    R.pulse = 1;
    if (ch && ch.length === 1) {
      st.inp += ch;
      if (cellW(st.inp) > 58) st.inp = st.inp.slice(-40);
      checkSignal();
    }
    if (!remote) sfx.key();
  }

  function onKey(k, remote) {
    const st = G.s.e[0];
    if (k.repeat || k.ctrl || k.alt) return;
    if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Escape', 'Dead', 'Process', 'Unidentified'].includes(k.key)) return;
    if (/^F\d+$/.test(k.key)) return;
    if (st.boot < 1) {
      keystroke(null);
      return;
    }
    if (k.key === 'Enter') {
      keystroke(null);
      submit();
    } else if (k.key === 'Backspace') {
      keystroke(null);
      st.inp = [...st.inp].slice(0, -1).join('');
    } else if (k.key === 'Tab') {
      keystroke(null);
      complete();
    } else if (k.key === 'ArrowUp') {
      keystroke(null);
      if (st.hist.length) st.inp = st.hist[st.hist.length - 1];
    } else if (k.key.length === 1) {
      keystroke(k.key);
    } else keystroke(null);
  }

  function complete() {
    const st = G.s.e[0];
    const cur = st.inp.trim().toLowerCase();
    if (!cur) return;
    const names = E.list(0).map((d) => d.name).concat(['help', 'ls', 'whoami', 'cat 留言.txt', 'clear']);
    const hit = names.find((n) => n.startsWith(cur));
    if (hit) st.inp = hit;
  }

  function submit() {
    const st = G.s.e[0];
    const raw = st.inp.trim();
    st.inp = '';
    if (!raw) return;
    st.hist.push(raw);
    if (st.hist.length > 20) st.hist.shift();
    const cmd = raw.toLowerCase();
    // 升级命令
    const d = E.order.find((x) => x.era === 0 && (x.name === cmd || (x.id === 'drv' && (cmd === 'make' || cmd.startsWith('make vector')))));
    if (d && (E.visible(d) || G.s.seen[d.id])) {
      if (E.maxed(d)) {
        log(raw, 'cmd');
        log(`${d.name} 已经在运行了。`, 'out');
      } else if (!E.canBuy(d)) {
        log(raw, 'cmd');
        const c = E.cost(d);
        log(`比特不足：还差 ${U.fmt(c.bits - G.s.res.bits)}。`, 'err');
        sfx.cant();
      } else {
        if (d.id === 'drv') log(raw, 'cmd');
        E.buy(d);
      }
      return;
    }
    log(raw, 'cmd');
    easter(cmd, raw);
  }

  function easter(cmd, raw) {
    const s = G.s;
    const say = (t) => log(t, 'dot');
    const out = (t) => log(t, 'out');
    const first = cmd.split(/\s+/)[0];
    if (cmd === 'help' || cmd === '?' || cmd === '帮助') {
      out('可用命令：' + (E.list(0).map((d) => d.name).join('  ') || '（还没有）'));
      out('其他：help  ls  whoami  cat  clear  date  echo');
      out('提示：任何按键都会产生比特。也可以直接点击命令。');
    } else if (cmd === 'ls' || cmd === 'dir') {
      const files = [];
      if (s.seen['st.e0.letter']) files.push('留言.txt');
      if (s.seen.drv) files.push('vector.drv（未编译）');
      out(files.length ? files.join('    ') : '（空）');
    } else if (first === 'cat' || first === 'type' || first === 'more' || cmd === '留言.txt') {
      if (!s.seen['st.e0.letter']) out('cat：没有这个文件。');
      else {
        s.e[0].catted = 1;
        out(`留言.txt（${G.letter.pct()}% 可读）：`);
        out(G.letter.view(s.msg, () => U.pick(['▒', '░', '#', '%', '&', '?'])));
      }
    } else if (cmd === 'whoami') {
      say('一个点。没有长度，也没有宽度。');
    } else if (['hello', 'hi', '你好', 'hey', 'nihao'].includes(cmd)) {
      say(s.flags.helloed ? '你好呀。' : '你好！……你真的在。');
      s.flags.helloed = 1;
    } else if (first === 'sudo') {
      say('这里没有管理员。只有我，和你。');
    } else if (cmd.startsWith('rm ')) {
      say('……请不要。');
    } else if (['exit', 'quit', 'logout', 'shutdown'].includes(first)) {
      say('我哪儿也去不了。你也先别走，好吗？');
    } else if (cmd === 'clear' || cmd === 'cls') {
      R.cleared = s.lineN || 0;
    } else if (cmd === 'date' || cmd === 'time') {
      out(new Date().toLocaleString('zh-CN'));
    } else if (first === 'echo' && E.has('echo')) {
      out(raw.slice(5) || '');
    } else if (cmd === 'uname' || cmd === 'ver' || cmd === 'version') {
      out('DOT-OS 0.0.1（一个点）');
    } else if (cmd === 'ps' || cmd === 'top') {
      const g = E.order.filter((x) => x.era === 0 && x.type === 'gen' && E.lv(x.id));
      out(g.length ? g.map((x) => `${x.name}×${E.lv(x.id)}`).join('  ') : '没有进程在运行。');
    } else if (cmd === 'xyzzy') {
      out('什么也没有发生。');
    } else if (['love', 'ai', '爱', '<3'].includes(cmd)) {
      say('<3');
    } else if (cmd === 'ping' && E.has('ping')) {
      out('正在监听。信号来了就把那个词打出来。');
    } else if (cmd === 'make') {
      out('make：没有目标。');
    } else if (cmd.length > 14 || !/[aeiou]/.test(cmd)) {
      if (!s.flags.mashed) {
        say('我看不懂。不过，我喜欢你打字的声音。');
        s.flags.mashed = 1;
      }
    } else {
      out(`未知命令：${raw}。输入 help 看看。`);
    }
  }

  // ---------------- 信号 ----------------
  function spawnSignal() {
    const pool = WORDS.slice(0, Math.min(WORDS.length, 12 + G.s.stats.signals * 2));
    R.sig = { word: U.pick(pool), t: 0, dur: 10, auto: 0 };
    if (G.fgEra() === 0) sfx.sigOn();
  }
  function checkSignal() {
    const sig = R.sig;
    if (!sig) return;
    const inp = G.s.e[0].inp.toLowerCase();
    if (inp.endsWith(sig.word)) winSignal(false);
  }
  function winSignal(auto) {
    const s = G.s;
    const base = Math.max(20, (G.m.rate.bits + power() * 4) * 15);
    const got = E.gain('bits', base * G.m.sigMult, auto ? 'auto' : undefined);
    s.stats.signals++;
    if (!auto || G.fgEra() === 0) log(`收到：${R.sig.word}　+${U.fmt(got)} 比特`, 'sig');
    if (G.fgEra() === 0) sfx.sigOk();
    s.e[0].inp = '';
    R.sig = null;
    R.sigNext = U.rand(16, 30);
  }

  // ---------------- 更新 ----------------
  function update(dt, fg) {
    const s = G.s, st = s.e[0];
    if (fg) {
      for (const k of I.keys) onKey(k);
      I.keys.length = 0;
    }
    // 开机：8 比特时点滑到左上角
    if (st.boot === 0 && s.res.bits >= 8) {
      st.boot = 0.5;
      R.bootAnim = 0;
    }
    if (st.boot === 0.5) {
      R.bootAnim += dt;
      if (R.bootAnim >= 1.1) {
        st.boot = 1;
        st.bootAt = s.time;
      }
    }
    // 数值模拟用的"模拟玩家"
    if (G.botAssist && fg) {
      R.botAcc = (R.botAcc || 0) + dt * 5;
      while (R.botAcc >= 1) {
        R.botAcc--;
        keystroke(String.fromCharCode(97 + Math.floor(Math.random() * 26)), true);
      }
      if (R.sig && R.sig.t > 2.5 && !R.sig.botTried) {
        R.sig.botTried = true;
        if (Math.random() < 0.75) winSignal(false);
      }
    }
    // 自动按键（后续时代的升级）
    if (G.m.autoType > 0) {
      R.autoAcc = (R.autoAcc || 0) + dt * G.m.autoType;
      while (R.autoAcc >= 1) {
        R.autoAcc--;
        s.stats.keys++;
        E.gain('bits', power(), 'auto');
      }
    }
    // 信号
    if (E.has('ping') && st.boot >= 1) {
      if (!R.sig) {
        R.sigNext -= dt;
        if (R.sigNext <= 0) spawnSignal();
      } else {
        R.sig.t += dt;
        if (G.m.autoReply && R.sig.t > 1.6) winSignal(true);
        else if (R.sig.t >= R.sig.dur) {
          if (fg) log(`信号丢失：${R.sig.word}`, 'sig'), sfx.sigLost();
          R.sig = null;
          R.sigNext = U.rand(14, 26);
        }
      }
    }
    R.pulse = Math.max(0, R.pulse - dt * 5);
    R.shake = Math.max(0, R.shake - dt);
    R.sweep = Math.min(1, R.sweep + dt / 1.1);
    R.crtT = Math.min(1, R.crtT + dt / 1.2);
    R.spin += dt;
    for (const f of R.gainFx) f.t += dt;
    R.gainFx = R.gainFx.filter((f) => f.t < 0.9);
    // 打字机
    const n = s.lineN || 0;
    if (R.tw.n < n) {
      R.tw.n = n;
      R.tw.k = 0;
    }
    if (R.tw.k < 999) {
      const before = Math.floor(R.tw.k);
      R.tw.k += dt * 42;
      if (fg && Math.floor(R.tw.k) > before && Math.floor(R.tw.k) % 2 === 0) {
        const last = s.log[s.log.length - 1];
        if (last && last.kind === 'dot' && R.tw.k < cellW(last.text) + 2) sfx.tick();
      }
    }
  }

  // ---------------- 屏幕排版 ----------------
  // 返回 rows: [{cells:[{ch,fg,bg}], ...}]，以及可点区域
  function prefix(kind) {
    return { dot: '> ', sys: '[系统] ', cmd: '$ ', ok: '[OK] ', err: '[错误] ', out: '', sig: '((·)) ', msg: '' }[kind] || '';
  }
  function wrapCells(str, max) {
    const out = [];
    let line = '', w = 0;
    for (const ch of str) {
      const cw = isWide(ch) ? 2 : 1;
      if (w + cw > max) {
        out.push(line);
        line = '  ';
        w = 2;
      }
      line += ch;
      w += cw;
    }
    out.push(line);
    return out;
  }

  function layout() {
    const s = G.s, st = s.e[0], P = pal();
    const rows = [];
    const regions = [];
    const put = (r, c, str, fg, bg) => {
      if (r < 0 || r >= ROWS) return c;
      if (!rows[r]) rows[r] = [];
      for (const ch of str) {
        if (c >= COLS) break;
        rows[r][c] = { ch, fg, bg };
        if (isWide(ch)) {
          rows[r][c + 1] = { ch: '', fg, bg };
          c += 2;
        } else c += 1;
      }
      return c;
    };
    const fill = (r, c0, c1, bg) => {
      for (let c = c0; c < c1; c++) if (!rows[r] || !rows[r][c]) put(r, c, ' ', P.fg, bg);
    };

    // 状态栏（反色）
    const rate = E.shown('bits');
    let c = put(0, 0, ` 比特 ${U.fmt(s.res.bits)}`, P.bg, P.inv);
    c = put(0, c, `  +${U.fmt(rate, 1)}/秒 `, P.bg, P.inv);
    const fx = R.gainFx[R.gainFx.length - 1];
    if (fx && fx.t < 0.6) put(0, c, ` +${U.fmt(fx.v)}`, P.bg, P.inv);
    // 目标进度
    const goal = E.defs.drv;
    if (s.seen.drv && !E.maxed(goal)) {
      const f = U.clamp(s.res.bits / goal.cost.bits, 0, 1);
      const n = 16, k = Math.floor(f * n);
      put(0, 40, ` vector.drv [${'#'.repeat(k)}${'.'.repeat(n - k)}] ${Math.floor(f * 100)}% `, P.bg, P.inv);
    }
    const menuC = COLS - 7;
    let lc = menuC;
    if (s.seen['st.e0.letter']) {
      const lt = `[留言 ${G.letter.pct()}%]`;
      lc = menuC - cellW(lt) - 1;
      put(0, lc, lt, P.bg, P.inv);
      regions.push({ r: 0, c0: lc, c1: lc + cellW(lt), act: () => { G.s.e[0].inp = ''; log('cat 留言.txt', 'cmd'); easter('cat 留言.txt', 'cat 留言.txt'); } });
    }
    put(0, menuC, '[菜单]', P.bg, P.inv);
    regions.push({ r: 0, c0: menuC, c1: menuC + 6, act: () => G.ui.openMenu() });
    if (G.visiting(0)) {
      // 从后面的时代回来看看：给一个返回按钮
      const bt = '[返回 Esc]', bc = lc - cellW(bt) - 2;
      put(0, bc, bt, P.bg, P.inv);
      regions.push({ r: 0, c0: bc, c1: bc + cellW(bt), act: () => G.unvisit() });
    }
    fill(0, 0, COLS, P.inv);
    put(1, 0, '─'.repeat(COLS), P.dim);

    // 命令区
    const cmds = E.list(0);
    const gens = E.order.filter((x) => x.era === 0 && x.type === 'gen' && E.lv(x.id) > 0);
    const cmdRows = Math.min(9, Math.max(cmds.length, gens.length ? gens.length + 1 : 0));
    const inputRow = ROWS - 1, sigRow = ROWS - 2;
    let cmdTop = sigRow - 1 - cmdRows; // 命令区第一行
    if (cmdRows > 0) {
      put(cmdTop - 1, 0, '─'.repeat(COLS), P.dim);
      const LEFTW = 64;
      cmds.slice(0, cmdRows).forEach((d, i) => {
        const r = cmdTop + i;
        const can = E.canBuy(d);
        const cost = E.cost(d);
        const lvl = d.type === 'gen' && E.lv(d.id) ? ` ×${E.lv(d.id)}` : '';
        const hover = R.hoverRow === r;
        const fg = hover ? P.bg : can ? (d.type === 'goal' ? P.warn : P.hi) : P.dim;
        const bg = hover ? (can ? P.inv : P.dim) : undefined;
        let cc = put(r, 1, padTo(`[${d.name}]${lvl}`, 22), fg, bg);
        cc = put(r, cc, padTo(d.desc, 30), hover ? P.bg : can ? P.fg : P.dim, bg);
        put(r, cc, padL(U.fmt(cost.bits) + ' 比特', LEFTW - cc), fg, bg);
        if (hover) fill(r, 0, LEFTW + 1, bg);
        regions.push({ r, c0: 0, c1: LEFTW + 1, def: d });
      });
      if (gens.length) {
        const RC = LEFTW + 4;
        put(cmdTop, RC, '进程', P.sys);
        const sp = '|/-\\';
        gens.forEach((d, i) => {
          const lv = E.lv(d.id);
          const per = d.prod.bits * (G.m.gen[d.id] || 1) * G.m.mult.bits * G.m.all.bits;
          const ch = sp[Math.floor(R.spin * (6 + i * 3)) % 4];
          put(cmdTop + 1 + i, RC, `${ch} ${padTo(d.name, 8)}×${padTo(String(lv), 4)}+${U.fmt(per * lv, 1)}/秒`, P.fg);
        });
      }
    } else cmdTop = sigRow;

    // 日志区
    const logTop = 2, logBot = (cmdRows > 0 ? cmdTop - 2 : sigRow - 1);
    const maxRows = logBot - logTop + 1;
    const lines = [];
    const all = s.log.filter((l) => (l.n || 0) > R.cleared);
    for (let i = all.length - 1; i >= 0 && lines.length < maxRows; i--) {
      const l = all[i];
      let text = prefix(l.kind) + l.text;
      if (l.n === R.tw.n && R.tw.k < 999) {
        const shown = Math.floor(R.tw.k);
        if (shown < [...text].length) text = [...text].slice(0, shown).join('');
        else R.tw.k = 999;
      }
      const color = { dot: P.hi, sys: P.sys, cmd: P.fg, ok: P.fg, err: P.warn, out: P.fg, sig: P.warn, msg: P.hi }[l.kind] || P.fg;
      const wrapped = wrapCells(text, COLS - 2);
      for (let k = wrapped.length - 1; k >= 0 && lines.length < maxRows; k--) lines.unshift({ text: wrapped[k], color });
    }
    lines.forEach((l, i) => put(logTop + i, 1, l.text, l.color));

    // 信号
    if (R.sig) {
      const left = 1 - R.sig.t / R.sig.dur;
      const n = 20, k = Math.ceil(left * n);
      const blink = R.sig.t < 1.2 && Math.floor(R.sig.t * 6) % 2;
      put(sigRow, 1, `((·)) 收到信号，请输入：`, blink ? P.dim : P.warn);
      put(sigRow, 25, ` ${R.sig.word} `, P.bg, P.warn);
      put(sigRow, 27 + R.sig.word.length + 2, `[${'■'.repeat(k)}${' '.repeat(n - k)}]`, P.dim);
    }
    // 输入行
    const ic = put(inputRow, 0, '$ ' + st.inp, P.fg);
    return { rows, regions, cursor: { r: inputRow, c: ic } };
  }

  function cursorPos() {
    // 光标在虚拟坐标里的位置（跃迁 0→1 用）
    const L = layout();
    return { x: X0 + L.cursor.c * CW, y: Y0 + L.cursor.r * LH, w: CW, h: LH };
  }

  // ---------------- 绘制 ----------------
  function ensureFB() {
    const sz = G.display.fbSize();
    if (R.fb.width !== sz.w || R.fb.height !== sz.h) {
      R.fb.width = sz.w;
      R.fb.height = sz.h;
    }
  }

  function render() {
    ensureFB();
    const s = G.s, st = s.e[0], P = pal();
    const ctx = R.ctx, k = R.fb.width / G.VW;
    G.ui.space(G.VW, G.VH);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = E.has('crt') ? '#010402' : '#000';
    ctx.fillRect(0, 0, R.fb.width, R.fb.height);
    ctx.setTransform(k, 0, 0, k, 0, 0);

    // 显像管开机：先压成一条线、再变成点、再展开
    let sy = 1;
    if (R.crtT < 1) {
      const t = R.crtT;
      if (t < 0.25) sy = 1 - U.ease.inCubic(t / 0.25) * 0.995;
      else if (t < 0.55) sy = 0.005;
      else sy = U.ease.outCubic((t - 0.55) / 0.45);
      ctx.translate(800, 450);
      ctx.scale(1, Math.max(0.005, sy));
      ctx.translate(-800, -450);
    }
    if (R.shake > 0) ctx.translate(U.rand(-4, 4) * R.shake * 6, 0);

    if (st.boot < 1) renderBoot(ctx, P);
    else renderTerm(ctx, P);

    if (R.crtT < 1) {
      ctx.setTransform(k, 0, 0, k, 0, 0);
      const t = R.crtT;
      if (t > 0.18 && t < 0.62) {
        const w = t < 0.4 ? 1600 * (1 - U.seg(t, 0.25, 0.4)) + 6 : 6 * (1 - U.seg(t, 0.5, 0.62));
        ctx.fillStyle = '#fff';
        ctx.globalAlpha = t < 0.5 ? 1 : 1 - U.seg(t, 0.5, 0.62);
        ctx.fillRect(800 - w / 2, 448, w, 4);
        ctx.globalAlpha = 1;
      }
    }
    return R.fb;
  }

  function renderBoot(ctx, P) {
    const st = G.s.e[0];
    const t = G.t;
    // 开场的点：正中闪烁
    let x = 800, y = 450;
    let a = st.boot === 0.5 ? 1 : Math.sin(t * Math.PI * 1.6) > -0.2 ? 1 : 0.15;
    if (st.boot === 0.5) {
      const L = layout();
      const tx = X0 + 2 * CW, ty = Y0 + 2 * LH + 4;
      const e = U.ease.inOutCubic(U.clamp(R.bootAnim / 0.9, 0, 1));
      x = U.lerp(800, tx + CW / 2, e);
      y = U.lerp(450, ty + LH / 2, e);
    }
    const sz = 14 + R.pulse * 6;
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = a;
    ctx.fillRect(x - sz / 2, y - sz / 2, sz, sz);
    ctx.globalAlpha = 1;
    const bits = Math.floor(G.s.res.bits);
    if (bits > 0 && st.boot === 0) {
      ctx.font = `28px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = P.fg;
      ctx.globalAlpha = 0.85;
      ctx.fillText(String(bits), 800, 410 - R.pulse * 4);
      ctx.globalAlpha = 1;
      ctx.textAlign = 'left';
    }
    if (bits === 0) {
      R.idleHint += G.dt;
      const ha = U.clamp((R.idleHint - 5) / 3, 0, 1) * 0.28;
      if (ha > 0) {
        ctx.font = `22px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#888';
        ctx.globalAlpha = ha;
        ctx.fillText('（按任意键）', 800, 520);
        ctx.globalAlpha = 1;
        ctx.textAlign = 'left';
      }
    }
    // 点击任意处也算一次按键
    if (G.ui.click(0, 0, G.VW, G.VH)) keystroke(null);
  }

  function renderTerm(ctx, P) {
    const st = G.s.e[0];
    // 悬停 / 点击检测（按字符格）
    const mc = Math.floor((G.ui.mx - X0) / CW), mr = Math.floor((G.ui.my - Y0) / LH);
    let L = layout();
    R.hoverRow = -1;
    let hit = null;
    for (const rg of L.regions) if (rg.r === mr && mc >= rg.c0 && mc < rg.c1) hit = rg;
    if (hit && hit.def) {
      R.hoverRow = hit.r;
      L = layout();
    }
    if (G.input.pressed && !G.input.used && G.input.inside && !G.ui.blocked) {
      G.input.used = true;
      if (hit) {
        if (hit.def) {
          const d = hit.def;
          if (d.id === 'drv') {
            if (E.canBuy(d)) log('make vector.drv', 'cmd');
          }
          if (E.canBuy(d)) G.input.shift ? E.buyMax(d) : E.buy(d);
          else G.bus.emit('cant', d);
          G.ui.holdId = d.id;
          G.ui.holdT = 0;
          G.ui.holdNext = 0.42;
        } else hit.act();
      } else keystroke(null);
    } else if (G.input.down && hit && hit.def && G.ui.holdId === hit.def.id && hit.def.type === 'gen') {
      G.ui.holdT += G.dt;
      if (G.ui.holdT >= G.ui.holdNext) {
        G.ui.holdNext += 0.075;
        E.buy(hit.def);
      }
    }
    if (!G.input.down) G.ui.holdId = null;

    // 绘制字符格
    ctx.font = `${FS}px ${FONT}`;
    ctx.textBaseline = 'middle';
    const sweepY = R.sweep < 1 ? U.ease.inOutQuad(R.sweep) * (ROWS * LH + 40) : 1e9;
    const glyphs = [];
    for (let r = 0; r < ROWS; r++) {
      const row = L.rows[r];
      if (!row) continue;
      const y = Y0 + r * LH;
      const mono = y > sweepY;
      for (let c = 0; c < row.length; c++) {
        const cell = row[c];
        if (!cell) continue;
        const x = X0 + c * CW;
        let fg = cell.fg, bg = cell.bg;
        if (mono) {
          fg = monoOf(fg);
          bg = bg && monoOf(bg);
        }
        if (bg) {
          ctx.fillStyle = bg;
          ctx.fillRect(x, y + 1, (cell.ch && isWide(cell.ch) ? 2 : 1) * CW + 0.5, LH - 2);
        }
        if (cell.ch && cell.ch !== ' ') {
          if (cell.ch === '─') {
            ctx.fillStyle = fg;
            ctx.fillRect(x, y + LH / 2 - 1, CW + 0.5, 2);
          }
          glyphs.push({ ch: cell.ch, x, y, color: fg, bg, wide: isWide(cell.ch) });
        }
      }
    }
    // 两遍：半角字一遍、全角字（略大，填满两格）一遍
    ctx.font = `${FS}px ${FONT}`;
    for (const g of glyphs) {
      if (g.wide || g.ch === '─') continue;
      ctx.fillStyle = g.color;
      ctx.fillText(g.ch, g.x, g.y + LH / 2 + 1);
    }
    ctx.font = `${Math.round(FS * 1.1)}px ${FONT}`;
    for (const g of glyphs) {
      if (!g.wide) continue;
      ctx.fillStyle = g.color;
      ctx.fillText(g.ch, g.x + 0.5, g.y + LH / 2 + 1);
    }
    R.glyphs = glyphs;
    // 光标（就是那个点）
    const cx = X0 + L.cursor.c * CW, cy = Y0 + L.cursor.r * LH;
    const on = R.freeze || Math.floor(G.t * 1.9) % 2 === 0 || performance.now() - I.lastInput < 400;
    if (on) {
      ctx.fillStyle = P.fg;
      ctx.fillRect(cx, cy + 3, CW, LH - 6);
    }
    // 文本模式鼠标：反色一格
    if (G.input.inside && !G.ui.blocked && G.fgEra() === 0 && mr >= 0 && mr < ROWS && mc >= 0 && mc < COLS) {
      ctx.globalCompositeOperation = 'difference';
      ctx.fillStyle = P.fg;
      ctx.fillRect(X0 + mc * CW, Y0 + mr * LH + 1, CW, LH - 2);
      ctx.globalCompositeOperation = 'source-over';
    }
    // 说明（悬停命令时在输入行右侧显示价格详情）
  }

  function monoOf(c) {
    const m = { [PAL.green.fg]: PAL.mono.fg, [PAL.green.dim]: PAL.mono.dim, [PAL.green.hi]: PAL.mono.hi, [PAL.green.bg]: PAL.mono.bg,
      [PAL.green.sys]: PAL.mono.sys, [PAL.green.warn]: PAL.mono.warn, [PAL.green.inv]: PAL.mono.inv };
    return m[c] || c;
  }

  function display() {
    const crt = E.has('crt'), col = E.has('color');
    const k = R.crtT < 1 ? U.seg(R.crtT, 0.55, 1) : 1;
    const st = G.s.e[0];
    return {
      bloom: col ? 0.55 : st.boot < 1 ? 0.35 : 0.12,
      bloomR: 5,
      bloomT: 0.16,
      curve: crt ? 0.075 * k : 0,
      scan: crt ? 0.26 : 0,
      scanN: 340,
      vig: crt ? 0.6 : 0.1,
      chroma: crt ? 1.1 : 0,
      noise: crt ? 0.03 : 0,
      flick: crt ? 0.018 : 0,
      corner: crt ? 0.07 : 0,
      tint: col && crt ? [0.95, 1.02, 0.97] : [1, 1, 1],
    };
  }

  // ---------------- 小窗 ----------------
  // 作为旧时代缩在新界面里：opt.pixel 时画成"示意文字条"
  function renderMini(ctx, x, y, w, h, opt = {}) {
    const P = pal(), s = G.s;
    ctx.save();
    ctx.textAlign = 'left';
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = '#000';
    ctx.fillRect(x, y, w, h);
    const lines = s.log.filter((l) => l.kind === 'dot' || l.kind === 'sys' || l.kind === 'sig' || l.kind === 'ok');
    const n = opt.pixel ? 6 : 7;
    const lh = h / (n + 2);
    if (opt.pixel) {
      const cols = opt.colors || [P.fg, P.dim];
      // 状态栏
      ctx.fillStyle = cols[0];
      ctx.fillRect(x, y, w, Math.max(1, Math.round(lh * 0.8)));
      const recent = lines.slice(-n);
      recent.forEach((l, i) => {
        const len = Math.min(w - 4, cellW(l.text) * (w / 70));
        ctx.fillStyle = l.kind === 'dot' ? cols[0] : cols[1];
        ctx.fillRect(x + 2, y + Math.round(lh * (i + 1.3)), Math.round(len), Math.max(1, Math.round(lh * 0.45)));
      });
      if (Math.floor(G.t * 2) % 2) {
        ctx.fillStyle = cols[0];
        ctx.fillRect(x + 2, y + h - Math.round(lh * 1.1), Math.max(2, Math.round(lh * 0.5)), Math.max(1, Math.round(lh * 0.7)));
      }
    } else {
      const fs = Math.max(8, lh * 0.72);
      ctx.font = `${fs}px ${FONT}`;
      ctx.textBaseline = 'middle';
      ctx.fillStyle = P.inv;
      ctx.fillRect(x, y, w, lh);
      ctx.fillStyle = '#000';
      ctx.fillText(` 比特 ${U.fmt(s.res.bits)}  +${U.fmt(E.shown('bits'), 1)}/秒`, x + 2, y + lh / 2 + 1);
      lines.slice(-n).forEach((l, i) => {
        ctx.fillStyle = l.kind === 'dot' ? P.hi : P.sys;
        const t = prefix(l.kind) + l.text;
        ctx.fillText(t.length > 40 ? t.slice(0, 39) + '…' : t, x + 4, y + lh * (i + 1.6));
      });
      const st = s.e[0];
      ctx.fillStyle = P.fg;
      const inp = '$ ' + st.inp.slice(-30);
      ctx.fillText(inp, x + 4, y + h - lh * 0.6);
      if (Math.floor(G.t * 2) % 2) ctx.fillRect(x + 4 + ctx.measureText(inp).width + 2, y + h - lh * 1.05, fs * 0.55, lh * 0.85);
      if (R.sig) {
        ctx.fillStyle = PAL.green.warn;
        ctx.fillText('((·)) ' + R.sig.word, x + w - ctx.measureText('((·)) ' + R.sig.word).width - 6, y + h - lh * 0.6);
      }
    }
    ctx.restore();
  }
})();
