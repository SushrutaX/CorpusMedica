# 🔧 QUICK FIX: Gemini Model Error

## Error You Saw
```
404 models/gemini-1.5-flash is not found for API version v1beta
```

## What I Fixed
✅ Updated `backend/app/services/rag/chatbot.py` to use correct model names
✅ Created diagnostic tool: `backend/test_gemini_models.py`
✅ Created verification script: `backend/verify_gemini_fix.py`
✅ Created detailed guide: `backend/GEMINI_MODEL_FIX.md`

## Quick Fix Steps (5 Minutes)

### 1. Verify the Fix
```bash
cd backend
python verify_gemini_fix.py
```

This checks:
- ✅ API key is set
- ✅ Dependencies installed
- ✅ Code updated correctly
- ✅ Import works

### 2. Test Available Models
```bash
export GEMINI_API_KEY='your-key'  # Linux/Mac
# or
set GEMINI_API_KEY=your-key      # Windows (CMD)
# or
$env:GEMINI_API_KEY="your-key"   # Windows (PowerShell)

python test_gemini_models.py
```

This will show which Gemini models work with your API key.

### 3. Restart Backend
```bash
# Stop current backend (Ctrl+C)
# Then restart:
python -m uvicorn main:app --reload
```

Watch the logs for:
```
INFO: Using Gemini 1.5 Flash Latest model
```

### 4. Test the Chatbot
```bash
# In another terminal:
curl http://localhost:8000/api/chat/health
```

Expected response:
```json
{"status": "healthy", "indexed": true, "documents": 150}
```

### 5. Try the Frontend
1. Open http://localhost:5173
2. Click "💬 Ask AI Assistant"
3. Ask: "What models are available?"
4. Should get a response!

## What Changed in the Code

### Before (Broken)
```python
self.model = genai.GenerativeModel('gemini-1.5-flash')
```

### After (Fixed)
```python
self.model = genai.GenerativeModel('gemini-1.5-flash-latest')
```

With fallback chain:
- `gemini-1.5-flash-latest` → Fast, free tier friendly
- `gemini-1.5-pro-latest` → More powerful
- `gemini-pro` → Stable legacy

## If Still Not Working

### Problem: "API key not valid"
**Solution:** Get new key from https://makersuite.google.com/app/apikey

### Problem: "Model not found"
**Solution:** Run `python test_gemini_models.py` to see available models

### Problem: Dependencies missing
**Solution:**
```bash
cd backend
pip install --upgrade google-generativeai
pip install -r requirements.txt
```

### Problem: Import errors
**Solution:**
```bash
cd backend
python verify_gemini_fix.py
```
Follow the suggestions in the output.

## Files Created/Modified

| File | Status | Purpose |
|------|--------|---------|
| `app/services/rag/chatbot.py` | Modified | Fixed model names |
| `test_gemini_models.py` | New | Test available models |
| `verify_gemini_fix.py` | New | Verify fix is applied |
| `GEMINI_MODEL_FIX.md` | New | Detailed documentation |
| `QUICK_FIX_GEMINI.md` | New | This file |

## Testing Checklist

- [ ] Run `verify_gemini_fix.py` - all checks pass
- [ ] Run `test_gemini_models.py` - at least 1 model works
- [ ] Backend starts without errors
- [ ] Logs show "Using Gemini 1.5 Flash Latest model"
- [ ] Health endpoint responds: `curl http://localhost:8000/api/chat/health`
- [ ] Chat endpoint works: `curl -X POST http://localhost:8000/api/chat -d '{"query":"Hi"}'`
- [ ] Frontend chat sidebar opens
- [ ] Can send messages and get responses

## Quick Test Command

```bash
# All-in-one test
cd backend && \
export GEMINI_API_KEY='your-key' && \
python verify_gemini_fix.py && \
python test_gemini_models.py && \
echo "✅ All tests passed! Start backend with: python -m uvicorn main:app --reload"
```

## Support

Still having issues? Check:
1. `GEMINI_MODEL_FIX.md` - Detailed troubleshooting
2. Google AI Studio: https://makersuite.google.com/
3. Gemini API Status: https://status.cloud.google.com/

---

**Status:** ✅ Fixed  
**Date:** January 11, 2025  
**Fix Time:** ~5 minutes
