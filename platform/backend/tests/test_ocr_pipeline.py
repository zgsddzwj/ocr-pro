"""图片准备（EXIF/尺寸/旋转）与身份证号校验 单元测试（全部离线）。"""

import io

import pytest
from PIL import Image, ImageOps

from app.services import idcard, preprocess

TRUTH_ID = "11010519491231002X"
TRUTH_ADDRESS = "北京市海淀区中关村大街27号"


# ---------- 身份证号 ----------
@pytest.mark.parametrize(
    "value,expected",
    [
        (TRUTH_ID, True),
        ("11010119900307451x", False),   # 末位应为 4，不是 X
        ("110105194912310021", False),   # 末位错
        ("110105491231002", True),       # 15 位旧证号
        ("1101051949123100", False),     # 位数不足
        ("", False),
        ("11O1O519491231002X", False),   # 含字母 O，原始值不通过
    ],
)
def test_checksum(value, expected):
    assert idcard.checksum_ok(value) is expected


def test_correct_confused_characters():
    """0 被读成 O 时应能确定性纠正回来。"""
    assert idcard.correct_id("11O1O519491231002X") == TRUTH_ID
    assert idcard.correct_id(TRUTH_ID) == TRUTH_ID
    assert idcard.correct_id("110105194912310021") is None  # 纠不了的返回 None


def test_normalize_keeps_letters_for_correction():
    assert idcard.normalize_id("1101 0519 4912 3100 2X") == TRUTH_ID
    assert idcard.normalize_id("11o1o519491231002x") == "11O1O519491231002X"


def test_province_cross_check():
    assert idcard.province_of(TRUTH_ID) == "北京"
    assert idcard.province_matches(TRUTH_ADDRESS, TRUTH_ID) is True
    assert idcard.province_matches("上海市浦东新区张江路88号", TRUTH_ID) is False
    assert idcard.province_matches("", TRUTH_ID) is False
    # 号码长度不合法时不做省籍判断，避免误报
    assert idcard.province_of("12345") == ""
    assert idcard.province_matches("随便写的地址", "12345") is True


# ---------- 图片准备 ----------
def _jpeg(size=(1200, 900), color=(200, 210, 220)) -> bytes:
    img = Image.new("RGB", size, color)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=92)
    return buf.getvalue()


def test_prepare_resizes_oversized_image():
    data, meta = preprocess.prepare_image(_jpeg((4000, 3000)))
    decoded = Image.open(io.BytesIO(data))
    assert max(decoded.size) == preprocess.MAX_LONG_SIDE
    assert meta["resized"] is True


def test_prepare_keeps_small_image():
    data, meta = preprocess.prepare_image(_jpeg((900, 700)))
    decoded = Image.open(io.BytesIO(data))
    assert decoded.size == (900, 700)
    assert meta["resized"] is False


def test_prepare_applies_exif_orientation():
    """手机竖拍：存储为横向 900x600 + EXIF Orientation 6，应被转正为 600x900。"""
    stored = Image.new("RGB", (900, 600), (150, 160, 170))
    buf = io.BytesIO()
    exif = Image.Exif()
    exif[274] = 6  # Orientation: Rotate 90 CW
    stored.save(buf, format="JPEG", exif=exif.tobytes())

    data, _ = preprocess.prepare_image(buf.getvalue())
    decoded = ImageOps.exif_transpose(Image.open(io.BytesIO(data)))
    assert decoded.size == (600, 900)


def test_rotate_image_swaps_dimensions():
    data = preprocess.rotate_image(_jpeg((1200, 800)), 90)
    decoded = Image.open(io.BytesIO(data))
    assert decoded.size == (800, 1200)


def test_prepare_rejects_broken_bytes():
    with pytest.raises(preprocess.PrepareError):
        preprocess.prepare_image(b"not-an-image")
