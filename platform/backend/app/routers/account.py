"""登录与密码管理。"""

from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session

from .. import auth
from ..db import get_session
from ..schemas import ChangePasswordIn, PasswordIn, SimpleOk, TokenOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.get("/status")
def status(session: Session = Depends(get_session)):
    return {"ok": True, "needsSetup": auth.needs_setup(session)}


@router.post("/setup", response_model=TokenOut)
def setup(payload: PasswordIn, session: Session = Depends(get_session)):
    """首次使用：设置管理密码（仅当尚未设置时可用）。"""
    auth.setup_password(session, payload.password)
    return TokenOut(token=auth.create_token())


@router.post("/login", response_model=TokenOut)
def login(payload: PasswordIn, session: Session = Depends(get_session)):
    return TokenOut(token=auth.login(session, payload.password))


@router.put("/password", response_model=SimpleOk, dependencies=[Depends(auth.require_login)])
def change_password(payload: ChangePasswordIn, session: Session = Depends(get_session)):
    auth.change_password(session, payload.oldPassword, payload.newPassword)
    return SimpleOk()
