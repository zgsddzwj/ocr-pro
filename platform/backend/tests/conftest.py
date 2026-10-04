import os
import tempfile
from pathlib import Path

# 必须在导入 app 之前把数据目录指向临时路径
_TMP = Path(tempfile.mkdtemp(prefix="ocr-pro-test-"))
os.environ["DATA_DIR"] = str(_TMP)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlmodel import SQLModel  # noqa: E402

from app.db import engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture()
def client():
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture()
def auth_client(client):
    """已设置密码并登录的客户端。"""
    response = client.post("/api/auth/setup", json={"password": "grain123"})
    assert response.status_code == 200
    token = response.json()["token"]
    client.headers.update({"Authorization": f"Bearer {token}"})
    return client
