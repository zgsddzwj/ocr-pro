"""身份证号校验与 OCR 常见误识的确定性纠正。"""

# GB 11643 校验位算法
WEIGHTS = [7, 9, 10, 5, 8, 4, 2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2]
CODES = "10X98765432"

# OCR/大模型常见的字符混淆（仅在校验位不通过时用于确定性纠正）
CONFUSION = {
    "O": "0", "o": "0", "Q": "0", "D": "0",
    "I": "1", "l": "1", "i": "1", "|": "1",
    "B": "8", "S": "5", "s": "5", "Z": "2", "z": "2",
    "G": "6", "T": "7", "A": "4", "g": "9",
}


def normalize_id(value: str | None) -> str:
    """去掉空格/分隔符，保留数字与字母（字母留给 correct_id 做混淆纠正），末位 x 转大写。"""
    if not value:
        return ""
    cleaned = "".join(ch for ch in str(value) if ch.isalnum())
    return cleaned.upper()


def checksum_ok(value: str | None) -> bool:
    """18 位身份证校验位校验；15 位旧证号无校验位视为通过；空值/含非法字符视为不通过。"""
    normalized = normalize_id(value)
    if len(normalized) == 15:
        return normalized.isdigit()
    if len(normalized) != 18 or not normalized[:17].isdigit():
        return False
    if not (normalized[17].isdigit() or normalized[17] == "X"):
        return False
    total = sum(int(normalized[i]) * WEIGHTS[i] for i in range(17))
    return CODES[total % 11] == normalized[17]


def correct_id(value: str | None) -> str | None:
    """尝试用常见字符混淆表纠正出校验位通过的号码；纠正不了返回 None。"""
    normalized = normalize_id(value)
    if len(normalized) != 18:
        return None
    if checksum_ok(normalized):
        return normalized

    positions = [(index, CONFUSION[ch]) for index, ch in enumerate(normalized) if ch in CONFUSION]

    # 单点替换
    for index, replacement in positions:
        candidate = normalized[:index] + replacement + normalized[index + 1:]
        if checksum_ok(candidate):
            return candidate

    # 双点组合（数量有限，代价可控）
    for first in range(len(positions)):
        for second in range(first + 1, len(positions)):
            index_a, repl_a = positions[first]
            index_b, repl_b = positions[second]
            chars = list(normalized)
            chars[index_a] = repl_a
            chars[index_b] = repl_b
            candidate = "".join(chars)
            if checksum_ok(candidate):
                return candidate
    return None


# 身份证前两位 = 省级行政区代码（GB/T 2260）
PROVINCE_CODES = {
    "11": "北京", "12": "天津", "13": "河北", "14": "山西", "15": "内蒙古",
    "21": "辽宁", "22": "吉林", "23": "黑龙江",
    "31": "上海", "32": "江苏", "33": "浙江", "34": "安徽", "35": "福建", "36": "江西", "37": "山东",
    "41": "河南", "42": "湖北", "43": "湖南", "44": "广东", "45": "广西", "46": "海南",
    "50": "重庆", "51": "四川", "52": "贵州", "53": "云南", "54": "西藏",
    "61": "陕西", "62": "甘肃", "63": "青海", "64": "宁夏", "65": "新疆",
    "71": "台湾", "81": "香港", "82": "澳门",
}


def province_of(value: str | None) -> str:
    """由身份证号前两位得到省级简称；号码长度不合法（非 15/18 位）时返回空串。"""
    normalized = normalize_id(value)
    if len(normalized) not in (15, 18):
        return ""
    return PROVINCE_CODES.get(normalized[:2], "")


def province_matches(address: str | None, id_number: str | None) -> bool:
    """住址是否与身份证号所属省份一致（无法判断时视为一致，不误报）。"""
    province = province_of(id_number)
    if not province:
        return True
    if not address:
        return False
    return province in address
