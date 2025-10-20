from fastapi import HTTPException, status


class TransactionBadRequest(HTTPException):
    """
    Raised when a transaction cannot be completed due to lack of stock.
    (e.g., trying to reserve or ship more than is available) or when 
    an unsupported or invalid transaction action is provided.
    """
    def __init__(self, detail: str):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail,
        )


class NotFound(HTTPException):
    """
    Raised when a ressource couldn't be returned due to lack of sufficient
    priviliges or inexcitence.
    """
    def __init__(self, detail: str | None = None):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail,
        )


class InventoryException(HTTPException):
    """Base exception for inventory operations."""
    pass


class SKUNotFoundError(InventoryException):
    """SKU not found in organization."""
    def __init__(self, detail: str, sku_code: str):
        self.sku_code = sku_code
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": "SKU_NOT_FOUND",
                "message": detail,
                "sku_code": sku_code,
                "action_required": "CREATE_SKU",
            }
        )


class SKUAlreadyExistsError(InventoryException):
    """SKU already exists in organization."""
    def __init__(self, detail: str):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=detail
        )


class TransactionBadRequest(InventoryException):
    """Invalid transaction request."""
    def __init__(self, detail: str):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail
        )


class InsufficientStockError(InventoryException):
    """Not enough stock available."""
    def __init__(
        self, 
        detail: str,
        sku_code: str = None,
        location: str = None,
        requested: int = None,
        available: int = None,
        on_hand: int = None,
        reserved: int = None
    ):
        error_detail = {
            "error_code": "INSUFFICIENT_STOCK",
            "message": detail,
        }
        
        # Only include optional fields if they are provided
        if sku_code is not None:
            error_detail["sku_code"] = sku_code
        if location is not None:
            error_detail["location"] = location
        if requested is not None:
            error_detail["requested"] = abs(requested)
        if available is not None:
            error_detail["available"] = available
        if on_hand is not None:
            error_detail["on_hand"] = on_hand
        if reserved is not None:
            error_detail["reserved"] = reserved
        
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=error_detail
        )


class LocationNotFoundError(InventoryException):
    """Location not found."""
    def __init__(self, detail: str):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail
        )


class InvalidOperationError(InventoryException):
    """Operation not allowed in current state."""
    def __init__(self, detail: str):
        super().__init__(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=detail
        )

class CurrencyError(Exception):
    """Raised when currency conversion fails."""
    def __init__(self, detail: str, currency_code: str):
        self.detail = detail
        self.currency_code = currency_code
        super().__init__(detail)
        