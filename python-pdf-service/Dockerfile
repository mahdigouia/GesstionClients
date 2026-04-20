FROM python:3.11-slim

WORKDIR /app

# Dépendances système pour Camelot et pdfplumber
RUN apt-get update && apt-get install -y \
    ghostscript \
    poppler-utils \
    libgl1-mesa-glx \
    libglib2.0-0 \
    tesseract-ocr \
    tesseract-ocr-fra \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
