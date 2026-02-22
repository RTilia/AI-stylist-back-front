from sqlalchemy import Column, Integer, String, Float
from database import Base


class User(Base):
    __tablename__ = "users"

    # Основные данные профиля
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)  # Логин (например, @nadya05)
    name = Column(String)  # Имя (Надежда Смирнова)
    hashed_password = Column(String)  # <--- НОВОЕ ПОЛЕ ДЛЯ ПАРОЛЯ
    birthday = Column(String, nullable=True)  # Дата рождения

    # Индивидуальность (заполняется из анкеты)
    hair_color = Column(String, nullable=True)
    eye_color = Column(String, nullable=True)
    skin_tone = Column(String, nullable=True)
    undertone = Column(String, nullable=True)

    # Характеристики (параметры тела)
    height = Column(Float, nullable=True)
    weight = Column(Float, nullable=True)
    chest = Column(Float, nullable=True)
    waist = Column(Float, nullable=True)
    hips = Column(Float, nullable=True)

    # Результаты работы ИИ-стилиста (САМОЕ ВАЖНОЕ ДЛЯ ПРОФИЛЯ)
    body_type = Column(String, nullable=True)  # Например: "Песочные часы"
    color_type = Column(String, nullable=True)  # Например: "Холодное лето"
    contrast = Column(String, nullable=True)  # Например: "Высокая"