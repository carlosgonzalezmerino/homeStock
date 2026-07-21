from fastapi import APIRouter, Depends

from app.api.deps import get_shopping_list_service
from app.schemas import ShoppingListItemOut
from app.services.shopping_list import ShoppingListService

router = APIRouter(prefix="/api", tags=["shopping-list"])


@router.get("/shopping-list", response_model=list[ShoppingListItemOut])
def get_shopping_list(
    service: ShoppingListService = Depends(get_shopping_list_service),
) -> list[ShoppingListItemOut]:
    return [
        ShoppingListItemOut(
            ean=item.ean,
            name=product.name,
            quantity=item.quantity,
            threshold=item.threshold,
            unit=item.unit,
            image_url=product.image_url,
        )
        for item, product in service.items()
    ]
