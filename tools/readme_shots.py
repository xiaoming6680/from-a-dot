# 生成 README 配图：六个时代的真实画面、六宫格头图、跃迁 0→1 的短 GIF。
# 用法：python tools/readme_shots.py
# 需要：Python 版 Playwright + 本机 Edge、Pillow、ffmpeg（winget 装的 Gyan.FFmpeg，或 E:\ffmpeg...）
# 输出：docs/images/*.jpg、docs/images/transition.gif（不含任何结局画面）
import glob, os, pathlib, shutil, subprocess
from PIL import Image, ImageDraw, ImageFont
from playwright.sync_api import sync_playwright

ROOT = pathlib.Path(__file__).resolve().parent.parent
GAME = (ROOT / "index.html").as_uri()
IMG = ROOT / "docs" / "images"
TMP = ROOT / "tools" / "shots" / "readme"
IMG.mkdir(parents=True, exist_ok=True)
TMP.mkdir(parents=True, exist_ok=True)


def find_ffmpeg():
    for c in [shutil.which("ffmpeg"),
              *glob.glob(os.path.expandvars(r"%LOCALAPPDATA%\Microsoft\WinGet\Packages\Gyan.FFmpeg*\*\bin\ffmpeg.exe")),
              r"E:\ffmpeg-master-latest-win64-gpl-shared\bin\ffmpeg.exe"]:
        if c and os.path.exists(c):
            return c
    raise SystemExit("找不到 ffmpeg")


BOOT = """() => {
  G.speed = 0;
  for (let i = 0; i < 12; i++) { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', code: 'KeyA' })); G.step(0.2, 1/60, false); }
  G.step(2, 1/30, false);
}"""
SCENES = {
    "era0": """() => {
      G.s.res.bits = 3000;
      ['beep','echo','color','ping','crt','macro'].forEach(id => G.econ.buy(id));
      for (let i = 0; i < 6; i++) G.econ.buy('loop');
      for (let i = 0; i < 3; i++) G.econ.buy('fork');
      G.s.res.bits = 2600;
      G.step(34, 1/30, false);
      for (const ch of 'hel') window.dispatchEvent(new KeyboardEvent('keydown', { key: ch, code: 'Key' + ch.toUpperCase() }));
      G.step(0.4, 1/30, true);
    }""",
    "era1": """() => {
      G.cheat.toEra(1);
      G.s.res.vec = 3e4; G.s.res.bits = 1e6;
      ['tone','glow0','glow1','long','hills'].forEach(id => G.econ.buy(id));
      G.econ.buy('auto'); G.econ.buy('auto');
      for (let i = 0; i < 4; i++) G.econ.buy('ball');
      for (let i = 0; i < 6; i++) G.econ.buy('scope');
      for (let i = 0; i < 3; i++) G.econ.buy('plot');
      G.econ.buy('array'); G.econ.buy('array');
      G.step(30, 1/60, true);
    }""",
    "era2": """() => {
      G.cheat.toEra(2); G.s.e[2].started = 1;
      G.s.res.px = 1e6; G.s.res.bits = 1e8; G.s.res.vec = 1e7;
      for (const id of ['pal_red','pal_blue','pal_green','pal_yellow','pal_cyan','pal_purple','pal_orange','pal_pink','ch1','ch2','ch3','ch4','twin','gold']) G.econ.buy(id);
      G.econ.buy('sai'); G.econ.buy('sai');
      G.step(45, 1/30, true);
    }""",
    "era3": """() => {
      G.cheat.toEra(3);
      G.s.res.dust = 1e6;
      for (let i = 0; i < 5; i++) G.econ.buy('layer');
      for (const id of ['dbl','glide']) G.econ.buy(id);
      G.econ.buy('runai'); G.econ.buy('magnet');
      G.step(9, 1/60, true);
    }""",
    "era4": """() => {
      G.cheat.toEra(4);
      G.s.res.lux = 1e9;
      for (const id of ['glass','grad']) G.econ.buy(id);
      for (let i = 0; i < 4; i++) G.econ.buy('lens');
      for (let i = 0; i < 8; i++) G.econ.buy('fiber');
      for (let i = 0; i < 4; i++) G.econ.buy('amp');
      G.econ.buy('voice'); G.econ.buy('dense');
      G.botAssist = true; G.step(7, 1/60, false); G.botAssist = false;
      G.step(0.3, 1/60, true);
    }""",
    "era5": """() => {
      G.cheat.toEra(5);
      G.s.res.dots = 1e28;
      for (let i = 0; i < 8; i++) G.econ.buy('grav');
      for (let i = 0; i < 3; i++) { G.econ.buy('line'); G.econ.buy('neb'); }
      G.econ.buy('gal'); G.econ.buy('gal');
      const c = G.eras[5].cam; c.ty = 0.95; c.tp = 0.32; c.td = 10.5;
      G.step(8, 1/30, true);
    }""",
}
LABELS = {"era0": "1 · 终端", "era1": "2 · 矢量", "era2": "3 · 8-bit", "era3": "4 · 16-bit", "era4": "5 · 现代", "era5": "6 · 3D"}


def save_jpg(png, out, w=1280, q=84):
    im = Image.open(png).convert("RGB")
    im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    im.save(out, "JPEG", quality=q, optimize=True, progressive=True)
    return out


with sync_playwright() as p:
    b = p.chromium.launch(channel="msedge", headless=True, args=["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"])
    pg = b.new_page(viewport={"width": 1600, "height": 900})
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(GAME)
    pg.evaluate("() => localStorage.clear()")
    pg.reload(); pg.wait_for_timeout(800)
    pg.evaluate(BOOT)
    for name, js in SCENES.items():
        pg.evaluate(js)
        pg.wait_for_timeout(400)
        pg.screenshot(path=str(TMP / f"{name}.png"))
        print("截图", name, flush=True)

    # 跃迁 0→1：重新开一局，买到显像管后编译矢量驱动，逐帧截图
    pg.evaluate("() => { G.save.blocked = true; localStorage.clear(); }")
    pg.reload(); pg.wait_for_timeout(800)
    pg.evaluate(BOOT)
    pg.evaluate("""() => {
      G.s.res.bits = 9e4; G.cheat.buyAll(); G.s.res.bits = 9000;
      G.step(30, 1/30, false);
      G.cheat.goal(); G.step(1.6, 1/60, true);
    }""")
    frames = TMP / "gif"
    shutil.rmtree(frames, ignore_errors=True)
    frames.mkdir()
    for i in range(int(7.8 * 12)):
        pg.evaluate("() => G.step(1 / 12, 1/120, true)")
        pg.screenshot(path=str(frames / f"f{i:03d}.png"))
    print("GIF 帧", i + 1, "错误：", errs, flush=True)
    b.close()

# 单张截图
for name in SCENES:
    out = save_jpg(TMP / f"{name}.png", IMG / f"{name}.jpg")
    print(out.name, out.stat().st_size // 1024, "KB")

# 六宫格头图
W, Hh, G2 = 522, 294, 8
canvas = Image.new("RGB", (W * 3 + G2 * 4, Hh * 2 + G2 * 3), (8, 9, 14))
font = ImageFont.truetype(r"C:\Windows\Fonts\msyhbd.ttc", 24)
for i, name in enumerate(SCENES):
    tile = Image.open(TMP / f"{name}.png").convert("RGB").resize((W, Hh), Image.LANCZOS)
    d = ImageDraw.Draw(tile, "RGBA")
    d.rectangle([0, Hh - 40, W, Hh], fill=(0, 0, 0, 150))
    d.text((14, Hh - 36), LABELS[name], font=font, fill=(255, 255, 255, 235))
    canvas.paste(tile, (G2 + (i % 3) * (W + G2), G2 + (i // 3) * (Hh + G2)))
canvas.save(IMG / "eras.jpg", "JPEG", quality=84, optimize=True, progressive=True)
print("eras.jpg", (IMG / "eras.jpg").stat().st_size // 1024, "KB")

# GIF（调色板两遍法）
ff = find_ffmpeg()
pal = TMP / "palette.png"
src = str(frames / "f%03d.png")
vf = "fps=10,scale=640:-1:flags=lanczos"
subprocess.run([ff, "-y", "-v", "error", "-framerate", "12", "-i", src, "-vf", vf + ",palettegen=max_colors=64:stats_mode=diff", str(pal)], check=True)
subprocess.run([ff, "-y", "-v", "error", "-framerate", "12", "-i", src, "-i", str(pal), "-lavfi",
                vf + ",tpad=stop_mode=clone:stop_duration=1.5[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle",
                str(IMG / "transition.gif")], check=True)
print("transition.gif", (IMG / "transition.gif").stat().st_size // 1024, "KB")
