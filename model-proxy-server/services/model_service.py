"""
Model management service
"""
import asyncio
import os
import time
from typing import Dict, Any, Optional, List
from pathlib import Path
import torch
import jax
import jax.numpy as jnp
from transformers import AutoTokenizer, AutoModelForCausalLM, AutoModelForSeq2SeqLM, pipeline
from huggingface_hub import HfApi

from config import settings
from logger import setup_logger
from models import ModelInfo, ModelBackend, DeploymentStatus

logger = setup_logger(__name__)


class ModelCompatibilityChecker:
    """Check model compatibility with our system"""
    
    INCOMPATIBLE_TAGS = {'mlx', 'gguf', 'onnx', 'openvino', 'tensorrt'}
    INCOMPATIBLE_LIBRARIES = {'mlx', 'gguf', 'onnx'}
    
    @classmethod
    def is_compatible(cls, model_info) -> tuple[bool, str]:
        """Check if a model is compatible with our setup"""
        tags = getattr(model_info, 'tags', [])
        library_name = getattr(model_info, 'library_name', '')
        
        # Check for incompatible tags
        for tag in tags:
            if any(incomp in tag.lower() for incomp in cls.INCOMPATIBLE_TAGS):
                return False, f"Incompatible format: {tag}"
        
        # Check for incompatible libraries
        if library_name.lower() in cls.INCOMPATIBLE_LIBRARIES:
            return False, f"Incompatible library: {library_name}"
        
        # Check for MLX quantized models
        if any('bit' in tag for tag in tags) and 'mlx' in tags:
            return False, "MLX quantized model not supported"
        
        return True, "Compatible"


class ModelSearchService:
    """Service for searching HuggingFace models"""
    
    def __init__(self):
        self.api = HfApi()
        self.cache = {}
        self.cache_ttl = 300  # 5 minutes
        
    async def search_models(self, query: str, limit: int = 10, filter_compatible: bool = True) -> List[ModelInfo]:
        """Search HuggingFace models with caching"""
        cache_key = f"{query}:{limit}:{filter_compatible}"
        
        # Check cache
        if cache_key in self.cache:
            cached_data, timestamp = self.cache[cache_key]
            if time.time() - timestamp < self.cache_ttl:
                return cached_data
        
        try:
            # Search models using HuggingFace API
            models = await self._fetch_models(query, limit)
            
            # Process and filter models
            processed_models = []
            for model in models:
                model_info = self._process_model_info(model)
                
                if filter_compatible and not model_info.compatible:
                    continue
                    
                processed_models.append(model_info)
            
            # Cache results
            self.cache[cache_key] = (processed_models, time.time())
            
            return processed_models
            
        except Exception as e:
            logger.error(f"Error searching models: {e}")
            # Return fallback models
            return self._get_fallback_models()
    
    async def _fetch_models(self, query: str, limit: int) -> List:
        """Fetch models from HuggingFace API"""
        import requests
        
        url = settings.huggingface_api_url
        params = {
            "search": query,
            "limit": limit,
            "filter": "text-generation",
            "sort": "downloads",
            "direction": -1
        }
        
        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None, lambda: requests.get(url, params=params, timeout=10)
        )
        response.raise_for_status()
        return response.json()
    
    def _process_model_info(self, model_data: dict) -> ModelInfo:
        """Process raw model data into ModelInfo"""
        try:
            # Get model info for compatibility check
            model_info = self.api.model_info(model_data.get("id", ""))
            compatible, reason = ModelCompatibilityChecker.is_compatible(model_info)
        except Exception:
            compatible, reason = True, "Unable to verify compatibility"
        
        return ModelInfo(
            id=model_data.get("id", ""),
            name=model_data.get("id", ""),
            downloads=model_data.get("downloads", 0),
            likes=model_data.get("likes", 0),
            tags=model_data.get("tags", []),
            description=(model_data.get("description", "") or "")[:200] + "..." if model_data.get("description") else "",
            pipeline_tag=getattr(model_info, 'pipeline_tag', None) if 'model_info' in locals() else None,
            library_name=getattr(model_info, 'library_name', None) if 'model_info' in locals() else None,
            compatible=compatible,
            compatibility_reason=None if compatible else reason
        )
    
    def _get_fallback_models(self) -> List[ModelInfo]:
        """Return fallback models when API fails"""
        return [
            ModelInfo(
                id="gpt2",
                name="gpt2",
                downloads=1000000,
                likes=500,
                tags=["text-generation"],
                description="GPT-2 is a transformers model pretrained on a very large corpus of English data",
                compatible=True
            ),
            ModelInfo(
                id="microsoft/DialoGPT-medium",
                name="microsoft/DialoGPT-medium",
                downloads=500000,
                likes=200,
                tags=["conversational"],
                description="Large-scale pretraining for dialogue generation",
                compatible=True
            ),
            ModelInfo(
                id="google/flan-t5-base",
                name="google/flan-t5-base",
                downloads=300000,
                likes=150,
                tags=["text2text-generation"],
                description="FLAN-T5 Base model for instruction following",
                compatible=True
            ),
            ModelInfo(
                id="distilgpt2",
                name="distilgpt2",
                downloads=150000,
                likes=80,
                tags=["text-generation"],
                description="Distilled version of GPT-2",
                compatible=True
            )
        ]


class ModelLoader:
    """Service for loading and managing ML models"""
    
    def __init__(self):
        self.loaded_models: Dict[str, Dict[str, Any]] = {}
        
    async def load_model(self, model_name: str, backend: ModelBackend = ModelBackend.TRANSFORMERS) -> Dict[str, Any]:
        """Load a model asynchronously"""
        try:
            logger.info(f"Loading model {model_name} with {backend} backend")
            
            # Create model directory
            model_dir = Path(settings.user_models_dir) / model_name.replace('/', '_')
            model_dir.mkdir(parents=True, exist_ok=True)
            
            if backend == ModelBackend.TRANSFORMERS:
                return await self._load_transformers_model(model_name)
            elif backend == ModelBackend.JAX:
                return await self._load_jax_model(model_name)
            else:
                raise ValueError(f"Unsupported backend: {backend}")
                
        except Exception as e:
            logger.error(f"Error loading model {model_name}: {e}")
            raise
    
    async def _load_transformers_model(self, model_name: str) -> Dict[str, Any]:
        """Load model using Transformers library"""
        # Get model info to determine correct model type
        api = HfApi()
        model_info = api.model_info(model_name)
        pipeline_tag = getattr(model_info, 'pipeline_tag', 'text-generation')
        
        logger.info(f"Model {model_name} has pipeline tag: {pipeline_tag}")
        
        # Load tokenizer
        tokenizer = AutoTokenizer.from_pretrained(
            model_name,
            cache_dir=settings.models_cache_dir,
            trust_remote_code=True
        )
        
        # Add pad token if missing
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token
        
        # Load appropriate model based on pipeline tag
        if pipeline_tag == "text2text-generation":
            model = AutoModelForSeq2SeqLM.from_pretrained(
                model_name,
                cache_dir=settings.models_cache_dir,
                trust_remote_code=True,
                torch_dtype=torch.float32,
                device_map="auto" if torch.cuda.is_available() else "cpu"
            )
            task = "text2text-generation"
        else:
            # Default to causal LM for text-generation
            model = AutoModelForCausalLM.from_pretrained(
                model_name,
                cache_dir=settings.models_cache_dir,
                trust_remote_code=True,
                torch_dtype=torch.float32,
                device_map="auto" if torch.cuda.is_available() else "cpu"
            )
            task = "text-generation"
        
        # Create pipeline
        pipe = pipeline(
            task,
            model=model,
            tokenizer=tokenizer,
            device_map="auto" if torch.cuda.is_available() else "cpu"
        )
        
        return {
            "model": model,
            "tokenizer": tokenizer,
            "pipeline": pipe,
            "backend": ModelBackend.TRANSFORMERS,
            "task": task,
            "status": "ready",
            "loaded_at": time.time()
        }
    
    async def _load_jax_model(self, model_name: str) -> Dict[str, Any]:
        """Load model using JAX/Flax"""
        # Placeholder for JAX implementation
        # For now, fallback to transformers
        logger.warning("JAX backend not fully implemented, falling back to Transformers")
        return await self._load_transformers_model(model_name)
    
    def unload_model(self, model_key: str):
        """Unload a model from memory"""
        if model_key in self.loaded_models:
            del self.loaded_models[model_key]
            # Force garbage collection
            import gc
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            logger.info(f"Model {model_key} unloaded from memory")
    
    def get_model(self, model_key: str) -> Optional[Dict[str, Any]]:
        """Get a loaded model"""
        return self.loaded_models.get(model_key)
    
    def list_loaded_models(self) -> List[str]:
        """List all loaded models"""
        return list(self.loaded_models.keys())


# Global service instances
model_search_service = ModelSearchService()
model_loader = ModelLoader()
