import pytest
from sqlmodel import Session, text

from app import db as db_module


def test_get_session_without_engine_raises_runtime_error(monkeypatch) -> None:
    monkeypatch.setattr(db_module, "_engine", None)
    with pytest.raises(RuntimeError, match="engine not initialized"):
        next(db_module.get_session())


def test_is_engine_set_after_set_engine_returns_true(monkeypatch) -> None:
    monkeypatch.setattr(db_module, "_engine", None)
    assert db_module.is_engine_set() is False
    db_module.set_engine(db_module.get_engine("sqlite://"))
    assert db_module.is_engine_set() is True


def test_get_engine_non_sqlite_url_uses_that_dialect() -> None:
    engine = db_module.get_engine(
        "mysql+pymysql://user:secret@localhost:3306/homestock"
    )
    assert engine.dialect.name == "mysql"


def test_get_engine_in_memory_sqlite_shares_data_between_sessions() -> None:
    engine = db_module.get_engine("sqlite://")
    with Session(engine) as writer:
        writer.exec(text("create table sample (id integer)"))
        writer.exec(text("insert into sample values (7)"))
        writer.commit()
    with Session(engine) as reader:
        assert reader.exec(text("select id from sample")).one()[0] == 7


def test_get_session_with_engine_yields_a_working_session(monkeypatch) -> None:
    monkeypatch.setattr(db_module, "_engine", db_module.get_engine("sqlite://"))
    session = next(db_module.get_session())
    assert session.exec(text("select 1")).one()[0] == 1
