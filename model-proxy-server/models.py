"""
Data models and schemas for Model Proxy Server
"""
from datetime import datetime
from typing import Dict, List, Optional, Any
from enum import Enum
from pydantic import BaseModel, Field, validator


class DeploymentStatus(str, Enum):
    """Deployment status enumeration"""
    PENDING = "pending"
    DEPLOYING = "deploying"
    READY = "ready"
    ERROR = "error"
    STOPPED = "stopped"


class ModelBackend(str, Enum):
    """Model backend enumeration"""
    TRANSFORMERS = "transformers"
    JAX = "jax"
    VLLM = "vllm"


class ModelSearchRequest(BaseModel):
    """Request model for searching HuggingFace models"""
    query: str = Field(..., min_length=1, max_length=100, description="Search query")
    limit: int = Field(default=10, ge=1, le=50, description="Maximum number of results")
    filter_compatible: bool = Field(default=True, description="Filter only compatible models")


class ModelDeployRequest(BaseModel):
    """Request model for deploying a model"""
    model_name: str = Field(..., min_length=1, description="HuggingFace model identifier")
    backend: ModelBackend = Field(default=ModelBackend.TRANSFORMERS, description="Model backend")
    api_key_enabled: bool = Field(default=True, description="Enable API key authentication")
    user_id: Optional[str] = Field(None, description="User ID (generated if not provided)")
    custom_config: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Custom model configuration")


class ChatMessage(BaseModel):
    """Chat message model"""
    role: str = Field(..., regex="^(system|user|assistant)$", description="Message role")
    content: str = Field(..., min_length=1, description="Message content")


class ChatCompletionRequest(BaseModel):
    """Request model for chat completions"""
    model: str = Field(..., description="Model identifier")
    messages: List[ChatMessage] = Field(..., min_items=1, description="Chat messages")
    max_tokens: int = Field(default=100, ge=1, le=4096, description="Maximum tokens to generate")
    temperature: float = Field(default=0.7, ge=0.0, le=2.0, description="Sampling temperature")
    top_p: float = Field(default=1.0, ge=0.0, le=1.0, description="Nucleus sampling parameter")
    stream: bool = Field(default=False, description="Enable streaming response")
    stop: Optional[List[str]] = Field(None, description="Stop sequences")


class ModelInfo(BaseModel):
    """Model information from HuggingFace"""
    id: str = Field(..., description="Model identifier")
    name: str = Field(..., description="Model display name")
    downloads: int = Field(default=0, description="Number of downloads")
    likes: int = Field(default=0, description="Number of likes")
    tags: List[str] = Field(default_factory=list, description="Model tags")
    description: str = Field(default="", description="Model description")
    pipeline_tag: Optional[str] = Field(None, description="Primary pipeline tag")
    library_name: Optional[str] = Field(None, description="Library name")
    compatible: bool = Field(default=True, description="Whether model is compatible")
    compatibility_reason: Optional[str] = Field(None, description="Reason for incompatibility")


class UserDeployment(BaseModel):
    """User deployment model"""
    user_id: str = Field(..., description="Unique user identifier")
    model_name: str = Field(..., description="Deployed model name")
    backend: ModelBackend = Field(..., description="Model backend")
    status: DeploymentStatus = Field(..., description="Deployment status")
    api_key: Optional[str] = Field(None, description="API key for authentication")
    api_key_enabled: bool = Field(default=True, description="Whether API key is enabled")
    base_url: str = Field(..., description="Base URL for API endpoints")
    created_at: datetime = Field(default_factory=datetime.now, description="Creation timestamp")
    updated_at: datetime = Field(default_factory=datetime.now, description="Last update timestamp")
    loaded_at: Optional[datetime] = Field(None, description="Model load completion timestamp")
    error_message: Optional[str] = Field(None, description="Error message if deployment failed")
    custom_config: Dict[str, Any] = Field(default_factory=dict, description="Custom configuration")
    
    @validator('updated_at', pre=True, always=True)
    def set_updated_at(cls, v):
        return datetime.now()


class DeploymentStatusResponse(BaseModel):
    """Response model for deployment status"""
    user_id: str
    model_name: str
    backend: str
    status: DeploymentStatus
    api_key: Optional[str] = None
    api_key_enabled: bool
    base_url: str
    created_at: datetime
    error_message: Optional[str] = None
    progress: Optional[str] = None


class ChatCompletionChoice(BaseModel):
    """Chat completion choice"""
    index: int
    message: ChatMessage
    finish_reason: str


class ChatCompletionUsage(BaseModel):
    """Token usage information"""
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int


class ChatCompletionResponse(BaseModel):
    """Response model for chat completions"""
    id: str
    object: str = "chat.completion"
    created: int
    model: str
    choices: List[ChatCompletionChoice]
    usage: ChatCompletionUsage


class ServerStatus(BaseModel):
    """Server status model"""
    status: str = "running"
    version: str = "1.0.0"
    active_deployments: int
    active_models: int
    total_users: int
    uptime_seconds: int
    memory_usage_mb: float
    jax_devices: int
    external_ip: str
    features: List[str] = ["chat_completions", "model_search", "multi_user", "api_keys"]


class ErrorResponse(BaseModel):
    """Error response model"""
    error: str
    message: str
    code: Optional[str] = None
    details: Optional[Dict[str, Any]] = None
