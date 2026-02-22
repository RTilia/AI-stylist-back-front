import json
import re
import os
import requests
import urllib.parse
import time
import random
import base64
from typing import List

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv
from openai import OpenAI
from duckduckgo_search import DDGS
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from passlib.context import CryptContext

import models
from database import engine, get_db

# --- 1. НАСТРОЙКИ ---

load_dotenv()
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
if not OPENROUTER_API_KEY:
    raise ValueError("❌ Ключ не найден! Проверь .env")

# Создаем файл базы данных и все таблицы
models.Base.metadata.create_all(bind=engine)

# Настройка шифровальщика паролей
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Модель, которая умеет смотреть картинки и писать отличные тексты
AI_MODEL = "nvidia/nemotron-nano-12b-v2-vl:free"

client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=OPENROUTER_API_KEY,
)

app = FastAPI(title="AI Stylist Backend (Vision & Collage Edition)")

# noinspection PyTypeChecker
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "*"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("uploads", exist_ok=True)
app.mount("/static", StaticFiles(directory="uploads"), name="static")


# --- 2. ЗАГРУЗКА БАЗЫ ЗНАНИЙ И ПРОМПТОВ ---

def build_system_prompt() -> str:
    print("📚 Загрузка базы знаний стилиста...")
    kb_dir = "knowledge_base"

    try:
        with open(f"{kb_dir}/main_prompt.txt", "r", encoding="utf-8") as f:
            system_prompt = f.read() + "\n\n"
    except FileNotFoundError:
        print("⚠️ Файл main_prompt.txt не найден! Создай его в папке knowledge_base.")
        system_prompt = "Ты — профессиональный стилист.\n\n"

    files_to_load = [
        "Категории стилей.md",
        "Описание и применение женских стилей в одежде.md",
        "Женские стили.md",
        "Типы фигур.md",
        "Цветовая палитра.md",
        "Рост.md"
    ]

    parts: List[str] = [system_prompt, "--- НАЧАЛО БАЗЫ ЗНАНИЙ (ИСПОЛЬЗУЙ КАК СПРАВОЧНИК) ---\n\n"]

    for filename in files_to_load:
        try:
            with open(f"{kb_dir}/{filename}", "r", encoding="utf-8") as f:
                parts.append(f"--- ФАЙЛ: {filename} ---\n")
                parts.append(f.read() + "\n\n")
        except FileNotFoundError:
            print(f"⚠️ Файл {filename} не найден в папке {kb_dir}")

    parts.append("--- КОНЕЦ БАЗЫ ЗНАНИЙ ---\n")
    return "".join(parts)


STYLIST_SYSTEM_PROMPT = build_system_prompt()

CAPSULE_GENERATION_SYSTEM_PROMPT = """
Твоя роль — элитный фэшн-эксперт. Твоя задача — составить капсульный гардероб на основе готового анализа внешности клиента.

ТРЕБОВАНИЯ К ОТВЕТУ:
1. Изучи анализ внешности, телосложение, цветотип и образ жизни клиента (всё это будет во входных данных).
2. Предложи не меньше 10-15 вещей, обуви и аксессуаров, которые идеально сочетаются между собой в единую капсулу.
3. Учти, что в подборке должны быть предметы для любого времени года (многослойность).
4. Отдай предпочтение натуральным тканям, базовым цветам и современному минимализму.
5. Строго соблюдай ограничения: не предлагай вещи, цвета или фасоны, которые не подходят клиенту по анализу или которые он просил исключить.
6. Дай советы, как подбирать элементы, чтобы они хорошо сидели по фигуре и легко комбинировались.

Напиши красивый, вдохновляющий и структурированный текст. Обращайся к клиенту вежливо и экспертно. Не используй формат JSON, пиши обычным, красиво оформленным текстом.
"""


# --- 3. МОДЕЛИ ДАННЫХ ---

class UserCreate(BaseModel):
    username: str
    name: str
    password: str


class UserLogin(BaseModel):
    username: str
    password: str


class AnalysisResponse(BaseModel):
    analysis_text: str
    color_type: str = ""
    body_type: str = ""
    contrast: str = ""


class CapsuleGenerationRequest(BaseModel):
    analysis_text: str
    event_goal: str
    budget: str = "Средний"


class CapsuleResult(BaseModel):
    capsule_text: str
    image_url: str


class ProductLinkResult(BaseModel):
    title: str
    image_url: str
    shop_link: str


# --- 4. ПАРСИНГ СТРУКТУРИРОВАННОГО БЛОКА ИЗ ОТВЕТА ИИ ---

def parse_structured_block(text: str) -> dict:
    """Извлекает цветотип, контрастность и тип фигуры из блока ---ДАННЫЕ--- в ответе ИИ."""
    result = {"color_type": "", "body_type": "", "contrast": ""}
    block_match = re.search(r'---ДАННЫЕ---(.+?)---КОНЕЦ ДАННЫХ---', text, re.DOTALL)
    if block_match:
        block = block_match.group(1)
        ct = re.search(r'ЦВЕТОТИП:\s*(.+)', block)
        if ct:
            result["color_type"] = ct.group(1).strip().strip('"«»')
        cn = re.search(r'КОНТРАСТНОСТЬ:\s*(.+)', block)
        if cn:
            result["contrast"] = cn.group(1).strip().strip('"«»')
        bt = re.search(r'ТИП ФИГУРЫ:\s*(.+)', block)
        if bt:
            result["body_type"] = bt.group(1).strip().strip('"«»')
    return result


def clean_analysis_text(text: str) -> str:
    """Убирает структурированный блок данных из текста, чтобы пользователь его не видел."""
    return re.sub(r'---ДАННЫЕ---.*?---КОНЕЦ ДАННЫХ---', '', text, flags=re.DOTALL).strip()


# --- 5. ЛОГИКА ПОИСКА WB (Бронебойная) ---

def get_wb_image_url(nm_id: int):
    vol = nm_id // 100000
    part = nm_id // 1000

    if 0 <= vol <= 143:
        basket = "01"
    elif 144 <= vol <= 287:
        basket = "02"
    elif 288 <= vol <= 431:
        basket = "03"
    elif 432 <= vol <= 719:
        basket = "04"
    elif 720 <= vol <= 1007:
        basket = "05"
    elif 1008 <= vol <= 1061:
        basket = "06"
    elif 1062 <= vol <= 1115:
        basket = "07"
    elif 1116 <= vol <= 1169:
        basket = "08"
    elif 1170 <= vol <= 1313:
        basket = "09"
    elif 1314 <= vol <= 1601:
        basket = "10"
    elif 1602 <= vol <= 1655:
        basket = "11"
    elif 1656 <= vol <= 1919:
        basket = "12"
    elif 1920 <= vol <= 2045:
        basket = "13"
    else:
        basket = "14"

    return f"https://basket-{basket}.wbbasket.ru/vol{vol}/part{part}/{nm_id}/images/big/1.webp"


def search_wb_api(query: str):
    try:
        time.sleep(random.uniform(0.5, 1.0))
        url = "https://search.wb.ru/exactmatch/ru/common/v5/search"
        params = {
            "appType": 1, "curr": "rub", "dest": -1257786, "query": query,
            "resultset": "catalog", "sort": "popular", "spp": 30
        }
        headers = {"User-Agent": "Mozilla/5.0"}
        response = requests.get(url, params=params, headers=headers, timeout=5)
        if response.status_code == 200:
            data = response.json()
            products = data.get('data', {}).get('products', [])
            if products:
                p = products[0]
                nm_id = p.get('id')
                name = f"{p.get('brand', '')} / {p.get('name', '')}"
                return name, f"https://www.wildberries.ru/catalog/{nm_id}/detail.aspx", get_wb_image_url(nm_id)
    except Exception as e:
        print(f"⚠️ Ошибка API WB: {e}")
    return None, None, None


def search_wb_text_fallback(query: str):
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(f"site:wildberries.ru/catalog {query}", region='ru-ru', max_results=5))
            for res in results:
                match = re.search(r"catalog/(\d+)/detail", res['href'])
                if match:
                    nm_id = int(match.group(1))
                    title = res['title'].split("-")[0].strip()
                    return title, f"https://www.wildberries.ru/catalog/{nm_id}/detail.aspx", get_wb_image_url(nm_id)
    except Exception as e:
        print(f"⚠️ Ошибка DDGS: {e}")
    return None, None, None


# --- 5. ЭНДПОИНТЫ API ---

@app.post("/api/v1/auth/register", summary="Регистрация пользователя")
def register_user(user: UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Этот логин уже занят")

    hashed_password = pwd_context.hash(user.password)

    new_user = models.User(
        username=user.username,
        name=user.name,
        hashed_password=hashed_password
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {"message": "Успешная регистрация!", "user_id": new_user.id}


@app.post("/api/v1/auth/login", summary="Вход")
def login_user(user: UserLogin, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.username == user.username).first()

    if not db_user or not pwd_context.verify(user.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")

    return {"message": "Успешный вход", "user_id": db_user.id, "username": db_user.username, "name": db_user.name}


@app.get("/api/v1/users/{user_id}", summary="Получить данные Личного кабинета")
def get_user_profile(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    return {
        "name": user.name,
        "username": user.username,
        "hair_color": user.hair_color,
        "eye_color": user.eye_color,
        "skin_tone": user.skin_tone,
        "undertone": user.undertone,
        "height": user.height,
        "weight": user.weight,
        "chest": user.chest,
        "waist": user.waist,
        "hips": user.hips,
        "body_type": user.body_type,
        "color_type": user.color_type,
        "contrast": user.contrast,
        "birthday": user.birthday,
    }


@app.put("/api/v1/users/{user_id}", summary="Обновить профиль пользователя")
def update_user_profile(user_id: int, data: dict, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    allowed_fields = ["hair_color", "eye_color", "skin_tone", "undertone",
                      "height", "weight", "chest", "waist", "hips",
                      "body_type", "color_type", "contrast", "name", "birthday"]
    for key, value in data.items():
        if key in allowed_fields and value is not None:
            setattr(user, key, value)

    db.commit()
    db.refresh(user)
    return {"message": "Профиль обновлён"}


@app.post("/api/v1/style", response_model=AnalysisResponse, summary="1. Анализ фигуры и стиля (с поддержкой ФОТО)")
async def analyze_style(
        name: str = Form(..., description="Имя"),
        hair_color: str = Form(..., description="Цвет волос"),
        eye_color: str = Form(..., description="Цвет глаз"),
        skin_tone: str = Form(..., description="Цвет кожи"),
        undertone: str = Form(..., description="Подтон (теплый/холодный)"),
        height: float = Form(..., description="Рост см"),
        weight: float = Form(..., description="Вес кг"),
        chest: float = Form(..., description="Грудь см"),
        waist: float = Form(..., description="Талия см"),
        hips: float = Form(..., description="Бедра см"),
        style_categories: str = Form(..., description="Стили (Кэжуал, Гранж...)"),
        event_goal: str = Form(..., description="Цель (Корпоратив...)"),
        feeling_goal: str = Form(..., description="Ощущение (Уверенно...)"),
        requirements: str = Form(None, description="Доп. требования"),
        budget: str = Form("Средний", description="Бюджет"),
        photo: UploadFile = File(None)
):
    user_profile = f"""
    Вводные данные (анкета пользователя):
    Имя: {name}
    Цель: {event_goal}
    Индивидуальность: Волосы {hair_color}, Глаза {eye_color}, Кожа {skin_tone}, Подтон {undertone}.
    Параметры: Рост {height}, Грудь {chest}, Талия {waist}, Бедра {hips}. Вес {weight} кг.
    Стиль: {style_categories}
    Ожидания: {feeling_goal}
    Требования: {requirements if requirements else "Нет"}
    Бюджет: {budget}
    """

    print(f"🧠 Анализируем стиль для {name}...")

    user_message_content: List[dict] = [
        {"type": "text", "text": user_profile}
    ]

    if photo:
        print(f"📸 Обрабатываем фото: {photo.filename}")
        image_bytes = await photo.read()
        base64_encoded = base64.b64encode(image_bytes).decode('utf-8')
        mime_type = photo.content_type or "image/jpeg"

        user_message_content.append({
            "type": "image_url",
            "image_url": {
                "url": f"data:{mime_type};base64,{base64_encoded}"
            }
        })
        user_message_content[0][
            "text"] += "\n\nПользователь прикрепил свое фото. Пожалуйста, проанализируй его внешность, цветотип и фигуру по фото, и сравни с тем, что он указал в анкете."

    completion = client.chat.completions.create(
        model=AI_MODEL,
        messages=[
            {"role": "system", "content": STYLIST_SYSTEM_PROMPT},
            {"role": "user", "content": user_message_content}
        ],
        temperature=0.4
    )

    raw_text = completion.choices[0].message.content
    structured = parse_structured_block(raw_text)
    clean_text = clean_analysis_text(raw_text)

    return {
        "analysis_text": clean_text,
        "color_type": structured["color_type"],
        "body_type": structured["body_type"],
        "contrast": structured["contrast"]
    }


@app.post("/api/v1/capsules", response_model=CapsuleResult, summary="2. Генерация текста капсулы + Картинка")
def generate_capsule(request: CapsuleGenerationRequest):
    prompt = f"""
    АНАЛИЗ ВНЕШНОСТИ И ПАРАМЕТРЫ КЛИЕНТА:
    {request.analysis_text}

    ЦЕЛЬ / ОБРАЗ ЖИЗНИ: {request.event_goal}
    БЮДЖЕТ: {request.budget}
    """

    print("📝 Пишем советы и собираем вещи для капсулы...")
    completion = client.chat.completions.create(
        model=AI_MODEL,
        messages=[
            {"role": "system", "content": CAPSULE_GENERATION_SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ],
        temperature=0.7
    )

    capsule_text = completion.choices[0].message.content

    print("🎨 Рисуем картинку-коллаж (пока стоит ЗАГЛУШКА)...")
    placeholder_image_url = "https://images.unsplash.com/photo-1550614000-4b95d4edeb8b?q=80&w=800&auto=format&fit=crop"

    return {
        "capsule_text": capsule_text,
        "image_url": placeholder_image_url
    }


@app.post("/api/v1/link", response_model=ProductLinkResult, summary="3. Поиск товара")
def find_wb_link(query: str):
    print(f"🔎 Ищем вещь: {query}")
    clean_query = query.replace("купить", "").strip()

    title, link, img = search_wb_api(clean_query)

    if not link:
        title, link, img = search_wb_text_fallback(clean_query)

    if not link:
        encoded = urllib.parse.quote(clean_query)
        link = f"https://www.wildberries.ru/catalog/0/search.aspx?search={encoded}"
        title = f"Поиск: {clean_query}"
        img = ""

    return {"title": title or "Товар", "image_url": img or "", "shop_link": link}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)