import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Barcode, SKU
from app.services.barcodes import link_barcode


@pytest.mark.asyncio
class TestBarcodeService:
    """
    Tests for the barcode linking service.
    """

    async def test_link_new_barcode(self, db_session: AsyncSession, create_org):
        """
        Test that a new barcode is successfully linked to a SKU.
        """
        org = await create_org()
        org_id = org.org_id
        barcode_value = "1234567890123"
        sku_code = "SKU-001"
        barcode_format = "EAN-13"

        # Create the SKU first to satisfy the foreign key constraint
        sku = SKU(code=sku_code, org_id=org_id, name="Test SKU")
        db_session.add(sku)
        await db_session.flush()

        await link_barcode(
            db=db_session,
            org_id=org_id,
            value=barcode_value,
            sku_code=sku_code,
            format=barcode_format,
        )
        await db_session.flush()

        # Verify the barcode was created in the database
        stmt = select(Barcode).where(
            Barcode.org_id == org_id, Barcode.value == barcode_value
        )
        result = await db_session.execute(stmt)
        created_barcode = result.scalar_one_or_none()

        assert created_barcode is not None
        assert created_barcode.org_id == org_id
        assert created_barcode.value == barcode_value
        assert created_barcode.sku_code == sku_code
        assert created_barcode.barcode_format == barcode_format

    async def test_link_existing_barcode_does_nothing(
        self, db_session: AsyncSession, create_org
    ):
        """
        Test that linking an existing barcode value for the same org does nothing.
        """
        org = await create_org()
        org_id = org.org_id
        barcode_value = "9876543210987"
        original_sku_code = "SKU-ORIGINAL"
        new_sku_code = "SKU-NEW"

        # Create both SKUs first
        original_sku = SKU(code=original_sku_code, org_id=org_id, name="Original SKU")
        new_sku = SKU(code=new_sku_code, org_id=org_id, name="New SKU")
        db_session.add_all([original_sku, new_sku])
        await db_session.flush()

        # First, link the barcode
        await link_barcode(
            db=db_session,
            org_id=org_id,
            value=barcode_value,
            sku_code=original_sku_code,
            format="TEST",
        )
        await db_session.flush()

        # Now, try to link the same barcode value to a new SKU
        await link_barcode(
            db=db_session,
            org_id=org_id,
            value=barcode_value,
            sku_code=new_sku_code,
            format="TEST",
        )
        await db_session.flush()

        # Verify that the barcode still points to the original SKU
        stmt = select(Barcode).where(
            Barcode.org_id == org_id, Barcode.value == barcode_value
        )
        result = await db_session.execute(stmt)
        barcode_in_db = result.scalar_one()

        assert barcode_in_db is not None
        assert barcode_in_db.sku_code == original_sku_code
        assert barcode_in_db.sku_code != new_sku_code

        # Verify there is only one entry for this barcode
        count_stmt = select(Barcode).where(
            Barcode.org_id == org_id, Barcode.value == barcode_value
        )
        results = await db_session.execute(count_stmt)
        assert len(results.scalars().all()) == 1

    async def test_link_same_barcode_for_different_orgs(
        self, db_session: AsyncSession, create_org
    ):
        """
        Test that the same barcode value can be used by two different organizations.
        """
        org1 = await create_org(name="Org One")
        org2 = await create_org(name="Org Two")

        org1_id = org1.org_id
        org2_id = org2.org_id
        barcode_value = "COMMON-BARCODE-123"
        sku1_code = "SKU-ORG1"
        sku2_code = "SKU-ORG2"

        # Create SKUs for each organization
        sku1 = SKU(code=sku1_code, org_id=org1_id, name="SKU for Org 1")
        sku2 = SKU(code=sku2_code, org_id=org2_id, name="SKU for Org 2")
        db_session.add_all([sku1, sku2])
        await db_session.flush()

        # Link barcode to the first org
        await link_barcode(
            db=db_session,
            org_id=org1_id,
            value=barcode_value,
            sku_code=sku1_code,
            format="TEST",
        )
        await db_session.flush()

        # Link the same barcode to the second org
        await link_barcode(
            db=db_session,
            org_id=org2_id,
            value=barcode_value,
            sku_code=sku2_code,
            format="TEST",
        )
        await db_session.flush()

        # Verify barcode exists for org 1
        stmt1 = select(Barcode).where(
            Barcode.org_id == org1_id, Barcode.value == barcode_value
        )
        result1 = await db_session.execute(stmt1)
        barcode1 = result1.scalar_one_or_none()
        assert barcode1 is not None
        assert barcode1.sku_code == sku1_code

        # Verify barcode exists for org 2
        stmt2 = select(Barcode).where(
            Barcode.org_id == org2_id, Barcode.value == barcode_value
        )
        result2 = await db_session.execute(stmt2)
        barcode2 = result2.scalar_one_or_none()
        assert barcode2 is not None
        assert barcode2.sku_code == sku2_code
