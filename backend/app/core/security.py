"""
Security utilities for encryption/decryption of sensitive data.
"""
from cryptography.fernet import Fernet
from app.core.config import settings
import base64
import hashlib


class EncryptionService:
    """Service for encrypting and decrypting sensitive data using Fernet symmetric encryption."""
    
    def __init__(self):
        key = hashlib.sha256(settings.SECRET_KEY.encode()).digest()
        self.fernet = Fernet(base64.urlsafe_b64encode(key))
    
    def encrypt(self, data: str) -> str:
        """
        Encrypt a string value.
        
        Args:
            data: Plain text string to encrypt
            
        Returns:
            Encrypted string (base64 encoded)
        """
        if not data:
            return ""
        
        encrypted_bytes = self.fernet.encrypt(data.encode())
        return encrypted_bytes.decode()
    
    def decrypt(self, encrypted_data: str) -> str:
        """
        Decrypt an encrypted string value.
        
        Args:
            encrypted_data: Encrypted string (base64 encoded)
            
        Returns:
            Decrypted plain text string
        """
        if not encrypted_data:
            return ""
        
        decrypted_bytes = self.fernet.decrypt(encrypted_data.encode())
        return decrypted_bytes.decode()


# Singleton instance
encryption_service = EncryptionService()
