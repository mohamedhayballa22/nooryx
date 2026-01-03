import asyncio
import random
import uuid
from datetime import datetime, timedelta
from typing import List, Tuple, Optional
from enum import Enum
from app.core.config import settings
from app.models import SKU, Transaction, Alert, AlertReadReceipt

from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import (
    create_async_engine,
    async_sessionmaker,
)

# ============================================================
# CONFIG
# ============================================================

START_DATE = datetime(2024, 12, 26, 9, 0, 0)
END_DATE   = datetime(2025, 12, 26, 18, 0, 0)

TARGET_ORG_ID = "019b56c7-1a13-75d6-b2f3-1d07289c0b36"

random.seed(42)

# ============================================================
# LOGIC
# ============================================================

def get_seasonal_weight(date_obj: datetime) -> float:
    return {
        1: 0.85, 2: 0.80, 3: 0.90, 4: 0.95,
        5: 1.00, 6: 0.95, 7: 0.85, 8: 0.90,
        9: 1.05, 10: 1.15, 11: 1.30, 12: 1.25,
    }.get(date_obj.month, 1.0)

def get_day_weight(date_obj: datetime) -> float:
    return {
        0: 1.15, 1: 1.20, 2: 1.20, 3: 1.15, 4: 1.10,
        5: 0.50, 6: 0.30,
    }[date_obj.weekday()]

def get_hour_weight(hour: int, pref: str) -> float:
    if pref == "early_morning":
        return 2.0 if 6 <= hour < 9 else 0.2
    if pref == "morning":
        return 2.0 if 8 <= hour < 11 else 0.4
    if pref == "midday":
        return 2.0 if 11 <= hour < 14 else 0.4
    if pref == "afternoon":
        return 2.0 if 14 <= hour < 17 else 0.4

    if 9 <= hour < 12: return 1.5
    if 13 <= hour < 17: return 1.8
    if 7 <= hour < 9 or 17 <= hour < 19: return 0.8
    return 0.1

def generate_timestamp(base: datetime, time_pref: str) -> datetime:
    for _ in range(12):
        candidate = base + timedelta(days=random.uniform(-2, 2))
        weight = (get_seasonal_weight(candidate) * get_day_weight(candidate))

        if random.random() < min(weight / 1.3, 1.0):
            hours = list(range(24))
            weights = [get_hour_weight(h, time_pref) for h in hours]
            hour = random.choices(hours, weights=weights)[0]
            
            ts = candidate.replace(
                hour=hour,
                minute=random.randint(0, 59),
                second=random.randint(0, 59)
            )
            return max(min(ts, END_DATE), START_DATE)
    return base

def classify_txn(txn: Transaction) -> Tuple[str, Optional[str]]:
    meta = txn.txn_metadata or {}
    ref = txn.reference or ""
    
    if txn.action == "receive":
        if "INIT" in ref: return "early_morning", None
        return "morning", f"receive_{ref[:10]}"
        
    if txn.action == "ship":
        if meta.get("ship_from") == "reserved": return "afternoon", f"ship_{ref[:10]}"
        return "business_hours", f"ship_{ref[:10]}"
        
    if txn.action in ("reserve", "unreserve"):
        oid = meta.get("order_id", "")
        return "business_hours", f"order_{oid[:8]}"
        
    if "transfer" in txn.action:
        return "midday", f"transfer_{str(txn.id)[:6]}"
        
    return "business_hours", None

class StockStatus(str, Enum):
    OUT_OF_STOCK = "out_of_stock"
    CRITICALLY_LOW = "critically_low"
    BELOW_REORDER = "below_reorder"

def analyze_status(available: int, reorder_point: int) -> StockStatus:
    if available <= 0: return StockStatus.OUT_OF_STOCK
    if reorder_point > 0 and (available / reorder_point) * 100 < 25:
        return StockStatus.CRITICALLY_LOW
    return StockStatus.BELOW_REORDER

def generate_alert_content(items: List[dict]) -> Tuple[str, str, str]:
    total = len(items)
    oos_count = 0
    crit_count = 0
    
    for item in items:
        status = analyze_status(item['available'], item['reorder_point'])
        if status == StockStatus.OUT_OF_STOCK: oos_count += 1
        elif status == StockStatus.CRITICALLY_LOW: crit_count += 1
            
    severity = "warning"
    if oos_count > 0 or crit_count > 0:
        severity = "critical"
        
    title = f"{total} SKUs need reordering" if total > 1 else "1 SKU needs reordering"
    
    if total == 1:
        i = items[0]
        st = analyze_status(i['available'], i['reorder_point'])
        if st == StockStatus.OUT_OF_STOCK: msg = f"{i['sku_name']} is out of stock"
        elif st == StockStatus.CRITICALLY_LOW: msg = f"{i['sku_name']} is critically low"
        else: msg = f"{i['sku_name']} is below reorder point"
        return severity, title, msg
        
    parts = []
    if oos_count: parts.append(f"{oos_count} out of stock")
    if crit_count: parts.append(f"{crit_count} critically low")
    if not parts: parts.append("need reordering")
    
    msg = f"{total} SKUs • " + ", ".join(parts)
    return severity, title, msg

# ============================================================
# MAIN
# ============================================================

async def run_process():
    engine = create_async_engine(settings.DATABASE_URL)
    SessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False)

    async with SessionLocal() as session:
        # 1. Read Phase
        print("-> Fetching SKUs configuration...")
        sku_stmt = select(SKU).where(SKU.org_id == TARGET_ORG_ID)
        skus = {s.code: s for s in (await session.execute(sku_stmt)).scalars()}

        print(f"-> Fetching transactions for {TARGET_ORG_ID}...")
        txn_stmt = (
            select(Transaction)
            .where(Transaction.org_id == TARGET_ORG_ID)
            .options(selectinload(Transaction.location))
            .order_by(Transaction.created_at)
        )
        txns = list((await session.execute(txn_stmt)).scalars())
        
        if not txns:
            print("No transactions found.")
            return

        print(f"   Found {len(txns)} transactions.")

        # 2. Plan Phase (In-Memory)
        print("-> Calculating new timestamps...")
        span = (END_DATE - START_DATE).total_seconds()
        cluster_cache = {}
        raw_plan = []

        # Generate candidate timestamps
        for idx, txn in enumerate(txns):
            progress = idx / len(txns)
            base_time = START_DATE + timedelta(seconds=progress * span)
            
            time_pref, cluster_key = classify_txn(txn)
            
            if cluster_key:
                if cluster_key in cluster_cache:
                    base_time = cluster_cache[cluster_key] + timedelta(minutes=random.randint(1, 30))
                else:
                    cluster_cache[cluster_key] = base_time
            
            new_ts = generate_timestamp(base_time, time_pref)
            raw_plan.append((txn, new_ts))
        
        # Enforce monotonic order while preserving original sequence
        print("-> Enforcing monotonic timestamp order...")
        last_ts = START_DATE - timedelta(seconds=1)
        update_plan = []
        
        for txn, proposed_ts in raw_plan:
            if proposed_ts <= last_ts:
                # Push forward to maintain order
                proposed_ts = last_ts + timedelta(milliseconds=random.randint(50, 500))
            
            last_ts = proposed_ts
            update_plan.append((txn, proposed_ts))

        print(f"\nPlanned range: {update_plan[0][1]} to {update_plan[-1][1]}")
        confirm = input("-> Proceed with ATOMIC update (Transactions + Alerts)? (yes/no): ")
        if confirm.lower() != "yes":
            return

        # 3. Preparation for Atomic Block
        await session.commit()

        # 4. Atomic Write Phase
        print("\n-> STARTING ATOMIC TRANSACTION...")
        try:
            async with session.begin():
                # A. Update Transactions
                print("   Updating transaction timestamps...")
                for txn, new_ts in update_plan:
                    txn.created_at = new_ts
                    session.add(txn)
                
                # B. Clear Old Alerts
                print("   Clearing old low_stock alerts...")
                subq = select(Alert.id).where(
                    Alert.org_id == TARGET_ORG_ID, 
                    Alert.alert_type == 'low_stock'
                )
                await session.execute(
                    delete(AlertReadReceipt).where(AlertReadReceipt.alert_id.in_(subq))
                )
                await session.execute(
                    delete(Alert).where(
                        Alert.org_id == TARGET_ORG_ID, 
                        Alert.alert_type == 'low_stock'
                    )
                )

                # C. Replay History
                print("   Reconstructing alerts history...")
                inventory = {}
                alerts_to_create = {} 

                for txn, ts in update_plan:
                    sku = txn.sku_code
                    if sku not in inventory: inventory[sku] = {'on_hand': 0, 'reserved': 0}
                    prev_avail = inventory[sku]['on_hand'] - inventory[sku]['reserved']
                    
                    qty = txn.qty
                    act = txn.action
                    if act in ("receive", "transfer_in") or (act == "adjust" and qty > 0):
                        inventory[sku]['on_hand'] += qty
                    elif act in ("ship", "transfer_out") or (act == "adjust" and qty < 0):
                        inventory[sku]['on_hand'] += qty
                        if act == "ship" and (txn.txn_metadata or {}).get("ship_from") == "reserved":
                            inventory[sku]['reserved'] -= abs(qty)
                    elif act == "reserve":
                        inventory[sku]['reserved'] += qty
                    elif act == "unreserve":
                        inventory[sku]['reserved'] -= qty

                    new_avail = inventory[sku]['on_hand'] - inventory[sku]['reserved']
                    
                    if sku not in skus or not skus[sku].alerts: continue
                    rp = skus[sku].reorder_point
                    
                    is_low = new_avail <= rp
                    was_low = prev_avail <= rp
                    
                    if is_low and not was_low:
                        date_key = ts.date().isoformat()
                        if date_key not in alerts_to_create:
                            alerts_to_create[date_key] = {}
                        
                        if sku not in alerts_to_create[date_key]:
                            alerts_to_create[date_key][sku] = {
                                "sku_code": sku,
                                "sku_name": skus[sku].name,
                                "available": new_avail,
                                "reorder_point": rp,
                                "timestamp": ts
                            }

                # D. Insert New Alerts
                count = 0
                for date_key, sku_map in alerts_to_create.items():
                    details = list(sku_map.values())
                    if not details: continue
                    
                    severity, title, message = generate_alert_content(details)
                    clean_details = [{k:v for k,v in d.items() if k != 'timestamp'} for d in details]
                    sku_codes = [d['sku_code'] for d in clean_details]
                    group_ts = min(d['timestamp'] for d in details)
                    
                    new_alert = Alert(
                        id=uuid.uuid4(),
                        org_id=uuid.UUID(TARGET_ORG_ID), 
                        alert_type="low_stock",
                        severity=severity,
                        title=title,
                        message=message,
                        aggregation_key=f"low_stock_{date_key}",
                        alert_metadata={
                            "sku_codes": sku_codes,
                            "details": clean_details,
                            "check_timestamp": group_ts.isoformat()
                        },
                        created_at=group_ts
                    )
                    session.add(new_alert)
                    count += 1
                
                print(f"   Prepared {count} alert groups.")
            
            print("-> SUCCESS: Database updated successfully.")

        except Exception as e:
            print(f"\n-> ERROR: {e}")
            print("-> Rolled back all changes.")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(run_process())
    