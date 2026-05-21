FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["sh", "-c", "until alembic upgrade head; do echo 'DB belum siap, coba lagi dalam 3 detik...'; sleep 3; done && python seed.py && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
