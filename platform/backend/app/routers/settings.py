"""平台设置：公司抬头、凭证标题、默认品名/单价等。"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session

from ..auth import require_login
from ..db import get_session
from ..services.settings import get_settings, update_settings

router = APIRouter(prefix="/api/settings", tags=["settings"], dependencies=[Depends(require_login)])


class SettingsPatch(BaseModel):
    companyTitle: str | None = None
    slipTitle: str | None = None
    checkNoPrefix: str | None = None
    defaultProduct: str | None = None
    defaultPricePerKg: str | None = None


@router.get("")
def read_settings(session: Session = Depends(get_session)):
    return {"ok": True, **get_settings(session)}


@router.put("")
def write_settings(payload: SettingsPatch, session: Session = Depends(get_session)):
    patch = {key: value for key, value in payload.model_dump().items() if value is not None}
    data = update_settings(session, patch)
    return {"ok": True, **data}
