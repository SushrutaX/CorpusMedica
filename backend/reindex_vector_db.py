"""
Verification and re-indexing script for vector database.
This script ensures all specified documents are indexed in the vector DB.

Usage:
    python reindex_vector_db.py [--force]
"""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv
import logging

# Setup paths
BACKEND_DIR = Path(__file__).parent
env_path = BACKEND_DIR / '.env'
load_dotenv(dotenv_path=env_path)

# Add backend to path
sys.path.insert(0, str(BACKEND_DIR))

from app.services.rag.chatbot import RAGChatbot
from app.services.rag.document_processor import process_all_documents

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def verify_required_files(base_path: Path, models_path: Path) -> dict:
    """Verify that all required files exist"""
    
    results = {
        "all_exist": True,
        "missing": [],
        "found": []
    }
    
    logger.info("=" * 70)
    logger.info("VERIFYING REQUIRED FILES")
    logger.info("=" * 70)
    
    # 1. Check BRATS_README.md
    brats_readme = base_path / "BRATS_README.md"
    if brats_readme.exists():
        results["found"].append(str(brats_readme))
        logger.info(f"✅ Found: BRATS_README.md")
    else:
        results["missing"].append(str(brats_readme))
        results["all_exist"] = False
        logger.warning(f"❌ Missing: BRATS_README.md")
    
    # 2. Check backend/scripts/download_monai_bundles.py
    script_file = base_path / "backend" / "scripts" / "download_monai_bundles.py"
    if script_file.exists():
        results["found"].append(str(script_file))
        logger.info(f"✅ Found: backend/scripts/download_monai_bundles.py")
    else:
        results["missing"].append(str(script_file))
        results["all_exist"] = False
        logger.warning(f"❌ Missing: backend/scripts/download_monai_bundles.py")
    
    # 3. Check models/bundles directory
    bundles_path = models_path / "bundles"
    if bundles_path.exists():
        logger.info(f"✅ Found: models/bundles directory")
        
        # List all bundle directories
        bundle_dirs = [d for d in bundles_path.iterdir() if d.is_dir() and not d.name.endswith('.zip')]
        logger.info(f"\n📦 Bundle directories found: {len(bundle_dirs)}")
        
        for bundle_dir in bundle_dirs:
            logger.info(f"\n  Bundle: {bundle_dir.name}")
            results["found"].append(str(bundle_dir))
            
            # Check for configs
            configs_dir = bundle_dir / "configs"
            if configs_dir.exists():
                config_files = list(configs_dir.glob("*.json"))
                logger.info(f"    ✅ {len(config_files)} config files")
                for cf in config_files:
                    results["found"].append(str(cf))
            else:
                logger.warning(f"    ⚠️  No configs directory")
            
            # Check for docs
            docs_dir = bundle_dir / "docs"
            if docs_dir.exists():
                readme = docs_dir / "README.md"
                license_file = docs_dir / "data_license.txt"
                
                if readme.exists():
                    logger.info(f"    ✅ README.md")
                    results["found"].append(str(readme))
                else:
                    logger.warning(f"    ⚠️  No README.md")
                
                if license_file.exists():
                    logger.info(f"    ✅ data_license.txt")
                    results["found"].append(str(license_file))
                else:
                    logger.warning(f"    ⚠️  No data_license.txt")
            else:
                logger.warning(f"    ⚠️  No docs directory")
            
            # Check for scripts
            scripts_dir = bundle_dir / "scripts"
            if scripts_dir.exists():
                script_files = list(scripts_dir.glob("*.py"))
                if script_files:
                    logger.info(f"    ✅ {len(script_files)} script files")
                    for sf in script_files:
                        results["found"].append(str(sf))
    else:
        results["missing"].append(str(bundles_path))
        results["all_exist"] = False
        logger.warning(f"❌ Missing: models/bundles directory")
    
    logger.info("\n" + "=" * 70)
    logger.info(f"VERIFICATION COMPLETE")
    logger.info(f"✅ Found: {len(results['found'])} files")
    if results['missing']:
        logger.info(f"❌ Missing: {len(results['missing'])} files")
    logger.info("=" * 70 + "\n")
    
    return results


def main():
    """Main function to verify and reindex"""
    
    # Check for force flag
    force_reindex = "--force" in sys.argv
    
    print("=" * 70)
    print("CORPUS MEDICA - VECTOR DATABASE REINDEXING TOOL")
    print("=" * 70)
    print()
    
    # Check API key
    if not os.getenv("GEMINI_API_KEY"):
        print("❌ ERROR: GEMINI_API_KEY not set!")
        print("Please set it in your .env file")
        sys.exit(1)
    
    print("✅ GEMINI_API_KEY found")
    print()
    
    # Setup paths
    base_path = BACKEND_DIR.parent  # Project root
    models_path = base_path / "models"
    
    # Verify required files
    verification = verify_required_files(base_path, models_path)
    
    if not verification["all_exist"]:
        print("\n⚠️  WARNING: Some required files are missing!")
        print("The indexing will continue with available files.\n")
    
    # Initialize chatbot
    try:
        print("🔧 Initializing RAG chatbot...")
        chatbot = RAGChatbot(base_path=base_path, models_path=models_path)
        
        # Check current status
        stats = chatbot.get_stats()
        print(f"\n📊 Current Status:")
        print(f"   Indexed: {stats['indexed']}")
        print(f"   Documents: {stats['documents_count']}")
        print()
        
        # Ask for confirmation if already indexed and not forcing
        if stats['indexed'] and not force_reindex:
            print("⚠️  Knowledge base is already indexed!")
            print("   Use --force to reindex anyway")
            print()
            response = input("Continue with reindexing? (yes/no): ").strip().lower()
            if response != 'yes':
                print("❌ Reindexing cancelled")
                return
            force_reindex = True
        
        # Perform indexing
        print("\n" + "=" * 70)
        print("STARTING INDEXING PROCESS")
        print("=" * 70)
        print()
        print("This will process:")
        print("  ✓ All Python code (backend + frontend)")
        print("  ✓ BRATS_README.md")
        print("  ✓ backend/scripts/download_monai_bundles.py")
        print("  ✓ All files in models/bundles/*/")
        print("    - All JSON configs (metadata, inference, train, etc.)")
        print("    - README.md files")
        print("    - data_license.txt files")
        print("    - Python scripts")
        print()
        print("⏱️  This may take 2-5 minutes...")
        print()
        
        chatbot.index_knowledge_base(force_reindex=force_reindex)
        
        # Get final stats
        final_stats = chatbot.get_stats()
        
        print("\n" + "=" * 70)
        print("✅ INDEXING COMPLETE!")
        print("=" * 70)
        print(f"\n📊 Final Statistics:")
        print(f"   Total documents indexed: {final_stats['documents_count']}")
        print(f"   Collection: {final_stats['collection_name']}")
        print(f"   Status: {final_stats['status']}")
        print()
        
        # Verify specific files are in the index
        print("🔍 Testing search for specific documents...")
        print()
        
        test_queries = [
            "BRATS segmentation labels",
            "download_monai_bundles script",
            "brats_mri_segmentation bundle metadata",
            "data license"
        ]
        
        for query in test_queries:
            results = chatbot.retrieve_context(query, top_k=3)
            if results:
                print(f"✅ '{query}': Found {len(results)} relevant documents")
                for i, result in enumerate(results[:2], 1):
                    source = result['metadata'].get('source', 'Unknown')
                    source_name = Path(source).name if source != 'Unknown' else 'Unknown'
                    score = result.get('score', 0)
                    print(f"   {i}. {source_name} (score: {score:.3f})")
            else:
                print(f"⚠️  '{query}': No results found")
            print()
        
        print("=" * 70)
        print("ALL DONE! You can now test the chatbot with:")
        print("  python test_chatbot.py")
        print("=" * 70)
        
    except Exception as e:
        print(f"\n❌ Error during indexing: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
