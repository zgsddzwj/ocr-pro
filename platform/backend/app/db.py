from sqlmodel import Session, create_engine

from .config import DB_PATH, ensure_data_dir

engine = create_engine(
    f"sqlite:///{DB_PATH}",
    connect_args={"check_same_thread": False},
)


def init_db() -> None:
    ensure_data_dir()
    from . import models  # noqa: F401 确保表定义已加载

    from sqlmodel import SQLModel

    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
