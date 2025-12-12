"""
Redis client for caching and temporary data storage.
"""
import redis.asyncio as redis
from app.core.config import settings
from typing import Optional
import json


class RedisClient:
    """Async Redis client wrapper."""
    
    def __init__(self):
        self._client: Optional[redis.Redis] = None
    
    async def get_client(self) -> redis.Redis:
        """Get or create Redis client instance."""
        if self._client is None:
            self._client = await redis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True
            )
        return self._client
    
    async def set_with_expiry(
        self,
        key: str,
        value: str,
        expiry_seconds: int = 600
    ) -> bool:
        """
        Set a key-value pair with expiration.
        
        Args:
            key: Redis key
            value: Value to store
            expiry_seconds: TTL in seconds (default 10 minutes)
            
        Returns:
            True if successful
        """
        client = await self.get_client()
        return await client.setex(key, expiry_seconds, value)
    
    async def get(self, key: str) -> Optional[str]:
        """
        Get value by key.
        
        Args:
            key: Redis key
            
        Returns:
            Value if exists, None otherwise
        """
        client = await self.get_client()
        return await client.get(key)
    
    async def delete(self, key: str) -> bool:
        """
        Delete a key.
        
        Args:
            key: Redis key
            
        Returns:
            True if key was deleted
        """
        client = await self.get_client()
        result = await client.delete(key)
        return result > 0
    
    async def set_json(
        self,
        key: str,
        value: dict,
        expiry_seconds: int = 600
    ) -> bool:
        """
        Store a dictionary as JSON with expiration.
        
        Args:
            key: Redis key
            value: Dictionary to store
            expiry_seconds: TTL in seconds
            
        Returns:
            True if successful
        """
        json_str = json.dumps(value)
        return await self.set_with_expiry(key, json_str, expiry_seconds)
    
    async def get_json(self, key: str) -> Optional[dict]:
        """
        Retrieve and parse JSON value.
        
        Args:
            key: Redis key
            
        Returns:
            Parsed dictionary if exists, None otherwise
        """
        value = await self.get(key)
        if value:
            return json.loads(value)
        return None
    
    async def close(self):
        """Close Redis connection."""
        if self._client:
            await self._client.close()


# Singleton instance
redis_client = RedisClient()
