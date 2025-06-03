"""
Main FastAPI application for Model Proxy Server
Production-grade implementation with proper structure
"""
import time
import psutil
from datetime import datetime
from typing import List, Dict, Any
from fastapi import FastAPI, HTTPException, Request, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import jax

from config import settings
from logger import setup_logger
from models import (
    ModelSearchRequest, ModelDeployRequest, ChatCompletionRequest,
    DeploymentStatusResponse, ChatCompletionResponse, ServerStatus,
    ErrorResponse, ModelInfo
)
from services.model_service import model_search_service
from services.user_service import user_service
from services.inference_service import inference_service

# Setup logging
logger = setup_logger(__name__, log_file="logs/app.log")

# Create FastAPI app
app = FastAPI(
    title="Model Proxy Server",
    description="Production-grade model proxy server for HuggingFace models",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Security
security = HTTPBearer(auto_error=False)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Track server start time
SERVER_START_TIME = time.time()


async def verify_api_key(
    user_id: str,
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> bool:
    """Verify API key for a user"""
    if not settings.enable_auth:
        return True
    
    deployment = user_service.get_deployment(user_id)
    if not deployment or not deployment.api_key_enabled:
        return True
    
    if not credentials:
        raise HTTPException(status_code=401, detail="API key required")
    
    api_key = credentials.credentials
    if not user_service.validate_api_key(user_id, api_key):
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    return True


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler"""
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content=ErrorResponse(
            error="Internal Server Error",
            message="An unexpected error occurred"
        ).dict()
    )


@app.get("/", response_class=HTMLResponse)
async def get_frontend():
    """Serve the modern frontend with black/purple theme"""
    with open("frontend.html", "r") as f:
        return HTMLResponse(content=f.read())


@app.post("/api/v1/search-models", response_model=Dict[str, List[ModelInfo]])
async def search_models(request: ModelSearchRequest):
    """Search HuggingFace models"""
    try:
        models = await model_search_service.search_models(
            request.query,
            request.limit,
            request.filter_compatible
        )
        return {"models": models}
    except Exception as e:
        logger.error(f"Error searching models: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/deploy-model", response_model=Dict[str, Any])
async def deploy_model(request: ModelDeployRequest):
    """Deploy a model for a user"""
    try:
        deployment = await user_service.create_deployment(
            model_name=request.model_name,
            backend=request.backend,
            api_key_enabled=request.api_key_enabled,
            user_id=request.user_id,
            custom_config=request.custom_config
        )
        
        return {
            "message": f"Deploying model {request.model_name}",
            "user_id": deployment.user_id,
            "model_name": deployment.model_name,
            "backend": deployment.backend.value,
            "status": deployment.status.value,
            "api_key_enabled": deployment.api_key_enabled
        }
        
    except Exception as e:
        logger.error(f"Error deploying model: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/deployment-status/{user_id}", response_model=DeploymentStatusResponse)
async def get_deployment_status(user_id: str):
    """Get deployment status for a user"""
    deployment = user_service.get_deployment(user_id)
    if not deployment:
        raise HTTPException(status_code=404, detail="User deployment not found")
    
    return DeploymentStatusResponse(
        user_id=deployment.user_id,
        model_name=deployment.model_name,
        backend=deployment.backend.value,
        status=deployment.status,
        api_key=deployment.api_key if deployment.api_key_enabled else None,
        api_key_enabled=deployment.api_key_enabled,
        base_url=deployment.base_url,
        created_at=deployment.created_at,
        error_message=deployment.error_message,
        progress=None  # Could be enhanced with detailed progress tracking
    )


@app.get("/user/{user_id}/v1/models")
async def get_user_models(user_id: str, _: bool = Depends(verify_api_key)):
    """Get models for a specific user (OpenAI compatible)"""
    deployment = user_service.get_deployment(user_id)
    if not deployment:
        raise HTTPException(status_code=404, detail="User not found")
    
    if deployment.status.value != "ready":
        raise HTTPException(status_code=503, detail="Model not ready")
    
    return {
        "object": "list",
        "data": [{
            "id": deployment.model_name,
            "object": "model",
            "created": int(deployment.created_at.timestamp()),
            "owned_by": f"user-{user_id}",
            "permission": [],
            "root": deployment.model_name,
            "parent": None
        }]
    }


@app.post("/user/{user_id}/v1/chat/completions", response_model=ChatCompletionResponse)
async def user_chat_completions(
    user_id: str,
    request: ChatCompletionRequest,
    _: bool = Depends(verify_api_key)
):
    """Chat completions for a specific user (OpenAI compatible)"""
    try:
        response = await inference_service.chat_completion(
            user_id=user_id,
            messages=request.messages,
            max_tokens=request.max_tokens,
            temperature=request.temperature,
            top_p=request.top_p,
            stop=request.stop
        )
        return response
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error in chat completion for user {user_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/v1/settings")
async def get_settings():
    """Get current server settings"""
    return {
        "host": settings.host,
        "port": settings.port,
        "debug": settings.debug,
        "models_cache_dir": settings.models_cache_dir,
        "user_models_dir": settings.user_models_dir,
        "max_models_per_user": settings.max_models_per_user,
        "secret_key": settings.secret_key[:8] + "..." if settings.secret_key else "",  # Mask secret key
        "api_key_length": settings.api_key_length,
        "enable_auth": settings.enable_auth,
        "requests_per_minute": settings.requests_per_minute,
        "models_search_limit": settings.models_search_limit,
        "huggingface_api_url": settings.huggingface_api_url,
        "metadata_service_url": settings.metadata_service_url,
        "redis_url": settings.redis_url,
        "log_level": settings.log_level,
        "log_format": settings.log_format
    }


@app.put("/api/v1/settings")
async def update_settings(updated_settings: Dict[str, Any]):
    """Update server settings"""
    try:
        # Validate and update settings
        for key, value in updated_settings.items():
            if hasattr(settings, key):
                # Type validation
                current_value = getattr(settings, key)
                if isinstance(current_value, bool):
                    value = bool(value)
                elif isinstance(current_value, int):
                    value = int(value)
                elif isinstance(current_value, str):
                    value = str(value)
                
                setattr(settings, key, value)
                logger.info(f"Updated setting {key} = {value}")
        
        # Return updated settings (with masked secret key)
        return await get_settings()
        
    except Exception as e:
        logger.error(f"Error updating settings: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid settings: {str(e)}")


@app.post("/api/v1/settings/reset")
async def reset_settings():
    """Reset settings to defaults"""
    try:
        # Reset to default values
        from config import Settings
        default_settings = Settings()
        
        # Update current settings with defaults
        for field_name, field in default_settings.__fields__.items():
            default_value = field.default
            setattr(settings, field_name, default_value)
            logger.info(f"Reset setting {field_name} = {default_value}")
        
        return await get_settings()
        
    except Exception as e:
        logger.error(f"Error resetting settings: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to reset settings: {str(e)}")


@app.get("/api/v1/status", response_model=ServerStatus)
async def get_status():
    """Get comprehensive server status"""
    user_stats = user_service.get_stats()
    inference_stats = inference_service.get_stats()
    
    # Get memory usage
    process = psutil.Process()
    memory_usage_mb = process.memory_info().rss / 1024 / 1024
    
    # Get external IP
    try:
        import requests
        response = requests.get(
            f"{settings.metadata_service_url}/instance/network-interfaces/0/access-configs/0/external-ip",
            headers={"Metadata-Flavor": "Google"},
            timeout=2
        )
        external_ip = response.text.strip()
    except:
        external_ip = "localhost"
    
    return ServerStatus(
        status="running",
        active_deployments=user_stats["active_deployments"],
        active_models=user_stats["active_models"],
        total_users=user_stats["unique_users"],
        uptime_seconds=int(time.time() - SERVER_START_TIME),
        memory_usage_mb=memory_usage_mb,
        jax_devices=len(jax.devices()) if jax.devices() else 0,
        external_ip=external_ip
    )


@app.post("/api/v1/deployments/{user_id}/stop")
async def stop_deployment(user_id: str):
    """Stop a user's deployment"""
    if user_service.stop_deployment(user_id):
        return {"message": f"Deployment for user {user_id} stopped"}
    else:
        raise HTTPException(status_code=404, detail="User deployment not found")


@app.delete("/api/v1/deployments/{user_id}")
async def delete_deployment(user_id: str):
    """Delete a user's deployment"""
    if user_service.delete_deployment(user_id):
        return {"message": f"Deployment for user {user_id} deleted"}
    else:
        raise HTTPException(status_code=404, detail="User deployment not found")


@app.get("/api/v1/deployments")
async def list_deployments():
    """List all deployments (admin endpoint)"""
    deployments = user_service.list_deployments()
    return {
        "deployments": [
            {
                "user_id": d.user_id,
                "model_name": d.model_name,
                "backend": d.backend.value,
                "status": d.status.value,
                "created_at": d.created_at.isoformat(),
                "api_key_enabled": d.api_key_enabled
            }
            for d in deployments
        ]
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "uptime_seconds": int(time.time() - SERVER_START_TIME)
    }


# Startup event
@app.on_event("startup")
async def startup_event():
    """Application startup tasks"""
    logger.info("Starting Model Proxy Server v2.0.0")
    logger.info(f"Server configuration: {settings.dict()}")
    
    # Create necessary directories
    import os
    os.makedirs(settings.models_cache_dir, exist_ok=True)
    os.makedirs(settings.user_models_dir, exist_ok=True)
    os.makedirs("logs", exist_ok=True)
    
    # Log JAX device info
    try:
        devices = jax.devices()
        logger.info(f"JAX devices available: {len(devices)}")
        for i, device in enumerate(devices):
            logger.info(f"  Device {i}: {device}")
    except Exception as e:
        logger.warning(f"Could not detect JAX devices: {e}")


# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown tasks"""
    logger.info("Shutting down Model Proxy Server")
    
    # Clean up any resources
    # This could include saving state, closing connections, etc.


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        access_log=True,
        log_config={
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "default": {
                    "format": settings.log_format,
                },
            },
            "handlers": {
                "default": {
                    "formatter": "default",
                    "class": "logging.StreamHandler",
                    "stream": "ext://sys.stdout",
                },
            },
            "root": {
                "level": settings.log_level,
                "handlers": ["default"],
            },
        }
    )
