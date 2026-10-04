"""统计汇总（不含作废单）。"""

from datetime import date

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from ..auth import require_login
from ..db import get_session
from ..models import PurchaseRecord

router = APIRouter(prefix="/api/stats", tags=["stats"])


def _summarize(records) -> dict:
    count = len(records)
    weight_kg = sum(record.priced_weight for record in records)
    amount = sum(record.total_amount for record in records)
    return {
        "count": count,
        "tons": round(weight_kg / 1000, 3),
        "amount": round(amount, 2),
    }


@router.get("/summary", dependencies=[Depends(require_login)])
def summary(session: Session = Depends(get_session)):
    records = session.exec(
        select(PurchaseRecord).where(PurchaseRecord.status != "void")
    ).all()

    today = date.today().isoformat()
    month_prefix = today[:7]

    today_records = [record for record in records if record.date == today]
    month_records = [record for record in records if record.date.startswith(month_prefix)]
    confirmed_records = [record for record in records if record.status == "confirmed"]

    return {
        "ok": True,
        "today": _summarize(today_records),
        "month": _summarize(month_records),
        "total": _summarize(records),
        "pendingConfirm": len([record for record in records if record.status == "draft"]),
    }
