import time
import random
import uuid
from decimal import Decimal
from typing import Dict, Tuple
import requests
import math

# ============================================================
# CONFIG
# ============================================================

BASE_URL = "http://localhost:8000/api"

USERS = [
    {
        "name": "ops_manager",
        "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMDg4YjVlZi1kMDFjLTRkZGYtODYyYi0zNTA3NDMzYTljZDMiLCJhdWQiOlsibm9vcnl4X3VzZXJzIl0sImV4cCI6MjM2NzEwNDk0MH0.XArvQHTXAgrePItYe9wdufwxQoTQx5B39Qyr9uoyV-E",
        "csrf": "PASTE_CSRF_1",
    },
    {
        "name": "warehouse",
        "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI4ZGM1M2NlYy02YjJlLTQyNGMtODdhZC1iMzRkOTg1OTEzMzEiLCJhdWQiOlsibm9vcnl4X3VzZXJzIl0sImV4cCI6MjM2Njc1MjU0N30.PlDkhqu2ewE-f8nxJT7UIIZaeN53y5NocPkok2GqsCI",
        "csrf": "PASTE_CSRF_2",
    },
    {
        "name": "sales",
        "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5MmFhZDdiOS03YWQ5LTRlYzYtOWQ1MC0yYTUwN2UxMDc0MGUiLCJhdWQiOlsibm9vcnl4X3VzZXJzIl0sImV4cCI6MjM2Njc1MjU5M30.2utZp13CfV1chK2NyVd624VRQS5Eumlis5rUUFMgFOM",
        "csrf": "PASTE_CSRF_3",
    },
    {
        "name": "admin",
        "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI0NTljZWU3ZC04Yzc2LTQxN2EtYmMwZS1kYzA0ZjE4ZmJlMzYiLCJhdWQiOlsibm9vcnl4X3VzZXJzIl0sImV4cCI6MjM2Njc1MjYyN30.C8bJzWRasL0Q6fnwXPHygAeskogluvWUna54JtZvrSc",
        "csrf": "PASTE_CSRF_4",
    },
]

LOCATIONS = ["Main Warehouse", "Retail Showroom", "Overflow Storage"]

REQUEST_DELAY = 0.02
FAIL_FAST = True

random.seed(42)

# ============================================================
# HTTP CLIENT
# ============================================================

def client_for(user):
    s = requests.Session()
    s.cookies.set("access_token", user["access_token"])
    s.headers.update({
        "X-CSRF-Token": user["csrf"],
        "Content-Type": "application/json",
    })
    return s


def post_txn(client, payload):
    r = client.post(BASE_URL + "/" + payload["action"], json=payload)
    if not r.ok:
        print("FAILED PAYLOAD:", payload)
        print("STATUS:", r.status_code, r.text)
        raise RuntimeError("API call failed")
    time.sleep(REQUEST_DELAY)
    return r.json()


# ============================================================
# LOCAL INVENTORY STATE
# ============================================================

class StockState:
    def __init__(self):
        # (sku, location) -> dict
        self.state: Dict[Tuple[str, str], Dict[str, int]] = {}
        # Track SKU thresholds
        self.sku_thresholds: Dict[str, Dict[str, int]] = {}
        # Track daily shipment costs for smoothing
        self.daily_shipment_value: Dict[int, Decimal] = {}
        self.daily_shipment_count: Dict[int, int] = {}

    def ensure(self, sku, location):
        self.state.setdefault(
            (sku, location),
            {"on_hand": 0, "reserved": 0}
        )

    def set_thresholds(self, sku, reorder_point, low_stock_threshold):
        """Store thresholds for a SKU"""
        self.sku_thresholds[sku] = {
            "reorder_point": reorder_point,
            "low_stock_threshold": low_stock_threshold
        }

    def get_thresholds(self, sku):
        """Get stored thresholds or defaults"""
        return self.sku_thresholds.get(sku, {
            "reorder_point": 15,
            "low_stock_threshold": 8
        })

    def available(self, sku, location):
        s = self.state.get((sku, location))
        if not s:
            return 0
        return s["on_hand"] - s["reserved"]

    def receive(self, sku, location, qty):
        self.ensure(sku, location)
        self.state[(sku, location)]["on_hand"] += qty

    def reserve(self, sku, location, qty):
        self.ensure(sku, location)
        if self.available(sku, location) < qty:
            raise RuntimeError("Reserve invariant violated")
        self.state[(sku, location)]["reserved"] += qty

    def unreserve(self, sku, location, qty):
        s = self.state[(sku, location)]
        if s["reserved"] < qty:
            raise RuntimeError("Unreserve invariant violated")
        s["reserved"] -= qty

    def ship(self, sku, location, qty, ship_from):
        s = self.state[(sku, location)]
        if ship_from == "reserved":
            if s["reserved"] < qty:
                raise RuntimeError("Ship reserved invariant violated")
            s["reserved"] -= qty
        else:
            if self.available(sku, location) < qty:
                raise RuntimeError("Ship available invariant violated")
        s["on_hand"] -= qty

    def adjust(self, sku, location, qty):
        s = self.state[(sku, location)]
        if s["on_hand"] + qty < 0:
            raise RuntimeError("Adjust invariant violated")
        s["on_hand"] += qty

    def transfer(self, sku, src, dst, qty):
        if self.available(sku, src) < qty:
            raise RuntimeError("Transfer invariant violated")
        self.state[(sku, src)]["on_hand"] -= qty
        self.ensure(sku, dst)
        self.state[(sku, dst)]["on_hand"] += qty

    def record_shipment(self, day, value):
        """Track daily shipment values for COGS smoothing"""
        self.daily_shipment_value[day] = self.daily_shipment_value.get(day, Decimal(0)) + value
        self.daily_shipment_count[day] = self.daily_shipment_count.get(day, 0) + 1

    def get_daily_avg_shipment(self, day):
        """Get average shipment value for a day"""
        if day not in self.daily_shipment_count or self.daily_shipment_count[day] == 0:
            return Decimal(0)
        return self.daily_shipment_value[day] / self.daily_shipment_count[day]

    def should_throttle_shipment(self, day, proposed_value, max_daily_cogs=Decimal(10000)):
        """Check if we should throttle this shipment to avoid COGS spikes"""
        current_daily = self.daily_shipment_value.get(day, Decimal(0))
        if current_daily + proposed_value > max_daily_cogs:
            return True
        return False


STATE = StockState()

# ============================================================
# SKU GENERATION & SEGMENTATION
# ============================================================

BASE_PRODUCTS = [
    ("BLT", "Hex Bolt", "fasteners"),
    ("LIN", "Linear Bearing", "motion"),
    ("VLT", "V-Belt", "power_transmission"),
    ("CHN", "Roller Chain", "power_transmission"),
    ("SPK", "Sprocket", "power_transmission"),
    ("ORNG", "O-Ring", "seals"),
    ("GSKT", "Industrial Gasket", "seals"),
    ("HOS", "Hydraulic Hose", "hydraulics"),
    ("CYL", "Pneumatic Cylinder", "pneumatics"),
    ("FIT", "Hydraulic Fitting", "hydraulics"),
    ("SW", "Limit Switch", "electrical"),
    ("FRL", "Air Filter Regulator", "pneumatics"),
    ("VAL", "Solenoid Valve", "pneumatics"),
    ("RBRG", "Roller Bearing", "bearings"),
]

MATERIALS = ["STL", "SS", "AL"]
DIAMETERS = ["M6", "M8", "M10", "M12", "M16"]
LENGTHS = ["10", "20", "30", "40"]

def generate_skus(target=140):
    skus = []
    for code, name, category in BASE_PRODUCTS:
        for mat in MATERIALS:
            for dia in DIAMETERS:
                for length in LENGTHS:
                    skus.append((
                        f"{code}-{mat}-{dia}-{length}",
                        f"{name} {dia}x{length} {mat}",
                        category
                    ))
                    if len(skus) >= target:
                        return skus
    return skus


SKUS = generate_skus()

# Segment SKUs by demand pattern
FAST_MOVERS = random.sample(SKUS, 25)  # High velocity
MEDIUM_MOVERS = random.sample([s for s in SKUS if s not in FAST_MOVERS], 45)
SLOW_MOVERS = random.sample([s for s in SKUS if s not in FAST_MOVERS and s not in MEDIUM_MOVERS], 35)
DORMANT_SKUS = [s for s in SKUS if s not in FAST_MOVERS and s not in MEDIUM_MOVERS and s not in SLOW_MOVERS]

# Select SKUs that will gradually run out of stock
STOCKOUT_TARGET_SKUS = random.sample(FAST_MOVERS + MEDIUM_MOVERS, 13)

SKU_PROFILES = {}
for sku_data in FAST_MOVERS:
    SKU_PROFILES[sku_data[0]] = {
        "velocity": "fast", 
        "base_cost": Decimal(random.uniform(12, 25)),
        "reorder_point": random.randint(20, 35),
        "low_stock_threshold": random.randint(10, 18),
        "stockout_target": sku_data in STOCKOUT_TARGET_SKUS
    }
for sku_data in MEDIUM_MOVERS:
    SKU_PROFILES[sku_data[0]] = {
        "velocity": "medium", 
        "base_cost": Decimal(random.uniform(10, 20)),
        "reorder_point": random.randint(12, 22),
        "low_stock_threshold": random.randint(6, 12),
        "stockout_target": sku_data in STOCKOUT_TARGET_SKUS
    }
for sku_data in SLOW_MOVERS:
    SKU_PROFILES[sku_data[0]] = {
        "velocity": "slow", 
        "base_cost": Decimal(random.uniform(8, 18)),
        "reorder_point": random.randint(8, 15),
        "low_stock_threshold": random.randint(4, 8),
        "stockout_target": False
    }
for sku_data in DORMANT_SKUS:
    SKU_PROFILES[sku_data[0]] = {
        "velocity": "dormant", 
        "base_cost": Decimal(random.uniform(7, 15)),
        "reorder_point": random.randint(5, 10),
        "low_stock_threshold": random.randint(2, 5),
        "stockout_target": False
    }

# ============================================================
# HELPERS
# ============================================================

def rand_user():
    return random.choice(USERS)

def rand_cost(base, variance=0.10):
    return (base * Decimal(random.uniform(1 - variance, 1 + variance))).quantize(Decimal("0.01"))

def seasonal_multiplier(iteration, total_iterations):
    """Returns demand multiplier based on position in timeline (simulates seasonality)"""
    progress = iteration / total_iterations
    # Create seasonal wave: start moderate, peak in middle, drop at end
    return 0.7 + 0.6 * (1 + math.cos((progress - 0.5) * 2 * math.pi)) / 2

def stockout_pressure(iteration, total_iterations, is_stockout_target):
    """
    Returns a multiplier for demand pressure to gradually run SKUs out of stock.
    For stockout targets, gradually increases demand and decreases restocking.
    """
    if not is_stockout_target:
        return 1.0
    
    progress = iteration / total_iterations
    
    # Start applying pressure after 30% through operations
    if progress < 0.30:
        return 1.0
    
    # Gradually increase demand pressure from 30% to 85% of timeline
    adjusted_progress = (progress - 0.30) / 0.55
    # Exponential increase to create natural stockout
    return 1.0 + (adjusted_progress ** 1.5) * 1.2

def should_restock_sku(sku, iteration, total_iterations):
    """
    Determines if a SKU should be restocked based on stockout strategy.
    Stockout targets get increasingly less restocking as time progresses.
    """
    profile = SKU_PROFILES[sku]
    
    if not profile["stockout_target"]:
        return True
    
    progress = iteration / total_iterations
    
    # Allow normal restocking early on
    if progress < 0.30:
        return True
    
    # Gradually reduce restocking probability
    if progress < 0.50:
        return random.random() < 0.7
    elif progress < 0.70:
        return random.random() < 0.4
    elif progress < 0.85:
        return random.random() < 0.15
    else:
        # Almost no restocking in final phase
        return random.random() < 0.05

def get_simulation_day(iteration, total_iterations):
    """Convert iteration to simulated day number (0-364 for a year)"""
    return int((iteration / total_iterations) * 365)

# ============================================================
# PHASES
# ============================================================

def phase_bootstrap():
    """Initial inventory setup - conservative quantities"""
    print("  Bootstrapping inventory...")
    for sku_data in SKUS:
        sku, name, category = sku_data
        profile = SKU_PROFILES[sku]
        user = rand_user()
        client = client_for(user)
        
        # Conservative initial stock based on velocity
        if profile["velocity"] == "fast":
            qty = random.randint(40, 80)
        elif profile["velocity"] == "medium":
            qty = random.randint(25, 50)
        elif profile["velocity"] == "slow":
            qty = random.randint(15, 30)
        else:  # dormant
            qty = random.randint(5, 15)

        base_cost = profile["base_cost"]
        reorder_point = profile["reorder_point"]
        low_stock_threshold = profile["low_stock_threshold"]
        
        # Store thresholds in state
        STATE.set_thresholds(sku, reorder_point, low_stock_threshold)
        
        payload = {
            "action": "receive",
            "sku_code": sku,
            "sku_name": name,
            "location": "Main Warehouse",
            "qty": qty,
            "unit_cost_major": float(base_cost),
            "alerts": True,
            "reorder_point": reorder_point,
            "low_stock_threshold": low_stock_threshold,
            "reference": f"PO-INIT-{uuid.uuid4().hex[:6]}",
        }

        post_txn(client, payload)
        STATE.receive(sku, "Main Warehouse", qty)


def phase_operations(iterations=2000):
    """Main operational phase with realistic demand patterns and controlled stockouts"""
    print(f"  Running {iterations} operational transactions...")
    
    for iteration in range(iterations):
        if iteration % 200 == 0:
            print(f"    Progress: {iteration}/{iterations}")
        
        # Seasonal demand adjustment
        season_factor = seasonal_multiplier(iteration, iterations)
        sim_day = get_simulation_day(iteration, iterations)
        
        # Select SKU based on velocity distribution
        velocity_roll = random.random()
        if velocity_roll < 0.45:  # 45% chance of fast mover
            sku_data = random.choice(FAST_MOVERS)
        elif velocity_roll < 0.75:  # 30% chance of medium
            sku_data = random.choice(MEDIUM_MOVERS)
        elif velocity_roll < 0.92:  # 17% chance of slow
            sku_data = random.choice(SLOW_MOVERS)
        else:  # 8% chance of dormant
            sku_data = random.choice(DORMANT_SKUS)
        
        sku = sku_data[0]
        profile = SKU_PROFILES[sku]
        location = "Main Warehouse"
        
        available = STATE.available(sku, location)
        user = rand_user()
        client = client_for(user)

        # Apply stockout pressure for targeted SKUs
        stockout_multiplier = stockout_pressure(iteration, iterations, profile["stockout_target"])

        # Action probabilities adjusted for realistic operations
        roll = random.random()

        # SHIP: Primary action (65% of transactions - increased from 60%)
        if roll < 0.65:
            # Determine ship quantity based on velocity and season
            if profile["velocity"] == "fast":
                max_ship = min(10, int(available * 0.35))  # Increased
            elif profile["velocity"] == "medium":
                max_ship = min(6, int(available * 0.30))  # Increased
            elif profile["velocity"] == "slow":
                max_ship = min(4, int(available * 0.25))  # Increased
            else:
                max_ship = min(3, int(available * 0.20))  # Increased
            
            # Apply seasonal and stockout pressure
            max_ship = int(max_ship * season_factor * stockout_multiplier)
            max_ship = max(1, max_ship)
            
            if available > 0 and max_ship > 0:
                ship_from = "available"
                reserved_qty = STATE.state.get((sku, location), {}).get("reserved", 0)
                
                # Sometimes ship from reserved
                if reserved_qty > 0 and random.random() < 0.3:
                    ship_from = "reserved"
                    max_ship = min(max_ship, reserved_qty)
                
                qty = random.randint(1, max(1, max_ship))
                
                # Calculate shipment value for COGS smoothing
                shipment_value = profile["base_cost"] * qty
                
                # Check if this would create a COGS spike (more lenient cap)
                max_daily_cogs = Decimal(8000 + 4000 * season_factor)  # Higher cap: 8K-12K range
                if STATE.should_throttle_shipment(sim_day, shipment_value, max_daily_cogs):
                    # Reduce quantity to smooth COGS
                    max_affordable_qty = int((max_daily_cogs - STATE.daily_shipment_value.get(sim_day, Decimal(0))) / profile["base_cost"])
                    if max_affordable_qty > 0:
                        qty = min(qty, max_affordable_qty)
                    else:
                        # Skip this shipment to avoid spike
                        continue
                
                payload = {
                    "action": "ship",
                    "sku_code": sku,
                    "location": location,
                    "qty": qty,
                    "txn_metadata": {
                        "ship_from": ship_from,
                        "channel": random.choice(["online", "retail", "wholesale"])
                    },
                    "reference": f"SHIP-{uuid.uuid4().hex[:6]}"
                }
                post_txn(client, payload)
                STATE.ship(sku, location, qty, ship_from)
                STATE.record_shipment(sim_day, shipment_value)

        # RESERVE: 13% of transactions (reduced from 15%)
        elif roll < 0.78:
            if available > 3:
                max_reserve = min(6, int(available * 0.4))
                qty = random.randint(1, max_reserve)
                payload = {
                    "action": "reserve",
                    "sku_code": sku,
                    "location": location,
                    "qty": qty,
                    "txn_metadata": {
                        "order_id": f"ORD-{uuid.uuid4().hex[:8]}",
                        "customer": random.choice(["Online Customer", "B2B Partner", "Retail Order"]),
                    }
                }
                post_txn(client, payload)
                STATE.reserve(sku, location, qty)

        # RESTOCK: 10% (reduced from 12%, trigger when low, but respect stockout strategy)
        elif roll < 0.88:
            # Check if we should restock this SKU
            if not should_restock_sku(sku, iteration, iterations):
                continue
            
            # Restock if inventory is getting low
            if available < 20 or (available < 40 and profile["velocity"] == "fast"):
                # Order quantity based on velocity (slightly reduced)
                if profile["velocity"] == "fast":
                    qty = random.randint(45, 90)
                elif profile["velocity"] == "medium":
                    qty = random.randint(25, 55)
                elif profile["velocity"] == "slow":
                    qty = random.randint(12, 30)
                else:
                    qty = random.randint(5, 12)
                
                # Reduce restock quantities for stockout targets in later phases
                if profile["stockout_target"]:
                    progress = iteration / iterations
                    if progress > 0.50:
                        qty = int(qty * 0.5)
                    if progress > 0.70:
                        qty = int(qty * 0.3)
                
                cost = rand_cost(profile["base_cost"], variance=0.08)
                thresholds = STATE.get_thresholds(sku)
                
                payload = {
                    "action": "receive",
                    "sku_code": sku,
                    "sku_name": sku_data[1],
                    "location": location,
                    "qty": qty,
                    "unit_cost_major": float(cost),
                    "alerts": False,
                    "low_stock_threshold": thresholds["low_stock_threshold"],
                    "reorder_point": thresholds["reorder_point"],
                    "reference": f"PO-{uuid.uuid4().hex[:6]}",
                }
                post_txn(client, payload)
                STATE.receive(sku, location, qty)

        # UNRESERVE: 6%
        elif roll < 0.94:
            reserved_qty = STATE.state.get((sku, location), {}).get("reserved", 0)
            if reserved_qty > 0:
                qty = random.randint(1, min(3, reserved_qty))
                payload = {
                    "action": "unreserve",
                    "sku_code": sku,
                    "location": location,
                    "qty": qty,
                    "txn_metadata": {
                        "reason": random.choice(["Order Cancelled", "Payment Failed", "Customer Request"]),
                        "order_id": f"ORD-{uuid.uuid4().hex[:6]}"
                    }
                }
                post_txn(client, payload)
                STATE.unreserve(sku, location, qty)

        # ADJUST (shrinkage/damage): 4%
        elif roll < 0.98:
            on_hand = STATE.state.get((sku, location), {}).get("on_hand", 0)
            if on_hand > 5:  # Ensure enough stock for meaningful adjustment
                # Smaller adjustments to avoid COGS impact
                max_adjust = max(1, min(2, on_hand // 5))
                adj_qty = -random.randint(1, max_adjust)
                payload = {
                    "action": "adjust",
                    "sku_code": sku,
                    "location": location,
                    "qty": adj_qty,
                    "txn_metadata": {"reason": random.choice(["Damaged", "Lost", "Quality Issue", "Audit Correction"])},
                }
                post_txn(client, payload)
                STATE.adjust(sku, location, adj_qty)

        # TRANSFER: 2% (reduced from 3%)
        else:
            if available > 10:
                qty = random.randint(2, min(6, available // 4))
                target = random.choice(["Retail Showroom", "Overflow Storage"])
                payload = {
                    "action": "transfer",
                    "sku_code": sku,
                    "location": location,
                    "target_location": target,
                    "qty": qty,
                }
                post_txn(client, payload)
                STATE.transfer(sku, location, target, qty)


def phase_final_stockout_nudge():
    """
    Final gentle nudge to ensure stockout targets reach zero.
    Only acts on SKUs that are very close to stockout but not quite there.
    """
    print("  Final stockout verification...")
    
    for sku_data in STOCKOUT_TARGET_SKUS:
        sku = sku_data[0]
        location = "Main Warehouse"
        available = STATE.available(sku, location)
        
        # Only act if SKU has 1-5 units remaining (very close but not zero)
        if 0 < available <= 5:
            user = rand_user()
            client = client_for(user)
            
            payload = {
                "action": "ship",
                "sku_code": sku,
                "location": location,
                "qty": available,
                "txn_metadata": {
                    "ship_from": "available",
                    "reason": "Final Order Fulfillment"
                },
                "reference": f"SHIP-FINAL-{uuid.uuid4().hex[:6]}"
            }
            post_txn(client, payload)
            STATE.ship(sku, location, available, "available")


def print_final_stats():
    """Print summary statistics"""
    print("\n" + "="*60)
    print("FINAL INVENTORY SNAPSHOT")
    print("="*60)
    
    total_units = 0
    total_value = Decimal(0)
    total_cogs = sum(STATE.daily_shipment_value.values())
    stockout_count = 0
    lowstock_count = 0
    stockout_skus = []
    
    for (sku, loc), data in STATE.state.items():
        if loc == "Main Warehouse":
            total_units += data["on_hand"]
            total_value += data["on_hand"] * SKU_PROFILES[sku]["base_cost"]
            if data["on_hand"] == 0:
                stockout_count += 1
                stockout_skus.append(sku)
            elif data["on_hand"] < 10:
                lowstock_count += 1
    
    print(f"Total SKUs tracked: {len(SKUS)}")
    print(f"Total units on hand: {total_units}")
    print(f"Total inventory value: ${total_value:,.2f}")
    print(f"Total COGS (all-time): ${total_cogs:,.2f}")
    print(f"Inventory/COGS ratio: {(total_value / total_cogs * 100):.1f}%")
    print(f"SKUs out of stock: {stockout_count}")
    print(f"SKUs with low stock (<10 units): {lowstock_count}")
    
    if stockout_skus:
        print(f"\nStocked-out SKUs ({len(stockout_skus)}):")
        for sku in sorted(stockout_skus)[:10]:
            velocity = SKU_PROFILES[sku]["velocity"]
            print(f"  - {sku} ({velocity})")
        if len(stockout_skus) > 10:
            print(f"  ... and {len(stockout_skus) - 10} more")

# ============================================================
# MAIN
# ============================================================

def main():
    print("\n" + "="*60)
    print("INVENTORY DATA GENERATION - REALISTIC OPERATIONS")
    print("="*60 + "\n")
    
    print("Phase 1: BOOTSTRAP")
    phase_bootstrap()
    
    print("\nPhase 2: OPERATIONS (with gradual stockouts)")
    phase_operations(iterations=2000)
    
    print("\nPhase 3: FINAL STOCKOUT VERIFICATION")
    phase_final_stockout_nudge()
    
    print("\n" + "="*60)
    print("DATA GENERATION COMPLETE")
    print_final_stats()


if __name__ == "__main__":
    main()
    