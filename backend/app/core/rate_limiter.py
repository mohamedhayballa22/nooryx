import redis.asyncio as redis
import time
from typing import Dict, Tuple

from app.core.config import settings


class RateLimiter:
    def __init__(self, redis_url: str):
        self.redis = redis.from_url(redis_url)

    async def is_allowed(
        self, key: str, capacity: int = 100, refill_rate: float = 10
    ) -> Tuple[bool, Dict]:
        now = time.time()
        redis_key = f"rate_limit:{key}"

        # Get current bucket state
        bucket = await self.redis.hgetall(redis_key)

        tokens = float(bucket.get(b"tokens", capacity)) if bucket else capacity
        last_refill = float(bucket.get(b"last_refill", now)) if bucket else now

        # Refill
        time_passed = now - last_refill
        tokens = min(capacity, tokens + time_passed * refill_rate)

        # Check allowance
        if tokens >= 1:
            allowed = True
            tokens -= 1
        else:
            allowed = False

        remaining = int(tokens)
        reset_time = now + (capacity - tokens) / refill_rate

        # Save state
        await self.redis.hset(
            redis_key,
            mapping={
                "tokens": tokens,
                "last_refill": now,
            },
        )
        await self.redis.expire(redis_key, 3600)  # Expire after 1h of inactivity

        return allowed, {
            "remaining": remaining,
            "reset_time": reset_time,
        }


rate_limiter = RateLimiter(settings.REDIS_URL)
