FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/

# Copy pre-built data (SQLite DB + ChromaDB index)
RUN mkdir -p /app/data/documents /app/data/chroma
COPY data/anton_rx.db /app/data/anton_rx.db
COPY data/chroma/ /app/data/chroma/

ENV PORT=8080
ENV DATABASE_URL=sqlite:////app/data/anton_rx.db
ENV STORAGE_PATH=/app/data/documents
ENV CHROMA_PATH=/app/data/chroma
ENV STORAGE_BACKEND=local
ENV CORS_ORIGINS=*

EXPOSE 8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
