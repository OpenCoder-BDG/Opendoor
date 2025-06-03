"""
Logging configuration for Model Proxy Server
"""
import logging
import sys
from typing import Optional
from pathlib import Path
from config import settings


def setup_logger(
    name: str = "model_proxy",
    log_file: Optional[str] = None,
    level: str = None
) -> logging.Logger:
    """
    Set up a logger with proper formatting and handlers
    
    Args:
        name: Logger name
        log_file: Optional log file path
        level: Log level (defaults to settings.log_level)
    
    Returns:
        Configured logger instance
    """
    logger = logging.getLogger(name)
    
    # Don't add handlers if already configured
    if logger.handlers:
        return logger
    
    log_level = getattr(logging, (level or settings.log_level).upper(), logging.INFO)
    logger.setLevel(log_level)
    
    # Create formatter
    formatter = logging.Formatter(settings.log_format)
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    console_handler.setLevel(log_level)
    logger.addHandler(console_handler)
    
    # File handler (if specified)
    if log_file:
        # Ensure log directory exists
        log_path = Path(log_file)
        log_path.parent.mkdir(parents=True, exist_ok=True)
        
        file_handler = logging.FileHandler(log_file)
        file_handler.setFormatter(formatter)
        file_handler.setLevel(log_level)
        logger.addHandler(file_handler)
    
    return logger


# Default logger instance
logger = setup_logger()
