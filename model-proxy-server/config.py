"""
Configuration management for Model Proxy Server
"""
import os
from typing import Optional
from pydantic import BaseSettings


class Settings(BaseSettings):
    """Application settings with environment variable support"""
    
    # Server settings
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False
    
    # Model settings
    models_cache_dir: str = "/mnt/models/huggingface_cache"
    user_models_dir: str = "/mnt/models/user_models"
    max_models_per_user: int = 3
    
    # Security settings
    secret_key: str = "your-secret-key-change-in-production"
    api_key_length: int = 32
    enable_auth: bool = True
    
    # Database settings (for future use)
    database_url: Optional[str] = None
    redis_url: Optional[str] = "redis://localhost:6379"
    
    # External services
    huggingface_api_url: str = "https://huggingface.co/api/models"
    metadata_service_url: str = "http://metadata.google.internal/computeMetadata/v1"
    
    # Rate limiting
    requests_per_minute: int = 60
    models_search_limit: int = 50
    
    # Logging
    log_level: str = "INFO"
    log_format: str = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    
    class Config:
        env_file = ".env"
        env_prefix = "MODEL_PROXY_"


# Global settings instance
settings = Settings()
