from pathlib import Path

from sqlalchemy import text

from app.db import get_engine
from app.migrations import head_revision
from scripts.off_import import main

FIXTURE = str(Path(__file__).parent / "fixtures" / "off_sample.csv")


def test_main_on_a_new_database_applies_migrations_before_importing(
    tmp_path, capsys
) -> None:
    url = f"sqlite:///{tmp_path / 'fresh.db'}"
    main(["--csv", FIXTURE, "--db", url])
    with get_engine(url).connect() as connection:
        version = connection.execute(text("select version_num from alembic_version"))
        imported = connection.execute(text("select count(*) from off_products"))
        assert (version.scalar_one(), imported.scalar_one()) == (head_revision(), 1)
    assert "Imported 1 OFF products" in capsys.readouterr().out


def test_main_twice_on_the_same_database_does_not_fail_or_duplicate(tmp_path) -> None:
    url = f"sqlite:///{tmp_path / 'again.db'}"
    main(["--csv", FIXTURE, "--db", url])
    main(["--csv", FIXTURE, "--db", url])
    with get_engine(url).connect() as connection:
        assert (
            connection.execute(text("select count(*) from off_products")).scalar_one()
            == 1
        )
