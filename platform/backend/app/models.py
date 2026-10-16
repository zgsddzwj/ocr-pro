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
    product: str = Field(default="")  # 产品名称
    grade: str = Field(default="")  # 产品等级

    # 粮情检斤（% 与公斤，均由录入提供）
    moisture: float = Field(default=0.0)  # 水分%
    impurity: float = Field(default=0.0)  # 杂质霉变%
    gross: float = Field(default=0.0)  # 毛重
    tare: float = Field(default=0.0)  # 皮重
    deduct_total: float = Field(default=0.0)  # 综合扣量（手填）

    # 结算
    price_per_kg: float = Field(default=0.0)  # 单价

    # 其他信息
    unload_spot: str = Field(default="")  # 卸车货位
    bank_card: str = Field(default="")  # 银行账号
    phone: str = Field(default="")  # 联系电话
    weigh_in_at: str = Field(default="")  # 毛检时间
    weigh_out_at: str = Field(default="")  # 皮检时间
    checker: str = Field(default="")  # 化验员
    supervisor: str = Field(default="")  # 监管员

    # 派生字段（服务端计算后落库）
    net_weight: float = Field(default=0.0)  # 净重 = 毛重 − 皮重 − 综合扣量
    price_per_jin: float = Field(default=0.0)  # 市斤价 = 单价 ÷ 2
    grain_amount: float = Field(default=0.0)  # 金额 = 净重 × 单价
    amount_cn: str = Field(default="")  # 金额大写

    status: str = Field(default="draft", index=True)  # draft/confirmed/void
    created_by: str = Field(default="")
    created_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)
    confirmed_at: datetime | None = Field(default=None)


class AppSetting(SQLModel, table=True):
    __tablename__ = "app_settings"

    key: str = Field(primary_key=True)
    value: str = Field(default="")
