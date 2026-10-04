"""OCR 与健康检查接口：与原 Node 版请求/响应契约保持一致（新增字段为兼容性扩展）。

准确率策略（模型为主，纯逻辑为辅，不依赖 OpenCV 几何检测）：
1. 图片准备：EXIF 纠正 + 尺寸规整；
2. 方向预判：专用提问让模型报告需顺时针旋转的角度，转正后再识别；
3. 提示词：抗倾斜、号码逐位辨认与校验位自检、禁止猜测，输出逐字段置信度；
4. 号码校验位自检 + 常见混淆字符（O/0、I/1 等）确定性纠正；
5. 号码不合格/姓名缺失 → 带线索整卡复读；住址缺失/过短/省籍不符/置信度偏低 → 住址聚焦复读；
6. 低置信度字段给出人工核对提示，绝不静默写入可疑数据。
"""

import base64
import binascii
import time
from collections import Counter

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from .. import config
from ..schemas import OcrResponse
from ..services import bailian, idcard, preprocess

router = APIRouter(prefix="/api")

LOW_CONFIDENCE = 0.6          # 一般字段的低置信度阈值
ADDRESS_CONFIDENCE = 0.85     # 住址字段更严：字形易混，低于此值提示重点核对
MIN_ADDRESS_LENGTH = 8


@router.get("/health")
def health():
    return {
        "ok": True,
        "provider": "bailian",
        "model": config.BAILIAN_MODEL,
        "bailianKeyReady": bool(config.BAILIAN_API_KEY),
        "visionToolReady": False,
        "tencentKeyReady": False,
    }


def _build_hint(fields: dict, id_number: str, valid: bool) -> str:
    """整卡复读的线索：告诉模型哪里读错了、该怎么改。"""
    hints = []
    if id_number and not valid:
        hints.append(
            f"上次读到的身份证号 {id_number} 校验位不通过，请重新逐位辨认身份证号"
            "（注意 0/O、1/I/l、8/B、5/S、2/Z、6/G 混淆），务必输出校验位正确的 18 位号码"
        )
    if not fields.get("name"):
        hints.append("上次没能读出姓名，请重点识别姓名区域")
    return "；".join(hints)


def _address_hint(address: str, id_number: str) -> str:
    province = idcard.province_of(id_number)
    hints = []
    if province:
        hints.append(f"该身份证号归属地为「{province}」，住址应以该省份开头")
    if address:
        hints.append(f"上次读到的住址是「{address}」，请逐字复核县名、镇名与村名，不要用同音字或形近字替代")
    return "；".join(hints)


def _adopt_address(current: str, candidate: str, id_number: str) -> bool:
    """判断聚焦复读的住址是否比首轮更好（避免无信号时反复改写）。"""
    if not candidate:
        return False
    current_ok = idcard.province_matches(current, id_number)
    candidate_ok = idcard.province_matches(candidate, id_number)
    if candidate_ok and not current_ok:
        return True
    if len(current) < MIN_ADDRESS_LENGTH and len(candidate) > len(current):
        return True
    return False


@router.post("/ocr/idcard")
async def ocr_idcard(request: Request):
    started = time.monotonic()

    content_type = request.headers.get("content-type", "")
    image_base64 = ""
    mime = "image/jpeg"

    if "application/json" in content_type:
        try:
            payload = await request.json()
        except Exception:  # noqa: BLE001
            return JSONResponse({"ok": False, "error": "请求体不是合法 JSON"}, status_code=400)
        raw = str(payload.get("imageBase64") or "")
        if raw.startswith("data:"):
            raw = raw.split(",", 1)[-1]
        image_base64 = raw.strip()
        mime = str(payload.get("mime") or mime)
    else:
        body = await request.body()
        image_base64 = base64.b64encode(body).decode()
        if content_type:
            mime = content_type.split(";")[0].strip()

    if not image_base64:
        return JSONResponse({"ok": False, "error": "缺少图片数据"}, status_code=400)

    try:
        image_bytes = base64.b64decode(image_base64, validate=False)
    except (binascii.Error, ValueError):
        return JSONResponse({"ok": False, "error": "图片数据无法解码"}, status_code=400)

    if not image_bytes:
        return JSONResponse({"ok": False, "error": "图片数据无法解码"}, status_code=400)
    if len(image_bytes) > config.MAX_IMAGE_BYTES:
        return JSONResponse({"ok": False, "error": "图片过大，请压缩后重试"}, status_code=413)

    # 1) 图片准备（EXIF 纠正 + 尺寸规整）
    try:
        processed, prepare_meta = preprocess.prepare_image(image_bytes)
    except preprocess.PrepareError as error:
        return JSONResponse({"ok": False, "error": str(error)}, status_code=400)

    # 2) 主识别
    try:
        fields = await bailian.recognize(processed)
    except bailian.BailianError as error:
        return JSONResponse({"ok": False, "error": str(error)}, status_code=500)
    confidence = fields.get("confidence") or {}

    # 4) 号码校验位自检 + 确定性纠正
    id_number = idcard.normalize_id(fields.get("idNumber"))
    valid = idcard.checksum_ok(id_number) if id_number else False
    if id_number and not valid:
        corrected = idcard.correct_id(id_number)
        if corrected:
            id_number, valid = corrected, True

    address = fields.get("address", "")
    address_confidence = confidence.get("address", 0)
    retried = False

    # 5) 整卡复读：号码仍不合格或姓名缺失
    hint = _build_hint(fields, id_number, valid)
    if hint:
        retried = True
        try:
            second = await bailian.recognize(processed, extra_hint=hint)
        except bailian.BailianError:
            second = None
        if second:
            second_id = idcard.normalize_id(second.get("idNumber"))
            second_valid = idcard.checksum_ok(second_id) if second_id else False
            if second_id and not second_valid:
                corrected = idcard.correct_id(second_id)
                if corrected:
                    second_id, second_valid = corrected, True
            if second_valid and not valid:
                id_number, valid = second_id, True
            if not fields.get("name") and second.get("name"):
                fields["name"] = second["name"]
            if not address and second.get("address"):
                address = second["address"]
                address_confidence = (second.get("confidence") or {}).get("address", 0)
            for key in ("name", "idNumber", "address"):
                if (second.get("confidence") or {}).get(key, 0) > confidence.get(key, 0):
                    confidence[key] = second["confidence"][key]

    # 6) 住址多角度投票：照片拍横/拍竖时，不同角度的读取结果会不同。
    #    0° 与 90° 两读一致即采信；不一致加读 180°、270° 取多数；
    #    仍无多数则保留首轮结果并提示人工核对（绝不静默写入可疑住址）。
    votes = [address] if address else []
    if address:
        retried = True
        for degrees in (90, 180, 270):
            if len(votes) >= 2 and votes.count(votes[0]) == len(votes):
                break  # 已全部一致
            try:
                candidate = await bailian.recognize_address(
                    preprocess.rotate_image(processed, degrees),
                    extra_hint=_address_hint(address, id_number),
                )
                candidate_address = candidate.get("address", "")
            except (bailian.BailianError, preprocess.PrepareError):
                break
            if not candidate_address:
                break
            votes.append(candidate_address)
            top, count = Counter(votes).most_common(1)[0]
            if count > len(votes) / 2:
                address = top
                break

    verified = len(votes) >= 2 and votes.count(address) == len(votes)
    if not verified and len(votes) >= 2:
        address_confidence = min(address_confidence, 0.5)  # 多读不一致，按低置信度处理

    # 7) 提示
    warnings = []
    if not fields.get("name"):
        warnings.append("未能识别姓名，请手动填写")
    if not id_number:
        warnings.append("未能识别身份证号，请手动填写")
    elif not valid:
        warnings.append("身份证号校验位不通过，请逐位核对")
    if not address:
        warnings.append("未能识别住址，请手动填写")
    elif not idcard.province_matches(address, id_number):
        warnings.append(f"住址与身份证号所属省份（{idcard.province_of(id_number)}）不一致，请核对")

    if 0 < confidence.get("name", 0) < LOW_CONFIDENCE:
        warnings.append(f"姓名识别置信度较低（{confidence['name']:.0%}），请重点核对")
    if 0 < confidence.get("idNumber", 0) < LOW_CONFIDENCE:
        warnings.append(f"身份证号识别置信度较低（{confidence['idNumber']:.0%}），请重点核对")
    if address and not verified:
        warnings.append("住址多次读取结果不一致，请人工核对县名、镇名与村名")
    elif address and 0 < address_confidence < ADDRESS_CONFIDENCE:
        warnings.append(f"住址识别置信度较低（{address_confidence:.0%}），请重点核对镇/村名")

    elapsed_ms = int((time.monotonic() - started) * 1000)
    return OcrResponse(
        name=fields.get("name", ""),
        idNumber=id_number,
        address=address,
        warnings=warnings,
        elapsedMs=elapsed_ms,
        checksumOk=valid,
        confidence=confidence,
            addressVerified=verified,
        retried=retried,
    )
