import pytest
from decimal import Decimal
from app.services.currency_service import CurrencyService, CurrencyError

class TestCurrencyService:
    
    @pytest.mark.parametrize("currency, expected_factor", [
        ("USD", 100),
        ("JPY", 1),
        ("BHD", 1000),
        ("EUR", 100),
    ])
    def test_get_minor_unit_factor(self, currency, expected_factor):
        """Test that the correct minor unit factor is returned for a given currency."""
        assert CurrencyService.get_minor_unit_factor(currency) == expected_factor

    def test_get_minor_unit_factor_invalid_currency(self):
        """Test that a CurrencyError is raised for an invalid currency code."""
        
        
        with pytest.raises(CurrencyError):
            CurrencyService.get_minor_unit_factor("XYZ")

    @pytest.mark.parametrize("amount, currency, expected_minor_units", [
        (Decimal("20.50"), "USD", 2050),
        (Decimal("1000"), "JPY", 1000),
        (Decimal("15.123"), "BHD", 15123),
        (Decimal("0.50"), "USD", 50),
        (Decimal("1.00"), "USD", 100),
    ])
    def test_to_minor_units(self, amount, currency, expected_minor_units):
        """Test conversion from major to minor units."""
        assert CurrencyService.to_minor_units(amount, currency) == expected_minor_units

    def test_to_minor_units_negative_amount(self):
        """Test that a CurrencyError is raised for a negative amount."""
        with pytest.raises(CurrencyError):
            CurrencyService.to_minor_units(Decimal("-10.00"), "USD")

    @pytest.mark.parametrize("minor_units, currency, expected_major_units", [
        (2050, "USD", Decimal("20.50")),
        (1000, "JPY", Decimal("1000")),
        (15123, "BHD", Decimal("15.123")),
        (50, "USD", Decimal("0.50")),
        (100, "USD", Decimal("1.00")),
    ])
    def test_to_major_units(self, minor_units, currency, expected_major_units):
        """Test conversion from minor to major units."""
        assert CurrencyService.to_major_units(minor_units, currency) == expected_major_units

    @pytest.mark.parametrize("minor_units, currency, expected_format", [
        (2050, "USD", "20.50"),
        (1000, "JPY", "1000"),
        (15123, "BHD", "15.123"),
        (50, "USD", "0.50"),
    ])
    def test_format_amount(self, minor_units, currency, expected_format):
        """Test currency formatting."""
        assert CurrencyService.format_amount(minor_units, currency) == expected_format
