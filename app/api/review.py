from http import HTTPStatus

from fastapi import APIRouter, Depends, HTTPException, Response

from app.api.deps import get_review_service
from app.schemas import ReviewCandidateOut
from app.services.review import ReviewCandidate, ReviewService

router = APIRouter(prefix="/api/review", tags=["review"])


def _to_out(candidate: ReviewCandidate) -> ReviewCandidateOut:
    """Builds the API view of a review candidate.

    Args:
        candidate: The candidate chosen by the service.

    Returns:
        The response model.
    """
    return ReviewCandidateOut(
        ean=candidate.item.ean,
        name=candidate.product.name,
        brand=candidate.product.brand,
        image_url=candidate.product.image_url,
        quantity=candidate.item.quantity,
        unit=candidate.item.unit,
        reason=candidate.reason,
        estimated_empty_on=candidate.estimated_empty_on,
        days_since_activity=candidate.days_since_activity,
    )


@router.get("", response_model=list[ReviewCandidateOut])
def list_review(
    service: ReviewService = Depends(get_review_service),
) -> list[ReviewCandidateOut]:
    """Lists the products the weekly review asks about, in asking order.

    Args:
        service: The review service.

    Returns:
        At most ten candidates; empty when there is not enough history yet.
    """
    return [_to_out(candidate) for candidate in service.candidates()]


@router.post("/{ean}/confirm", status_code=HTTPStatus.NO_CONTENT)
def confirm_review(
    ean: str, service: ReviewService = Depends(get_review_service)
) -> Response:
    """Records that a product's stock was checked and is real. No movement is written.

    Args:
        ean: The product's barcode.
        service: The review service.

    Returns:
        An empty 204 response.

    Raises:
        HTTPException: 404 when the product is not tracked.
    """
    if not service.confirm(ean):
        raise HTTPException(status_code=HTTPStatus.NOT_FOUND, detail={"ean": ean})
    return Response(status_code=HTTPStatus.NO_CONTENT)
