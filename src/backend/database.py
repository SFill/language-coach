from sqlmodel import SQLModel, Session, create_engine
from typing import Generator

# Database configuration
sqlite_file_name = "database.db"
sqlite_url = f"sqlite:///{sqlite_file_name}"
connect_args = {"check_same_thread": False}

# Create engine
engine = create_engine(sqlite_url, connect_args=connect_args)

def create_db_and_tables():
    """Create database and tables if they don't exist."""
    SQLModel.metadata.create_all(engine)

def get_session() -> Generator[Session, None, None]:
    """Get a database session."""
    with Session(engine) as session:
        yield session