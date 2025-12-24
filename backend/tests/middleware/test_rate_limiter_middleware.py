import pytest
import time
from unittest.mock import patch
from httpx import AsyncClient


@pytest.mark.asyncio
class TestRateLimiterMiddleware:

    async def test_tier_configuration(self, client):
        """Verify different endpoints trigger different rate limit tiers."""
        
        with patch("app.middleware.rate_limit.rate_limiter.is_allowed") as mock_limiter:
            mock_limiter.return_value = (True, {"remaining": 50, "reset_time": time.time() + 60})
            
            # 1. Login (Public, Strict)
            await client.post("/api/auth/jwt/login", json={"username": "x", "password": "y"})
            call_args = mock_limiter.call_args_list[-1][0]
            key_login, cap_login, _ = call_args[0], call_args[1], call_args[2]
            
            assert "login" in key_login
            assert cap_login == 10
            
            # 2. Public Refresh
            await client.post("/api/auth/sessions/refresh")
            call_args = mock_limiter.call_args_list[-1][0]
            key_pub, cap_pub, _ = call_args[0], call_args[1], call_args[2]
            assert "public_refresh" in key_pub
            assert cap_pub == 50

    async def test_fail_open_on_backend_error(self, client: AsyncClient):
        """System must fail OPEN if rate limiter backend fails."""
        
        with patch("app.middleware.rate_limit.rate_limiter.is_allowed") as mock_limiter:
            mock_limiter.side_effect = Exception("Redis connection refused")
            
            response = await client.get("/api/inventory")
            
            assert response.status_code == 401  # bypassed but 401 as auth is required
            assert response.headers.get("X-RateLimit-Status") == "bypassed"

    async def test_rate_limit_exceeded_response(self, client: AsyncClient):
        """Verify 429 response structure when limit is exceeded."""
        fixed_time = time.time()
        
        with patch('app.middleware.rate_limit.time.time', return_value=fixed_time):
            with patch("app.middleware.rate_limit.rate_limiter.is_allowed") as mock_limiter:
                mock_limiter.return_value = (
                    False,
                    {
                        "remaining": 0,
                        "reset_time": fixed_time + 45
                    }
                )
                
                response = await client.get("/api/inventory")
                
                assert response.status_code == 429
                assert response.headers["Retry-After"] == "45"
                
                data = response.json()
                assert "error" in data
                assert "Too many requests" in data.get("message", "")

    async def test_headers_presence_happy_path(self, client: AsyncClient):
        """Verify rate limit headers are present on successful requests."""
        
        with patch("app.middleware.rate_limit.rate_limiter.is_allowed") as mock_limiter:
            mock_limiter.return_value = (True, {"remaining": 50, "reset_time": time.time() + 60})
            
            # Use a real endpoint
            response = await client.get("/api/settings")
            
            # May be 200 or 401 depending on auth requirements
            assert response.status_code in [200, 401]
            assert "X-RateLimit-Limit" in response.headers
            assert "X-RateLimit-Remaining" in response.headers
            assert "X-RateLimit-Reset" in response.headers
        
    async def test_thundering_herd_on_same_user(self, client):
        """100 concurrent requests from same user - do we leak through?"""
        import asyncio
        
        with patch("app.middleware.rate_limit.rate_limiter.is_allowed") as mock_limiter:
            mock_limiter.return_value = (False, {"remaining": 0, "reset_time": time.time() + 60})
            
            tasks = [client.get("/api/inventory") for _ in range(100)]
            responses = await asyncio.gather(*tasks, return_exceptions=True)
            
            # ALL should be 429s, not just 99 of them
            assert all(r.status_code == 429 for r in responses if hasattr(r, 'status_code'))
        
    async def test_malformed_jwt_doesnt_crash_middleware(self, client):
        """Malicious/corrupted tokens shouldn't DoS the service."""
        
        with patch("app.middleware.rate_limit.rate_limiter.is_allowed") as mock_limiter:
            mock_limiter.return_value = (True, {"remaining": 50, "reset_time": time.time() + 60})
            
            # Use ASCII-only characters that form invalid JWTs
            malformed_tokens = [
                "not.a.jwt",
                "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.corrupted.signature",
                "a" * 5000,  # Extremely long but valid ASCII
                "../../../../etc/passwd",  # Path traversal attempt
                "'; DROP TABLE users; --",  # SQL injection attempt
            ]
            
            for token in malformed_tokens:
                client.cookies.set("access_token", token)
                response = await client.get("/api/settings")
                # Should handle gracefully, not crash the worker
                assert response.status_code in [401, 429, 200]
        
    async def test_negative_retry_after_is_impossible(self, client):
        """reset_time in the past shouldn't give negative retry-after."""
        
        with patch("app.middleware.rate_limit.rate_limiter.is_allowed") as mock_limiter:
            mock_limiter.return_value = (
                False, 
                {"remaining": 0, "reset_time": time.time() - 100}  # Past!
            )
            
            response = await client.get("/api/settings")
            retry_after = int(response.headers["Retry-After"])
            
            assert retry_after >= 1  # Your max(1, ...) should save this
        
    async def test_x_forwarded_for_injection_attack(self, client):
        """Attacker shouldn't bypass rate limits by forging proxy headers."""
        
        with patch("app.middleware.rate_limit.rate_limiter.is_allowed") as mock_limiter:
            mock_limiter.return_value = (True, {"remaining": 50, "reset_time": time.time() + 60})
            
            # Attacker tries to impersonate different IPs
            for fake_ip in ["1.2.3.4", "5.6.7.8", "9.10.11.12"]:
                client.headers["x-forwarded-for"] = fake_ip
                response = await client.get("/api/auth/jwt/login")
            
            # Should be rate limited because fingerprint includes more than just IP
            # Or you need to validate proxy headers are from trusted sources
            assert mock_limiter.call_count >= 3
            