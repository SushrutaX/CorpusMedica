import pdfplumber
import pytesseract
import cv2
import numpy as np
from PIL import Image
from fastapi import UploadFile

async def extract_text(file: UploadFile) -> str:
    content = await file.read()
    filename = file.filename.lower()

    # TEXT FILE
    if filename.endswith(".txt"):
        return content.decode(errors="ignore")

    # PDF
    if filename.endswith(".pdf"):
        text = ""
        with pdfplumber.open(file.file) as pdf:
            for page in pdf.pages:
                text += page.extract_text() or ""
        return text

    # IMAGE (JPG / PNG)
    img = np.array(Image.open(file.file).convert("RGB"))
    gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
    return pytesseract.image_to_string(gray)
