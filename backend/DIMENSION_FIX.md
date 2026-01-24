# 🔧 VECTOR DIMENSION FIX

## ❌ Problem
```
ValueError: could not broadcast input array from shape (384,) into shape (768,)
```

## 🎯 Root Cause
The embedding model `all-MiniLM-L6-v2` produces **384-dimensional** vectors, but the Qdrant collection was created expecting **768-dimensional** vectors (old default).

## ✅ Solution Applied

### Files Updated:

1. **`vector_db.py`** ✅
   - Changed default vector size from 768 to 384
   - Added automatic dimension detection
   - Added validation to catch dimension mismatches
   - Added better error messages

2. **`chatbot.py`** ✅
   - Now detects embedding dimension from the model
   - Passes correct dimension to VectorDBManager
   - Uses `get_sentence_embedding_dimension()` method

### What Changed:

**Before:**
```python
self.vector_size = 768  # Hardcoded wrong size
```

**After:**
```python
# Get actual dimension from model
self.embedding_dim = self.embedding_model.get_sentence_embedding_dimension()
# Pass to vector DB
self.vector_db = VectorDBManager(vector_size=self.embedding_dim)
```

---

## 🚀 How to Fix Your Database

Since you have an existing collection with wrong dimensions, you need to delete it and reindex:

### Step 1: Navigate to Backend
```bash
cd C:\Users\Shaurya\OneDrive\Desktop\CorpusMedica\backend
```

### Step 2: Run Reindex with Force Flag
```bash
python reindex_vector_db.py --force
```

The `--force` flag will:
1. ✅ Delete the old collection (wrong 768 dimensions)
2. ✅ Create new collection (correct 384 dimensions)
3. ✅ Process all documents
4. ✅ Generate embeddings
5. ✅ Add to vector database

---

## 📊 What You'll See

```
============================================================
CORPUS MEDICA - VECTOR DATABASE REINDEXING TOOL
============================================================

✅ GEMINI_API_KEY found

Loading embedding model...
Embedding model dimension: 384

Force re-indexing: deleting existing collection...
Deleted collection: corpus_medica_kb
Creating collection: corpus_medica_kb with vector size: 384

Processing documents from codebase and MONAI bundles...
[1/2] Processing codebase and documentation...
✅ Codebase: 65 documents

[2/2] Processing MONAI bundles...
✅ MONAI Bundles: 90 documents

✅ TOTAL DOCUMENTS PROCESSED: 155

Generating embeddings for 155 documents...
[████████████████████] 100%

Adding documents to vector database...
Uploaded batch 1/2
Uploaded batch 2/2
Successfully added 155 documents to vector store

✅ Knowledge base indexing complete!

✅ INDEXING COMPLETE!
📊 Final Statistics:
   Total documents indexed: 155
   Vector size: 384
```

---

## 🔍 Verification

After reindexing, the stats will show correct vector size:

```python
stats = chatbot.get_stats()
print(stats)

# Output:
{
    'indexed': True,
    'documents_count': 155,
    'collection_name': 'corpus_medica_kb',
    'status': 'green',
    'vector_size': 384  # ✅ Correct!
}
```

---

## ⚠️ Important Notes

1. **Old Data Will Be Lost**: When you use `--force`, the old collection is deleted. This is necessary because Qdrant collections cannot change vector dimensions after creation.

2. **Reindexing Takes 2-5 Minutes**: Be patient while it processes all documents.

3. **Future-Proof**: The code now automatically detects the embedding dimension, so this won't happen again if you change models.

---

## 🆘 If Issues Persist

### Issue: Still getting dimension error
```bash
# Manually delete the Qdrant database
# If using in-memory (:memory:), just restart Python

# If using persistent storage, delete the directory:
rm -rf /path/to/qdrant/data
```

### Issue: "Collection already exists"
```bash
# The script should handle this, but if not:
python -c "from app.services.rag.vector_db import VectorDBManager; VectorDBManager().delete_collection()"
```

---

## ✅ Quick Fix Command

```bash
cd C:\Users\Shaurya\OneDrive\Desktop\CorpusMedica\backend
python reindex_vector_db.py --force
```

That's it! The dimension mismatch is now fixed. 🎉
