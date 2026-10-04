"""结算计算与中文大写金额。

计算口径（与凭证一致）：
  净重 = 毛重 - 皮重
  扣量总重 = 场地扣量 + 水分扣量 + 杂质扣量 + 生霉扣量
  计价净重（扣后净重） = 净重 - 扣量总重
  粮食价款 = 计价净重 × 公斤价
  市斤价 = 公斤价 ÷ 2
  结算价款 = 粮食价款 - 卸车费
金额一律用 Decimal + ROUND_HALF_UP，避免二进制浮点误差。
"""

from decimal import ROUND_HALF_UP, Decimal

CN_DIGITS = "零壹贰叁肆伍陆柒捌玖"
CN_POSITIONS = ["", "拾", "佰", "仟"]
CN_GROUPS = ["", "万", "亿", "兆"]


def dec(value) -> Decimal:
    if value is None or value == "":
        return Decimal("0")
    return Decimal(str(value))


def quantize(value, places: int) -> float:
    quantum = Decimal(1).scaleb(-places)
    return float(dec(value).quantize(quantum, rounding=ROUND_HALF_UP))


def int_to_cn(value: int) -> str:
    """非负整数的大写（不带“圆”）。"""
    if value < 0:
        raise ValueError("负数不支持")
    if value == 0:
        return "零"

    groups = []
    remaining = value
    while remaining > 0:
        groups.append(remaining % 10000)
        remaining //= 10000

    parts: list[str] = []
    zero_pending = False
    for gi in range(len(groups) - 1, -1, -1):
        group = groups[gi]
        if group == 0:
            zero_pending = True
            continue

        group_cn = ""
        zero_in_group = False
        emitted = False
        for pos in range(3, -1, -1):
            digit = (group // 10**pos) % 10
            if digit == 0:
                if emitted:
                    zero_in_group = True
                continue
            if zero_in_group:
                group_cn += "零"
                zero_in_group = False
            group_cn += CN_DIGITS[digit] + CN_POSITIONS[pos]
            emitted = True

        if parts and (zero_pending or group < 1000):
            parts.append("零")
        parts.append(group_cn + CN_GROUPS[gi])
        zero_pending = False

    return "".join(parts)


def amount_to_cn(amount) -> str:
    """人民币大写：6914.00 -> 陆仟玖佰壹拾肆圆整；6914.55 -> ...伍角伍分。"""
    negative = dec(amount) < 0
    cents = int((dec(abs(amount)) * 100).quantize(Decimal("1"), rounding=ROUND_HALF_UP))
    yuan = cents // 100
    jiao = (cents % 100) // 10
    fen = cents % 10

    text = int_to_cn(yuan) + "圆"
    if jiao == 0 and fen == 0:
        text += "整"
    else:
        text += ("零" if jiao == 0 else CN_DIGITS[jiao]) + "角"
        if fen > 0:
            text += CN_DIGITS[fen] + "分"

    return ("负" + text) if negative else text


def compute_record(inputs: dict) -> dict:
    """根据录入项计算派生字段，返回 rounded float + 大写。"""
    net_weight = dec(inputs.get("gross")) - dec(inputs.get("tare"))
    deduct_total = (
        dec(inputs.get("deductSite"))
        + dec(inputs.get("deductMoisture"))
        + dec(inputs.get("deductImpurity"))
        + dec(inputs.get("deductMoldy"))
    )
    priced_weight = net_weight - deduct_total
    price_per_kg = dec(inputs.get("pricePerKg"))
    grain_amount = priced_weight * price_per_kg
    unload_fee = dec(inputs.get("unloadFee"))
    total_amount = grain_amount - unload_fee

    return {
        "netWeight": quantize(net_weight, 3),
        "deductTotal": quantize(deduct_total, 3),
        "pricedWeight": quantize(priced_weight, 3),
        "pricePerJin": quantize(price_per_kg / 2, 4),
        "grainAmount": quantize(grain_amount, 2),
        "totalAmount": quantize(total_amount, 2),
        "amountCn": amount_to_cn(total_amount),
    }
