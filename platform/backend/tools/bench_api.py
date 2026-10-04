"""通过真实接口跑全部样张，统计端到端准确率（含预处理、校验、二次识别）。

用法：.venv/bin/python tools/bench_api.py [接口地址]
"""
import json
import sys
from pathlib import Path

import httpx

FIXTURES = Path(__file__).resolve().parent.parent / "testdata" / "fixtures"
TRUTH = json.loads((FIXTURES / "ground_truth.json").read_text(encoding="utf-8"))
REAL_TRUTH = {}
real_truth_file = FIXTURES / "ground_truth_real.json"
if real_truth_file.exists():
    REAL_TRUTH = json.loads(real_truth_file.read_text(encoding="utf-8"))
API = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000/api/ocr/idcard"

hits = {"name": 0, "id": 0, "addr": 0, "full": 0}
names = sorted(p.name for p in FIXTURES.glob("*.jpg"))
print(f"接口 {API} | 样张 {len(names)} 张 | 真值 {TRUTH['name']} / {TRUTH['idNumber']}\n")
print(f"{'样张':<18}{'姓名':<6}{'号码':<6}{'住址':<6}{'拉平':<6}{'复读':<6}{'耗时'}")
for name in names:
    truth = REAL_TRUTH.get(name, TRUTH)
    data = (FIXTURES / name).read_bytes()
    response = httpx.post(API, content=data, headers={"Content-Type": "image/jpeg"}, timeout=120)
    body = response.json()
    ok_name = body.get("name") == truth["name"]
    ok_id = body.get("idNumber") == truth["idNumber"]
    ok_addr = body.get("address") == truth["address"]
    mark = lambda b: "✓" if b else "✗"  # noqa: E731
    print(f"{name:<18}{mark(ok_name):<6}{mark(ok_id):<6}{mark(ok_addr):<6}"
          f"{'是' if body.get('deskewed') else '否':<6}{'是' if body.get('retried') else '否':<6}"
          f"{body.get('elapsedMs')}ms")
    if not (ok_name and ok_id and ok_addr):
        print(f"      实际: {body.get('name')} / {body.get('idNumber')} / {body.get('address')}")
        if body.get("warnings"):
            print(f"      提示: {body['warnings']}")
    for key, ok in (("name", ok_name), ("id", ok_id), ("addr", ok_addr)):
        hits[key] += 1 if ok else 0
    if ok_name and ok_id and ok_addr:
        hits["full"] += 1

total = len(names)
print(f"\n端到端：姓名 {hits['name']}/{total}  号码 {hits['id']}/{total}  住址 {hits['addr']}/{total}  三项全对 {hits['full']}/{total}")
