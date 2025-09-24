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
