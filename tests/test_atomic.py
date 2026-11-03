import pytest
from sqlmodel import Session, select

from app.db import atomic, commit_unless_atomic, create_db_and_tables, get_engine
from app.models import Product


@pytest.fixture
def session() -> Session:
    engine = get_engine("sqlite://")
    create_db_and_tables(engine)
    with Session(engine) as db_session:
        yield db_session


def _add(session: Session, ean: str) -> None:
    session.add(Product(ean=ean, name=ean, source="manual"))
    commit_unless_atomic(session)


def _eans(session: Session) -> list[str]:
    return sorted(product.ean for product in session.exec(select(Product)).all())


def test_commit_unless_atomic_outside_a_block_commits(session: Session) -> None:
    _add(session, "a")
    session.rollback()
    assert _eans(session) == ["a"]


def test_atomic_block_commits_everything_when_it_finishes(session: Session) -> None:
    with atomic(session):
        _add(session, "a")
        _add(session, "b")
    session.rollback()
    assert _eans(session) == ["a", "b"]


def test_atomic_block_rolls_back_everything_when_it_raises(session: Session) -> None:
    with pytest.raises(RuntimeError), atomic(session):
        _add(session, "a")
        _add(session, "b")
        raise RuntimeError("boom")
    assert _eans(session) == []


def test_atomic_block_lets_a_write_be_seen_by_the_next_statement(
    session: Session,
) -> None:
    with atomic(session):
        _add(session, "a")
        assert _eans(session) == ["a"]


def test_atomic_block_does_not_undo_what_was_committed_before_it(
    session: Session,
) -> None:
    _add(session, "before")
    with pytest.raises(RuntimeError), atomic(session):
        _add(session, "inside")
        raise RuntimeError("boom")
    assert _eans(session) == ["before"]


def test_atomic_after_a_failure_normal_writes_commit_again(session: Session) -> None:
    with pytest.raises(RuntimeError), atomic(session):
        raise RuntimeError("boom")
    _add(session, "later")
    session.rollback()
    assert _eans(session) == ["later"]


def test_atomic_blocks_nest_by_joining_the_outer_one(session: Session) -> None:
    with pytest.raises(RuntimeError), atomic(session):
        _add(session, "outer")
        with atomic(session):
            _add(session, "inner")
        raise RuntimeError("boom")
    assert _eans(session) == []
