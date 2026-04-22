FROM python:3.11-slim

WORKDIR /app

# Dépendances système pour pdfplumber (minimal pour Render)
RUN apt-get update && apt-get install -y \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

EXPOSE 8000

# Utiliser le port de Render ou 8000 par défaut
CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
