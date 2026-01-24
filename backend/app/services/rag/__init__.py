"""
RAG (Retrieval-Augmented Generation) Service for Corpus Medica

This package provides document processing, vector storage, and chatbot capabilities
for the medical imaging platform.
"""

from .chatbot import RAGChatbot

# Global chatbot instance
_chatbot_instance = None


def get_chatbot() -> RAGChatbot:
    """
    Get or create the global chatbot instance.
    
    Returns:
        RAGChatbot: The chatbot instance
    """
    global _chatbot_instance
    
    if _chatbot_instance is None:
        _chatbot_instance = RAGChatbot()
    
    return _chatbot_instance


__all__ = ['RAGChatbot', 'get_chatbot']
