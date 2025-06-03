"""
Inference service for chat completions and text generation
"""
import time
from typing import List, Dict, Any, Optional
import asyncio

from logger import setup_logger
from models import ChatMessage, ChatCompletionResponse, ChatCompletionChoice, ChatCompletionUsage
from services.user_service import user_service

logger = setup_logger(__name__)


class InferenceService:
    """Service for handling model inference requests"""
    
    def __init__(self):
        self.request_count = 0
        
    async def chat_completion(
        self,
        user_id: str,
        messages: List[ChatMessage],
        max_tokens: int = 100,
        temperature: float = 0.7,
        top_p: float = 1.0,
        stop: Optional[List[str]] = None
    ) -> ChatCompletionResponse:
        """Generate chat completion for a user"""
        
        # Get user's deployment and model
        deployment = user_service.get_deployment(user_id)
        if not deployment:
            raise ValueError("User deployment not found")
        
        if deployment.status.value != "ready":
            raise ValueError(f"Model not ready. Status: {deployment.status}")
        
        model_data = user_service.get_user_model(user_id)
        if not model_data:
            raise ValueError("Model not loaded")
        
        try:
            # Format messages into prompt
            prompt = self._format_messages_to_prompt(messages)
            
            # Generate response based on model type
            if model_data["task"] == "text2text-generation":
                response_text = await self._generate_text2text(
                    model_data, prompt, max_tokens, temperature
                )
            else:
                response_text = await self._generate_causal_lm(
                    model_data, prompt, max_tokens, temperature, top_p, stop
                )
            
            # Create response
            response_id = f"chatcmpl-{int(time.time())}-{self.request_count}"
            self.request_count += 1
            
            # Calculate token usage (approximate)
            prompt_tokens = len(prompt.split())
            completion_tokens = len(response_text.split())
            
            return ChatCompletionResponse(
                id=response_id,
                created=int(time.time()),
                model=deployment.model_name,
                choices=[
                    ChatCompletionChoice(
                        index=0,
                        message=ChatMessage(role="assistant", content=response_text),
                        finish_reason="stop"
                    )
                ],
                usage=ChatCompletionUsage(
                    prompt_tokens=prompt_tokens,
                    completion_tokens=completion_tokens,
                    total_tokens=prompt_tokens + completion_tokens
                )
            )
            
        except Exception as e:
            logger.error(f"Error in chat completion for user {user_id}: {e}")
            raise
    
    def _format_messages_to_prompt(self, messages: List[ChatMessage]) -> str:
        """Format chat messages into a single prompt"""
        prompt_parts = []
        
        for message in messages:
            role = message.role
            content = message.content
            
            if role == "system":
                prompt_parts.append(f"System: {content}")
            elif role == "user":
                prompt_parts.append(f"User: {content}")
            elif role == "assistant":
                prompt_parts.append(f"Assistant: {content}")
        
        # Add assistant prompt at the end
        prompt_parts.append("Assistant:")
        
        return "\n".join(prompt_parts)
    
    async def _generate_text2text(
        self,
        model_data: Dict[str, Any],
        prompt: str,
        max_tokens: int,
        temperature: float
    ) -> str:
        """Generate text using text2text models (like T5)"""
        pipeline = model_data["pipeline"]
        
        # Run inference in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        
        def run_inference():
            result = pipeline(
                prompt,
                max_length=max_tokens,
                temperature=temperature,
                do_sample=True if temperature > 0 else False,
                pad_token_id=pipeline.tokenizer.eos_token_id
            )
            return result[0]["generated_text"]
        
        response = await loop.run_in_executor(None, run_inference)
        return response.strip()
    
    async def _generate_causal_lm(
        self,
        model_data: Dict[str, Any],
        prompt: str,
        max_tokens: int,
        temperature: float,
        top_p: float,
        stop: Optional[List[str]]
    ) -> str:
        """Generate text using causal language models (like GPT)"""
        pipeline = model_data["pipeline"]
        
        # Run inference in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        
        def run_inference():
            # Calculate max_length (input + new tokens)
            input_length = len(pipeline.tokenizer.encode(prompt))
            max_length = input_length + max_tokens
            
            # Generate
            result = pipeline(
                prompt,
                max_length=max_length,
                temperature=temperature,
                top_p=top_p,
                do_sample=True if temperature > 0 else False,
                pad_token_id=pipeline.tokenizer.eos_token_id,
                eos_token_id=pipeline.tokenizer.eos_token_id,
                return_full_text=False  # Only return the generated part
            )
            
            generated_text = result[0]["generated_text"]
            
            # Apply stop sequences
            if stop:
                for stop_seq in stop:
                    if stop_seq in generated_text:
                        generated_text = generated_text.split(stop_seq)[0]
                        break
            
            return generated_text
        
        response = await loop.run_in_executor(None, run_inference)
        
        # Extract only the assistant response
        if "Assistant:" in response:
            response = response.split("Assistant:")[-1]
        
        return response.strip()
    
    def get_stats(self) -> Dict[str, Any]:
        """Get inference statistics"""
        return {
            "total_requests": self.request_count,
            "active_models": len(user_service.active_models)
        }


# Global service instance
inference_service = InferenceService()
