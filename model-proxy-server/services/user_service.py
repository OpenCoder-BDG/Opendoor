"""
User and deployment management service
"""
import secrets
import time
import uuid
from datetime import datetime
from typing import Dict, Optional, List
import asyncio

from config import settings
from logger import setup_logger
from models import UserDeployment, DeploymentStatus, ModelBackend
from services.model_service import model_loader

logger = setup_logger(__name__)


class UserService:
    """Service for managing users and their deployments"""
    
    def __init__(self):
        self.deployments: Dict[str, UserDeployment] = {}
        self.active_models: Dict[str, Dict] = {}
        
    def generate_user_id(self) -> str:
        """Generate a unique user ID"""
        return str(uuid.uuid4())
    
    def generate_api_key(self) -> str:
        """Generate a secure API key"""
        return f"sk-{secrets.token_urlsafe(settings.api_key_length)}"
    
    async def create_deployment(
        self,
        model_name: str,
        backend: ModelBackend = ModelBackend.TRANSFORMERS,
        api_key_enabled: bool = True,
        user_id: Optional[str] = None,
        custom_config: Optional[Dict] = None
    ) -> UserDeployment:
        """Create a new model deployment for a user"""
        
        # Generate user ID if not provided
        if not user_id:
            user_id = self.generate_user_id()
        
        # Check if user already has this model deployed
        if user_id in self.deployments:
            existing = self.deployments[user_id]
            if existing.model_name == model_name and existing.status != DeploymentStatus.ERROR:
                return existing
        
        # Generate API key if enabled
        api_key = self.generate_api_key() if api_key_enabled else None
        
        # Get external IP for base URL
        external_ip = await self._get_external_ip()
        base_url = f"http://{external_ip}:{settings.port}/user/{user_id}/v1"
        
        # Create deployment
        deployment = UserDeployment(
            user_id=user_id,
            model_name=model_name,
            backend=backend,
            status=DeploymentStatus.DEPLOYING,
            api_key=api_key,
            api_key_enabled=api_key_enabled,
            base_url=base_url,
            custom_config=custom_config or {}
        )
        
        # Store deployment
        self.deployments[user_id] = deployment
        
        # Start model loading in background
        asyncio.create_task(self._load_user_model(user_id, model_name, backend))
        
        logger.info(f"Created deployment for user {user_id} with model {model_name}")
        return deployment
    
    async def _load_user_model(self, user_id: str, model_name: str, backend: ModelBackend):
        """Load model for a specific user"""
        try:
            logger.info(f"Loading model {model_name} for user {user_id}")
            
            # Update status to deploying
            if user_id in self.deployments:
                self.deployments[user_id].status = DeploymentStatus.DEPLOYING
            
            # Load the model
            model_data = await model_loader.load_model(model_name, backend)
            
            # Store in active models
            self.active_models[user_id] = model_data
            
            # Update deployment status
            if user_id in self.deployments:
                deployment = self.deployments[user_id]
                deployment.status = DeploymentStatus.READY
                deployment.loaded_at = datetime.now()
                deployment.updated_at = datetime.now()
            
            logger.info(f"Model {model_name} loaded successfully for user {user_id}")
            
        except Exception as e:
            logger.error(f"Error loading model for user {user_id}: {e}")
            
            # Update deployment status
            if user_id in self.deployments:
                deployment = self.deployments[user_id]
                deployment.status = DeploymentStatus.ERROR
                deployment.error_message = str(e)
                deployment.updated_at = datetime.now()
    
    def get_deployment(self, user_id: str) -> Optional[UserDeployment]:
        """Get deployment for a user"""
        return self.deployments.get(user_id)
    
    def get_user_model(self, user_id: str) -> Optional[Dict]:
        """Get loaded model for a user"""
        return self.active_models.get(user_id)
    
    def list_deployments(self) -> List[UserDeployment]:
        """List all deployments"""
        return list(self.deployments.values())
    
    def stop_deployment(self, user_id: str) -> bool:
        """Stop a user's deployment"""
        if user_id not in self.deployments:
            return False
        
        # Update status
        deployment = self.deployments[user_id]
        deployment.status = DeploymentStatus.STOPPED
        deployment.updated_at = datetime.now()
        
        # Unload model
        if user_id in self.active_models:
            del self.active_models[user_id]
            model_loader.unload_model(user_id)
        
        logger.info(f"Stopped deployment for user {user_id}")
        return True
    
    def delete_deployment(self, user_id: str) -> bool:
        """Delete a user's deployment"""
        if user_id not in self.deployments:
            return False
        
        # Stop deployment first
        self.stop_deployment(user_id)
        
        # Remove from deployments
        del self.deployments[user_id]
        
        logger.info(f"Deleted deployment for user {user_id}")
        return True
    
    def validate_api_key(self, user_id: str, api_key: str) -> bool:
        """Validate API key for a user"""
        deployment = self.get_deployment(user_id)
        if not deployment or not deployment.api_key_enabled:
            return True  # No API key required
        
        return deployment.api_key == api_key
    
    def get_stats(self) -> Dict:
        """Get service statistics"""
        total_deployments = len(self.deployments)
        active_deployments = sum(1 for d in self.deployments.values() if d.status == DeploymentStatus.READY)
        error_deployments = sum(1 for d in self.deployments.values() if d.status == DeploymentStatus.ERROR)
        
        return {
            "total_deployments": total_deployments,
            "active_deployments": active_deployments,
            "error_deployments": error_deployments,
            "active_models": len(self.active_models),
            "unique_users": len(set(d.user_id for d in self.deployments.values()))
        }
    
    async def _get_external_ip(self) -> str:
        """Get external IP of the instance"""
        try:
            import requests
            response = requests.get(
                f"{settings.metadata_service_url}/instance/network-interfaces/0/access-configs/0/external-ip",
                headers={"Metadata-Flavor": "Google"},
                timeout=5
            )
            return response.text.strip()
        except Exception:
            return "localhost"  # Fallback


# Global service instance
user_service = UserService()
