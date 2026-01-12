# 🔥 CRITICAL UPDATE: Google Genai Package Migration

## 🚨 Two Issues Fixed

### Issue 1: Deprecated Package
**Error:** `google.generativeai` package is deprecated and no longer maintained

### Issue 2: Expired API Key  
**Error:** `400 API key expired. Please renew the API key.`

## ✅ What I Fixed

### 1. Updated Requirements
Changed from deprecated package to new one:
```diff
- google-generativeai>=0.3.0
+ google-genai>=0.2.0
```

### 2. Rewrote Chatbot Code
Complete rewrite of `backend/app/services/rag/chatbot.py` to use the new API:

**Old (Deprecated):**
```python
import google.generativeai as genai
genai.configure(api_key=api_key)
model = genai.GenerativeModel('gemini-1.5-flash-latest')
response = model.generate_content(prompt)
```

**New (Current):**
```python
from google import genai
client = genai.Client(api_key=api_key)
response = client.models.generate_content(
    model='gemini-1.5-flash',
    contents=prompt
)
```

### 3. Fixed Qdrant API Compatibility
Fixed `vectors_count` attribute error in `vector_db.py` to handle both old and new Qdrant versions.

## 🚀 How to Update (3 Steps)

### Step 1: Get New API Key

Your old key is expired. Get a new one:

1. Go to https://makersuite.google.com/app/apikey
2. Click "Create API Key" or "Get API Key"
3. Copy the new key

### Step 2: Update Dependencies

```bash
cd backend

# Uninstall old package
pip uninstall google-generativeai -y

# Install new package
pip install google-genai>=0.2.0

# Or reinstall all requirements
pip install -r requirements.txt
```

### Step 3: Update API Key

**Option A: Environment Variable**
```bash
# Windows CMD
set GEMINI_API_KEY=your-new-key-here

# Windows PowerShell
$env:GEMINI_API_KEY="your-new-key-here"

# Linux/Mac
export GEMINI_API_KEY='your-new-key-here'
```

**Option B: .env File (Recommended)**
```bash
cd backend

# Edit .env file
# Replace old key with new key:
GEMINI_API_KEY=your-new-key-here
```

## 🧪 Verify the Fix

### Test 1: Check Dependencies
```bash
cd backend
python -c "from google import genai; print('✅ New package installed')"
```

Expected: `✅ New package installed`

### Test 2: Run Chatbot Test
```bash
cd backend
python test_chatbot.py
```

Should see:
- No deprecation warning
- "Initialized Gemini client with model: gemini-1.5-flash"
- Successful responses to queries

### Test 3: Start Backend
```bash
cd backend
python -m uvicorn main:app --reload
```

Check logs for:
```
INFO: Initialized Gemini client with model: gemini-1.5-flash
```

### Test 4: Test API
```bash
curl http://localhost:8000/api/chat/health
```

Expected:
```json
{"status": "healthy", "indexed": true, "documents": 150}
```

## 📝 What Changed in the Code

### chatbot.py - New API Structure

**Old:**
```python
import google.generativeai as genai
genai.configure(api_key=self.gemini_api_key)
self.model = genai.GenerativeModel('gemini-1.5-flash-latest')
response = self.model.generate_content(prompt)
```

**New:**
```python
from google import genai
self.client = genai.Client(api_key=self.gemini_api_key)
self.model_name = 'gemini-1.5-flash'
response = self.client.models.generate_content(
    model=self.model_name,
    contents=prompt
)
```

### vector_db.py - API Compatibility

Fixed to handle both `vectors_count` and `points_count` attributes:
```python
points_count = getattr(info, 'points_count', 0)
if points_count == 0 and hasattr(info, 'vectors_count'):
    points_count = info.vectors_count
```

## 🎯 Migration Checklist

- [ ] Get new Gemini API key from Google AI Studio
- [ ] Uninstall `google-generativeai` package
- [ ] Install `google-genai` package
- [ ] Update API key in `.env` file
- [ ] Test with `python test_chatbot.py`
- [ ] Verify no deprecation warnings
- [ ] Start backend successfully
- [ ] Test `/api/chat/health` endpoint
- [ ] Test actual chat queries

## 🐛 Troubleshooting

### Problem: "ModuleNotFoundError: No module named 'google.genai'"

**Solution:**
```bash
pip uninstall google-generativeai -y
pip install google-genai>=0.2.0
```

### Problem: "API key not valid" or "expired"

**Solution:**
1. Get new key: https://makersuite.google.com/app/apikey
2. Update `.env` file
3. Restart backend

### Problem: Still seeing deprecation warning

**Solution:**
```bash
# Make sure old package is completely removed
pip uninstall google-generativeai -y
pip cache purge
pip install -r requirements.txt
```

### Problem: "Client has no attribute 'models'"

**Solution:**
Make sure you have the latest version:
```bash
pip install --upgrade google-genai
```

### Problem: Qdrant "vectors_count" error

**Solution:** Already fixed in vector_db.py. Just restart backend.

## 🆕 New API Features

The new `google-genai` package offers:

1. **Simplified API** - Cleaner client/server architecture
2. **Better Error Handling** - More descriptive error messages
3. **Type Safety** - Better type hints and IDE support
4. **Active Maintenance** - Regular updates and bug fixes
5. **Future-Proof** - This is the recommended package going forward

## 📊 Comparison

| Feature | Old Package | New Package |
|---------|------------|-------------|
| Package Name | `google-generativeai` | `google-genai` |
| Status | ❌ Deprecated | ✅ Active |
| API Style | genai.GenerativeModel() | genai.Client() |
| Model Names | `gemini-1.5-flash-latest` | `gemini-1.5-flash` |
| Import | `import google.generativeai` | `from google import genai` |

## 🎉 Benefits of Update

- ✅ No more deprecation warnings
- ✅ Actively maintained package
- ✅ Better error messages
- ✅ Improved type safety
- ✅ Future compatibility
- ✅ Simpler API structure

## 📚 Documentation

**New Package Docs:**
- GitHub: https://github.com/google-gemini/generative-ai-python
- API Reference: https://ai.google.dev/api/python

**API Key:**
- Get key: https://makersuite.google.com/app/apikey
- Docs: https://ai.google.dev/docs

## 🔄 Rollback (If Needed)

If you need to rollback for any reason:

```bash
cd backend

# Reinstall old package
pip install google-generativeai>=0.3.0

# Restore old chatbot.py
git checkout backend/app/services/rag/chatbot.py

# Update requirements.txt back
git checkout backend/requirements.txt
```

**Note:** Not recommended as the old package is deprecated.

## ✨ Next Steps

1. **Now:** Update packages and API key
2. **Test:** Run all verification steps
3. **Deploy:** Update production environment
4. **Monitor:** Check for any issues in first 24 hours

## 📞 Support

**Still having issues?**

1. Check you have the new package:
   ```bash
   pip list | grep google-genai
   ```

2. Verify API key works:
   ```bash
   python test_gemini_models.py
   ```

3. Check backend logs for specific errors

4. Review new API docs: https://ai.google.dev/api/python

---

**Status:** ✅ Updated  
**Date:** January 11, 2025  
**Breaking Changes:** Yes - requires new package and API key  
**Migration Time:** ~10 minutes
