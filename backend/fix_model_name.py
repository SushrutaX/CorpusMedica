"""Fix the Gemini model name in chatbot.py"""
import sys
from pathlib import Path

chatbot_file = Path(__file__).parent / 'app' / 'services' / 'rag' / 'chatbot.py'

with open(chatbot_file, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the model names list
old_text = """        # Try different model names in order of preference
        model_names = [
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
            raise ValueError("Could not initialize any Gemini model. Please check your API key and available models.")"""

new_text = """        # Use Gemini 2.5 Flash (confirmed working with your API key)
        model_name = 'models/gemini-2.5-flash'
        logger.info(f"Initializing Gemini model: {model_name}")
        try:
            self.model = genai.GenerativeModel(model_name)
            logger.info(f"✅ Successfully initialized {model_name}")
        except Exception as e:
            logger.error(f"Failed to initialize {model_name}: {e}")
            raise ValueError(
                f"Could not initialize Gemini model. "
                "Please check your API key is valid."
            )"""

if old_text in content:
    content = content.replace(old_text, new_text)
    with open(chatbot_file, 'w', encoding='utf-8') as f:
        f.write(content)
    print("✅ Successfully updated chatbot.py to use models/gemini-2.5-flash")
else:
    print("❌ Could not find the text to replace. File may have been modified.")
    sys.exit(1)
