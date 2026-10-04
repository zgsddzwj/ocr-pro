"""平台设置（键值存储 + 默认值）。"""

from sqlmodel import Session

from ..models import AppSetting

DEFAULTS = {
    "companyTitle": "",
    "slipTitle": "原粮收购统一凭证",
    "checkNoPrefix": "",
    "defaultProduct": "玉米",
    "defaultPricePerKg": "0",
}

EDITABLE_KEYS = set(DEFAULTS)


def get_settings(session: Session) -> dict:
    result = dict(DEFAULTS)
    rows = session.query(AppSetting).filter(AppSetting.key.in_(EDITABLE_KEYS)).all()
    for row in rows:
        if row.key in EDITABLE_KEYS:
            result[row.key] = row.value
    return result


def update_settings(session: Session, patch: dict) -> dict:
    for key, value in patch.items():
        if key not in EDITABLE_KEYS:
            continue
        row = session.get(AppSetting, key)
        if row is None:
            row = AppSetting(key=key, value="")
        row.value = str(value if value is not None else "")
        session.add(row)
    session.commit()
    return get_settings(session)
