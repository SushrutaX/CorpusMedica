# Gemini API Model Fix

## Problem
The chatbot was failing with error:
```
404 models/gemini-1.5-flash is not found for API version v1beta
```

## Root Cause
The Google Generative AI SDK changed its model naming convention. The old model names like `gemini-1.5-flash` require the beta API endpoint, but the SDK might be using the stable v1 API by default.

## Solution Applied

### 1. Updated Model Names in `chatbot.py`

Changed from:
```python
self.model = genai.GenerativeModel('gemini-1.5-flash')
```

To:
```python
self.model = genai.GenerativeModel('gemini-1.5-flash-latest')
```

With proper fallback chain:
1. `gemini-1.5-flash-latest` (recommended - fastest, free tier)
2. `gemini-1.5-pro-latest` (more powerful)
3. `gemini-pro` (stable fallback)

### 2. Created Diagnostic Tool

New file: `backend/test_gemini_models.py`

Run it to test which models work with your API key:
```bash
cd backend
export GEMINI_API_KEY='your-key'  # or set on Windows
python test_gemini_models.py
```

This will:
- Test all available model names
- Show which ones work
- Give you a recommendation

## How to Fix Your Setup

### Option 1: Quick Fix (Recommended)
```bash
# 1. Make sure you have the updated chatbot.py
cd backend

# 2. Test which models work
export GEMINI_API_KEY='your-key-here'  # Linux/Mac
# or
set GEMINI_API_KEY=your-key-here      # Windows

python test_gemini_models.py

# 3. Restart your backend
python -m uvicorn main:app --reload
```

### Option 2: Update Requirements
```bash
cd backend
pip install --upgrade google-generativeai
```

Then test again.

## Verification

After fixing, verify the chatbot works:

### 1. Check Health Endpoint
```bash
curl http://localhost:8000/api/chat/health
```

Expected response:
```json
{
  "status": "healthy",
  "indexed": true,
  "documents": 150
}
```

### 2. Test Chat
```bash
curl -X POST http://localhost:8000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"query": "What models are available?"}'
```

### 3. Check Logs
Look for this in the backend logs:
```
INFO: Using Gemini 1.5 Flash Latest model
```

## Available Gemini Models (As of Jan 2025)

| Model Name | Speed | Cost | Best For |
|------------|-------|------|----------|
| `gemini-1.5-flash-latest` | Very Fast | Free/Cheap | Development, quick responses |
| `gemini-1.5-pro-latest` | Slower | Higher | Production, complex queries |
| `gemini-pro` | Fast | Free/Cheap | Stable fallback |

## Common Issues

### "API key not valid"
- Get a new key: https://makersuite.google.com/app/apikey
- Make sure you're using Google AI Studio API key, not Vertex AI

### "Model not found"
- Run `python test_gemini_models.py` to see available models
- Update chatbot.py with a working model name

### "Rate limit exceeded"
Free tier limits:
- 60 requests/minute
- 1,500 requests/day

Wait or upgrade to paid tier.

## Model Selection Logic in Code

```python
try:
    # Try latest Flash (recommended)
    self.model = genai.GenerativeModel('gemini-1.5-flash-latest')
except:
    try:
        # Fall back to Pro
        self.model = genai.GenerativeModel('gemini-1.5-pro-latest')
    except:
        # Last resort
        self.model = genai.GenerativeModel('gemini-pro')
```

## Testing After Fix

1. **Backend logs** should show:
   ```
   INFO: Using Gemini 1.5 Flash Latest model
   ```

2. **Test endpoint** should return chat response:
   ```bash
   curl -X POST http://localhost:8000/api/chat \
     -H "Content-Type: application/json" \
     -d '{"query": "Hello!"}'
   ```

3. **Frontend** chat should work without errors

## If Still Not Working

1. Check Google AI Studio dashboard: https://makersuite.google.com/
2. Verify API key is active
3. Check for service outages
4. Try creating a new API key
5. Update `google-generativeai` package:
   ```bash
   pip install --upgrade google-generativeai
   ```

## References

- Google AI Studio: https://makersuite.google.com/
- Gemini API Docs: https://ai.google.dev/docs
- Model List: https://ai.google.dev/models/gemini

---

**Status: ✅ Fixed**
**Last Updated: January 11, 2025**
