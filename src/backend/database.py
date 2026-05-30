from sqlmodel import SQLModel, Session, create_engine
from typing import Generator, Optional

from backend.settings import get_settings


class DatabaseManager:
    """Singleton database manager for the application."""

    _instance: Optional['DatabaseManager'] = None
    _engine = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if self._engine is None:
            self._initialize_engine()

    def _initialize_engine(self):
        settings = get_settings()
        self._engine = create_engine(settings.database_url)

    @property
    def engine(self):
        """Get the database engine."""
        return self._engine

    def create_db_and_tables(self):
        """Create database and tables if they don't exist."""
        SQLModel.metadata.create_all(self._engine)

    def get_session(self) -> Generator[Session, None, None]:
        """Get a database session."""
        with Session(self._engine) as session:
            yield session


# Global instance
db_manager = DatabaseManager()

# Backwards compatibility
engine = db_manager.engine


def create_db_and_tables():
    """Create database and tables if they don't exist."""
    return db_manager.create_db_and_tables()


def get_session() -> Generator[Session, None, None]:
    """Get a database session."""
    yield from db_manager.get_session()