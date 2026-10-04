"""图片准备：EXIF 方向校正 + 尺寸规整。

只做无风险的标准化；证件是否歪斜、要不要旋转，交给视觉大模型判断
（`detect_orientation`），需要转正时用 `rotate_image` 旋转字节后重读。
不依赖 OpenCV、不做几何检测——实测几何检测在杂乱背景下不可靠。
"""

import io

from PIL import Image, ImageOps

MAX_LONG_SIDE = 2000  # 控制上传体积，长边超过则等比缩小
JPEG_QUALITY = 90

# 顺时针角度 -> PIL transpose 模式（无损旋转）
_TURNS = {
    90: Image.Transpose.ROTATE_270,   # 顺时针 90° = 逆时针 270°
    180: Image.Transpose.ROTATE_180,
    270: Image.Transpose.ROTATE_90,
}


class PrepareError(Exception):
    pass


def prepare_image(image_bytes: bytes) -> tuple[bytes, dict]:
    """EXIF 方向校正 + 长边超限时等比缩小。返回 (JPEG 字节, 信息)。"""
    try:
        image = Image.open(io.BytesIO(image_bytes))
        image = ImageOps.exif_transpose(image).convert("RGB")
    except Exception as error:  # noqa: BLE001
        raise PrepareError(f"图片无法解码: {error}") from error

    meta = {"originalSize": f"{image.width}x{image.height}", "resized": False}
    long_side = max(image.size)
    if long_side > MAX_LONG_SIDE:
        scale = MAX_LONG_SIDE / long_side
        image = image.resize(
            (round(image.width * scale), round(image.height * scale)), Image.LANCZOS
        )
        meta["resized"] = True
    meta["size"] = f"{image.width}x{image.height}"

    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=JPEG_QUALITY)
    return buffer.getvalue(), meta


def rotate_image(image_bytes: bytes, degrees: int) -> bytes:
    """按顺时针角度无损旋转整张图片（90/180/270）。"""
    image = Image.open(io.BytesIO(image_bytes))
    image = ImageOps.exif_transpose(image).convert("RGB")
    mode = _TURNS.get(degrees % 360)
    if mode is not None:
        image = image.transpose(mode)
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=JPEG_QUALITY)
    return buffer.getvalue()
