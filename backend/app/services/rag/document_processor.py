"""
Document Processor for RAG System

Handles loading, chunking, and preprocessing of various document types.
"""

import os
from pathlib import Path
from typing import List, Dict, Any, Optional
import logging
import json

logger = logging.getLogger(__name__)


class Document:
    """Represents a document chunk with metadata."""
    
    def __init__(
        self,
        content: str,
        metadata: Optional[Dict[str, Any]] = None,
        doc_id: Optional[str] = None
    ):
        self.content = content
        self.metadata = metadata or {}
        self.doc_id = doc_id or self._generate_id()
    
    def _generate_id(self) -> str:
        """Generate a unique ID for the document."""
        import hashlib
        return hashlib.md5(self.content.encode()).hexdigest()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            'id': self.doc_id,
            'content': self.content,
            'metadata': self.metadata
        }


class DocumentProcessor:
    """Process and chunk documents for the RAG system."""
    
    def __init__(
        self,
        chunk_size: int = 1500,
        chunk_overlap: int = 200,
        exclude_patterns: Optional[List[str]] = None
    ):
        """
        Initialize document processor.
        
        Args:
            chunk_size: Maximum size of each chunk in characters
            chunk_overlap: Number of characters to overlap between chunks
            exclude_patterns: List of patterns to exclude
        """
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.exclude_patterns = exclude_patterns or [
            '__pycache__',
            '.git',
            'node_modules',
            '.pytest_cache',
            '.venv',
            'venv',
            '.env',
            '.pyc',
            '.pyo',
            '.pyd',
            '.so',
            '.dll',
            'dist',
            'build',
            '.next',
            'coverage',
            '.nyc_output'
        ]
    
    def should_process_file(self, filepath: Path) -> bool:
        """Check if file should be processed."""
        path_str = str(filepath)
        
        # Check exclusion patterns
        for pattern in self.exclude_patterns:
            if pattern in path_str:
                return False
        
        # Process text-based files
        text_extensions = {
            '.py', '.md', '.txt', '.rst', '.json', '.yaml', '.yml',
            '.js', '.jsx', '.ts', '.tsx', '.html', '.css', '.scss',
            '.sh', '.bash', '.bat', '.ps1', '.sql', '.xml', '.toml',
            '.ini', '.cfg', '.conf', '.dockerfile'
        }
        
        return filepath.suffix.lower() in text_extensions
    
    def load_file(self, filepath: Path) -> Optional[str]:
        """Load content from a file."""
        try:
            with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
                return f.read()
        except Exception as e:
            logger.warning(f"Could not read {filepath}: {e}")
            return None
    
    def chunk_text(self, text: str, metadata: Dict[str, Any]) -> List[Document]:
        """
        Chunk text into smaller pieces.
        
        Args:
            text: Text to chunk
            metadata: Metadata for the document
            
        Returns:
            List of Document objects
        """
        if len(text) <= self.chunk_size:
            return [Document(content=text, metadata=metadata)]
        
        chunks = []
        start = 0
        
        while start < len(text):
            end = start + self.chunk_size
            
            # Try to break at a newline
            if end < len(text):
                newline_pos = text.rfind('\n', start, end)
                if newline_pos != -1 and newline_pos > start + self.chunk_size // 2:
                    end = newline_pos
            
            chunk_text = text[start:end].strip()
            
            if chunk_text:
                chunk_metadata = metadata.copy()
                chunk_metadata['chunk_index'] = len(chunks)
                chunks.append(Document(content=chunk_text, metadata=chunk_metadata))
            
            start = end - self.chunk_overlap
        
        return chunks
    
    def process_file(
        self,
        filepath: Path,
        doc_type: str = "document",
        base_path: Optional[Path] = None
    ) -> Optional[Document]:
        """
        Process a single file.
        
        Args:
            filepath: Path to file
            doc_type: Type of document
            base_path: Base path for relative paths
            
        Returns:
            Document object or None
        """
        if not self.should_process_file(filepath):
            return None
        
        content = self.load_file(filepath)
        if not content:
            return None
        
        # Create relative path
        if base_path:
            try:
                rel_path = filepath.relative_to(base_path)
            except ValueError:
                rel_path = filepath
        else:
            rel_path = filepath
        
        metadata = {
            'source': str(rel_path),
            'type': doc_type,
            'filename': filepath.name,
            'extension': filepath.suffix
        }
        
        # For small files, return as single document
        if len(content) <= self.chunk_size:
            return Document(content=content, metadata=metadata)
        
        # For large files, return first chunk only (for now)
        # In production, you'd want to chunk properly
        chunk = content[:self.chunk_size]
        return Document(content=chunk, metadata=metadata)
    
    def process_directory(
        self,
        directory: Path,
        doc_type: str = "document",
        recursive: bool = True
    ) -> List[Document]:
        """
        Process all files in a directory.
        
        Args:
            directory: Directory to process
            doc_type: Type of documents
            recursive: Process subdirectories
            
        Returns:
            List of Document objects
        """
        documents = []
        
        if not directory.exists():
            logger.warning(f"Directory does not exist: {directory}")
            return documents
        
        # Get all files
        if recursive:
            files = list(directory.rglob('*'))
        else:
            files = list(directory.glob('*'))
        
        logger.info(f"Found {len(files)} total items in {directory}")
        
        # Process each file
        processed_count = 0
        for filepath in files:
            if filepath.is_file():
                doc = self.process_file(filepath, doc_type=doc_type, base_path=directory.parent)
                if doc:
                    documents.append(doc)
                    processed_count += 1
        
        logger.info(f"Processed {processed_count} files from {directory.name}")
        
        return documents
    
    def process_json_file(self, filepath: Path, doc_type: str = "config") -> Optional[Document]:
        """Process a JSON configuration file."""
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            # Convert JSON to readable text
            content = json.dumps(data, indent=2)
            
            # Add descriptive header
            header = f"Configuration file: {filepath.name}\n\n"
            content = header + content
            
            metadata = {
                'source': str(filepath),
                'type': doc_type,
                'filename': filepath.name,
                'format': 'json'
            }
            
            return Document(content=content, metadata=metadata)
        
        except Exception as e:
            logger.warning(f"Could not process JSON file {filepath}: {e}")
            return None


def process_all_documents(
    base_path: Path,
    models_path: Path
) -> List[Document]:
    """
    Process all documents in the project.
    
    Args:
        base_path: Project root path
        models_path: Models directory path
        
    Returns:
        List of all documents
    """
    processor = DocumentProcessor()
    all_documents = []
    
    # 1. Backend code
    backend_path = base_path / "backend"
    if backend_path.exists():
        docs = processor.process_directory(backend_path, doc_type="python_code")
        all_documents.extend(docs)
        logger.info(f"Processed backend: {len(docs)} documents")
    
    # 2. Frontend code
    frontend_path = base_path / "frontend" / "src"
    if frontend_path.exists():
        docs = processor.process_directory(frontend_path, doc_type="typescript_code")
        all_documents.extend(docs)
        logger.info(f"Processed frontend: {len(docs)} documents")
    
    # 3. Documentation
    for doc_file in ['BRATS_README.md', 'README.md', 'CHATBOT_README.md']:
        doc_path = base_path / doc_file
        if doc_path.exists():
            doc = processor.process_file(doc_path, doc_type="documentation", base_path=base_path)
            if doc:
                all_documents.append(doc)
                logger.info(f"Processed: {doc_file}")
    
    # 4. MONAI bundles
    bundles_path = models_path / "bundles"
    if bundles_path.exists():
        for bundle_dir in bundles_path.iterdir():
            if bundle_dir.is_dir() and not bundle_dir.name.endswith('.zip'):
                docs = processor.process_directory(bundle_dir, doc_type="monai_bundle")
                all_documents.extend(docs)
                logger.info(f"Processed bundle {bundle_dir.name}: {len(docs)} documents")
    
    logger.info(f"Total documents processed: {len(all_documents)}")
    return all_documents
