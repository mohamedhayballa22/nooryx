from typing import Optional, Any, Dict
from dataclasses import dataclass


@dataclass
class TransactionError(Exception):
    """Base structured transaction error."""
    code: str
    message: str
    details: Optional[Dict[str, Any]] = None

    def to_dict(self):
        return {"code": self.code, "message": self.message, "details": self.details}


class InsufficientStock(TransactionError):
    def __init__(self, message: str = "Insufficient stock", details: Optional[Dict] = None):
        super().__init__(code="insufficient_stock", message=message, details=details)


class InvalidAction(TransactionError):
    def __init__(self, message: str = "Invalid transaction action", details: Optional[Dict] = None):
        super().__init__(code="invalid_action", message=message, details=details)


class NegativeInventory(TransactionError):
    def __init__(self, message: str = "Operation would cause negative inventory", details: Optional[Dict] = None):
        super().__init__(code="negative_inventory", message=message, details=details)


class ConcurrencyConflict(TransactionError):
    def __init__(self, message: str = "Concurrent update conflict; try again", details: Optional[Dict] = None):
        super().__init__(code="concurrency_conflict", message=message, details=details)


class DatabaseError(TransactionError):
    def __init__(self, message: str = "Database error", details: Optional[Dict] = None):
        super().__init__(code="database_error", message=message, details=details)


_DEF_ERROR_MAP = [
    ("Not enough available stock", InsufficientStock),
    ("Not enough reserved stock", InsufficientStock),
    ("Not enough total stock", InsufficientStock),
    ("Unsupported transaction action", InvalidAction),
    ("Adjustment leads to negative on_hand", NegativeInventory),
    ("Unsupported transaction action:", InvalidAction),
]


def map_errors(err: ValueError) -> TransactionError:
    msg = str(err)
    for prefix, exc_cls in _DEF_ERROR_MAP:
        if msg.startswith(prefix) or prefix in msg:
            return exc_cls(message=msg)
    return TransactionError(code="invalid_transaction", message=msg)