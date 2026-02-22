FROM python:3.10-slim

WORKDIR /app

# Установка системных зависимостей (если понадобятся для парсинга/библиотек)
RUN apt-get update && apt-get install -y gcc sqlite3 && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Создаем папку для загрузок
RUN mkdir -p uploads

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
