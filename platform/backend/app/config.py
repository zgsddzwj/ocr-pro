import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent  # platform/backend
load_dotenv(BASE_DIR / ".env")

HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))

DATA_DIR = Path(os.getenv("DATA_DIR", str(BASE_DIR / "data")))
DB_PATH = DATA_DIR / "app.db"
SECRET_FILE = DATA_DIR / "secret.key"

BAILIAN_API_KEY = os.getenv("BAILIAN_API_KEY", "")
BAILIAN_MODEL = os.getenv("BAILIAN_MODEL", "qwen-vl-plus")
BAILIAN_BASE_URL = os.getenv(
    "BAILIAN_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1"
)
BAILIAN_TIMEOUT = float(os.getenv("BAILIAN_TIMEOUT", "30"))
# 高分辨率图像输入（部分模型有效，实测对预处理后的图提升有限，默认关闭）
BAILIAN_HIGH_RES = os.getenv("BAILIAN_HIGH_RES", "0") == "1"

# 上传图片大小上限（原始字节）
MAX_IMAGE_BYTES = 10 * 1024 * 1024

# 前端构建产物目录
FRONTEND_DIST = BASE_DIR.parent / "frontend" / "dist"

TOKEN_TTL_SECONDS = 30 * 24 * 3600


def ensure_data_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)


def get_secret() -> str:
    """签名密钥：首次运行自动生成并保存到 data/secret.key"""
    ensure_data_dir()
    if SECRET_FILE.exists():
        secret = SECRET_FILE.read_text().strip()
        if secret:
            return secret
    import secrets

    secret = secrets.token_hex(32)
    SECRET_FILE.write_text(secret)
    return secret
