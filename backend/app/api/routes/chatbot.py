from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os

router = APIRouter(tags=["chatbot"])


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    query: str
    history: Optional[List[ChatMessage]] = []
    top_k: Optional[int] = 5


class SourceReference(BaseModel):
    source: str
    type: str
    score: float


class ChatResponse(BaseModel):
    response: str
    sources: List[SourceReference] = []


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """
    Chat endpoint for the RAG-based medical AI assistant.
    
    This endpoint accepts a user query and optional conversation history,
    and returns an AI-generated response with source references.
    """
    
    # Check if Gemini API key is configured
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    
    if not gemini_api_key or gemini_api_key == "your_gemini_api_key_here":
        return ChatResponse(
            response=(
                "⚠️ **Chatbot Not Configured**\n\n"
                "The chatbot requires a Gemini API key to function. "
                "Please configure your GEMINI_API_KEY in the .env file.\n\n"
                "To set up the chatbot:\n"
                "1. Get a free API key from https://makersuite.google.com/app/apikey\n"
                "2. Add it to your .env file: `GEMINI_API_KEY=your-key-here`\n"
                "3. Restart the backend service\n\n"
                "For more information, see the CHATBOT_README.md file."
            ),
            sources=[]
        )
    
    try:
        # Try to import and use the RAG chatbot if available
        try:
            from app.services.rag import get_chatbot
            
            chatbot = get_chatbot()
            
            # Convert history to the format expected by the chatbot
            history_formatted = [
                {"role": msg.role, "content": msg.content}
                for msg in request.history
            ]
            
            # Get response from chatbot
            result = chatbot.chat(
                query=request.query,
                chat_history=history_formatted,
                top_k=request.top_k
            )
            
            return ChatResponse(
                response=result["response"],
                sources=[
                    SourceReference(
                        source=src.get("source", "Unknown"),
                        type=src.get("type", "document"),
                        score=src.get("score", 0.0)
                    )
                    for src in result.get("sources", [])
                ]
            )
            
        except ImportError:
            # RAG service not available, return helpful message
            return ChatResponse(
                response=(
                    f"**Question:** {request.query}\n\n"
                    "⚠️ **RAG Chatbot Service Not Available**\n\n"
                    "The advanced RAG (Retrieval-Augmented Generation) chatbot service is not currently installed. "
                    "This service provides context-aware responses using your medical imaging documentation.\n\n"
                    "**To enable the full chatbot:**\n"
                    "1. Run the chatbot initialization script:\n"
                    "   ```\n"
                    "   cd backend\n"
                    "   python init_chatbot.py\n"
                    "   ```\n"
                    "2. Follow the setup instructions\n"
                    "3. Restart the backend\n\n"
                    "For now, I can provide general assistance, but I won't have access to "
                    "your specific documentation and codebase."
                ),
                sources=[]
            )
            
    except Exception as e:
        # Log the error and return a user-friendly message
        print(f"Chat error: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return ChatResponse(
            response=(
                f"I encountered an error while processing your question:\n\n"
                f"**Error:** {str(e)}\n\n"
                "Please try again. If the problem persists, check that:\n"
                "- Your GEMINI_API_KEY is valid\n"
                "- You have an active internet connection\n"
                "- The backend logs for more details"
            ),
            sources=[]
        )


@router.get("/chat/health")
async def chat_health():
    """
    Health check endpoint for the chat service.
    Returns the status of various chatbot components.
    """
    gemini_api_key = os.getenv("GEMINI_API_KEY")
    
    status = {
        "chatbot_enabled": bool(gemini_api_key and gemini_api_key != "your_gemini_api_key_here"),
        "api_key_configured": bool(gemini_api_key),
    }
    
    # Check if RAG service is available
    try:
        from app.services.rag import get_chatbot
        chatbot = get_chatbot()
        stats = chatbot.get_stats()
        status["rag_service"] = "available"
        status["knowledge_base_indexed"] = stats.get("indexed", False)
        status["documents_count"] = stats.get("documents_count", 0)
    except ImportError:
        status["rag_service"] = "not_installed"
    except Exception as e:
        status["rag_service"] = f"error: {str(e)}"
    
    return status


@router.get("/chat/stats")
async def chat_stats():
    """
    Get statistics about the chatbot's knowledge base.
    """
    try:
        from app.services.rag import get_chatbot
        chatbot = get_chatbot()
        return chatbot.get_stats()
    except ImportError:
        raise HTTPException(
            status_code=503,
            detail="RAG chatbot service not installed. Run 'python init_chatbot.py' to set up."
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
