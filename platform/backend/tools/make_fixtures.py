"""生成身份证测试样张（正常/倾斜/透视/模糊/暗光/低清/综合），用于识别准确率对比。

用法：.venv/bin/python tools/make_fixtures.py
输出：testdata/fixtures/*.jpg + testdata/fixtures/ground_truth.json
"""

import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

BASE_DIR = Path(__file__).resolve().parent.parent
OUT_DIR = BASE_DIR / "testdata" / "fixtures"

CARD_W, CARD_H = 856, 540

FONT_CANDIDATES = [
    "/System/Library/Fonts/PingFang.ttc",
    "/System/Library/Fonts/Supplemental/Songti.ttc",
    "/System/Library/Fonts/STHeiti Light.ttc",
    "/System/Library/Fonts/Hiragino Sans GB.ttc",
]

GROUND_TRUTH = {
    "name": "张三",
    "idNumber": "11010519491231002X",
    "address": "北京市海淀区中关村大街27号",
}


def load_font(size: int):
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size, index=0)
            except Exception:
                continue
    return ImageFont.load_default()


def render_card() -> Image.Image:
    """按真实身份证人像面布局画一张模拟证件。"""
    img = Image.new("RGB", (CARD_W, CARD_H), (233, 243, 249))
    draw = ImageDraw.Draw(img)
    draw.rectangle([0, 0, CARD_W - 1, CARD_H - 1], outline=(150, 180, 200), width=3)

    title_font = load_font(28)
    text_font = load_font(30)
    label_font = load_font(26)
    addr_font = load_font(28)

    draw.text((CARD_W // 2 - 165, 22), "中华人民共和国居民身份证", font=title_font, fill=(25, 25, 25))

    # 证件照区域
    draw.rectangle([620, 140, 800, 420], fill=(214, 222, 228), outline=(190, 200, 208), width=2)

    rows = [
        (105, "姓　名", "张三"),
        (170, "性　别", "男"),
        (235, "民　族", "汉"),
        (300, "出　生", "1990年1月1日"),
    ]
    for y, label, value in rows:
        draw.text((52, y), label, font=label_font, fill=(90, 100, 110))
        draw.text((150, y - 4), value, font=text_font, fill=(20, 20, 20))

    draw.text((52, 372), "住　址", font=label_font, fill=(90, 100, 110))
    draw.text((150, 366), "北京市海淀区", font=addr_font, fill=(20, 20, 20))
    draw.text((150, 402), "中关村大街27号", font=addr_font, fill=(20, 20, 20))

    draw.text((52, 470), "公民身份号码", font=label_font, fill=(90, 100, 110))
    draw.text((215, 462), GROUND_TRUTH["idNumber"], font=load_font(32), fill=(20, 20, 20))

    return img


def _pil_to_bgr(image: Image.Image) -> np.ndarray:
    return cv2.cvtColor(np.array(image.convert("RGB")), cv2.COLOR_RGB2BGR)


def _save(bgr: np.ndarray, name: str) -> None:
    path = OUT_DIR / name
    cv2.imwrite(str(path), bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 88])
    print(f"  {name}  {bgr.shape[1]}x{bgr.shape[0]}")


def _canvas(card_bgr: np.ndarray, scale: float, pad_ratio: float = 0.18) -> np.ndarray:
    """把证件缩放后放到白色画布中央。"""
    card = cv2.resize(card_bgr, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    h, w = card.shape[:2]
    canvas = np.full((int(h * (1 + pad_ratio * 2)), int(w * (1 + pad_ratio * 2)), 3), 246, np.uint8)
    y = (canvas.shape[0] - h) // 2
    x = (canvas.shape[1] - w) // 2
    canvas[y:y + h, x:x + w] = card
    return canvas


def _rotate(bgr: np.ndarray, angle: float) -> np.ndarray:
    h, w = bgr.shape[:2]
    matrix = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1.0)
    cos, sin = abs(matrix[0, 0]), abs(matrix[0, 1])
    nw, nh = int(h * sin + w * cos), int(h * cos + w * sin)
    matrix[0, 2] += nw / 2 - w / 2
    matrix[1, 2] += nh / 2 - h / 2
    return cv2.warpAffine(bgr, matrix, (nw, nh), borderValue=(246, 246, 246))


def _perspective(bgr: np.ndarray, strength: float = 0.14) -> np.ndarray:
    h, w = bgr.shape[:2]
    src = np.float32([[0, 0], [w, 0], [w, h], [0, h]])
    dst = np.float32([
        [w * strength, h * strength * 0.5],
        [w * (1 - strength * 0.4), h * strength * 0.2],
        [w * (1 - strength * 0.1), h * (1 - strength * 0.3)],
        [w * strength * 0.6, h * (1 - strength)],
    ])
    matrix = cv2.getPerspectiveTransform(src, dst)
    return cv2.warpPerspective(bgr, matrix, (w, h), borderValue=(246, 246, 246))


def _blur(bgr: np.ndarray, sigma: float) -> np.ndarray:
    return cv2.GaussianBlur(bgr, (0, 0), sigma)


def _darken(bgr: np.ndarray, factor: float) -> np.ndarray:
    return np.clip(bgr.astype(np.float32) * factor, 0, 255).astype(np.uint8)


def _jpeg(bgr: np.ndarray, quality: int) -> np.ndarray:
    ok, buf = cv2.imencode(".jpg", bgr, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    return cv2.imdecode(buf, cv2.IMREAD_COLOR) if ok else bgr


def _background(width: int, height: int, seed: int = 7) -> np.ndarray:
    """模拟杂乱背景（水泥地/桌子）：噪声纹理 + 随机色块。"""
    rng = np.random.default_rng(seed)
    noise = rng.normal(0, 26, (height, width, 3)).astype(np.float32)
    base = np.zeros((height, width, 3), np.float32) + np.array([132, 138, 144], np.float32)
    canvas = np.clip(base + noise, 0, 255).astype(np.uint8)
    canvas = cv2.GaussianBlur(canvas, (0, 0), 6)
    for _ in range(26):
        x, y = rng.integers(0, width), rng.integers(0, height)
        w, h = rng.integers(40, width // 3), rng.integers(40, height // 3)
        color = tuple(int(c) for c in rng.integers(60, 210, 3))
        cv2.rectangle(canvas, (x, y), (x + w, y + h), color, -1)
    return cv2.GaussianBlur(canvas, (0, 0), 9)


def _lighting(bgr: np.ndarray, low: float = 0.55, high: float = 1.05) -> np.ndarray:
    """横向光照渐变（一侧暗一侧亮）。"""
    height, width = bgr.shape[:2]
    ramp = np.linspace(low, high, width, dtype=np.float32)
    return np.clip(bgr.astype(np.float32) * ramp[None, :, None], 0, 255).astype(np.uint8)


def _moire(bgr: np.ndarray) -> np.ndarray:
    """模拟拍屏幕产生的摩尔纹。"""
    height, width = bgr.shape[:2]
    xs = np.arange(width, dtype=np.float32)
    ys = np.arange(height, dtype=np.float32)
    pattern = 1 + 0.07 * np.sin(2 * np.pi * xs / 3.1)[None, :] * np.sin(2 * np.pi * ys / 3.4)[:, None]
    out = bgr.astype(np.float32) * pattern[:, :, None]
    return np.clip(out, 0, 255).astype(np.uint8)


def _place_on_background(card: np.ndarray, width: int, height: int, scale: float, angle: float,
                         offset: tuple[int, int] = (0, 0), seed: int = 7) -> np.ndarray:
    """把证件缩放、旋转后合成到杂乱背景上（带透明边缘）。"""
    background = _background(width, height, seed)
    resized = cv2.resize(card, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    ch, cw = resized.shape[:2]
    mask = np.full((ch, cw), 255, np.uint8)
    matrix = cv2.getRotationMatrix2D((cw / 2, ch / 2), angle, 1.0)
    cos, sin = abs(matrix[0, 0]), abs(matrix[0, 1])
    nw, nh = int(ch * sin + cw * cos), int(ch * cos + cw * sin)
    matrix[0, 2] += nw / 2 - cw / 2
    matrix[1, 2] += nh / 2 - ch / 2
    warped = cv2.warpAffine(resized, matrix, (nw, nh), borderValue=(0, 0, 0))
    warped_mask = cv2.warpAffine(mask, matrix, (nw, nh), borderValue=0)

    x = max(0, (width - nw) // 2 + offset[0])
    y = max(0, (height - nh) // 2 + offset[1])
    x2, y2 = min(width, x + nw), min(height, y + nh)
    region = background[y:y2, x:x2]
    card_region = warped[: y2 - y, : x2 - x]
    mask_region = warped_mask[: y2 - y, : x2 - x].astype(np.float32)[:, :, None] / 255.0
    background[y:y2, x:x2] = (card_region * mask_region + region * (1 - mask_region)).astype(np.uint8)
    return background


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    card = _pil_to_bgr(render_card())
    big = cv2.resize(card, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)

    print("生成测试样张（基础）：")
    _save(big, "clean.jpg")                                   # 清晰正面（基准）
    _save(_rotate(_canvas(card, 1.6), 12), "tilt12.jpg")      # 倾斜 12°
    _save(_rotate(_canvas(card, 1.6), -18), "tilt_minus18.jpg")  # 倾斜 -18°
    _save(_perspective(_canvas(card, 1.5)), "perspective.jpg")   # 透视畸变
    _save(_blur(big, 2.4), "blur.jpg")                        # 模糊
    _save(_darken(_blur(big, 1.2), 0.55), "dark.jpg")         # 暗光
    _save(cv2.resize(big, None, fx=0.38, fy=0.38, interpolation=cv2.INTER_AREA), "small.jpg")  # 低分辨率
    _save(_darken(_blur(_rotate(_canvas(card, 1.5), 15), 1.8), 0.68), "combo.jpg")  # 倾斜+模糊+暗光

    print("\n生成测试样张（模拟真实拍照）：")
    # 手持拍照：证件占画面约 45%，倾斜 + 光照不均 + JPEG 压缩
    photo1 = _place_on_background(card, 1800, 1350, 0.95, 9, offset=(60, -40))
    _save(_jpeg(_lighting(_blur(photo1, 1.1)), 68), "photo_tilt.jpg")
    # 困难：证件占 35%、大幅倾斜 + 透视、暗光、强压缩
    photo2 = _perspective(_place_on_background(card, 1800, 1350, 0.75, -21, offset=(-80, 70), seed=11), 0.10)
    _save(_jpeg(_lighting(_darken(_blur(photo2, 1.7), 0.62), 0.5, 0.95), 45), "photo_hard.jpg")
    # 拍屏幕：摩尔纹 + 反光渐变
    photo3 = _moire(_blur(_place_on_background(card, 1600, 1200, 1.5, 4, offset=(20, 10), seed=3), 1.4))
    _save(_jpeg(_lighting(photo3, 0.7, 1.1), 52), "photo_screen.jpg")
    # 证件很小（占 25%）+ 噪点
    photo4 = _place_on_background(card, 2000, 1500, 0.55, 16, offset=(-160, 90), seed=23)
    noise = np.random.default_rng(5).normal(0, 12, photo4.shape).astype(np.float32)
    _save(_jpeg(_lighting(np.clip(photo4 + noise, 0, 255).astype(np.uint8), 0.6, 1.0), 60), "photo_small.jpg")

    (OUT_DIR / "ground_truth.json").write_text(
        json.dumps(GROUND_TRUTH, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"\n共 {len(list(OUT_DIR.glob('*.jpg')))} 张，输出目录：{OUT_DIR}")


if __name__ == "__main__":
    main()
