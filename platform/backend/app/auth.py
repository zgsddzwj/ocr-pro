"""单账号密码登录：PBKDF2 口令哈希 + HMAC 签名 token（全部标准库实现）。"""

import base64
import hashlib
import hmac
import json
import secrets
import time

from fastapi import HTTPException, Request
from sqlmodel import Session

from .config import TOKEN_TTL_SECONDS, get_secret
from .models import AppSetting

PASSWORD_KEY = "password_hash"
PBKDF2_ITERATIONS = 200_000


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), salt.encode("utf-8"), PBKDF2_ITERATIONS
    ).hex()
    return f"pbkdf2${PBKDF2_ITERATIONS}${salt}${digest}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _, iterations, salt, digest = stored.split("$")
        candidate = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), salt.encode("utf-8"), int(iterations)
        ).hex()
        return hmac.compare_digest(candidate, digest)
    except (ValueError, TypeError):
        return False


def get_password_hash(session: Session) -> str | None:
    setting = session.get(AppSetting, PASSWORD_KEY)
    return setting.value if setting and setting.value else None


def set_password(session: Session, password: str) -> None:
    setting = session.get(AppSetting, PASSWORD_KEY)
    if setting is None:
        setting = AppSetting(key=PASSWORD_KEY, value="")
    setting.value = hash_password(password)
    session.add(setting)
    session.commit()


def _sign(payload: dict) -> str:
    secret = get_secret()
    body = base64.urlsafe_b64encode(json.dumps(payload).encode()).decode().rstrip("=")
    signature = hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()
    return f"{body}.{signature}"


def _verify(token: str) -> dict | None:
    try:
        body, signature = token.rsplit(".", 1)
        secret = get_secret()
        expected = hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            return None
        padded = body + "=" * (-len(body) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded))
        if payload.get("exp", 0) < time.time():
            return None
        return payload
    except (ValueError, TypeError, json.JSONDecodeError):
        return None


def create_token() -> str:
    return _sign({"v": 1, "exp": int(time.time()) + TOKEN_TTL_SECONDS})


def require_login(request: Request) -> None:
    authorization = request.headers.get("authorization", "")
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="未登录")
    if _verify(authorization.removeprefix("Bearer ").strip()) is None:
        raise HTTPException(status_code=401, detail="登录已过期，请重新登录")


def login(session: Session, password: str) -> str:
    stored = get_password_hash(session)
    if stored is None:
        raise HTTPException(status_code=400, detail="尚未设置密码，请先完成初始化")
    if not verify_password(password, stored):
        raise HTTPException(status_code=401, detail="密码错误")
    return create_token()


def setup_password(session: Session, password: str) -> None:
    if get_password_hash(session) is not None:
        raise HTTPException(status_code=409, detail="密码已设置，请直接登录或使用修改密码")
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="密码至少 6 位")
    set_password(session, password)


def change_password(session: Session, old_password: str, new_password: str) -> None:
    stored = get_password_hash(session)
    if stored is None or not verify_password(old_password, stored):
        raise HTTPException(status_code=400, detail="原密码不正确")
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="新密码至少 6 位")
    set_password(session, new_password)


def needs_setup(session: Session) -> bool:
    return get_password_hash(session) is None


__all__ = [
    "PASSWORD_KEY",
    "change_password",
    "create_token",
    "login",
    "needs_setup",
    "require_login",
    "setup_password",
]
