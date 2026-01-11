"""
Document processor for ingesting codebase and MONAI bundles into vector database.
Enhanced to include all documentation, scripts, and bundle files.
"""
import json
import logging
from pathlib import Path
from typing import Dict, List, Any

logger = logging.getLogger(__name__)


class Document:
    """Represents a document chunk for embedding"""
    
    def __init__(self, content: str, metadata: Dict[str, Any]):
        self.content = content
        self.metadata = metadata
        self.page_content = content  # For compatibility with LangChain


def extract_python_code(file_path: Path) -> List[Document]:
    """Extract Python code with context"""
    try:
        content = file_path.read_text(encoding='utf-8')
        
        # Add full file as one document with metadata
        docs = [Document(
            content=content,
            metadata={
                "source": str(file_path),
                "type": "python_code",
                "file_name": file_path.name,
                "directory": str(file_path.parent),
            }
        )]
        
        return docs
    except Exception as e:
        logger.error(f"Error processing {file_path}: {e}")
        return []


def extract_text_file(file_path: Path, file_type: str = "text") -> List[Document]:
    """Extract plain text files (like .txt, license files, etc.)"""
    try:
        content = file_path.read_text(encoding='utf-8')
        
        formatted_content = f"""
File: {file_path.name}
Path: {file_path}
Type: {file_type}

Content:
{content}
"""
        
        return [Document(
            content=formatted_content,
            metadata={
                "source": str(file_path),
                "type": file_type,
                "file_name": file_path.name,
            }
        )]
    except Exception as e:
        logger.error(f"Error processing text file {file_path}: {e}")
        return []


def extract_json_config(file_path: Path) -> List[Document]:
    """Extract JSON configuration files"""
    try:
        content = file_path.read_text(encoding='utf-8')
        data = json.loads(content)
        
        # Determine the bundle name from path
        bundle_name = "unknown"
        if 'bundles' in str(file_path):
            parts = str(file_path).split('bundles')
            if len(parts) > 1:
                bundle_parts = parts[1].strip('/\\').split('/')
                if bundle_parts:
                    bundle_name = bundle_parts[0]
        
        # Format JSON nicely for context
        formatted_content = f"""
Configuration File: {file_path.name}
Bundle: {bundle_name}
Path: {file_path}

Content:
{json.dumps(data, indent=2)}

Summary: This is a {file_path.stem} configuration file for the {bundle_name} MONAI bundle.
"""
        
        return [Document(
            content=formatted_content,
            metadata={
                "source": str(file_path),
                "type": "json_config",
                "file_name": file_path.name,
                "config_type": file_path.stem,
                "bundle_name": bundle_name,
            }
        )]
    except Exception as e:
        logger.error(f"Error processing JSON {file_path}: {e}")
        return []


def extract_markdown(file_path: Path) -> List[Document]:
    """Extract markdown documentation with intelligent chunking"""
    try:
        content = file_path.read_text(encoding='utf-8')
        
        # Determine document type
        doc_type = "markdown_documentation"
        if "BRATS" in file_path.name.upper():
            doc_type = "brats_documentation"
        elif "README" in file_path.name.upper():
            doc_type = "readme_documentation"
        
        # Split by headers for better chunking
        sections = []
        current_section = []
        current_header = "Introduction"
        
        for line in content.split('\n'):
            if line.startswith('#'):
                if current_section:
                    sections.append({
                        'header': current_header,
                        'content': '\n'.join(current_section)
                    })
                current_header = line.strip('#').strip()
                current_section = [line]
            else:
                current_section.append(line)
        
        # Add last section
        if current_section:
            sections.append({
                'header': current_header,
                'content': '\n'.join(current_section)
            })
        
        docs = []
        for section in sections:
            docs.append(Document(
                content=f"# {section['header']}\n\n{section['content']}",
                metadata={
                    "source": str(file_path),
                    "type": doc_type,
                    "file_name": file_path.name,
                    "section": section['header'],
                }
            ))
        
        return docs
    except Exception as e:
        logger.error(f"Error processing markdown {file_path}: {e}")
        return []


def process_codebase(base_path: Path) -> List[Document]:
    """Process entire codebase including Python files and documentation"""
    documents = []
    
    # Process backend Python files
    backend_path = base_path / "backend"
    if backend_path.exists():
        logger.info(f"Processing backend code from {backend_path}")
        for py_file in backend_path.rglob("*.py"):
            if "__pycache__" not in str(py_file):
                documents.extend(extract_python_code(py_file))
        
        # Process backend scripts specifically (they're already in rglob above, but log them)
        scripts_path = backend_path / "scripts"
        if scripts_path.exists():
            logger.info(f"Processing backend scripts from {scripts_path}")
    
    # Process frontend TypeScript files
    frontend_path = base_path / "frontend" / "src"
    if frontend_path.exists():
        logger.info(f"Processing frontend code from {frontend_path}")
        for ts_file in frontend_path.rglob("*.tsx"):
            documents.extend(extract_python_code(ts_file))
        for ts_file in frontend_path.rglob("*.ts"):
            if ".d.ts" not in str(ts_file):
                documents.extend(extract_python_code(ts_file))
    
    # Process all README files
    for readme in base_path.rglob("README.md"):
        logger.info(f"Processing documentation: {readme}")
        documents.extend(extract_markdown(readme))
    
    # Process BRATS_README specifically (critical documentation)
    brats_readme = base_path / "BRATS_README.md"
    if brats_readme.exists():
        logger.info(f"Processing BRATS documentation: {brats_readme}")
        documents.extend(extract_markdown(brats_readme))
    
    # Process other markdown documentation
    for md_file in base_path.glob("*.md"):
        if md_file.name not in ["README.md", "BRATS_README.md"]:  # Already processed
            logger.info(f"Processing markdown: {md_file}")
            documents.extend(extract_markdown(md_file))
    
    logger.info(f"Processed {len(documents)} code and documentation chunks")
    return documents


def process_monai_bundles(models_path: Path) -> List[Document]:
    """
    Process ALL MONAI bundle files including:
    - All JSON config files (metadata, inference, train, evaluate, etc.)
    - README.md files
    - data_license.txt files
    - Bundle overview documents
    """
    documents = []
    
    bundles_path = models_path / "bundles"
    if not bundles_path.exists():
        logger.warning(f"Bundles path not found: {bundles_path}")
        return documents
    
    # Process each bundle directory
    for bundle_dir in bundles_path.iterdir():
        if not bundle_dir.is_dir() or bundle_dir.name.endswith('.zip'):
            continue
        
        logger.info(f"Processing MONAI bundle: {bundle_dir.name}")
        
        # 1. Process ALL config JSON files
        configs_dir = bundle_dir / "configs"
        if configs_dir.exists():
            for config_file in configs_dir.glob("*.json"):
                logger.info(f"  - Processing config: {config_file.name}")
                documents.extend(extract_json_config(config_file))
        
        # 2. Process docs directory
        docs_dir = bundle_dir / "docs"
        if docs_dir.exists():
            # Process README.md
            bundle_readme = docs_dir / "README.md"
            if bundle_readme.exists():
                logger.info(f"  - Processing README: {bundle_readme}")
                documents.extend(extract_markdown(bundle_readme))
            
            # Process data_license.txt
            license_file = docs_dir / "data_license.txt"
            if license_file.exists():
                logger.info(f"  - Processing license: {license_file}")
                documents.extend(extract_text_file(license_file, "license"))
            
            # Process any other text files in docs
            for txt_file in docs_dir.glob("*.txt"):
                if txt_file.name != "data_license.txt":  # Already processed
                    logger.info(f"  - Processing text file: {txt_file}")
                    documents.extend(extract_text_file(txt_file, "documentation"))
        
        # 3. Process scripts directory if it exists
        scripts_dir = bundle_dir / "scripts"
        if scripts_dir.exists():
            for script_file in scripts_dir.glob("*.py"):
                logger.info(f"  - Processing script: {script_file.name}")
                documents.extend(extract_python_code(script_file))
        
        # 4. Create bundle overview document from metadata
        metadata_file = configs_dir / "metadata.json" if configs_dir and configs_dir.exists() else None
        if metadata_file and metadata_file.exists():
            try:
                metadata = json.loads(metadata_file.read_text(encoding='utf-8'))
                
                # Extract key information
                name = metadata.get('name', 'Unknown')
                task = metadata.get('task', 'Unknown')
                description = metadata.get('description', 'No description available')
                version = metadata.get('version', 'Unknown')
                monai_version = metadata.get('monai_version', 'Unknown')
                
                overview = f"""
MONAI Bundle Overview: {bundle_dir.name}

Official Name: {name}
Task: {task}
Version: {version}
MONAI Version: {monai_version}

Description:
{description}

Directory Structure:
- Bundle Location: {bundle_dir}
- Configurations: {configs_dir}
- Models: {bundle_dir / 'models'}
- Documentation: {bundle_dir / 'docs'}
- Scripts: {bundle_dir / 'scripts'}

Network Architecture:
{json.dumps(metadata.get('network_data_format', {}), indent=2)}

Intended Use:
{metadata.get('intended_use', 'Not specified')}

Available Configurations:
{', '.join([f.stem for f in configs_dir.glob('*.json')]) if configs_dir and configs_dir.exists() else 'None'}

References:
{json.dumps(metadata.get('references', []), indent=2)}
"""
                
                documents.append(Document(
                    content=overview,
                    metadata={
                        "source": str(bundle_dir),
                        "type": "monai_bundle_overview",
                        "bundle_name": bundle_dir.name,
                        "bundle_task": task,
                        "bundle_version": version,
                    }
                ))
                logger.info(f"  - Created bundle overview document")
                
            except Exception as e:
                logger.error(f"Error creating bundle overview for {bundle_dir.name}: {e}")
    
    logger.info(f"Processed {len(documents)} MONAI bundle documents")
    return documents


def process_all_documents(base_path: Path, models_path: Path) -> List[Document]:
    """
    Process ALL documents including:
    - Entire codebase (backend + frontend)
    - All markdown documentation (README.md, BRATS_README.md, etc.)
    - Backend scripts (including download_monai_bundles.py)
    - All MONAI bundle files (configs, docs, licenses, scripts)
    """
    all_documents = []
    
    logger.info("=" * 60)
    logger.info("Starting comprehensive document processing...")
    logger.info("=" * 60)
    
    # Process codebase (includes backend scripts automatically)
    logger.info("\n[1/2] Processing codebase and documentation...")
    codebase_docs = process_codebase(base_path)
    all_documents.extend(codebase_docs)
    logger.info(f"✅ Codebase: {len(codebase_docs)} documents")
    
    # Process MONAI bundles (ALL files in models/bundles)
    logger.info("\n[2/2] Processing MONAI bundles...")
    bundle_docs = process_monai_bundles(models_path)
    all_documents.extend(bundle_docs)
    logger.info(f"✅ MONAI Bundles: {len(bundle_docs)} documents")
    
    logger.info("=" * 60)
    logger.info(f"✅ TOTAL DOCUMENTS PROCESSED: {len(all_documents)}")
    logger.info("=" * 60)
    
    # Print summary by type
    doc_types = {}
    for doc in all_documents:
        doc_type = doc.metadata.get('type', 'unknown')
        doc_types[doc_type] = doc_types.get(doc_type, 0) + 1
    
    logger.info("\nDocument breakdown by type:")
    for doc_type, count in sorted(doc_types.items()):
        logger.info(f"  - {doc_type}: {count}")
    
    return all_documents
