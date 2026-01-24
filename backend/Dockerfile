FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt /app/
RUN --mount=type=cache,target=/root/.cache/pip pip install -r requirements.txt

COPY . /app

RUN ln -s /app /backend && cd /backend && printf "exit\n" | python test_chatbot.py

EXPOSE 8000
