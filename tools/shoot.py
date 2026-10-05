# 用 Playwright + Edge 打开游戏（file://），按脚本执行 JS 并截图。
# 用法：python shoot.py steps.json  （steps: [{"js": "...", "shot": "a.png", "wait": 0.2}, ...]）
import json, sys, os, time, pathlib
from playwright.sync_api import sync_playwright

GAME = (pathlib.Path(__file__).resolve().parent.parent / "index.html").as_uri()
OUT = pathlib.Path(__file__).resolve().parent / "shots"
OUT.mkdir(exist_ok=True)

steps = json.load(open(sys.argv[1], encoding="utf-8"))
query = sys.argv[2] if len(sys.argv) > 2 else "?debug"
w, h = tuple(int(v) for v in os.environ.get("VP", "1600x900").split("x"))
with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge", headless=True, args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--autoplay-policy=no-user-gesture-required"])
    pg = b.new_page(viewport={"width": w, "height": h})
    logs = []
    pg.on("console", lambda m: logs.append(f"[{m.type}] {m.text}"))
    pg.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))
    pg.goto(GAME + query)
    pg.wait_for_timeout(800)
    for st in steps:
        if "js" in st:
            try:
                r = pg.evaluate("async () => { " + st["js"] + " }")
                if r is not None:
                    print("JS>", json.dumps(r, ensure_ascii=False)[:2000])
            except Exception as e:
                print("JS ERROR:", e)
        if "wait" in st:
            pg.wait_for_timeout(int(st["wait"] * 1000))
        if "shot" in st:
            pg.screenshot(path=str(OUT / st["shot"]), timeout=120000)
            print("shot", st["shot"])
    for l in logs:
        print(l)
    b.close()
