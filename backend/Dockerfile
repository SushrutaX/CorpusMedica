FROM python:3.11-slim

WORKDIR /app

# Install tesseract system dependency required by pytesseract
RUN apt-get update && \
    apt-get install -y --no-install-recommends tesseract-ocr && \
    rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/
RUN --mount=type=cache,target=/root/.cache/pip pip install -r requirements.txt

COPY . /app

EXPOSE 8000
