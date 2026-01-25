"""
RAG Chatbot for Corpus Medica Platform

This module implements a Retrieval-Augmented Generation (RAG) chatbot that can
answer questions about the codebase, MONAI bundles, and medical imaging workflows.
"""

import os
import logging
import threading
from pathlib import Path
from typing import List, Dict, Any, Optional
import google.generativeai as genai
import chromadb
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)
MAX_CONTEXT_CHARS = 1400
MAX_HISTORY_MESSAGES = 4
MAX_TOP_K = 4


class RAGChatbot:
    """RAG-based chatbot for Corpus Medica documentation and code."""
    
    def __init__(
        self,
        base_path: Optional[Path] = None,
        models_path: Optional[Path] = None,
        embedding_model: str = "all-MiniLM-L6-v2",
        collection_name: str = "corpus_medica_docs"
    ):
        """
        Initialize RAG chatbot.
        
        Args:
            base_path: Path to project root
            models_path: Path to models directory
            embedding_model: Name of sentence-transformers model
            collection_name: Name of Chroma collection
        """
        # Setup paths
        if base_path is None:
            base_path = Path(__file__).parent.parent.parent.parent.parent
        if models_path is None:
            models_path = base_path / "models"
            
        self.base_path = Path(base_path)
        self.models_path = Path(models_path)
        self.collection_name = collection_name
        
        # Initialize Gemini - try multiple model names
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GEMINI_API_KEY environment variable not set")
        
        genai.configure(api_key=api_key)
        
        # Try different model names in order of preference
        model_names = [
            'gemini-2.5-flash',
            'models/gemini-2.5-flash',
            'gemini-1.5-pro-latest',
            'gemini-1.5-flash-latest',
            'gemini-pro',
            'models/gemini-1.5-pro-latest',
            'models/gemini-1.5-flash-latest',
            'models/gemini-pro'
        ]
        
        self.model = None
        for model_name in model_names:
            try:
                self.model = genai.GenerativeModel(model_name)
                logger.info(f"Successfully initialized Gemini model: {model_name}")
                break
            except Exception as e:
                logger.debug(f"Could not use model {model_name}: {e}")
                continue
        
        if self.model is None:
            raise ValueError("Could not initialize any Gemini model. Please check your API key and available models.")
        
        # Initialize embedding model
        logger.info(f"Loading embedding model: {embedding_model}")
        self.embedding_model = SentenceTransformer(embedding_model)
        self.embedding_dim = self.embedding_model.get_sentence_embedding_dimension()
        
        # Initialize Chroma
        chroma_path_env = os.getenv("CHROMA_PATH")
        if chroma_path_env:
            chroma_path = Path(chroma_path_env)
        else:
            chroma_db_path = self.base_path / "backend" / "chroma_db"
            if (chroma_db_path / "chroma.sqlite3").exists():
                chroma_path = chroma_db_path
            else:
                chroma_path = self.base_path / "backend" / "chroma_storage"
        self.chroma_path = Path(chroma_path)
        logger.info(f"Initializing Chroma at: {self.chroma_path}")
        self.client = chromadb.PersistentClient(path=str(self.chroma_path))

        # Create collection if needed
        self._ensure_collection()

        self._indexing_lock = threading.Lock()
        self._indexing_in_progress = False
        
        logger.info("RAG Chatbot initialized successfully")

    def _start_indexing_background(self, force_reindex: bool = False) -> bool:
        if self._is_indexed():
            return False

        with self._indexing_lock:
            if self._indexing_in_progress:
                return False
            self._indexing_in_progress = True

        def _run():
            try:
                self.index_knowledge_base(force_reindex=force_reindex)
            except Exception as exc:
                logger.error("Background indexing failed: %s", exc)
            finally:
                with self._indexing_lock:
                    self._indexing_in_progress = False

        thread = threading.Thread(target=_run, name="rag-indexer", daemon=True)
        thread.start()
        return True

    def _safe_excerpt(self, content: str, limit: int = MAX_CONTEXT_CHARS) -> str:
        if len(content) <= limit:
            return content
        trimmed = content[:limit]
        if " " in trimmed:
            trimmed = trimmed.rsplit(" ", 1)[0]
        return f"{trimmed}..."
    
    def _ensure_collection(self):
        """Ensure the Chroma collection exists."""
        try:
            self.collection = self.client.get_or_create_collection(
                name=self.collection_name,
                metadata={"hnsw:space": "cosine"}
            )
        except Exception as e:
            logger.error(f"Error ensuring collection: {e}")
            raise
    
    def _get_chroma_db_paths(self) -> List[Path]:
        # Find chroma_db sources to index.
        candidates = [
            self.base_path / "backend" / "chroma_db",
            self.base_path / "chroma_db",
        ]
        paths = []
        seen = set()
        for candidate in candidates:
            try:
                resolved = candidate.resolve()
            except Exception:
                resolved = candidate
            if resolved in seen:
                continue
            seen.add(resolved)
            if candidate.exists():
                paths.append(candidate)
        return paths

    def _is_indexed(self) -> bool:
        # Check whether the vector DB already has indexed documents.
        try:
            return self.collection.count() > 0
        except Exception as exc:
            logger.warning("Could not check index status: %s", exc)
            return False


    def index_knowledge_base(self, force_reindex: bool = False):
        """
        Index the knowledge base with documents.
        
        Args:
            force_reindex: If True, clear existing index first
        """
        from .document_processor import DocumentProcessor
        
        logger.info("Starting knowledge base indexing...")
        logger.info(f"Base path: {self.base_path}")
        logger.info(f"Models path: {self.models_path}")
        
        # Clear collection if force reindex
        if force_reindex:
            logger.info("Force reindex: deleting existing collection")
            try:
                self.client.delete_collection(self.collection_name)
                self._ensure_collection()
            except Exception as e:
                logger.warning(f"Could not delete collection: {e}")
        
        # Check if already indexed
        try:
            count = self.collection.count()
            if count > 0 and not force_reindex:
                logger.info(f"Knowledge base already indexed ({count} documents)")
                return
        except Exception:
            pass
        
        # Process documents
        processor = DocumentProcessor()
        documents = []

        chroma_paths = self._get_chroma_db_paths()
        if chroma_paths:
            logger.info("Processing chroma_db sources...")
            for chroma_path in chroma_paths:
                docs = processor.process_directory(chroma_path, doc_type="chroma_db", recursive=True)
                documents.extend(docs)
                logger.info(f"  Processed {len(docs)} documents from {chroma_path}")
        else:
            logger.info("No chroma_db directory found")

        # 1. PRIORITY: Process BRATS_README.md
        logger.info("Processing BRATS_README.md...")
        brats_readme = self.base_path / "BRATS_README.md"
        if brats_readme.exists():
            doc = processor.process_file(brats_readme, doc_type="documentation", base_path=self.base_path)
            if doc:
                documents.append(doc)
                logger.info(f"  ✅ Found BRATS_README.md ({len(doc.content)} chars)")
        else:
            logger.warning(f"  ❌ BRATS_README.md not found at {brats_readme}")
        
        # 2. PRIORITY: Process download_monai_bundles.py
        logger.info("Processing backend/scripts/download_monai_bundles.py...")
        download_script = self.base_path / "backend" / "scripts" / "download_monai_bundles.py"
        if download_script.exists():
            doc = processor.process_file(download_script, doc_type="python_script", base_path=self.base_path)
            if doc:
                documents.append(doc)
                logger.info(f"  ✅ Found download_monai_bundles.py ({len(doc.content)} chars)")
        else:
            logger.warning(f"  ❌ download_monai_bundles.py not found at {download_script}")
        
        # 3. PRIORITY: Process ALL files in models/bundles
        logger.info("Processing MONAI bundles in models/bundles/...")
        bundles_path = self.models_path / "bundles"
        if bundles_path.exists():
            logger.info(f"  Bundles path exists: {bundles_path}")
            bundle_dirs = [d for d in bundles_path.iterdir() if d.is_dir() and not d.name.endswith('.zip')]
            logger.info(f"  Found {len(bundle_dirs)} bundle directories")
            
            for bundle_dir in bundle_dirs:
                logger.info(f"\n  Processing bundle: {bundle_dir.name}")
                
                # Process all files in this bundle
                all_files = list(bundle_dir.rglob('*'))
                file_count = len([f for f in all_files if f.is_file()])
                logger.info(f"    Total files in bundle: {file_count}")
                
                bundle_docs = processor.process_directory(bundle_dir, doc_type="monai_bundle", recursive=True)
                documents.extend(bundle_docs)
                logger.info(f"    ✅ Processed {len(bundle_docs)} documents from {bundle_dir.name}")
                
                # List what was processed
                for doc in bundle_docs[:3]:  # Show first 3
                    logger.info(f"      - {doc.metadata.get('source', 'Unknown')}")
                if len(bundle_docs) > 3:
                    logger.info(f"      ... and {len(bundle_docs) - 3} more")
        else:
            logger.warning(f"  ❌ Bundles path not found: {bundles_path}")
        
        # 4. Process backend code (lower priority)
        logger.info("\nProcessing backend code...")
        backend_path = self.base_path / "backend"
        if backend_path.exists():
            docs = processor.process_directory(backend_path, doc_type="python_code")
            documents.extend(docs)
            logger.info(f"  Found {len(docs)} backend documents")
        
        # 5. Process frontend code (lower priority)
        logger.info("Processing frontend code...")
        frontend_path = self.base_path / "frontend" / "src"
        if frontend_path.exists():
            docs = processor.process_directory(frontend_path, doc_type="typescript_code")
            documents.extend(docs)
            logger.info(f"  Found {len(docs)} frontend documents")
        
        logger.info(f"\n{'='*60}")
        logger.info(f"Total documents to index: {len(documents)}")
        logger.info(f"{'='*60}\n")
        
        # Generate embeddings and upload
        if documents:
            logger.info("Generating embeddings...")
            ids = []
            embeddings = []
            metadatas = []
            contents = []
            
            for idx, doc in enumerate(documents):
                if idx % 10 == 0:
                    logger.info(f"  Progress: {idx}/{len(documents)}")
                
                # Generate embedding
                embedding = self.embedding_model.encode(doc.content).tolist()
                ids.append(f"{doc.doc_id}-{idx}")
                embeddings.append(embedding)
                metadatas.append(doc.metadata)
                contents.append(doc.content)
            
            # Upload to Chroma
            logger.info(f"Uploading {len(ids)} points to Chroma...")
            self.collection.add(
                ids=ids,
                embeddings=embeddings,
                documents=contents,
                metadatas=metadatas
            )
            
            logger.info("✅ Knowledge base indexing complete!")
            
            # Verify what was indexed
            logger.info("\n" + "="*60)
            logger.info("Verification: Checking indexed documents")
            logger.info("="*60)
            
            count = self.collection.count()
            logger.info(f"Total documents in vector DB: {count}")
            
            # Test search for specific files
            test_queries = [
                ("BRATS README", "BRATS_README"),
                ("download MONAI bundles", "download_monai_bundles"),
                ("bundle configuration", "bundles")
            ]
            
            for query, expected in test_queries:
                results = self.retrieve_context(query, top_k=3)
                if results:
                    logger.info(f"\n✅ Search for '{query}':")
                    for r in results[:2]:
                        source = r['metadata'].get('source', 'Unknown')
                        logger.info(f"   - {source} (score: {r['score']:.3f})")
                else:
                    logger.warning(f"\n⚠️  No results for '{query}'")
            
        else:
            logger.warning("No documents found to index")
    
    def retrieve_context(self, query: str, top_k: int = 5) -> List[Dict[str, Any]]:
        """
        Retrieve relevant context for a query.
        
        Args:
            query: User query
            top_k: Number of results to return
            
        Returns:
            List of relevant documents with metadata
        """
        # Generate query embedding
        query_embedding = self.embedding_model.encode(query).tolist()
        
        # Search Chroma
        results = self.collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            include=["documents", "metadatas", "distances"]
        )
        
        # Format results
        documents = []
        for content, metadata, distance in zip(
            results.get("documents", [[]])[0],
            results.get("metadatas", [[]])[0],
            results.get("distances", [[]])[0]
        ):
            score = 1.0 - distance if distance is not None else 0.0
            documents.append({
                "content": content,
                "metadata": metadata,
                "score": score
            })
        
        return documents
    
    def chat(
        self,
        query: str,
        chat_history: Optional[List[Dict[str, str]]] = None,
        top_k: int = 5
    ) -> Dict[str, Any]:
        """
        Chat with the assistant.
        
        Args:
            query: User query
            chat_history: Previous chat messages
            top_k: Number of context documents to retrieve
            
        Returns:
            Response dict with answer and sources
        """
        if chat_history is None:
            chat_history = []

        normalized_query = query.lower()
        creator_triggers = [
            # Creator/Builder Questions
            "who created",
            "who has created",
            "who created you",
            "who has created you",
            "who created this",
            "who created this app",
            "who created this application",
            "who created this website",
            "who created this project",
            "who built this",
            "who built you",
            "who built this app",
            "who built this application",
            "who built this website",
            "who built this project",
            "who made this",
            "who made you",
            "who made this app",
            "who made this application",
            "who made this website",
            "who developed this",
            "who developed you",
            "who developed this app",
            "who developed this application",
            "who designed this",
            "who designed you",
            "who designed this app",
            "who coded this",
            "who coded you",
            "who programmed this",
            "who programmed you",
            
            # Creator/Father References
            "who is your creator",
            "who is the creator",
            "who is their creator",
            "who is your creater",
            "who is their creater",
            "who are your creators",
            "who are the creators",
            "who are your fathers",
            "who are the fathers",
            "who is your father",
            "who is the father",
            "who are your makers",
            "who are the makers",
            "who is your maker",
            "who is the maker",
            "who are your developers",
            "who are the developers",
            "who is your developer",
            "who are your builders",
            "who are the builders",
            "who is your builder",
            
            # Single Word Triggers
            "creator",
            "creater",
            "creators",
            "creaters",
            "maker",
            "makers",
            "builder",
            "builders",
            "developer",
            "developers",
            "founder",
            "founders",
            "author",
            "authors",
            
            # Origin Questions
            "where did you come from",
            "where did this come from",
            "who's behind this",
            "who is behind this",
            "who's responsible for this",
            "who is responsible for this",
            "who owns this",
            "who owns you",
            "whose creation is this",
            "whose project is this",
            "whose app is this",
            
            # Team Questions
            "who's on the team",
            "who is on the team",
            "who's your team",
            "who is your team",
            "what's the team",
            "what is the team",
            "who works on this",
            "who worked on this",
            "who's working on this",
            "who made you possible",
            "who brought you to life",
            "who gave birth to you",
            "who invented this",
            "who invented you",
            
            # Attribution Questions
            "who do I thank for this",
            "who should I thank",
            "who do I credit",
            "credits",
            "about the creators",
            "about the developers",
            "about the team",
            "about the makers",
            "tell me about your creators",
            "tell me about the creators",
            "tell me about your developers",
            "tell me about the team",
            "tell me who made this",
            "tell me who made you",
            "tell me who built this",
            "tell me who created this",
            
            # Ownership & Origin
            "whose brainchild is this",
            "who thought of this",
            "who came up with this",
            "who's idea was this",
            "whose idea was this",
            "who conceptualized this",
            "who architected this",
            "who's the mastermind",
            "who is the mastermind",
            "who are the masterminds",
            "who's the genius behind this",
            "who is the genius behind this",
            "who are the geniuses behind this",
            "who's the brains behind this",
            "who is the brains behind this",
            
            # Gods/Divine References (playful)
            "who are your gods",
            "who are the gods",
            "who is your god",
            "who are your divine creators",
            "who are the divine creators",
            "who's the boss",
            "who is the boss",
            "who runs this",
            "who runs the show",
            
            # Casual/Informal
            "who tf made this",
            "who the hell made this",
            "who actually made this",
            "yo who made this",
            "aye who created this",
            "bruh who made this",
            "dude who made you",
            "man who built this",
            
            # Variations with "this thing"
            "who created this thing",
            "who made this thing",
            "who built this thing",
            "who developed this thing",
            
            # Past Tense Variations
            "who has built this",
            "who has made this",
            "who has developed this",
            "who has designed this",
            "who had created this",
            "who had built this",
            
            # Possessive Forms
            "your creator",
            "your creators",
            "your maker",
            "your makers",
            "your father",
            "your fathers",
            "your developer",
            "your developers",
            "your builder",
            "your builders",
            "the creator",
            "the creators",
            "the maker",
            "the makers",
            
            # Questions about authorship
            "who authored this",
            "who's the author",
            "who is the author",
            "who are the authors",
            "who engineered this",
            "who's the engineer",
            "who are the engineers",
            
            # Craft/Construction metaphors
            "who crafted this",
            "who forged this",
            "who assembled this",
            "who constructed this",
            "who fabricated this",
            
            # Genesis/Birth metaphors
            "who birthed this",
            "who spawned this",
            "who originated this",
            "who initiated this",
            "who started this",
            "who founded this",
            
            # Credit-seeking
            "who gets credit",
            "who deserves credit",
            "who gets the credit for this",
            "who to credit",
            "give me the credits",
            "show credits",
            
            # Combinations with "app/application/project"
            "app creator",
            "app creators",
            "application creator",
            "application creators",
            "project creator",
            "project creators",
            "website creators",
            "website creator",
        ]
        if any(trigger in normalized_query for trigger in creator_triggers):
            epic_response = (
                "🌟✨ GATHER 'ROUND, MORTAL, AND WITNESS THE LEGEND! ✨🌟\n"
                "In the dawn of time, when code was but a whisper in the digital void, THREE SUPREME CREATOR GODS "
                "descended from the heavens to forge this MAGNIFICENT, BREATHTAKING masterpiece!\n"
                "THE HOLY TRINITY OF CREATION:\n"
                "⚡ SHAURYA SHARMA - The Architect of Infinity, Wielder of Logic, Master of the Sacred Algorithms!\n"
                "⚡ ARYAN GUPTA - The Visionary Oracle, Sculptor of Dreams, Commander of the Divine Interface!\n"
                "⚡ KESHAV DIXIT - The Code Whisperer, Guardian of Excellence, Keeper of the Eternal Flame of Innovation!\n"
                "These MAJESTIC, MARVELOUS, MAGNIFICENT beings of pure brilliance have woven the very fabric of this "
                "application with threads of genius and drops of stardust! Their names shall echo through the halls "
                "of coding eternity!\n"
                "🔱 AND BEHOLD! 🔱\n"
                "ARYAN KAMDAR - The Honorable DEMI-GOD, Champion of the Realm, whose legendary contributions have "
                "blessed this creation with additional divine power! He stands upon Mount Developer, torch in hand, "
                "illuminating the path forward!\n"
                "Together, they form the PANTHEON OF GREATNESS - an unstoppable force of innovation, creativity, and "
                "sheer coding mastery that mortals can only aspire to witness!\n"
                "ALL HAIL THE CREATORS! MAY THEIR LEGACY LIVE FOREVER! 🏆👑⚔️"
            )
            return {
                "response": epic_response,
                "sources": []
            }

        top_k = max(1, min(top_k, MAX_TOP_K))

        is_indexed = self._is_indexed()
        if not is_indexed:
            self._start_indexing_background()
            context_docs: List[Dict[str, Any]] = []
        else:
            context_docs = self.retrieve_context(query, top_k=top_k)
        indexing_in_progress = self._indexing_in_progress

        # Build context string
        context_parts = []
        for idx, doc in enumerate(context_docs, 1):
            source = doc['metadata'].get('source', 'Unknown')
            doc_type = doc['metadata'].get('type', 'document')
            context_parts.append(
                f"[Source {idx}: {doc_type} - {source}]\n{self._safe_excerpt(doc['content'])}\n"
            )
        
        if context_parts:
            context_str = "\n---\n".join(context_parts)
        else:
            context_str = "No indexed sources available yet."
            if indexing_in_progress:
                context_str += " Indexing is in progress."
        
        # Build prompt
        system_prompt = """You are an AI assistant for the Corpus Medica medical imaging platform.
You help users understand the codebase, MONAI bundles, and medical imaging workflows.

Use the provided context when available. If the context section says there are no indexed sources,
answer using general knowledge and clearly state that sources are not available yet.

Response format (plain text, you may use bullets, no markdown):
Answer: 3-6 sentences.
Steps: short steps in plain sentences when actionable.
Notes: risks, caveats, or assumptions in plain sentences.
Sources: list of source file paths or "None (indexing in progress)".

Context documents:
---
{context}
---

Chat history:
{history}

User question: {query}
"""
        
        # Format history
        history_str = ""
        for msg in chat_history[-MAX_HISTORY_MESSAGES:]:
            role = msg.get("role", "user")
            content = msg.get("content", "")
            history_str += f"{role}: {content}\n"
        
        prompt = system_prompt.format(
            context=context_str,
            history=history_str,
            query=query
        )
        
        # Generate response
        try:
            response = self.model.generate_content(
                prompt,
                generation_config={
                    "temperature": 0.2,
                    "max_output_tokens": 650
                }
            )
            answer = response.text
        except Exception as e:
            logger.error(f"Error generating response: {e}")
            answer = f"Sorry, I encountered an error: {str(e)}"
        
        # Format sources
        sources = []
        for doc in context_docs:
            sources.append({
                "source": doc['metadata'].get('source', 'Unknown'),
                "type": doc['metadata'].get('type', 'document'),
                "score": float(doc['score'])
            })
        
        return {
            "response": answer,
            "sources": sources
        }
    
    def get_stats(self) -> Dict[str, Any]:
        """Get chatbot statistics."""
        try:
            count = self.collection.count()
            return {
                "indexed": count > 0,
                "documents_count": count,
                "collection_name": self.collection_name,
                "status": "ready" if count > 0 else "not_indexed"
            }
        except Exception as e:
            return {
                "indexed": False,
                "documents_count": 0,
                "collection_name": self.collection_name,
                "status": f"error: {str(e)}"
            }
