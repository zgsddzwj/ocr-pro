"""API 入参/出参模型（统一 camelCase，兼容小程序既有契约）。"""

from pydantic import BaseModel, Field


# ---------- OCR / 健康 ----------
class OcrResponse(BaseModel):
    ok: bool = True
    provider: str = "bailian"
    name: str = ""
    idNumber: str = ""
    address: str = ""
    warnings: list[str] = []
    elapsedMs: int = 0
    # 兼容性扩展（小程序端可选使用）
    checksumOk: bool = False
    confidence: dict = {}
    addressVerified: bool = False
    retried: bool = False


# ---------- 农户 ----------
class FarmerSubmit(BaseModel):
    name: str
    idNumber: str
    address: str = ""
    phone: str = ""


class FarmerUpdate(BaseModel):
    name: str | None = None
    address: str | None = None
    phone: str | None = None


class FarmerOut(BaseModel):
    id: str
    name: str
    idNumber: str
    address: str
    phone: str
    source: str
    createdAt: str
    updatedAt: str


class FarmerListOut(BaseModel):
    ok: bool = True
    items: list[FarmerOut]
    total: int


# ---------- 收购单 ----------
class RecordIn(BaseModel):
    farmerId: str
    date: str
    product: str = ""
    grade: str = ""
    moisture: float = 0.0
    impurity: float = 0.0
    gross: float = 0.0
    tare: float = 0.0
    deductTotal: float = 0.0
    pricePerKg: float = 0.0
    unloadSpot: str = ""
    bankCard: str = ""
    phone: str = ""
    weighInAt: str = ""
    weighOutAt: str = ""
    checker: str = ""
    supervisor: str = ""


class RecordPatch(BaseModel):
    """部分更新：仅覆盖传入字段。"""

    date: str | None = None
    product: str | None = None
    grade: str | None = None
    moisture: float | None = None
    impurity: float | None = None
    gross: float | None = None
    tare: float | None = None
    deductTotal: float | None = None
    pricePerKg: float | None = None
    unloadSpot: str | None = None
    bankCard: str | None = None
    phone: str | None = None
    weighInAt: str | None = None
    weighOutAt: str | None = None
    checker: str | None = None
    supervisor: str | None = None
    farmerId: str | None = None


class RecordOut(BaseModel):
    ok: bool = True
    id: str
    receiptNo: str
    status: str
    date: str
    farmerId: str
    farmerName: str = ""
    farmerIdNumber: str = ""
    farmerAddress: str = ""
    product: str = ""
    grade: str = ""
    moisture: float = 0.0
    impurity: float = 0.0
    gross: float = 0.0
    tare: float = 0.0
    deductTotal: float = 0.0
    netWeight: float = 0.0
    pricePerKg: float = 0.0
    pricePerJin: float = 0.0
    grainAmount: float = 0.0
    amountCn: str = ""
    unloadSpot: str = ""
    bankCard: str = ""
    phone: str = ""
    weighInAt: str = ""
    weighOutAt: str = ""
    checker: str = ""
    supervisor: str = ""
    companyTitle: str = ""
    slipTitle: str = ""
    createdAt: str = ""
    confirmedAt: str = ""


class RecordListOut(BaseModel):
    ok: bool = True
    items: list[RecordOut]
    total: int


# ---------- 认证 ----------
class PasswordIn(BaseModel):
    password: str = Field(min_length=1)


class ChangePasswordIn(BaseModel):
    oldPassword: str
    newPassword: str


class TokenOut(BaseModel):
    ok: bool = True
    token: str


class SimpleOk(BaseModel):
    ok: bool = True
