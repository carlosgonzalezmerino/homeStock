from sqlmodel import Session

from app.constants import REASON_PURCHASE
from app.db import create_db_and_tables, get_engine
from app.models import InventoryItem, Product, StockMovement
from scripts.check_movements import Difference, find_differences, format_report, main


def _session() -> Session:
    engine = get_engine("sqlite://")
    create_db_and_tables(engine)
    session = Session(engine)
    for ean in ("a", "b"):
        session.add(Product(ean=ean, name=ean, source="manual"))
    session.commit()
    return session


def _stock(session: Session, ean: str, quantity: float) -> None:
    session.add(InventoryItem(ean=ean, quantity=quantity, threshold=1))
    session.commit()


def _move(session: Session, ean: str, delta: float) -> None:
    session.add(
        StockMovement(
            ean=ean, delta=delta, quantity_after=delta, reason=REASON_PURCHASE,
            source="app",
        )
    )  # fmt: skip
    session.commit()


def test_find_differences_is_empty_when_stock_and_diary_agree() -> None:
    session = _session()
    _stock(session, "a", 3)
    _move(session, "a", 2)
    _move(session, "a", 1)
    assert find_differences(session) == []


def test_find_differences_reports_a_stock_without_movements() -> None:
    session = _session()
    _stock(session, "a", 3)
    assert find_differences(session) == [Difference("a", 3, 0)]


def test_find_differences_reports_movements_without_a_stock_row() -> None:
    session = _session()
    _move(session, "b", 5)
    assert find_differences(session) == [Difference("b", 0, 5)]


def test_find_differences_ignores_float_noise() -> None:
    session = _session()
    _stock(session, "a", 0.3)
    _move(session, "a", 0.1)
    _move(session, "a", 0.2)
    assert find_differences(session) == []


def test_format_report_says_ok_or_lists_every_product() -> None:
    assert format_report([]).startswith("OK")
    report = format_report([Difference("a", 3, 1)])
    assert "1 product(s)" in report and "a: stock 3, movements add up to 1" in report


def test_main_returns_the_exit_code_of_the_check(tmp_path, capsys) -> None:
    url = f"sqlite:///{tmp_path / 'check.db'}"
    engine = get_engine(url)
    create_db_and_tables(engine)
    assert main(["--db", url]) == 0
    with Session(engine) as session:
        session.add(Product(ean="a", name="a", source="manual"))
        session.add(InventoryItem(ean="a", quantity=2, threshold=1))
        session.commit()
    assert main(["--db", url]) == 1
    assert "do not agree" in capsys.readouterr().out
