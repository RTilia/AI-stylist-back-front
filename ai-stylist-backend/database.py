from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Указываем, что база будет лежать в файле sql_app.db прямо в папке проекта
SQLALCHEMY_DATABASE_URL = "sqlite:///./sql_app.db"

# Создаем "движок" базы данных
# check_same_thread=False нужен только для SQLite, чтобы FastAPI работал с ней быстро
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

# Создаем фабрику сессий (каждый запрос к серверу будет открывать свою сессию)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Создаем базовый класс, от которого будем наследовать все наши таблицы
Base = declarative_base()

# Зависимость для FastAPI (чтобы безопасно открывать и закрывать БД при каждом запросе)
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()