from fastapi import HTTPException, status

class InsufficientStockError(HTTPException):
    """
    Raised when a transaction cannot be completed due to lack of stock.
    (e.g., trying to reserve or ship more than is available).
    """
    def __init__(self, detail: str):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=detail,
        )

class InvalidTransactionActionError(HTTPException):
    """
    Raised when an unsupported or invalid transaction action is provided.
    """
    def __init__(self, detail: str):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail,
        )

class ConcurrencyConflictError(HTTPException):
    """
    Raised when a database concurrency issue (StaleDataError) is detected.
    Indicates the client should retry the transaction.
    """
    def __init__(self):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail="Concurrency conflict: The inventory state was updated by another process. Please retry the transaction.",
        )

class DatabaseConflictError(HTTPException):
    """
    Raised for database integrity errors, like unique constraint violations.
    """
    def __init__(self, detail: str = "A database conflict occurred."):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=detail,
        )

class UnexpectedDatabaseError(HTTPException):
    """
    A catch-all for unexpected database exceptions.
    """
    def __init__(self):
        # Note: In production, you would log the original exception but not expose its details to the client.
        super().__init__(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An unexpected database error occurred.",
        )