'use strict';
// 音序器 + 主旋律。每个时代用同一段主旋律重新编曲（见各时代文件里的 song 定义）。
G.music = (() => {
  const A = G.audio;
  const M = { cur: null };

  // 记谱："E5:2 -:2 A5:4 | ..."，冒号后是十六分音符个数，'-' 是休止，'|' 只为好看
  M.parse = (str, transpose = 0, start = 0) => {
    const out = [];
    let step = start;
    for (const tok of str.split(/\s+/)) {
      if (!tok || tok === '|') continue;
      const [name, lenS] = tok.split(':');
      const len = parseInt(lenS || '2', 10);
      if (name !== '-') out.push([step, A.note(name) + transpose, len]);
      step += len;
    }
    return out;
  };

  // 主旋律：A 段（Am F C G Am F C E）+ B 段（F G Em Am F G Am E），各 8 小节
  M.THEME = {
    A:
      'E5:2 E5:2 E5:2 -:2 A5:4 G5:2 E5:2 | F5:2 E5:2 C5:4 -:4 A4:2 C5:2 | ' +
      'E5:2 E5:2 E5:2 -:2 G5:4 E5:2 D5:2 | D5:6 -:2 B4:4 D5:4 | ' +
      'E5:2 E5:2 E5:2 -:2 A5:4 B5:2 C6:2 | C6:4 A5:2 G5:2 F5:4 E5:2 F5:2 | ' +
      'G5:4 E5:2 C5:2 D5:4 E5:2 D5:2 | D5:2 C5:2 B4:4 G#4:6 -:2',
    B:
      'A5:4 G5:2 F5:2 E5:4 C5:4 | D5:4 E5:2 F5:2 G5:8 | ' +
      'B4:2 B4:2 B4:2 -:2 E5:4 D5:2 B4:2 | C5:4 B4:2 A4:2 E4:8 | ' +
      'A4:2 C5:2 F5:4 E5:2 F5:2 A5:4 | G5:4 F5:2 E5:2 D5:4 B4:4 | ' +
      'C5:2 D5:2 E5:4 A5:4 G5:2 E5:2 | E5:4 G#5:4 B5:6 -:2',
    chordsA: ['Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'E'],
    chordsB: ['F', 'G', 'Em', 'Am', 'F', 'G', 'Am', 'E'],
  };
  M.THEME.chords = M.THEME.chordsA.concat(M.THEME.chordsB);
  // 和弦：根音（第 2 八度附近）+ 三和弦（第 4 八度附近）
  M.CHORD = {
    Am: { root: 45, tri: [57, 60, 64] },
    F: { root: 41, tri: [53, 57, 60] },
    C: { root: 48, tri: [55, 60, 64] },
    G: { root: 43, tri: [55, 59, 62] },
    E: { root: 40, tri: [56, 59, 64] },
    Em: { root: 40, tri: [55, 59, 64] },
    Dm: { root: 50, tri: [53, 57, 62] },
  };
  M.melody = (transpose = 0) => M.parse(M.THEME.A + ' ' + M.THEME.B, transpose);
  M.chordAt = (step) => M.CHORD[M.THEME.chords[Math.floor(step / 16) % 16]];

  // song: { bpm, len, tracks:[{ notes:[[step,midi,len,vel?]], inst(o), gen(step,t,spb,out) }] }
  M.play = (song, opt = {}) => {
    if (!A.ready) {
      M.pending = [song, opt];
      return;
    }
    M.stop(opt.fadeOut === undefined ? 0.8 : opt.fadeOut);
    const c = A.ctx;
    const gain = c.createGain();
    gain.gain.value = 0.0001;
    gain.connect(A.musicBus);
    gain.gain.setTargetAtTime(song.vol || 1, c.currentTime, (opt.fade || 0.5) / 3);
    const mask = opt.mask === undefined ? 0xffff : opt.mask;
    const tg = song.tracks.map((tr, i) => {
      const g = c.createGain();
      g.gain.value = mask & (1 << i) ? 1 : 0.0001;
      g.connect(gain);
      if (tr.notes && !tr.byStep) {
        tr.byStep = {};
        for (const nt of tr.notes) (tr.byStep[nt[0]] || (tr.byStep[nt[0]] = [])).push(nt);
      }
      return g;
    });
    const spb = 60 / song.bpm / 4;
    const t0 = c.currentTime + 0.08 - (opt.startStep || 0) * spb;
    M.cur = { song, gain, tg, mask, spb, t0, step: opt.startStep || 0, nextT: c.currentTime + 0.08 };
    M.pending = null;
  };

  M.stop = (fade = 0.8) => {
    if (!M.cur || !A.ctx) return;
    const g = M.cur.gain;
    g.gain.setTargetAtTime(0.0001, A.ctx.currentTime, fade / 3);
    setTimeout(() => g.disconnect(), fade * 1000 + 600);
    M.cur = null;
  };

  M.setMask = (mask, fade = 0.6) => {
    if (!M.cur) {
      if (M.pending) M.pending[1].mask = mask;
      return;
    }
    M.cur.mask = mask;
    const t = A.ctx.currentTime;
    M.cur.tg.forEach((g, i) => g.gain.setTargetAtTime(mask & (1 << i) ? 1 : 0.0001, t, fade / 3));
  };

  M.setVol = (v, fade = 0.5) => {
    if (M.cur) M.cur.gain.gain.setTargetAtTime(Math.max(0.0001, v), A.ctx.currentTime, fade / 3);
  };

  // 当前播放位置（十六分音符，浮点）
  M.pos = () => {
    if (!M.cur || !A.ctx) return 0;
    return (A.ctx.currentTime - M.cur.t0) / M.cur.spb;
  };
  M.beat = () => M.pos() / 4;

  M.pump = () => {
    const cur = M.cur;
    if (!cur || !A.ready || A.ctx.state !== 'running') return;
    const c = A.ctx, song = cur.song;
    if (cur.nextT < c.currentTime - 0.3) {
      // 落后太多（标签页切回来）：跳到现在
      const skip = Math.ceil((c.currentTime - cur.nextT) / cur.spb);
      cur.step += skip;
      cur.nextT += skip * cur.spb;
    }
    while (cur.nextT < c.currentTime + 0.14) {
      const st = cur.step % song.len;
      song.tracks.forEach((tr, i) => {
        if (!(cur.mask & (1 << i)) && !tr.always) return;
        const out = cur.tg[i];
        if (tr.byStep && tr.byStep[st]) {
          for (const nt of tr.byStep[st]) {
            tr.inst({ t: cur.nextT, n: nt[1], d: nt[2] * cur.spb, v: nt[3], out, step: st, spb: cur.spb });
          }
        }
        if (tr.gen) tr.gen(st, cur.nextT, cur.spb, out);
      });
      if (song.onStep) song.onStep(st, cur.nextT);
      cur.nextT += cur.spb;
      cur.step++;
    }
  };
  setInterval(M.pump, 25);
  G.bus.on('audio-ready', () => {
    if (M.pending) M.play(M.pending[0], M.pending[1]);
  });

  return M;
})();
