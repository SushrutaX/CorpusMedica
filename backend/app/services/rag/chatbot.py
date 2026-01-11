"""
RAG (Retrieval Augmented Generation) chatbot using Gemini REST API and Qdrant.
Uses direct REST API calls for maximum compatibility.
"""
import logging
import os
import requests
from typing import List, Dict, Any, Optional
from pathlib import Path

from sentence_transformers import SentenceTransformer

from app.services.rag.document_processor import process_all_documents, Document
from app.services.rag.vector_db import VectorDBManager

logger = logging.getLogger(__name__)


class RAGChatbot:
    """RAG-powered chatbot for Corpus Medica knowledge base"""
    
    def __init__(
        self,
        base_path: Optional[Path] = None,
        models_path: Optional[Path] = None,
        gemini_api_key: Optional[str] = None
    ):
        # Setup paths
        self.base_path = base_path or Path(__file__).parents[4]  # Project root
        self.models_path = models_path or self.base_path / "models"
        
        # Initialize Gemini
        self.gemini_api_key = gemini_api_key or os.getenv("GEMINI_API_KEY")
        if not self.gemini_api_key:
            raise ValueError("GEMINI_API_KEY environment variable must be set")
        
        # Use Gemini REST API directly for maximum compatibility
        # Model: gemini-2.5-flash is the available model
        self.model_name = 'gemini-2.5-flash'
        self.api_base = "https://generativelanguage.googleapis.com/v1beta"
        
        logger.info(f"Initialized Gemini REST API client with model: {self.model_name}")
        
        # Initialize embedding model
        logger.info("Loading embedding model...")
        self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
        
        # Get the actual embedding dimension from the model
        self.embedding_dim = self.embedding_model.get_sentence_embedding_dimension()
        logger.info(f"Embedding model dimension: {self.embedding_dim}")
        
        # Initialize vector database with correct dimension
        self.vector_db = VectorDBManager(vector_size=self.embedding_dim)
        
        # Check if indexed
        self.is_indexed = self._check_if_indexed()
        if not self.is_indexed:
            logger.warning("Knowledge base not indexed. Call index_knowledge_base() first.")
    
    def _check_if_indexed(self) -> bool:
        """Check if documents are already indexed"""
        info = self.vector_db.get_collection_info()
        return info.get('points_count', 0) > 0
    
    def index_knowledge_base(self, force_reindex: bool = False):
        """Index the entire knowledge base"""
        if self.is_indexed and not force_reindex:
            logger.info("Knowledge base already indexed. Use force_reindex=True to re-index.")
            return
        
        if force_reindex:
            logger.info("Force re-indexing: deleting existing collection...")
            self.vector_db.delete_collection()
            self.vector_db._ensure_collection()
        
        logger.info("Processing documents from codebase and MONAI bundles...")
        documents = process_all_documents(self.base_path, self.models_path)
        
        if not documents:
            logger.error("No documents found to index!")
            return
        
        logger.info(f"Generating embeddings for {len(documents)} documents...")
        texts = [doc.content for doc in documents]
        
        # Generate embeddings in batches
        batch_size = 32
        all_embeddings = []
        
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            embeddings = self.embedding_model.encode(
                batch,
                show_progress_bar=True,
                convert_to_numpy=True
            )
            all_embeddings.extend(embeddings.tolist())
            logger.info(f"Encoded batch {i//batch_size + 1}/{(len(texts)-1)//batch_size + 1}")
        
        logger.info("Adding documents to vector database...")
        self.vector_db.add_documents(documents, all_embeddings)
        
        self.is_indexed = True
        logger.info("✅ Knowledge base indexing complete!")
    
    def retrieve_context(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """Retrieve relevant context for a query"""
        if not self.is_indexed:
            logger.warning("Knowledge base not indexed. Returning empty context.")
            return []
        
        # Generate query embedding
        query_embedding = self.embedding_model.encode(query, convert_to_numpy=True).tolist()
        
        # Search vector database
        results = self.vector_db.search(query_embedding, top_k=top_k)
        
        return results
    
    def generate_response(
        self,
        query: str,
        context_docs: List[Dict[str, Any]],
        chat_history: Optional[List[Dict[str, str]]] = None
    ) -> str:
        """Generate response using Gemini REST API with retrieved context"""
        
        # Build context from retrieved documents
        context_text = "\n\n".join([
            f"[Source: {doc['metadata'].get('source', 'Unknown')}]\n{doc['content'][:1000]}"
            for doc in context_docs
        ])
        
        # Build chat history
        history_text = ""
        if chat_history:
            for msg in chat_history[-4:]:  # Last 4 messages for context
                role = msg.get("role", "user")
                content = msg.get("content", "")
                history_text += f"{role.capitalize()}: {content}\n"
        
        # Create prompt
        prompt = f"""You are an AI assistant for Corpus Medica, a medical AI platform for brain tumor and organ segmentation.

You have access to the platform's codebase, MONAI bundle configurations, and documentation.

IMPORTANT RULES:
1. Answer questions about the codebase architecture, MONAI bundles, models, and medical imaging workflows
2. Provide code examples when relevant
3. Reference specific files and configurations when explaining
4. Be technical and precise - this is for developers and researchers
5. If asked about models, explain their inputs, architectures, and use cases
6. If you don't know something, say so clearly

RETRIEVED CONTEXT:
{context_text}

CHAT HISTORY:
{history_text}

USER QUESTION: {query}

ASSISTANT RESPONSE:"""

        try:
            # Use Gemini REST API directly
            url = f"{self.api_base}/models/{self.model_name}:generateContent"
            headers = {"Content-Type": "application/json"}
            data = {
                "contents": [{
                    "parts": [{"text": prompt}]
                }],
                "generationConfig": {
                    "temperature": 0.7,
                    "topP": 0.95,
                    "maxOutputTokens": 2048,
                }
            }
            
            response = requests.post(
                f"{url}?key={self.gemini_api_key}",
                headers=headers,
                json=data,
                timeout=30
            )
            
            if response.status_code == 200:
                result = response.json()
                # Extract text from response
                if 'candidates' in result and len(result['candidates']) > 0:
                    candidate = result['candidates'][0]
                    if 'content' in candidate and 'parts' in candidate['content']:
                        parts = candidate['content']['parts']
                        if len(parts) > 0 and 'text' in parts[0]:
                            return parts[0]['text']
                
                return "I received a response but couldn't extract the text. Please try again."
            else:
                error_msg = response.json() if response.text else response.text
                logger.error(f"Gemini API error: {response.status_code} - {error_msg}")
                return f"I encountered an error: {response.status_code} - {error_msg}"
                
        except requests.exceptions.Timeout:
            logger.error("Request to Gemini API timed out")
            return "The request timed out. Please try again."
        except Exception as e:
            logger.error(f"Error generating response: {e}")
            return f"I encountered an error generating a response: {str(e)}"
    
    def chat(
        self,
        query: str,
        chat_history: Optional[List[Dict[str, str]]] = None,
        top_k: int = 5
    ) -> Dict[str, Any]:
        """Main chat interface"""
        
        # Retrieve context
        context_docs = self.retrieve_context(query, top_k=top_k)
        
        # Generate response
        response = self.generate_response(query, context_docs, chat_history)
        
        return {
            "response": response,
            "sources": [
                {
                    "source": doc["metadata"].get("source", "Unknown"),
                    "type": doc["metadata"].get("type", "Unknown"),
                    "score": doc.get("score", 0.0),
                }
                for doc in context_docs
            ],
            "context_used": len(context_docs)
        }
    
    def get_stats(self) -> Dict[str, Any]:
        """Get chatbot statistics"""
        info = self.vector_db.get_collection_info()
        return {
            "indexed": self.is_indexed,
            "documents_count": info.get('points_count', 0),
            "collection_name": info.get('name', ''),
            "status": info.get('status', 'unknown'),
            "vector_size": info.get('vector_size', self.embedding_dim),
        }


# Global instance (lazy loaded)
_chatbot_instance: Optional[RAGChatbot] = None


def get_chatbot() -> RAGChatbot:
    """Get or create global chatbot instance"""
    global _chatbot_instance
    
    if _chatbot_instance is None:
        logger.info("Initializing RAG chatbot...")
        _chatbot_instance = RAGChatbot()
        
        # Auto-index if not already indexed
        if not _chatbot_instance.is_indexed:
            logger.info("Auto-indexing knowledge base on first use...")
            _chatbot_instance.index_knowledge_base()
    
    return _chatbot_instance
