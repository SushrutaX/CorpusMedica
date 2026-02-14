import pdfplumber
import pytesseract
import cv2
import numpy as np
from PIL import Image
from fastapi import UploadFile

async def extract_text(file: UploadFile) -> tuple[str, bool]:
    """Returns (text, is_image_source)."""
    content = await file.read()
    filename = file.filename.lower()

    if filename.endswith(".txt"):
        return content.decode(errors="ignore"), False

    if filename.endswith(".pdf"):
        text = ""
        try:
            file.file.seek(0)
        except Exception:
            pass
        with pdfplumber.open(file.file) as pdf:
            for page in pdf.pages:
                text += page.extract_text() or ""
        return text, False

    try:
        file.file.seek(0)
    except Exception:
        pass
    img = np.array(Image.open(file.file).convert("RGB"))
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    return pytesseract.image_to_string(gray), True
