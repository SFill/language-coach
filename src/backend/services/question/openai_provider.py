"""OpenAI provider for AI response generation."""

from typing import List, Optional
from backend.services.openai_client import client, DEFAULT_MODEL


class OpenAIProvider:
    """
    Handles OpenAI API communication.
    Separates AI provider logic from business logic.
    """

    def __init__(self, model: str = DEFAULT_MODEL):
        """
        Initialize OpenAI provider.

        Args:
            model: OpenAI model to use (default: gpt-4o-mini)
        """
        self.client = client
        self.model = model
    
    def generate_response(self, messages: List[dict], max_tokens: Optional[int] = None) -> str:
        """
        Generate response using OpenAI API with streaming.

        Args:
            messages: List of message dicts for OpenAI API
            max_tokens: Optional cap on response length to enforce brevity

        Returns:
            Complete response text
        """
        kwargs = {"messages": messages, "model": self.model, "stream": True}
        if max_tokens is not None:
            kwargs["max_tokens"] = max_tokens
        response_stream = self.client.chat.completions.create(**kwargs)
        
        full_response = ""
        for chunk in response_stream:
            delta = chunk.choices[0].delta.content
            if delta:
                full_response += delta
        
        return full_response
