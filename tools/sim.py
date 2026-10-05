# 数值模拟：用无头 Edge 打开游戏，开启"模拟玩家"，用真实代码从零玩到结局，记录每个时代用了多久。
# 用法：python tools/sim.py            （需要 Python 版 Playwright + 本机 Edge）
import json, pathlib, sys, time
from playwright.sync_api import sync_playwright

GAME = (pathlib.Path(__file__).resolve().parent.parent / "index.html").as_uri()
CHUNK = 60  # 每次推进的游戏秒数
LIMIT = 3 * 3600

JS_INIT = """() => {
  localStorage.clear();
  return 1;
}"""
JS_STEP = """(chunk) => {
  G.speed = 0;
  G.botAssist = true;
  const E = G.econ;
  window.__sim = window.__sim || { log: [], last: G.s.era, buys: {} };
  const S = window.__sim;
  function buy() {
    if (G.scene.fx) return;
    const era = G.s.era;
    const goal = E.order.find((d) => d.era === era && d.type === 'goal');
    if (goal && E.visible(goal) && E.canBuy(goal)) { E.buy(goal); S.buys[goal.id] = G.s.time; return; }
    // 目标出现后像真人一样攒钱：只买很便宜的（发生器 < 8%，一次性升级 < 35%）
    const saving = goal && E.visible(goal);
    for (let k = 0; k < 3; k++) {
      let best = null, bc = Infinity;
      for (const d of E.order) {
        if (d.era !== era || d.type === 'goal') continue;
        if (!E.visible(d) || !E.canBuy(d)) continue;
        const c = E.cost(d);
        let rel = 0;
        for (const r in c) rel = Math.max(rel, c[r] / Math.max(1, G.s.res[r]));
        if (saving && rel > (d.tag === 'mult' ? 0.6 : d.type === 'gen' ? 0.08 : 0.35)) continue;
        if (rel < bc) { bc = rel; best = d; }
      }
      if (!best) break;
      E.buy(best);
      if (!S.buys[best.id]) S.buys[best.id] = G.s.time;
    }
  }
  const end = G.s.time + chunk;
  while (G.s.time < end) {
    if (G.s.era === 0 && G.s.e[0].boot < 1) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA' }));
    G.step(0.5, 1 / 30, false);
    if (G.s.era === 2 && !G.s.e[2].started && !G.scene.fx) G.s.e[2].started = 1;
    buy();
    if (G.s.era !== S.last) { S.log.push({ era: S.last, at: G.s.time }); S.last = G.s.era; }
    if (G.scene.fx && G.s.era === 5 && G.s.own.final) break;
  }
  const rr = E.ERA_RES[G.s.era];
  const goal = E.order.find((d) => d.era === G.s.era && d.type === 'goal');
  const st = G.s.stats;
  const diag = `食物${st.foods} 死${st.deaths} 长${st.maxLen} 砖${st.bricks} 距${Math.floor(st.dist)} 摔${st.falls} 被动${G.U.fmt(G.m.rate[rr])} 自动${G.U.fmt(G.s.autoRate[rr] || 0)} AI${G.m.snakeAI}/${G.m.padAI}/${G.m.runAI}`;
  return { diag, t: G.s.time, era: G.s.era, done: !!G.s.own.final, rate: G.U.fmt(E.shown(rr)), goal: goal ? E.costText(E.cost(goal)) : '', res: Object.fromEntries(Object.entries(G.s.res).map(([k, v]) => [k, G.U.fmt(v)])), log: S.log };
}"""

with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge", headless=True)
    pg = b.new_page(viewport={"width": 640, "height": 360})
    pg.goto(GAME)
    pg.wait_for_timeout(500)
    pg.evaluate(JS_INIT)
    pg.reload()
    pg.wait_for_timeout(800)
    t0 = time.time()
    r = None
    while True:
        r = pg.evaluate(JS_STEP, CHUNK)
        print(f"[{time.time()-t0:5.0f}s] 游戏 {r['t']/60:5.1f} 分  时代 {r['era']}  速率 {r['rate']}/秒  {r['diag']}  目标 {r['goal']}  {r['res']}", flush=True)
        if r["done"] or r["t"] > LIMIT:
            break
    buys = pg.evaluate("() => window.__sim.buys")
    b.close()
    prev = 0
    print("\n各时代用时：")
    for e in r["log"]:
        print(f"  时代 {e['era']}: {(e['at']-prev)/60:5.1f} 分（累计 {e['at']/60:5.1f}）")
        prev = e["at"]
    if r["done"]:
        print(f"  时代 5: {(r['t']-prev)/60:5.1f} 分（累计 {r['t']/60:5.1f}）")
    if "--buys" in sys.argv:
        for k, v in sorted(buys.items(), key=lambda x: x[1]):
            print(f"  {v/60:6.1f} 分  {k}")
