"""Checks that the diary of stock changes agrees with the stock rows.

Every inventory row should have a quantity equal to the sum of the deltas of its
movements. The diary is written after the row, so a crash in between can leave them
apart. This script only reports; it never fixes anything.
"""

import argparse
import sys
from dataclasses import dataclass

from sqlmodel import Session

from app.db import get_engine
from app.repositories.inventory import InventoryRepository
from app.repositories.movements import MovementRepository
from app.settings import settings

# Differences smaller than this are float noise, not a missing movement.
TOLERANCE = 1e-6


@dataclass(frozen=True)
class Difference:
    """A product whose stock does not match its diary.

    Attributes:
        ean: The product's barcode.
        stock: The quantity in the inventory row (0 when the row does not exist).
        diary: The sum of the deltas of its movements.
    """

    ean: str
    stock: float
    diary: float


def find_differences(session: Session) -> list[Difference]:
    """Compares every stock row with the sum of its movements.

    Args:
        session: A session over the database to check.

    Returns:
        One entry per product that does not match, ordered by EAN.
    """
    stocks = {
        item.ean: item.quantity for item in InventoryRepository(session).list_all()
    }
    diaries = MovementRepository(session).balances()
    differences = [
        Difference(ean, stocks.get(ean, 0.0), diaries.get(ean, 0.0))
        for ean in sorted(set(stocks) | set(diaries))
    ]
    return [d for d in differences if abs(d.stock - d.diary) > TOLERANCE]


def format_report(differences: list[Difference]) -> str:
    """Writes the report for a person.

    Args:
        differences: The mismatches found.

    Returns:
        A one-line OK message, or one line per mismatch.
    """
    if not differences:
        return "OK: every stock row agrees with its movements."
    lines = [f"{len(differences)} product(s) do not agree with their movements:"]
    lines += [
        f"  {d.ean}: stock {d.stock:g}, movements add up to {d.diary:g}"
        for d in differences
    ]
    return "\n".join(lines)


def main(argv: list[str] | None = None) -> int:
    """Command line entry point.

    Args:
        argv: Command line arguments. Defaults to `sys.argv`.

    Returns:
        0 when everything agrees, 1 when there are differences.
    """
    parser = argparse.ArgumentParser(description="Check stock against its movements.")
    parser.add_argument("--db", default=settings.database_url, help="Database URL.")
    arguments = parser.parse_args(argv)
    with Session(get_engine(arguments.db)) as session:
        differences = find_differences(session)
    print(format_report(differences))
    return 1 if differences else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
