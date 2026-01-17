"""
Alembic environment configuration - SYNC mode for migrations.
"""

from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context

# Import Base FIRST
from app.database import Base

# Import ALL models to ensure they're registered with Base.metadata
from app.models.user import User
from app.models.image import Image
from app.models.face import Face, UserFaceReference

# Load settings AFTER models
from app.config import settings

# this is the Alembic Config object
config = context.config

# Override sqlalchemy.url - use sync driver (psycopg2)
# For local: use localhost:5433
# For Docker: use livehub-db:5432
db_url = settings.DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://").replace("+asyncpg", "")
config.set_main_option("sqlalchemy.url", db_url)

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Add your model's MetaData object here for 'autogenerate' support
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, 
            target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
