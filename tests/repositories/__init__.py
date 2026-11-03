"""Shared low-stock cases: (quantity, threshold, expected low) from the stock spec."""

LOW_STOCK_CASES = [
    (0, 0, True),
    (0.5, 0, False),
    (2, 2, False),
    (1, 2, True),
    (0.5, 1, True),
    (3, 2, False),
]
