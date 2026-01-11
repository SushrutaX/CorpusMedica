"""
Chatbot API routes for RAG-powered knowledge base assistant
"""
import logging
from typing import List, Dict, Optional, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.rag import get_chatbot

logger = logging.getLogger(__name__)
router = APIRouter()


class ChatMessage(BaseModel):
    """Chat message model"""
    role: str  # 'user' or 'assistant'
    content: str


class ChatRequest(BaseModel):
    """Chat request model"""
    query: str
    history: Optional[List[ChatMessage]] = None
    top_k: Optional[int] = 5


class ChatResponse(BaseModel):
    """Chat response model"""
    response: str
    sources: List[Dict[str, Any]]
    context_used: int


class IndexRequest(BaseModel):
    """Index request model"""
    force_reindex: bool = False


class ChatbotStats(BaseModel):
    """Chatbot statistics"""
    indexed: bool
    documents_count: int
    collection_name: str
    status: str


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Chat with the RAG-powered assistant about the codebase and MONAI bundles.
    
    The assistant can answer questions about:
    - Backend and frontend code architecture
    - MONAI bundle configurations and models
    - Medical imaging workflows
    - Specific models stored in /models/bundles
    - General ML/medical imaging theory
    """
    try:
        chatbot = get_chatbot()
        
        # Convert history to dict format
        history_dicts = None
        if request.history:
            history_dicts = [
                {"role": msg.role, "content": msg.content}
                for msg in request.history
            ]
        
        # Get response
        result = chatbot.chat(
            query=request.query,
            chat_history=history_dicts,
            top_k=request.top_k or 5
        )
        
        return ChatResponse(**result)
        
    except Exception as e:
        logger.error(f"Chat error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chat/index")
async def index_knowledge_base(request: IndexRequest):
    """
    Index or re-index the knowledge base.
    
    This processes:
    - All backend Python code
    - All frontend TypeScript code
    - README and documentation files
    - MONAI bundle configurations
    - MONAI bundle documentation
    
    Set force_reindex=true to rebuild the entire index.
    """
    try:
        chatbot = get_chatbot()
        
        logger.info(f"Indexing knowledge base (force={request.force_reindex})...")
        chatbot.index_knowledge_base(force_reindex=request.force_reindex)
        
        stats = chatbot.get_stats()
        return {
            "success": True,
            "message": "Knowledge base indexed successfully",
            "stats": stats
        }
        
    except Exception as e:
        logger.error(f"Indexing error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/chat/stats", response_model=ChatbotStats)
async def get_chatbot_stats():
    """
    Get chatbot statistics including indexing status and document count.
    """
    try:
        chatbot = get_chatbot()
        stats = chatbot.get_stats()
        return ChatbotStats(**stats)
        
    except Exception as e:
        logger.error(f"Stats error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/chat/health")
async def chatbot_health():
    """
    Health check for chatbot service.
    """
    try:
        chatbot = get_chatbot()
        stats = chatbot.get_stats()
        
        return {
            "status": "healthy",
            "indexed": stats.get("indexed", False),
            "documents": stats.get("documents_count", 0),
        }
        
    except Exception as e:
        logger.error(f"Health check error: {e}", exc_info=True)
        return {
            "status": "unhealthy",
            "error": str(e)
        }
