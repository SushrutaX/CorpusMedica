import re

# Read the file
with open('app/services/rag/chatbot.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the model initialization section
old_pattern = r"# Try different model names in order of preference\s+model_names = \[[\s\S]*?\]"
new_code = """# Use Gemini 2.5 Flash (confirmed working)
        model_name = 'models/gemini-2.5-flash'
        logger.info(f"Initializing Gemini model: {model_name}")"""

content = re.sub(old_pattern, new_code, content)

# Also replace the loop that tries models
old_loop = r"self\.model = None\s+for model_name in model_names:[\s\S]*?if self\.model is None:[\s\S]*?raise ValueError\([^)]+\)"
new_loop = """try:
            self.model = genai.GenerativeModel(model_name)
            logger.info(f"✅ Successfully initialized {model_name}")
        except Exception as e:
            logger.error(f"Failed to initialize {model_name}: {e}")
            raise ValueError(
                f"Could not initialize Gemini model. "
                "Please check your API key is valid."
            )"""

content = re.sub(old_loop, new_loop, content)

# Write back
with open('app/services/rag/chatbot.py', 'w', encoding='utf-8') as f:
    f.write(content)

print("✅ Fixed chatbot.py to use models/gemini-2.5-flash")
