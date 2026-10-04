"""金额大写与结算计算单元测试（对齐收购凭证口径）。"""

import pytest

from app.services.money import amount_to_cn, compute_record, int_to_cn


@pytest.mark.parametrize(
    "value,expected",
    [
        (0, "零"),
        (10, "壹拾"),
        (100, "壹佰"),
        (105, "壹佰零伍"),
        (1005, "壹仟零伍"),
        (1050, "壹仟零伍拾"),
        (3060, "叁仟零陆拾"),
        (6914, "陆仟玖佰壹拾肆"),
        (7834, "柒仟捌佰叁拾肆"),
        (10000, "壹万"),
        (10005, "壹万零伍"),
        (100000, "壹拾万"),
        (1000000, "壹佰万"),
        (100000050, "壹亿零伍拾"),
    ],
)
def test_int_to_cn(value, expected):
    assert int_to_cn(value) == expected


@pytest.mark.parametrize(
    "amount,expected",
    [
        (0, "零圆整"),
        (6914, "陆仟玖佰壹拾肆圆整"),
        (6914.8, "陆仟玖佰壹拾肆圆捌角"),
        (6914.55, "陆仟玖佰壹拾肆圆伍角伍分"),
        (6914.05, "陆仟玖佰壹拾肆圆零角伍分"),
        (0.5, "零圆伍角"),
        (7677, "柒仟陆佰柒拾柒圆整"),
    ],
)
def test_amount_to_cn(amount, expected):
    assert amount_to_cn(amount) == expected


def test_compute_record_matches_voucher():
    """图一样例口径：毛重4918 皮重1858 水分扣130 → 扣后2930 × 2.36。"""
    result = compute_record(
        {
            "gross": 4918,
            "tare": 1858,
            "deductSite": 0,
            "deductMoisture": 130,
            "deductImpurity": 0,
            "deductMoldy": 0,
            "pricePerKg": 2.36,
            "unloadFee": 0,
        }
    )
    assert result["netWeight"] == 3060
    assert result["deductTotal"] == 130
    assert result["pricedWeight"] == 2930
    assert result["pricePerJin"] == 1.18
    assert result["grainAmount"] == 6914.8
    assert result["totalAmount"] == 6914.8
    assert result["amountCn"] == "陆仟玖佰壹拾肆圆捌角"


def test_compute_record_rounding_half_up():
    result = compute_record(
        {
            "gross": 1000,
            "tare": 0,
            "deductSite": 0,
            "deductMoisture": 0,
            "deductImpurity": 0,
            "deductMoldy": 0,
            "pricePerKg": 2.675,
            "unloadFee": 0,
        }
    )
    assert result["grainAmount"] == 2675.0
