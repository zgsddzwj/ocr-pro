"""模型与参数探测：在困难样张上对比 qwen-vl 系列的识别效果。"""
import asyncio
import base64
import json
import sys
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app.config import BAILIAN_API_KEY, BAILIAN_BASE_URL  # noqa: E402

PROMPT = (
    "你是身份证信息提取助手。照片可能倾斜、旋转、有反光、阴影或模糊，请先在脑中把证件摆正再识别。"
    "严格只输出一个 JSON 对象，不要输出 Markdown 代码块或任何其他文字，格式："
    '{"name":"姓名","idNumber":"证件号码","address":"住址",'
    '"confidence":{"name":0.0,"idNumber":0.0,"address":0.0}}。'
    "要求："
    '1. name：姓名本身（2-15个汉字，少数民族姓名可含间隔号·），不含"姓名"两字。'
    "2. idNumber：18 位（或 15 位）号码，逐位辨认，只含数字、末位可为大写 X，不要空格。"
    "第 18 位是校验位，请用国标校验规则自检；若自检不通过，请重新逐位辨认后再输出"
    "（注意 0/O、1/I/l、8/B、5/S、2/Z 容易混淆）。"
    "3. address：逐字保留证件上印刷的完整住址（省→门牌号），不要拆分、省略或改写。"
    "4. confidence：每个字段 0~1 的置信度，看不清给低分。"
    "5. 看不清的字段输出空字符串，绝对不要猜测或编造。"
)

FIXTURES = Path(__file__).resolve().parent.parent / "testdata" / "fixtures"
TRUTH = json.loads((FIXTURES / "ground_truth.json").read_text(encoding="utf-8"))


async def probe(model: str, image_name: str, high_res: bool = False) -> None:
    image = base64.b64encode((FIXTURES / image_name).read_bytes()).decode()
    body = {
        "model": model,
        "temperature": 0,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image}"}},
                {"type": "text", "text": PROMPT},
            ],
        }],
    }
    if high_res:
        body["vl_high_resolution_images"] = True

    try:
        async with httpx.AsyncClient(timeout=90) as client:
            response = await client.post(
                f"{BAILIAN_BASE_URL}/chat/completions",
                headers={"Authorization": f"Bearer {BAILIAN_API_KEY}", "Content-Type": "application/json"},
                json=body,
            )
    except Exception as error:  # noqa: BLE001
        print(f"  {model}{' +highres' if high_res else ''}: 请求异常 {error}")
        return

    if response.status_code != 200:
        detail = response.text[:200].replace("\n", " ")
        print(f"  {model}{' +highres' if high_res else ''}: HTTP {response.status_code} {detail}")
        return

    content = response.json()["choices"][0]["message"]["content"]
    try:
        start, end = content.index("{"), content.rindex("}")
        data = json.loads(content[start:end + 1])
    except Exception:  # noqa: BLE001
        print(f"  {model}: 无法解析 -> {content[:160]}")
        return

    name_ok = data.get("name") == TRUTH["name"]
    id_ok = (data.get("idNumber") or "").upper() == TRUTH["idNumber"]
    addr_ok = (data.get("address") or "") == TRUTH["address"]
    marks = "".join("✓" if ok else "✗" for ok in (name_ok, id_ok, addr_ok))
    print(f"  {model}{' +highres' if high_res else ''}: 姓名/号码/住址 = {marks}")
    if not (name_ok and id_ok and addr_ok):
        print(f"      返回: name={data.get('name')!r} id={data.get('idNumber')!r} addr={data.get('address')!r}")
    if data.get("confidence"):
        print(f"      置信度: {data['confidence']}")


async def main() -> None:
    image = sys.argv[1] if len(sys.argv) > 1 else "combo.jpg"
    print(f"样张：{image}（真值：{TRUTH['name']} / {TRUTH['idNumber']} / {TRUTH['address']}）")
    for model in ("qwen-vl-plus", "qwen-vl-max-latest", "qwen3-vl-plus", "qwen-vl-max"):
        await probe(model, image)
    print("  —— 高分辨率参数测试 ——")
    await probe("qwen-vl-plus", image, high_res=True)
    await probe("qwen-vl-max-latest", image, high_res=True)


if __name__ == "__main__":
    asyncio.run(main())
