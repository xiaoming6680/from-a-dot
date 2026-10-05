# 冒烟测试：用无头 Edge 以 file:// 打开游戏，发真实鼠标/键盘事件，逐个时代检查交互、回到过去、菜单、存读档、离线、结局恢复。
# 用法：python tools/smoke.py   （需要 Python 版 Playwright + 本机 Edge；截图写到 tools/shots/）
import json, pathlib, time
pathlib.Path(__file__).resolve().parent.joinpath('shots').mkdir(exist_ok=True)
from playwright.sync_api import sync_playwright
GAME = (pathlib.Path(__file__).resolve().parent.parent / "index.html").as_uri()
OUT = pathlib.Path(__file__).resolve().parent / "shots"
V2S = """([x, y]) => {
  // 虚拟坐标 → 屏幕坐标（反解 CRT 弧度）
  const v = G.display.view, p0 = G.display.last || {};
  const curve = p0.curve || 0;
  const tx = x / G.VW, ty = y / G.VH;
  let ux = tx, uy = ty;
  for (let i = 0; i < 20; i++) {
    const qx = ux * 2 - 1, qy = uy * 2 - 1;
    const wx = (qx * (1 + curve * qy * qy)) * 0.5 + 0.5, wy = (qy * (1 + curve * qx * qx)) * 0.5 + 0.5;
    ux += tx - wx; uy += ty - wy;
  }
  return [v.x + ux * v.w, v.y + uy * v.h];
}"""
fails = []
def check(name, cond, info=''):
    print(('PASS ' if cond else 'FAIL ') + name + ('' if cond else '  ' + str(info)[:300]))
    if not cond: fails.append(name)

with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge", headless=True)
    pg = b.new_page(viewport={"width": 1280, "height": 720})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(GAME + "?debug")
    pg.evaluate("() => localStorage.clear()")
    pg.reload(); pg.wait_for_timeout(700)
    ev = lambda js, arg=None: pg.evaluate(js, arg)
    def click_v(x, y):
        sx, sy = ev(V2S, [x, y]); pg.mouse.move(sx, sy); pg.wait_for_timeout(60); pg.mouse.click(sx, sy); pg.wait_for_timeout(150)

    # ---- 时代 0 ----
    for k in "asdfghjkl;":
        pg.keyboard.press(k); pg.wait_for_timeout(30)
    pg.wait_for_timeout(1600)
    check('开局按键产生比特并开机', ev("() => G.s.e[0].boot") == 1, ev("() => G.s.e[0]"))
    for ch in "beep": pg.keyboard.press(ch)
    pg.keyboard.press("Enter"); pg.wait_for_timeout(200)
    if not ev("() => !!G.s.own.beep"):
        for k in "qwertyuiop": pg.keyboard.press(k)
        for ch in "beep": pg.keyboard.press(ch)
        pg.keyboard.press("Enter"); pg.wait_for_timeout(200)
    check('输入 beep 回车购买', ev("() => !!G.s.own.beep"))
    ev("() => { G.s.res.bits = 500; }"); pg.wait_for_timeout(300)
    regs = ev("() => G.eras[0].regions()")
    loop = [r for r in regs if r['id'] == 'loop']
    check('loop 命令可见', bool(loop), regs)
    if loop:
        r = loop[0]; before = ev("() => G.s.own.loop || 0")
        click_v(r['x'] + 60, r['y'] + r['h'] / 2)
        check('点击 loop 购买', ev("() => G.s.own.loop || 0") == before + 1, ev("() => G.s.own"))
    ev("() => { G.s.res.bits = 5000; G.econ.buy('color'); G.econ.buy('crt'); }"); pg.wait_for_timeout(1600)
    regs = ev("() => G.eras[0].regions()")
    fork = [r for r in regs if r['id'] == 'fork']
    if fork:
        r = fork[0]; before = ev("() => G.s.own.fork || 0")
        click_v(r['x'] + 40, r['y'] + r['h'] / 2)
        check('CRT 弧度下点击 fork（坐标反算）', ev("() => G.s.own.fork || 0") == before + 1)
    act = [r for r in regs if r['id'] == 'act']
    if act:
        r = act[-1]; click_v(r['x'] + r['w'] / 2, r['y'] + r['h'] / 2)
        check('点击 [菜单] 打开设置', ev("() => document.getElementById('menu').classList.contains('open')"))
        pg.keyboard.press("Escape"); pg.wait_for_timeout(200)
        check('Esc 关闭设置', not ev("() => document.getElementById('menu').classList.contains('open')"))
    pg.screenshot(path=str(OUT / 'smoke_e0.png'))

    # ---- 时代 1 ----
    ev("() => { G.speed = 0; G.cheat.toEra(1); G.speed = 1; G.s.res.vec = 100; G.s.res.bits = 5000; }")
    pg.wait_for_timeout(800)
    before = ev("() => G.s.own.scope || 0")
    lst = ev("() => G.econ.list(1).map(d => d.id)")
    if 'scope' in lst:
        i = lst.index('scope'); click_v(1300, 350 + 8 + i * 56 + 20)
        check('时代 1 点击商店买示波器', ev("() => G.s.own.scope || 0") == before + 1, lst)
    click_v(180, 780); pg.wait_for_timeout(900)
    check('点击终端小窗进入"回到过去"', ev("() => G.scene.visit && G.scene.visit.phase") == 'on', ev("() => G.scene.visit"))
    pg.screenshot(path=str(OUT / 'smoke_visit0.png'))
    back = [r for r in ev("() => G.eras[0].regions()") if r['id'] == 'act']
    if len(back) >= 2:
        r = back[-1]; click_v(r['x'] + r['w'] / 2, r['y'] + r['h'] / 2); pg.wait_for_timeout(1000)
        check('终端时代的 [返回] 按钮', ev("() => G.scene.visit") is None)
    else:
        check('终端时代显示 [返回] 按钮', False, back)
        pg.keyboard.press("Escape"); pg.wait_for_timeout(1000)
    # 菜单背景点击不会漏进游戏
    ev("() => { G.s.res.vec = 1e4; }"); pg.wait_for_timeout(200)
    lst = ev("() => G.econ.list(1).map(d => d.id)")
    tgt = lst[0]; before = ev(f"() => G.s.own['{tgt}'] || 0")
    pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
    check('Esc 打开菜单', ev("() => G.ui.menuOpen()"))
    sx, sy = ev(V2S, [1300, 350 + 8 + 20]); pg.mouse.click(sx, sy); pg.wait_for_timeout(300)
    check('点菜单外背景关闭菜单', not ev("() => G.ui.menuOpen()"))
    check('关菜单的那一下没有漏进游戏', ev(f"() => G.s.own['{tgt}'] || 0") == before, [tgt, before, ev(f"() => G.s.own['{tgt}']")])
    pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
    pg.click('#m-master'); pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
    check('焦点在音量滑块上时 Esc 也能关菜单', not ev("() => G.ui.menuOpen()"))

    # ---- 时代 2 ----
    ev("() => { G.speed = 0; G.cheat.toEra(2); G.s.e[2].started = 0; G.speed = 1; }")
    pg.wait_for_timeout(500); pg.keyboard.press("x"); pg.wait_for_timeout(300)
    check('按任意键开始', ev("() => G.s.e[2].started") == 1)
    pg.keyboard.press("ArrowRight"); pg.wait_for_timeout(300)
    check('方向键控制蛇', ev("() => G.eras[2].dbg().dir[0]") == 1 or ev("() => G.s.stats.deaths") > 0, ev("() => G.eras[2].dbg().dir"))
    ev("() => { G.s.res.px = 300; }"); pg.wait_for_timeout(200)
    lst = ev("() => G.econ.list(2, 'main').map(d => d.id)")
    k3 = 1600 / 480
    if lst:
        before = ev(f"() => G.s.own['{lst[0]}'] || 0")
        click_v((254 + 100) * k3, (17 + 20 + 7) * k3)
        check('时代 2 点击商店第一项', ev(f"() => G.s.own['{lst[0]}'] || 0") == before + 1, lst)
    click_v((72 + 32) * k3, (231 + 18) * k3); pg.wait_for_timeout(900)
    check('8-bit 里点 Pong 小窗回到过去', ev("() => G.scene.visit && G.scene.visit.id") == 1)
    pg.screenshot(path=str(OUT / 'smoke_visit1.png'))
    pg.keyboard.press("Escape"); pg.wait_for_timeout(1000)

    # ---- 时代 3 ----
    ev("() => { G.speed = 0; G.cheat.toEra(3); G.speed = 1; }"); pg.wait_for_timeout(600)
    j0 = ev("() => G.s.stats.jumps"); pg.keyboard.press("Space"); pg.wait_for_timeout(300)
    check('空格跳跃', ev("() => G.s.stats.jumps") > j0)
    ev("() => { G.s.res.dust = 500; }"); pg.wait_for_timeout(200)
    lst = ev("() => G.econ.list(3, 'main').map(d => d.id)")
    k3 = 1600 / 640
    if lst:
        before = ev(f"() => G.s.own['{lst[0]}'] || 0")
        click_v((464 + 80) * k3, (26 + 25 + 10) * k3)
        check('时代 3 点击商店第一项', ev(f"() => G.s.own['{lst[0]}'] || 0") == before + 1, lst)

    # ---- 时代 4 ----
    ev("() => { G.speed = 0; G.cheat.toEra(4); G.speed = 1; }"); pg.wait_for_timeout(1500)
    ph0 = ev("() => G.s.stats.photons")
    sx, sy = ev(V2S, [300, 300]); pg.mouse.move(sx, sy); pg.mouse.down()
    cx, cy = ev(V2S, [590, 500])
    for i in range(30):
        pg.mouse.move(sx + (cx - sx) * i / 29, sy + (cy - sy) * i / 29); pg.wait_for_timeout(60)
    pg.wait_for_timeout(800); pg.mouse.up()
    check('引力井把光子拖进光核', ev("() => G.s.stats.photons") > ph0 + 5, ev("() => G.s.stats.photons"))
    ev("() => { G.s.res.lux = 1000; }"); pg.wait_for_timeout(300)
    lst = ev("() => G.econ.list(4).map(d => d.id)")
    if 'fiber' in lst:
        i = lst.index('fiber'); before = ev("() => G.s.own.fiber || 0")
        click_v(1500, 120 + 62 + i * 74 + 32)
        check('时代 4 点击买光纤', ev("() => G.s.own.fiber || 0") == before + 1, lst)
    pg.screenshot(path=str(OUT / 'smoke_e4.png'))
    ev("() => { G.s.res.lux = 1e7; G.s.res.bits = 1e12; G.s.res.vec = 1e12; G.s.res.px = 1e12; G.s.res.dust = 1e12; G.econ.buy('sched'); }")
    n0 = ev("() => G.s.log.length"); k0 = ev("() => G.s.lineN")
    pg.wait_for_timeout(4000)
    check('调度器自动购买不往日志刷屏', ev(f"() => G.s.log.filter(l => l.n > {k0} && (l.kind === 'cmd' || l.kind === 'ok')).length") == 0)

    # ---- 时代 5 ----
    ev("() => { G.speed = 0; G.cheat.toEra(5); G.speed = 1; }"); pg.wait_for_timeout(2000)
    s0 = ev("() => G.s.stats.stars")
    sx, sy = ev(V2S, [1000, 600]); pg.mouse.click(sx, sy); pg.wait_for_timeout(400)
    check('3D 里点击放星', ev("() => G.s.stats.stars") > s0)
    y0 = ev("() => G.eras[5].cam.ty")
    pg.mouse.move(sx, sy); pg.mouse.down(); pg.mouse.move(sx + 150, sy, steps=8); pg.mouse.up(); pg.wait_for_timeout(300)
    check('拖动旋转镜头', abs(ev("() => G.eras[5].cam.ty") - y0) > 0.3)
    pg.screenshot(path=str(OUT / 'smoke_e5.png'))
    # 点立方体某一面 → 回到那个时代
    pt = ev("() => { const R = G.eras[5].R; const out = []; for (const p of [[0.3,0.3,1],[1,0.3,0.3],[0.3,1,0.3],[-1,0.3,0.3]]) { const v = G.gl3d.xform(R.vp, p[0], p[1], p[2]); out.push([(v[0]/v[3]*0.5+0.5)*1600, (1-(v[1]/v[3]*0.5+0.5))*900]); } return out; }")
    ok = False
    for x, y in pt:
        click_v(x, y); pg.wait_for_timeout(900)
        vis = ev("() => G.scene.visit && G.scene.visit.id")
        if vis is not None:
            ok = True
            pg.screenshot(path=str(OUT / 'smoke_cubevisit.png'))
            pg.keyboard.press("Escape"); pg.wait_for_timeout(1000)
            break
    check('点立方体的一面回到那个时代', ok, pt)
    # 结局中途刷新 → 回到选择；选择停留后宇宙继续
    ev("() => { G.speed = 0; G.s.res.dots = 1e68; G.econ.buy('final'); G.step(2); G.save.write(); G.save.blocked = true; }")
    pg.reload(); pg.wait_for_timeout(3000)
    check('结局中途刷新后自动回到选择', ev("() => !!G.scene.fx"), ev("() => [G.s.era, G.s.own.final, G.s.ending]"))
    ev("() => { G.speed = 1; }")
    pg.wait_for_timeout(1500)
    sx, sy = ev(V2S, [940, 757]); pg.mouse.move(sx, sy); pg.wait_for_timeout(100); pg.mouse.click(sx, sy); pg.wait_for_timeout(500)
    check('选择停留', ev("() => G.s.ending") == 'stay' and not ev("() => !!G.scene.fx"), ev("() => [G.s.ending, !!G.scene.fx]"))
    check('停留后点数仍是无量大数', ev("() => G.s.res.dots") >= 1e67)
    check('停留后菜单可用', not ev("() => !!G.s.flags.noMenu"))

    # ---- 存读档与离线 ----
    era, dots = ev("() => [G.s.era, G.s.res.dots]")
    ev("() => { G.save.write(); const s = JSON.parse(localStorage.getItem('yigedian.save')); s.savedAt -= 600000; localStorage.setItem('yigedian.save', JSON.stringify(s)); G.save.blocked = true; }")
    pg.reload(); pg.wait_for_timeout(2500)
    check('读档后时代一致', ev("() => G.s.era") == era)
    check('离线 10 分钟有补发提示', ev("() => G.s.log.some(l => l.text.startsWith('离开了'))"), ev("() => G.s.log.slice(-3).map(l => l.text)"))
    check('3D 离线按指数膨胀', ev("() => G.s.res.dots") >= dots)
    check('没有页面报错', not errs, errs[:5])
    b.close()
print('\n失败：', fails if fails else '无')
