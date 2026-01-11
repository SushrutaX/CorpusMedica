"""
Vector database manager using Qdrant for document storage and retrieval.
"""
import logging
import os
from pathlib import Path
from typing import List, Dict, Any, Optional
import hashlib

from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams, PointStruct

logger = logging.getLogger(__name__)


class VectorDBManager:
    """Manages Qdrant vector database for RAG"""
    
    def __init__(self, collection_name: str = "corpus_medica_kb", vector_size: Optional[int] = None):
        self.collection_name = collection_name
        # Default to 384 for all-MiniLM-L6-v2, but allow override
        self.vector_size = vector_size or 384
        
        # Use in-memory Qdrant for development
        # For production, use: QdrantClient(host="localhost", port=6333)
        qdrant_path = os.getenv("QDRANT_PATH", ":memory:")
        
        if qdrant_path == ":memory:":
            self.client = QdrantClient(":memory:")
            logger.info("Using in-memory Qdrant database")
        else:
            db_path = Path(qdrant_path)
            db_path.mkdir(parents=True, exist_ok=True)
            self.client = QdrantClient(path=str(db_path))
            logger.info(f"Using persistent Qdrant database at {db_path}")
        
        self._ensure_collection()
    
    def _ensure_collection(self):
        """Create collection if it doesn't exist"""
        try:
            collections = self.client.get_collections().collections
            collection_names = [col.name for col in collections]
            
            if self.collection_name not in collection_names:
                logger.info(f"Creating collection: {self.collection_name} with vector size: {self.vector_size}")
                self.client.create_collection(
                    collection_name=self.collection_name,
                    vectors_config=VectorParams(
                        size=self.vector_size,
                        distance=Distance.COSINE
                    )
                )
            else:
                logger.info(f"Collection {self.collection_name} already exists")
                # Verify the vector size matches
                try:
                    collection_info = self.client.get_collection(self.collection_name)
                    existing_size = collection_info.config.params.vectors.size
                    if existing_size != self.vector_size:
                        logger.warning(
                            f"Existing collection has vector size {existing_size}, "
                            f"but current model uses {self.vector_size}. "
                            f"Consider deleting the collection and reindexing."
                        )
                except Exception as e:
                    logger.warning(f"Could not verify vector size: {e}")
        except Exception as e:
            logger.error(f"Error ensuring collection: {e}")
            raise
    
    def _generate_id(self, text: str, metadata: Dict[str, Any]) -> str:
        """Generate unique ID for document"""
        source = metadata.get('source', '')
        combined = f"{source}:{text[:100]}"
        return hashlib.md5(combined.encode()).hexdigest()
    
    def add_documents(self, documents: List[Any], embeddings: List[List[float]]):
        """Add documents with embeddings to vector store"""
        if len(documents) != len(embeddings):
            raise ValueError("Number of documents must match number of embeddings")
        
        # Validate embedding dimensions
        if embeddings and len(embeddings[0]) != self.vector_size:
            raise ValueError(
                f"Embedding dimension mismatch: expected {self.vector_size}, "
                f"got {len(embeddings[0])}. Delete collection and reindex."
            )
        
        points = []
        for idx, (doc, embedding) in enumerate(zip(documents, embeddings)):
            doc_id = self._generate_id(doc.content, doc.metadata)
            
            point = PointStruct(
                id=doc_id,
                vector=embedding,
                payload={
                    "content": doc.content,
                    "metadata": doc.metadata,
                    "doc_index": idx,
                }
            )
            points.append(point)
        
        # Batch upload
        batch_size = 100
        for i in range(0, len(points), batch_size):
            batch = points[i:i + batch_size]
            self.client.upsert(
                collection_name=self.collection_name,
                points=batch
            )
            logger.info(f"Uploaded batch {i//batch_size + 1}/{(len(points)-1)//batch_size + 1}")
        
        logger.info(f"Successfully added {len(documents)} documents to vector store")
    
    def search(self, query_embedding: List[float], top_k: int = 5) -> List[Dict[str, Any]]:
        """Search for similar documents"""
        try:
            # Try the new API first (Qdrant client >= 1.7.0)
            try:
                results = self.client.query_points(
                    collection_name=self.collection_name,
                    query=query_embedding,
                    limit=top_k
                ).points
            except AttributeError:
                # Fall back to old API for older versions
                results = self.client.search(
                    collection_name=self.collection_name,
                    query_vector=query_embedding,
                    limit=top_k
                )
            
            retrieved_docs = []
            for result in results:
                retrieved_docs.append({
                    "content": result.payload.get("content", ""),
                    "metadata": result.payload.get("metadata", {}),
                    "score": result.score,
                })
            
            return retrieved_docs
        except Exception as e:
            logger.error(f"Error searching vector store: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return []
    
    def get_collection_info(self) -> Dict[str, Any]:
        """Get information about the collection"""
        try:
            info = self.client.get_collection(self.collection_name)
            # Handle both old and new Qdrant API versions
            points_count = getattr(info, 'points_count', 0)
            if points_count == 0 and hasattr(info, 'vectors_count'):
                points_count = info.vectors_count
            
            return {
                "name": self.collection_name,
                "points_count": points_count,
                "status": str(info.status),
                "vector_size": info.config.params.vectors.size if hasattr(info.config.params, 'vectors') else self.vector_size,
            }
        except Exception as e:
            logger.error(f"Error getting collection info: {e}")
            return {
                "name": self.collection_name,
                "points_count": 0,
                "status": "error",
                "vector_size": self.vector_size,
            }
    
    def delete_collection(self):
        """Delete the collection (useful for re-indexing)"""
        try:
            self.client.delete_collection(self.collection_name)
            logger.info(f"Deleted collection: {self.collection_name}")
        except Exception as e:
            logger.error(f"Error deleting collection: {e}")
