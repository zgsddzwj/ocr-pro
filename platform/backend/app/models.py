import uuid
from datetime import datetime, timezone

from sqlmodel import Field, SQLModel


def _id() -> str:
    return uuid.uuid4().hex


def _now() -> datetime:
    # 带时区的本地时间（SQLModel 新版要求 aware datetime）
    return datetime.now().astimezone()


class Farmer(SQLModel, table=True):
    __tablename__ = "farmers"

    id: str = Field(default_factory=_id, primary_key=True)
    name: str = Field(index=True)
    id_number: str = Field(unique=True, index=True)
    address: str = Field(default="")
    phone: str = Field(default="")
    # miniprogram=小程序采集 / manual=平台手工录入
    source: str = Field(default="manual")
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)


class PurchaseRecord(SQLModel, table=True):
    __tablename__ = "purchase_records"

    id: str = Field(default_factory=_id, primary_key=True)
    receipt_no: str = Field(unique=True, index=True)
    farmer_id: str = Field(index=True, foreign_key="farmers.id")

    date: str  # YYYY-MM-DD
    product: str = Field(default="")
    vehicle_no: str = Field(default="")
    grade: str = Field(default="")

    # 粮情（% 与公斤，均由录入提供）
    moisture: float = Field(default=0.0)
    impurity: float = Field(default=0.0)
    moldy: float = Field(default=0.0)
    gross: float = Field(default=0.0)
    tare: float = Field(default=0.0)

    # 扣量（公斤，手填）
    deduct_site: float = Field(default=0.0)
    deduct_moisture: float = Field(default=0.0)
    deduct_impurity: float = Field(default=0.0)
    deduct_moldy: float = Field(default=0.0)

    # 结算
    price_per_kg: float = Field(default=0.0)
    unload_fee: float = Field(default=0.0)

    # 其他信息
    unload_spot: str = Field(default="")
    warehouse: str = Field(default="")
    bank_name: str = Field(default="")
    bank_card: str = Field(default="")
    phone: str = Field(default="")
    weigh_in_at: str = Field(default="")
    weigh_out_at: str = Field(default="")
    checker: str = Field(default="")
    weigher: str = Field(default="")
    manager: str = Field(default="")
    supervisor: str = Field(default="")
    payer: str = Field(default="")
    note: str = Field(default="")

    # 派生字段（服务端计算后落库）
    net_weight: float = Field(default=0.0)
    deduct_total: float = Field(default=0.0)
    priced_weight: float = Field(default=0.0)
    price_per_jin: float = Field(default=0.0)
    grain_amount: float = Field(default=0.0)
    total_amount: float = Field(default=0.0)
    amount_cn: str = Field(default="")

    status: str = Field(default="draft", index=True)  # draft/confirmed/void
    created_by: str = Field(default="")
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)
    confirmed_at: datetime | None = Field(default=None)


class AppSetting(SQLModel, table=True):
    __tablename__ = "app_settings"

    key: str = Field(primary_key=True)
    value: str = Field(default="")
