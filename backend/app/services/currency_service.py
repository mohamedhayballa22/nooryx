from decimal import Decimal, ROUND_HALF_UP
from functools import lru_cache
from babel.numbers import get_currency_precision, list_currencies

from app.services.exceptions import CurrencyError


class CurrencyService:
    """
    Handles conversion between human-readable decimal prices and integer minor units.
    Uses Babel to determine currency-specific precision (e.g., 2 for USD, 0 for JPY).
    """
    
    @staticmethod
    @lru_cache(maxsize=128)
    def get_minor_unit_factor(currency_code: str) -> int:
        """
        Get the multiplicative factor for converting to minor units.
        
        Examples:
            USD -> 100 (cents)
            EUR -> 100 (cents)
            JPY -> 1 (yen has no subunit)
            BHD -> 1000 (fils, 3 decimal places)
            
        Args:
            currency_code: ISO 4217 currency code (e.g., 'USD', 'EUR')
            
        Returns:
            Power of 10 representing minor unit conversion factor
            
        Raises:
            CurrencyError: If currency code is invalid
        """
        
        VALID_CURRENCIES = frozenset(list_currencies())
        
        # Validate currency code exists in Babel's currency data
        if currency_code not in VALID_CURRENCIES:
            raise CurrencyError(
                detail=f"Unknown currency code '{currency_code}'",
                currency_code=currency_code
            )
        
        precision = get_currency_precision(currency_code)
        return 10 ** precision
    
    @classmethod
    def to_minor_units(cls, amount: Decimal, currency_code: str) -> int:
        """
        Convert decimal amount to integer minor units.
        
        Examples:
            20.50 USD -> 2050
            1000 JPY -> 1000
            15.123 BHD -> 15123
            
        Args:
            amount: Decimal amount in major units
            currency_code: ISO 4217 currency code
            
        Returns:
            Integer amount in minor units
            
        Raises:
            CurrencyError: If conversion fails or amount is negative
        """
        if amount < 0:
            raise CurrencyError(
                detail="Amount cannot be negative",
                currency_code=currency_code
            )
        
        factor = cls.get_minor_unit_factor(currency_code)
        
        # Multiply and round to nearest integer (banker's rounding)
        minor_units = (amount * factor).quantize(Decimal('1'), rounding=ROUND_HALF_UP)
        
        return int(minor_units)
    
    @classmethod
    def to_major_units(cls, minor_units: int, currency_code: str) -> Decimal:
        """
        Convert integer minor units back to decimal major units.
        
        Examples:
            2050, 'USD' -> Decimal('20.50')
            1000, 'JPY' -> Decimal('1000')
            15123, 'BHD' -> Decimal('15.123')
            
        Args:
            minor_units: Integer amount in minor units
            currency_code: ISO 4217 currency code
            
        Returns:
            Decimal amount in major units
        """
        factor = cls.get_minor_unit_factor(currency_code)
        precision = get_currency_precision(currency_code)
        
        # Convert to Decimal and divide by factor
        amount = Decimal(minor_units) / Decimal(factor)
        
        # Quantize to correct precision
        quantize_template = Decimal('0.1') ** precision if precision > 0 else Decimal('1')
        return amount.quantize(quantize_template)
    
    @classmethod
    def format_amount(cls, minor_units: int, currency_code: str) -> str:
        """
        Format minor units as human-readable currency string.
        
        Examples:
            2050, 'USD' -> '20.50'
            1000, 'JPY' -> '1000'
            
        Args:
            minor_units: Integer amount in minor units
            currency_code: ISO 4217 currency code
            
        Returns:
            Formatted string without currency symbol
        """
        major_units = cls.to_major_units(minor_units, currency_code)
        precision = get_currency_precision(currency_code)
        
        if precision == 0:
            return f"{major_units:.0f}"
        else:
            return f"{major_units:.{precision}f}"
        