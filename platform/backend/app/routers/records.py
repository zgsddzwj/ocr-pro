"""收购单：草稿（可改）→ 确认（锁定、可打印收据）→ 作废（留档）。"""

from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlmodel import Session, func, or_, select

from ..auth import require_login
from ..db import get_session
from ..models import Farmer, PurchaseRecord
from ..schemas import RecordIn, RecordListOut, RecordOut, RecordPatch, SimpleOk
from ..services.excel import build_workbook
from ..services.money import compute_record
from ..services.settings import get_settings

router = APIRouter(prefix="/api/records", tags=["records"])

# 入参 camelCase -> 模型 snake_case
FIELD_MAP = {
    "product": "product",
    "vehicleNo": "vehicle_no",
    "grade": "grade",
    "moisture": "moisture",
    "impurity": "impurity",
    "moldy": "moldy",
    "gross": "gross",
    "tare": "tare",
    "deductSite": "deduct_site",
    "deductMoisture": "deduct_moisture",
    "deductImpurity": "deduct_impurity",
    "deductMoldy": "deduct_moldy",
    "pricePerKg": "price_per_kg",
    "unloadFee": "unload_fee",
    "unloadSpot": "unload_spot",
    "warehouse": "warehouse",
    "bankName": "bank_name",
    "bankCard": "bank_card",
    "phone": "phone",
    "weighInAt": "weigh_in_at",
    "weighOutAt": "weigh_out_at",
    "checker": "checker",
    "weigher": "weigher",
    "manager": "manager",
    "supervisor": "supervisor",
    "payer": "payer",
    "note": "note",
}


def _clean(value: str | None) -> str:
    return (value or "").strip()


def _next_receipt_no(session: Session, record_date: str) -> str:
    """编号规则：YYYYMMDD + 3 位当日流水（如 20261001047）。"""
    prefix = record_date.replace("-", "")
    taken = set(
        session.exec(
            select(PurchaseRecord.receipt_no).where(PurchaseRecord.receipt_no.like(f"{prefix}%"))
        ).all()
    )
    seq = 1
    while f"{prefix}{seq:03d}" in taken:
        seq += 1
    return f"{prefix}{seq:03d}"


def _record_inputs(record: PurchaseRecord) -> dict:
    """把记录的原始输入字段转成 compute_record 需要的 camelCase 字典。"""
    reverse = {snake: camel for camel, snake in FIELD_MAP.items()}
    inputs = {}
    for snake, camel in reverse.items():
        inputs[camel] = getattr(record, snake)
    return inputs


def _to_out(record: PurchaseRecord, farmer: Farmer | None, settings: dict) -> RecordOut:
    farmer_name = farmer.name if farmer else ""
    farmer_id_number = farmer.id_number if farmer else ""
    farmer_address = farmer.address if farmer else ""
    derived = compute_record(_record_inputs(record))
    return RecordOut(
        id=record.id,
        receiptNo=record.receipt_no,
        status=record.status,
        date=record.date,
        farmerId=record.farmer_id,
        farmerName=farmer_name,
        farmerIdNumber=farmer_id_number,
        farmerAddress=farmer_address,
        product=record.product,
        vehicleNo=record.vehicle_no,
        grade=record.grade,
        moisture=record.moisture,
        impurity=record.impurity,
        moldy=record.moldy,
        gross=record.gross,
        tare=record.tare,
        pricePerKg=record.price_per_kg,
        unloadFee=record.unload_fee,
        deductSite=record.deduct_site,
        deductMoisture=record.deduct_moisture,
        deductImpurity=record.deduct_impurity,
        deductMoldy=record.deduct_moldy,
        companyTitle=settings.get("companyTitle", ""),
        slipTitle=settings.get("slipTitle", ""),
        createdAt=record.created_at.isoformat(timespec="seconds"),
        confirmedAt=(record.confirmed_at.isoformat(timespec="seconds") if record.confirmed_at else ""),
        **derived,
    )


def _load_farmer(session: Session, farmer_id: str) -> Farmer:
    farmer = session.get(Farmer, farmer_id)
    if farmer is None:
        raise HTTPException(status_code=400, detail="农户不存在，请先在小程序提交或手工新增")
    return farmer


@router.post("", response_model=RecordOut, dependencies=[Depends(require_login)])
def create_record(payload: RecordIn, session: Session = Depends(get_session)):
    try:
        date.fromisoformat(payload.date)
    except ValueError:
        raise HTTPException(status_code=400, detail="日期格式应为 YYYY-MM-DD")

    farmer = _load_farmer(session, payload.farmerId)
    settings = get_settings(session)

    record = PurchaseRecord(
        receipt_no=_next_receipt_no(session, payload.date),
        farmer_id=farmer.id,
        date=payload.date,
        status="draft",
        created_by="platform",
    )
    for camel, snake in FIELD_MAP.items():
        setattr(record, snake, _clean(getattr(payload, camel)) if isinstance(getattr(payload, camel), str) else getattr(payload, camel))

    derived = compute_record(payload.model_dump())
    for key, value in derived.items():
        setattr(record, {
            "netWeight": "net_weight",
            "deductTotal": "deduct_total",
            "pricedWeight": "priced_weight",
            "pricePerJin": "price_per_jin",
            "grainAmount": "grain_amount",
            "totalAmount": "total_amount",
            "amountCn": "amount_cn",
        }[key], value)

    session.add(record)
    session.commit()
    session.refresh(record)
    return _to_out(record, farmer, settings)


@router.get("", response_model=RecordListOut, dependencies=[Depends(require_login)])
def list_records(
    status: str = "all",
    q: str = "",
    date_from: str = "",
    date_to: str = "",
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
):
    settings = get_settings(session)
    statement = select(PurchaseRecord, Farmer).join(
        Farmer, PurchaseRecord.farmer_id == Farmer.id, isouter=True
    )
    count_statement = (
        select(func.count())
        .select_from(PurchaseRecord)
        .join(Farmer, PurchaseRecord.farmer_id == Farmer.id, isouter=True)
    )

    conditions = []
    if status in ("draft", "confirmed", "void"):
        conditions.append(PurchaseRecord.status == status)
    elif status != "all":
        conditions.append(PurchaseRecord.status != "void")

    keyword = _clean(q)
    if keyword:
        like = f"%{keyword}%"
        conditions.append(
            or_(
                PurchaseRecord.receipt_no.like(like),
                Farmer.name.like(like),
                Farmer.id_number.like(like),
            )
        )
    if _clean(date_from):
        conditions.append(PurchaseRecord.date >= _clean(date_from))
    if _clean(date_to):
        conditions.append(PurchaseRecord.date <= _clean(date_to))

    for condition in conditions:
        statement = statement.where(condition)
        count_statement = count_statement.where(condition)

    total = session.exec(count_statement).one()
    rows = session.exec(
        statement.order_by(PurchaseRecord.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    items = []
    for record, farmer in rows:
        items.append(_to_out(record, farmer, settings))
    return RecordListOut(items=items, total=total)


@router.get("/export.xlsx", dependencies=[Depends(require_login)])
def export_records(session: Session = Depends(get_session)):
    """导出全部收购单为 Excel（收购明细 + 汇总统计）。"""
    pairs = session.exec(
        select(PurchaseRecord, Farmer)
        .join(Farmer, PurchaseRecord.farmer_id == Farmer.id, isouter=True)
        .order_by(PurchaseRecord.date, PurchaseRecord.receipt_no)
    ).all()
    filename = f'records_{date.today():%Y%m%d}.xlsx'
    return Response(
        content=build_workbook(pairs),
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'},
    )


@router.get("/{record_id}", response_model=RecordOut, dependencies=[Depends(require_login)])
def get_record(record_id: str, session: Session = Depends(get_session)):
    record = session.get(PurchaseRecord, record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="收购单不存在")
    farmer = session.get(Farmer, record.farmer_id)
    return _to_out(record, farmer, get_settings(session))


@router.put("/{record_id}", response_model=RecordOut, dependencies=[Depends(require_login)])
def update_record(
    record_id: str, payload: RecordPatch, session: Session = Depends(get_session)
):
    record = session.get(PurchaseRecord, record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="收购单不存在")
    if record.status != "draft":
        raise HTTPException(status_code=409, detail="已确认的单据不能修改，可先作废后重开")

    data = payload.model_dump(exclude_unset=True)

    if "farmerId" in data:
        farmer = _load_farmer(session, data.pop("farmerId"))
        record.farmer_id = farmer.id

    if "date" in data:
        new_date = data.pop("date")
        try:
            date.fromisoformat(new_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="日期格式应为 YYYY-MM-DD")
        if new_date != record.date:
            record.date = new_date
            record.receipt_no = _next_receipt_no(session, new_date)

    for camel, value in data.items():
        snake = FIELD_MAP.get(camel)
        if snake is None:
            continue
        setattr(record, snake, _clean(value) if isinstance(value, str) else value)

    derived = compute_record(_record_inputs(record))
    for key, value in derived.items():
        setattr(record, {
            "netWeight": "net_weight",
            "deductTotal": "deduct_total",
            "pricedWeight": "priced_weight",
            "pricePerJin": "price_per_jin",
            "grainAmount": "grain_amount",
            "totalAmount": "total_amount",
            "amountCn": "amount_cn",
        }[key], value)

    record.updated_at = datetime.now().astimezone()
    session.add(record)
    session.commit()
    session.refresh(record)
    farmer = session.get(Farmer, record.farmer_id)
    return _to_out(record, farmer, get_settings(session))


@router.post("/{record_id}/confirm", response_model=RecordOut, dependencies=[Depends(require_login)])
def confirm_record(record_id: str, session: Session = Depends(get_session)):
    record = session.get(PurchaseRecord, record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="收购单不存在")
    if record.status == "confirmed":
        raise HTTPException(status_code=409, detail="该单据已确认")
    if record.status == "void":
        raise HTTPException(status_code=409, detail="已作废的单据不能确认")

    record.status = "confirmed"
    record.confirmed_at = datetime.now().astimezone()
    session.add(record)
    session.commit()
    session.refresh(record)
    farmer = session.get(Farmer, record.farmer_id)
    return _to_out(record, farmer, get_settings(session))


@router.post("/{record_id}/void", response_model=RecordOut, dependencies=[Depends(require_login)])
def void_record(record_id: str, session: Session = Depends(get_session)):
    record = session.get(PurchaseRecord, record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="收购单不存在")
    if record.status == "void":
        raise HTTPException(status_code=409, detail="该单据已作废")

    record.status = "void"
    session.add(record)
    session.commit()
    session.refresh(record)
    farmer = session.get(Farmer, record.farmer_id)
    return _to_out(record, farmer, get_settings(session))


@router.delete("/{record_id}", response_model=SimpleOk, dependencies=[Depends(require_login)])
def delete_record(record_id: str, session: Session = Depends(get_session)):
    record = session.get(PurchaseRecord, record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="收购单不存在")
    if record.status == "confirmed":
        raise HTTPException(status_code=409, detail="已确认的单据不能删除，请使用作废")
    session.delete(record)
    session.commit()
    return SimpleOk()
