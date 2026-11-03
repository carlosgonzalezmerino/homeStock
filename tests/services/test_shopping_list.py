import pytest
from sqlmodel import Session

from app.constants import (
    REASON_INITIAL,
    REASON_PURCHASE,
    SHOPPING_PURCHASE_THRESHOLD,
    SOURCE_SHOPPING_LIST,
)
from app.repositories.movements import MovementRepository
from app.repositories.products import ProductRepository
from app.repositories.shopping_list import ShoppingListRepository
from app.services.inventory import InventoryService, ProductNotFoundError
from app.services.shopping_list import (
    ShoppingItemNotFoundError,
    ShoppingListService,
)
from tests.services.conftest import EAN, OTHER_EAN


@pytest.fixture
def shopping(
    session: Session, inventory_service: InventoryService
) -> ShoppingListService:
    return ShoppingListService(
        ShoppingListRepository(session), ProductRepository(session), inventory_service
    )


def _track(service: InventoryService, ean: str = EAN, quantity: float = 3) -> None:
    service.start_tracking(ean, quantity=quantity, threshold=1, unit="L", location=None)


def _pick(shopping: ShoppingListService, ean: str) -> None:
    shopping.update(ean, {"checked": True})


class TestAdd:
    def test_add_catalogue_product_creates_a_line_with_quantity_one(
        self, shopping: ShoppingListService
    ) -> None:
        line, is_new = shopping.add(EAN)
        assert is_new is True
        assert (line.item.quantity, line.item.checked) == (1, False)

    def test_add_with_explicit_quantity_keeps_it(
        self, shopping: ShoppingListService
    ) -> None:
        line, _ = shopping.add(EAN, 2.5)
        assert line.item.quantity == 2.5

    def test_add_product_already_on_the_list_sums_the_quantity(
        self, shopping: ShoppingListService
    ) -> None:
        shopping.add(EAN, 1)
        line, is_new = shopping.add(EAN, 2.25)
        assert (is_new, line.item.quantity) == (False, 3.25)
        assert len(shopping.lines()) == 1

    def test_add_summing_decimals_does_not_leave_float_noise(
        self, shopping: ShoppingListService
    ) -> None:
        shopping.add(EAN, 0.1)
        line, _ = shopping.add(EAN, 0.2)
        assert line.item.quantity == 0.3

    def test_add_unknown_product_raises_product_not_found(
        self, shopping: ShoppingListService
    ) -> None:
        with pytest.raises(ProductNotFoundError):
            shopping.add("ghost")


class TestLines:
    def test_lines_empty_when_nothing_was_added_even_with_empty_stock(
        self, shopping: ShoppingListService, inventory_service: InventoryService
    ) -> None:
        _track(inventory_service, quantity=0)
        assert shopping.lines() == []

    def test_lines_show_the_current_stock_and_its_unit(
        self, shopping: ShoppingListService, inventory_service: InventoryService
    ) -> None:
        _track(inventory_service, quantity=3)
        shopping.add(EAN)
        line = shopping.lines()[0]
        assert (line.in_stock, line.unit) == (3, "L")

    def test_lines_product_not_in_the_pantry_has_no_stock_and_default_unit(
        self, shopping: ShoppingListService
    ) -> None:
        shopping.add(EAN)
        line = shopping.lines()[0]
        assert (line.in_stock, line.unit) == (None, "units")

    def test_lines_keep_the_order_in_which_products_were_added(
        self, shopping: ShoppingListService
    ) -> None:
        shopping.add(OTHER_EAN)
        shopping.add(EAN)
        assert [line.item.ean for line in shopping.lines()] == [OTHER_EAN, EAN]


class TestUpdateAndRemove:
    def test_update_changes_quantity_and_checked_independently(
        self, shopping: ShoppingListService
    ) -> None:
        shopping.add(EAN, 1)
        shopping.update(EAN, {"quantity": 4})
        line = shopping.update(EAN, {"checked": True})
        assert (line.item.quantity, line.item.checked) == (4, True)

    def test_update_product_not_on_the_list_raises(
        self, shopping: ShoppingListService
    ) -> None:
        with pytest.raises(ShoppingItemNotFoundError):
            shopping.update(EAN, {"checked": True})

    def test_remove_takes_the_line_off_the_list(
        self, shopping: ShoppingListService
    ) -> None:
        shopping.add(EAN)
        shopping.remove(EAN)
        assert shopping.lines() == []

    def test_remove_product_not_on_the_list_raises(
        self, shopping: ShoppingListService
    ) -> None:
        with pytest.raises(ShoppingItemNotFoundError):
            shopping.remove(EAN)


class TestPurchase:
    def test_purchase_adds_picked_lines_to_existing_stock_and_clears_them(
        self, shopping: ShoppingListService, inventory_service: InventoryService
    ) -> None:
        _track(inventory_service, quantity=3)
        shopping.add(EAN, 2)
        _pick(shopping, EAN)
        summary = shopping.purchase()
        assert (summary.added, summary.created) == (1, 0)
        assert inventory_service.get_item(EAN).quantity == 5
        assert shopping.lines() == []

    def test_purchase_creates_the_stock_row_with_threshold_zero(
        self, shopping: ShoppingListService, inventory_service: InventoryService
    ) -> None:
        shopping.add(EAN, 2)
        _pick(shopping, EAN)
        summary = shopping.purchase()
        item = inventory_service.get_item(EAN)
        assert (summary.added, summary.created) == (1, 1)
        assert (item.quantity, item.threshold, item.unit, item.location) == (
            2,
            SHOPPING_PURCHASE_THRESHOLD,
            "units",
            None,
        )

    def test_purchase_leaves_unpicked_lines_untouched(
        self, shopping: ShoppingListService, inventory_service: InventoryService
    ) -> None:
        shopping.add(EAN)
        shopping.add(OTHER_EAN)
        _pick(shopping, EAN)
        shopping.purchase()
        assert [line.item.ean for line in shopping.lines()] == [OTHER_EAN]
        assert inventory_service.get_item(OTHER_EAN) is None

    def test_purchase_with_nothing_picked_does_nothing(
        self, shopping: ShoppingListService, inventory_service: InventoryService
    ) -> None:
        shopping.add(EAN)
        summary = shopping.purchase()
        assert (summary.added, summary.created) == (0, 0)
        assert len(shopping.lines()) == 1
        assert inventory_service.get_item(EAN) is None

    def test_purchase_is_written_to_the_diary_as_a_shopping_list_purchase(
        self,
        shopping: ShoppingListService,
        inventory_service: InventoryService,
        movements: MovementRepository,
    ) -> None:
        _track(inventory_service, quantity=3)
        shopping.add(EAN, 2)
        shopping.add(OTHER_EAN, 1)
        _pick(shopping, EAN)
        _pick(shopping, OTHER_EAN)
        shopping.purchase()
        by_ean = {
            m.ean: m
            for m in movements.find(None, None, 10, 0)
            if m.source == SOURCE_SHOPPING_LIST
        }
        assert (by_ean[EAN].reason, by_ean[EAN].delta) == (REASON_PURCHASE, 2)
        assert (by_ean[OTHER_EAN].reason, by_ean[OTHER_EAN].delta) == (
            REASON_INITIAL,
            1,
        )

    def test_purchase_failing_halfway_applies_nothing(
        self,
        shopping: ShoppingListService,
        inventory_service: InventoryService,
        movements: MovementRepository,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        _track(inventory_service, EAN, quantity=3)
        _track(inventory_service, OTHER_EAN, quantity=5)
        for ean in (EAN, OTHER_EAN):
            shopping.add(ean, 2)
            _pick(shopping, ean)
        diary_before = len(movements.find(None, None, 50, 0))
        real_adjust = inventory_service.adjust
        calls = []

        def adjust_then_fail(ean, delta, context):
            calls.append(ean)
            if len(calls) == 2:
                raise RuntimeError("disk full")
            return real_adjust(ean, delta, context)

        monkeypatch.setattr(inventory_service, "adjust", adjust_then_fail)
        with pytest.raises(RuntimeError):
            shopping.purchase()
        monkeypatch.undo()

        assert len(calls) == 2  # it really got as far as the second line
        assert inventory_service.get_item(EAN).quantity == 3
        assert inventory_service.get_item(OTHER_EAN).quantity == 5
        assert len(shopping.lines()) == 2
        assert all(line.item.checked for line in shopping.lines())
        assert len(movements.find(None, None, 50, 0)) == diary_before
