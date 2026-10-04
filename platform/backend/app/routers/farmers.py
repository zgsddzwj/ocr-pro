"""农户：小程序提交（免登录、按身份证号幂等）+ 平台管理（需登录）。"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, func, or_, select

from ..auth import require_login
from ..db import get_session
from ..models import Farmer, PurchaseRecord
from ..schemas import FarmerListOut, FarmerOut, FarmerSubmit, FarmerUpdate, SimpleOk

router = APIRouter(prefix="/api/farmers", tags=["farmers"])


def _clean(value: str | None) -> str:
    return (value or "").strip()


def _normalize_id_number(value: str) -> str:
    return _clean(value).upper()


def _to_out(farmer: Farmer) -> FarmerOut:
    return FarmerOut(
        id=farmer.id,
        name=farmer.name,
        idNumber=farmer.id_number,
        address=farmer.address,
        phone=farmer.phone,
        source=farmer.source,
        createdAt=farmer.created_at.isoformat(timespec="seconds"),
        updatedAt=farmer.updated_at.isoformat(timespec="seconds"),
    )


@router.post("/submit")
def submit_farmer(payload: FarmerSubmit, session: Session = Depends(get_session)):
    """小程序采集提交：同一身份证号已存在则更新，否则新建（幂等）。"""
    name = _clean(payload.name)
    id_number = _normalize_id_number(payload.idNumber)
    address = _clean(payload.address)
    phone = _clean(payload.phone)

    if not name:
        raise HTTPException(status_code=400, detail="姓名不能为空")
    if not id_number:
        raise HTTPException(status_code=400, detail="身份证号不能为空")

    farmer = session.exec(select(Farmer).where(Farmer.id_number == id_number)).first()
    created = farmer is None
    if farmer is None:
        farmer = Farmer(
            name=name,
            id_number=id_number,
            address=address,
            phone=phone,
            source="miniprogram",
        )
    else:
        farmer.name = name
        farmer.address = address or farmer.address
        farmer.phone = phone or farmer.phone
        farmer.updated_at = datetime.now().astimezone()

    session.add(farmer)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=409, detail="保存失败，请重试")
    session.refresh(farmer)

    return {"ok": True, "created": created, "farmer": _to_out(farmer).model_dump()}


@router.get("", response_model=FarmerListOut, dependencies=[Depends(require_login)])
def list_farmers(
    q: str = "",
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    session: Session = Depends(get_session),
):
    keyword = _clean(q)
    statement = select(Farmer)
    count_statement = select(func.count()).select_from(Farmer)
    if keyword:
        like = f"%{keyword}%"
        condition = or_(
            Farmer.name.like(like),
            Farmer.id_number.like(like),
            Farmer.address.like(like),
            Farmer.phone.like(like),
        )
        statement = statement.where(condition)
        count_statement = count_statement.where(condition)

    total = session.exec(count_statement).one()
    rows = session.exec(
        statement.order_by(Farmer.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    ).all()
    return FarmerListOut(items=[_to_out(row) for row in rows], total=total)


@router.put("/{farmer_id}", response_model=FarmerOut, dependencies=[Depends(require_login)])
def update_farmer(
    farmer_id: str, payload: FarmerUpdate, session: Session = Depends(get_session)
):
    farmer = session.get(Farmer, farmer_id)
    if farmer is None:
        raise HTTPException(status_code=404, detail="农户不存在")
    if payload.name is not None:
        farmer.name = _clean(payload.name)
        if not farmer.name:
            raise HTTPException(status_code=400, detail="姓名不能为空")
    if payload.address is not None:
        farmer.address = _clean(payload.address)
    if payload.phone is not None:
        farmer.phone = _clean(payload.phone)
    farmer.updated_at = datetime.now().astimezone()
    session.add(farmer)
    session.commit()
    session.refresh(farmer)
    return _to_out(farmer)


@router.delete("/{farmer_id}", response_model=SimpleOk, dependencies=[Depends(require_login)])
def delete_farmer(farmer_id: str, session: Session = Depends(get_session)):
    farmer = session.get(Farmer, farmer_id)
    if farmer is None:
        raise HTTPException(status_code=404, detail="农户不存在")
    used = session.exec(
        select(func.count()).select_from(PurchaseRecord).where(PurchaseRecord.farmer_id == farmer_id)
    ).one()
    if used:
        raise HTTPException(status_code=409, detail="该农户已有收购单，不能删除")
    session.delete(farmer)
    session.commit()
    return SimpleOk()
