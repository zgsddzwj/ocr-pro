"""阿里云百炼（DashScope）视觉大模型识别，OpenAI 兼容接口。

准确率相关要点：
- 提示词要求先"摆正"倾斜证件再识别，号码逐位辨认并做校验位自检，禁止猜测；
- 支持二次识别（extra_hint）：校验位不过或缺字段时，带着具体线索再问一次；
- 返回每字段置信度，供前端提示人工复核。
"""

import base64
import json
import re

import httpx

from .. import config

PROMPT = (
    "你是身份证信息提取助手。照片可能倾斜、旋转、有反光、阴影或模糊，请先在脑中把证件摆正，"
    "再逐项读取信息。严格只输出一个 JSON 对象，不要输出 Markdown 代码块或任何其他文字，格式："
    '{"name":"姓名","idNumber":"证件号码","address":"住址",'
    '"confidence":{"name":0.0,"idNumber":0.0,"address":0.0}}。'
    "要求："
    '1. name：姓名本身（2-15 个汉字，少数民族姓名可含间隔号·），不含"姓名"两字。'
    "2. idNumber：18 位（或 15 位）号码，逐位辨认，只含数字、末位可为大写 X，不要空格。"
    "第 18 位是校验位，请用国标校验规则自检；若自检不通过，请重新逐位辨认后再输出"
    "（特别注意 0/O、1/I/l、8/B、5/S、2/Z、6/G 容易混淆）。"
    "3. address：逐字保留证件上印刷的完整住址（省→门牌号），不要拆分、省略或改写。"
    "4. confidence：每个字段 0~1 的置信度，看不清给低分。"
    "5. 看不清的字段输出空字符串，绝对不要猜测或编造。"
)


class BailianError(Exception):
    """携带用户可读信息的识别异常。"""


def extract_json(text: str | None) -> dict | None:
    if not text:
        return None
    value = str(text).strip()
    fence = re.search(r"```(?:json)?\s*([\s\S]*?)```", value, re.IGNORECASE)
    if fence:
        value = fence.group(1).strip()
    start = value.find("{")
    end = value.rfind("}")
    if start == -1 or end <= start:
        return None
    try:
        return json.loads(value[start : end + 1])
    except json.JSONDecodeError:
        return None


def compact(value) -> str:
    return "".join(str(value if value is not None else "").split())


def normalize_fields(fields: dict | None) -> dict:
    source = fields or {}
    confidence = source.get("confidence") if isinstance(source.get("confidence"), dict) else {}
    return {
        "name": compact(source.get("name") or source.get("Name") or ""),
        "idNumber": compact(
            source.get("idNumber") or source.get("id_number") or source.get("IdNum") or ""
        ).upper(),
        "address": compact(source.get("address") or source.get("Address") or ""),
        "confidence": {
            "name": float(confidence.get("name") or 0),
            "idNumber": float(confidence.get("idNumber") or 0),
            "address": float(confidence.get("address") or 0),
        },
    }


async def recognize(image_bytes: bytes, extra_hint: str = "", mime: str = "image/jpeg") -> dict:
    """识别身份证人像面，返回 {name, idNumber, address, confidence}。

    extra_hint: 二次识别时追加的具体线索（如"上次号码校验位不通过，请重点重读号码"）。
    """
    api_key = config.BAILIAN_API_KEY
    if not api_key:
        raise BailianError("未配置百炼 API Key，请在 platform/backend/.env 中填写")

    image_base64 = base64.b64encode(image_bytes).decode()
    prompt = PROMPT if not extra_hint else f"{PROMPT}\n\n补充线索（请重点核对）：{extra_hint}"

    payload = {
        "model": config.BAILIAN_MODEL,
        "temperature": 0,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{image_base64}"}},
                    {"type": "text", "text": prompt},
                ],
            }
        ],
    }
    if config.BAILIAN_HIGH_RES:
        payload["vl_high_resolution_images"] = True

    try:
        async with httpx.AsyncClient(timeout=config.BAILIAN_TIMEOUT) as client:
            response = await client.post(
                f"{config.BAILIAN_BASE_URL}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json=payload,
            )
    except httpx.TimeoutException as error:
        raise BailianError("百炼识别请求超时，请重试") from error
    except httpx.HTTPError as error:
        raise BailianError(f"无法连接百炼服务: {error}") from error

    if response.status_code == 401:
        raise BailianError("百炼 API Key 无效，请检查 platform/backend/.env")
    if response.status_code >= 400:
        detail = ""
        try:
            body = response.json()
            detail = f": {body['error']['message']}" if body.get("error") else ""
        except Exception:  # noqa: BLE001
            pass
        raise BailianError(f"百炼识别失败（HTTP {response.status_code}）{detail}")

    body = response.json()
    choices = body.get("choices") or []
    content = (choices[0].get("message") or {}).get("content") if choices else ""
    fields = extract_json(content)
    if fields is None:
        raise BailianError("百炼返回的内容无法解析，请重试")
    return normalize_fields(fields)


ADDRESS_PROMPT = (
    "这是一张身份证照片。请只输出住址字段，格式：{\"address\":\"住址\",\"confidence\":0.0}，"
    "不要输出其他字段或任何其他文字。要求：从省/自治区开始逐字照抄到门牌号，"
    "特别注意镇名/村名的字形（楼/桥、丙/河、凤/风、真/直 等容易看错），"
    "不要改写、不要补全、不要用同音字替代；看不清的字留空。"
)


async def recognize_address(image_bytes: bytes, extra_hint: str = "", mime: str = "image/jpeg") -> dict:
    """聚焦复读住址（单字段提示词，注意力集中，用于住址校验/补全）。"""
    api_key = config.BAILIAN_API_KEY
    if not api_key:
        raise BailianError("未配置百炼 API Key，请在 platform/backend/.env 中填写")

    image_base64 = base64.b64encode(image_bytes).decode()
    prompt = ADDRESS_PROMPT if not extra_hint else f"{ADDRESS_PROMPT}\n补充线索（请重点核对）：{extra_hint}"

    payload = {
        "model": config.BAILIAN_MODEL,
        "temperature": 0,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{image_base64}"}},
                {"type": "text", "text": prompt},
            ],
        }],
    }

    try:
        async with httpx.AsyncClient(timeout=config.BAILIAN_TIMEOUT) as client:
            response = await client.post(
                f"{config.BAILIAN_BASE_URL}/chat/completions",
                headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
                json=payload,
            )
    except httpx.TimeoutException as error:
        raise BailianError("百炼识别请求超时，请重试") from error
    except httpx.HTTPError as error:
        raise BailianError(f"无法连接百炼服务: {error}") from error

    if response.status_code >= 400:
        raise BailianError(f"百炼识别失败（HTTP {response.status_code}）")

    choices = response.json().get("choices") or []
    content = (choices[0].get("message") or {}).get("content") if choices else ""
    data = extract_json(content) or {}
    confidence = data.get("confidence")
    if isinstance(confidence, dict):
        confidence = confidence.get("address") or 0
    return {"address": compact(data.get("address") or ""), "confidence": float(confidence or 0)}


