import os
from sqlmodel import SQLModel, Session, create_engine
from typing import Generator, Optional

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
        """Initialize the database engine."""
        # PostgreSQL configuration
        POSTGRES_HOST = os.environ.get("POSTGRES_HOST", "localhost")
        POSTGRES_PORT = os.environ.get("POSTGRES_PORT", "5432")
        POSTGRES_DB = os.environ.get("POSTGRES_DB", "language_coach")
        POSTGRES_USER = os.environ.get("POSTGRES_USER", "language_coach_user")
        POSTGRES_PASSWORD = os.environ.get("POSTGRES_PASSWORD", "language_coach_password")

        database_url = (
            f"postgresql://{POSTGRES_USER}:{POSTGRES_PASSWORD}"
            f"@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
        )

        self._engine = create_engine(database_url)
    
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